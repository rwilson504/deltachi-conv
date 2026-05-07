/**
 * Delta Chi Convention site — Sheet → GitHub bridge
 * ===================================================
 * Pushes APPROVED rows from this Google Sheet to:
 *   https://github.com/rwilson504/deltachi-conv/blob/main/data/roster.json
 *
 * Setup (one-time):
 * -----------------
 * 1. In this Sheet: Extensions → Apps Script.
 *    Paste this entire file in. Save.
 *
 * 2. Create a GitHub fine-grained Personal Access Token:
 *    https://github.com/settings/personal-access-tokens/new
 *    - Resource owner: rwilson504
 *    - Repository access: "Only select repositories" → choose `deltachi-conv`
 *    - Permissions → Repository → Contents: Read and write
 *    - Generate, copy the token (starts with github_pat_...)
 *
 * 3. In Apps Script: Project Settings (gear icon) → Script Properties → Add Property:
 *      key:   GITHUB_TOKEN
 *      value: github_pat_xxxxxxxx (paste the full token)
 *
 * 4. Back in the script editor: pick the function `setupTriggers` from the dropdown,
 *    click ▶ Run. First run will ask for permissions — approve.
 *    This creates an onEdit trigger that publishes whenever you change the Approved column.
 *
 * 5. Optionally, set the public submit form URL once:
 *    pick `setSubmitFormUrl` from dropdown, edit the URL inside the function, run once.
 *
 * Daily use:
 * ----------
 * - Form submissions land in the "Form Responses 1" sheet automatically.
 * - You add an "Approved" column to that sheet (or rename to "Attendees" — see below).
 * - Set a row's Approved cell to Y to publish it; set to N (or anything else) to hide.
 * - Site updates within ~30 sec of GitHub Pages rebuild.
 *
 * Sheet structure expected:
 * -------------------------
 * Tab 1: "Attendees"
 *   Required columns (in any order): Name, Chapter, Approved
 *   Optional columns (auto-rendered): Arrival, Departure, "Needs Roommate", Notes, etc.
 *   ANY column whose name contains "email" or "phone" is treated as PRIVATE
 *   and NEVER published. Safe to collect freely on the form.
 *
 * Tab 2: "Rooms"
 *   Required columns: Room, Occupants, Approved
 *   Optional: Booked, Notes
 */

const REPO_OWNER = 'rwilson504';
const REPO_NAME  = 'deltachi-conv';
const FILE_PATH  = 'data/roster.json';
const BRANCH     = 'main';

// Column names in the sheet that should NEVER make it into the public JSON.
// Match is case-insensitive substring.
const PRIVATE_COLS = ['email', 'phone', 'private', 'notes (private)', 'reviewer'];

// The single "approve" column that gates publishing
const APPROVAL_COL = 'Approved';
const APPROVED_VALUES = new Set(['Y', 'YES', 'TRUE', '1', '✓', 'X']);

const ATTENDEES_SHEET_NAME = 'Attendees';
const ROOMS_SHEET_NAME = 'Rooms';

// ============================================================================

function setupTriggers() {
  // Wipe any existing triggers we created before
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'onSheetEdit') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('onSheetEdit')
    .forSpreadsheet(SpreadsheetApp.getActive())
    .onEdit()
    .create();
  Logger.log('Trigger installed. The site will auto-publish on edits to the Approved column.');
  publishNow(); // do an initial publish so the site has data
}

function onSheetEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  const sheetName = sheet.getName();
  if (sheetName !== ATTENDEES_SHEET_NAME && sheetName !== ROOMS_SHEET_NAME) return;
  // Only react if the edit is in the Approved column
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const approvedCol = headers.findIndex(h => String(h).trim().toLowerCase() === APPROVAL_COL.toLowerCase()) + 1;
  if (approvedCol === 0) return;
  if (e.range.getColumn() !== approvedCol) return;
  publishNow();
}

function publishNow() {
  const ss = SpreadsheetApp.getActive();
  const props = PropertiesService.getScriptProperties();
  const token = props.getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKEN script property not set. See setup instructions in the file header.');

  const submitFormUrl = props.getProperty('SUBMIT_FORM_URL') || '';
  const attendees = readApproved(ss.getSheetByName(ATTENDEES_SHEET_NAME));
  const rooms     = readApproved(ss.getSheetByName(ROOMS_SHEET_NAME));

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
