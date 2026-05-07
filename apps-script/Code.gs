/**
 * Delta Chi Convention site — Sheet → GitHub bridge
 * ===================================================
 * Pushes APPROVED rows from this Google Sheet to:
 *   https://github.com/rwilson504/deltachi-conv/blob/main/data/roster.json
 *
 * Architecture:
 *   Form submission → onFormSubmit copies row into Attendees tab (Approved blank)
 *   You set Approved = Y/N → onSheetEdit publishes to GitHub
 *
 * Setup: see apps-script/SETUP.md
 */

const REPO_OWNER = 'rwilson504';
const REPO_NAME  = 'deltachi-conv';
const FILE_PATH  = 'data/roster.json';
const BRANCH     = 'main';

// Column names that should NEVER make it into the public JSON.
// Match is case-insensitive substring.
const PRIVATE_COLS = ['email', 'phone', 'private', 'reviewer', 'timestamp'];

const APPROVAL_COL = 'Approved';
const APPROVED_VALUES = new Set(['Y', 'YES', 'TRUE', '1', '✓', 'X']);

const ATTENDEES_SHEET_NAME = 'Attendees';
const ROOMS_SHEET_NAME = 'Rooms';

const ATTENDEES_HEADERS = ['Name', 'Chapter', 'Email', 'Phone', 'Arrival', 'Departure', 'Needs Roommate', 'Notes', 'Approved'];
const ROOMS_HEADERS = ['Room', 'Occupants', 'Booked', 'Notes', 'Approved'];

// Returns the named sheet, creating it with default headers if it doesn't exist.
function ensureSheet(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (sh) return sh;
  sh = ss.insertSheet(name);
  sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#f3f4f6');
  sh.setFrozenRows(1);
  // Find Approved column and add a quick data validation hint
  const approvedIdx = headers.findIndex(h => h.toLowerCase() === APPROVAL_COL.toLowerCase());
  if (approvedIdx >= 0) {
    sh.getRange(2, approvedIdx + 1, 1000, 1).setHorizontalAlignment('center');
  }
  Logger.log('Created missing tab "' + name + '" with headers: ' + headers.join(', '));
  return sh;
}

// ============================================================================
// FORM SUBMIT → auto-copy into Attendees tab
// ============================================================================

/**
 * Maps a form question (left) to an Attendees-tab column (right).
 * Match is case-insensitive substring on the form question text.
 * Anything not listed is silently dropped from the auto-copy.
 * Add/edit rows here if you change form questions.
 */
const FORM_TO_ATTENDEE_MAP = [
  { formContains: 'name',       attendeeCol: 'Name' },
  { formContains: 'chapter',    attendeeCol: 'Chapter' },
  { formContains: 'email',      attendeeCol: 'Email' },        // private, never published
  { formContains: 'phone',      attendeeCol: 'Phone' },        // private, never published
  { formContains: 'arrival',    attendeeCol: 'Arrival' },
  { formContains: 'departure',  attendeeCol: 'Departure' },
  { formContains: 'roommate',   attendeeCol: 'Needs Roommate' },
  { formContains: 'notes',      attendeeCol: 'Notes' },
  { formContains: 'anything',   attendeeCol: 'Notes' },        // alt label for Notes
];

function onFormSubmit(e) {
  const ss = SpreadsheetApp.getActive();
  const attendees = ensureSheet(ss, ATTENDEES_SHEET_NAME, ATTENDEES_HEADERS);
  const headers = attendees.getRange(1, 1, 1, Math.max(attendees.getLastColumn(), 1)).getValues()[0]
    .map(h => String(h).trim());

  // e.namedValues = { 'Question text': ['answer'], ... }
  const namedValues = (e && e.namedValues) || {};

  // Build the new row by walking Attendees columns in order
  const newRow = headers.map(col => {
    if (col.toLowerCase() === APPROVAL_COL.toLowerCase()) return ''; // leave blank for review
    // Find a form question that maps to this column
    for (const mapping of FORM_TO_ATTENDEE_MAP) {
      if (mapping.attendeeCol.toLowerCase() !== col.toLowerCase()) continue;
      // Find a form question whose text contains the trigger phrase
      const matchingQuestion = Object.keys(namedValues).find(q =>
        q.toLowerCase().includes(mapping.formContains.toLowerCase())
      );
      if (matchingQuestion) {
        const v = namedValues[matchingQuestion];
        return Array.isArray(v) ? v.join(', ') : String(v || '');
      }
    }
    return '';
  });

  attendees.appendRow(newRow);
  // Highlight the new row's Approved cell so it's obvious what to do next
  const approvedColIdx = headers.findIndex(h => h.toLowerCase() === APPROVAL_COL.toLowerCase());
  if (approvedColIdx >= 0) {
    const lastRow = attendees.getLastRow();
    attendees.getRange(lastRow, approvedColIdx + 1).setBackground('#fef3c7'); // amber pending
  }
  Logger.log('Auto-copied form submission into Attendees row ' + attendees.getLastRow());
}

// ============================================================================
// TRIGGERS
// ============================================================================

function setupTriggers() {
  // Wipe any existing triggers we created before
  ScriptApp.getProjectTriggers().forEach(t => {
    const fn = t.getHandlerFunction();
    if (fn === 'onSheetEdit' || fn === 'onFormSubmit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onSheetEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  ScriptApp.newTrigger('onFormSubmit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onFormSubmit()
    .create();
  Logger.log('Triggers installed: onSheetEdit (publish on approval) + onFormSubmit (auto-copy submissions).');
  publishNow();
}

function onSheetEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  if (sheetName !== ATTENDEES_SHEET_NAME && sheetName !== ROOMS_SHEET_NAME) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const approvedCol = headers.findIndex(h => String(h).trim().toLowerCase() === APPROVAL_COL.toLowerCase()) + 1;
  if (approvedCol === 0) return;
  if (e.range.getColumn() !== approvedCol) return;
  // Clear the amber highlight once decided
  e.range.setBackground(null);
  publishNow();
}

function publishNow() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKEN script property not set. See setup instructions in the file header.');

  const submitFormUrl = props.getProperty('SUBMIT_FORM_URL') || '';
  const attendees = readApproved(ensureSheet(ss, ATTENDEES_SHEET_NAME, ATTENDEES_HEADERS));
  const rooms     = readApproved(ensureSheet(ss, ROOMS_SHEET_NAME, ROOMS_HEADERS));

  const payload = {
    _comment: 'Auto-managed by the Sheet → GitHub Apps Script bridge. Do not hand-edit.',
    updated_at: new Date().toISOString(),
    submit_form_url: submitFormUrl,
    attendees: attendees,
    rooms: rooms,
  };

  const newContent = JSON.stringify(payload, null, 2);
  pushToGithub(token, newContent);
}

function readApproved(sheet) {
  if (!sheet) return [];
  const last = sheet.getLastRow();
  if (last < 2) return [];
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim());
  const data = sheet.getRange(2, 1, last - 1, headers.length).getValues();

  const approvedColIdx = headers.findIndex(h => h.toLowerCase() === APPROVAL_COL.toLowerCase());
  if (approvedColIdx < 0) return [];

  // Decide which columns to include (skip private + approval itself)
  const publicColIdxs = headers
    .map((h, i) => ({ h, i }))
    .filter(({ h, i }) => {
      if (i === approvedColIdx) return false;
      const low = h.toLowerCase();
      if (PRIVATE_COLS.some(p => low.includes(p))) return false;
      if (h === '') return false;
      return true;
    });

  const out = [];
  data.forEach(row => {
    const approval = String(row[approvedColIdx] || '').trim().toUpperCase();
    if (!APPROVED_VALUES.has(approval)) return;
    const obj = {};
    publicColIdxs.forEach(({ h, i }) => {
      const val = row[i];
      if (val instanceof Date) obj[h] = Utilities.formatDate(val, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      else obj[h] = String(val == null ? '' : val);
    });
    out.push(obj);
  });
  return out;
}

function pushToGithub(token, newContent) {
  const apiBase = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`;
  const headers = {
    Authorization: 'Bearer ' + token,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Get current SHA (required to update existing file)
  let sha = null;
  const getRes = UrlFetchApp.fetch(apiBase + '?ref=' + BRANCH, { headers, muteHttpExceptions: true });
  if (getRes.getResponseCode() === 200) {
    sha = JSON.parse(getRes.getContentText()).sha;
  } else if (getRes.getResponseCode() !== 404) {
    throw new Error('GitHub GET failed: ' + getRes.getResponseCode() + ' ' + getRes.getContentText());
  }

  // Skip if content hasn't changed
  if (sha) {
    const existing = JSON.parse(getRes.getContentText());
    const currentBytes = Utilities.base64Decode(existing.content.replace(/\n/g, ''));
    const currentText = Utilities.newBlob(currentBytes).getDataAsString();
    // Compare ignoring updated_at field
    try {
      const a = JSON.parse(currentText), b = JSON.parse(newContent);
      delete a.updated_at; delete b.updated_at;
      if (JSON.stringify(a) === JSON.stringify(b)) {
        Logger.log('No content change — skipping push.');
        return;
      }
    } catch (e) { /* fall through to push */ }
  }

  const body = {
    message: 'roster: publish approved entries (' + new Date().toISOString() + ')',
    content: Utilities.base64Encode(newContent),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;

  const putRes = UrlFetchApp.fetch(apiBase, {
    method: 'put',
    headers,
    contentType: 'application/json',
    payload: JSON.stringify(body),
    muteHttpExceptions: true,
  });
  const code = putRes.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('GitHub PUT failed: ' + code + ' ' + putRes.getContentText());
  }
  Logger.log('Pushed roster.json — commit ' + JSON.parse(putRes.getContentText()).commit.sha.slice(0, 7));
}

function setSubmitFormUrl() {
  // EDIT this URL once, then run this function.
  const url = 'https://docs.google.com/forms/d/e/PASTE_YOUR_FORM_URL_HERE/viewform';
  PropertiesService.getScriptProperties().setProperty('SUBMIT_FORM_URL', url);
  publishNow();
  Logger.log('Submit form URL set to: ' + url);
}

// Manually publish without an edit trigger, for first-run / testing
function manualPublish() { publishNow(); }

// Re-import every existing form response into Attendees (idempotent: appends new rows;
// won't dedupe — don't run twice unless you want duplicates).
function backfillFormResponses() {
  const ss = SpreadsheetApp.getActive();
  const responses = ss.getSheetByName('Form Responses 1');
  if (!responses || responses.getLastRow() < 2) { Logger.log('No form responses to backfill.'); return; }
  const headers = responses.getRange(1, 1, 1, responses.getLastColumn()).getValues()[0];
  const data = responses.getRange(2, 1, responses.getLastRow() - 1, responses.getLastColumn()).getValues();
  data.forEach(row => {
    const namedValues = {};
    headers.forEach((h, i) => { namedValues[String(h)] = [row[i]]; });
    onFormSubmit({ namedValues });
  });
  Logger.log('Backfilled ' + data.length + ' form responses into Attendees.');
}
