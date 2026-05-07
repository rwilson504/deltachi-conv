# Roster Setup — Google Form → Private Sheet → Site (with your approval)

This is the workflow for the **Roster** section of the site. Brothers self-submit via a Google Form, the data lands in a **private** Google Sheet only you can see, and only rows you mark `Approved = Y` are pushed to the public site.

```
Brother fills Google Form
        ↓
Submission → private Sheet "Form Responses 1"
        ↓
🤖 Apps Script auto-copies into "Attendees" tab (Approved blank, highlighted amber)
        ↓
You type Y or N in the Approved cell
        ↓
Apps Script trigger pushes data/roster.json to GitHub
        ↓
GitHub Pages rebuilds → site updates in ~30 sec
```

**Your job day-to-day = type one letter per submission.** That's it.

---

## One-time setup (~15 min)

### Step 1 — Create the Google Form

1. Go to https://forms.google.com and create a new blank form.
2. Title: "Delta Chi Convention 2026 — Attendee Submission"
3. Add these fields (mark required as noted):
   - **Name** (short answer, required)
   - **Chapter** (short answer, required, "e.g. Kent State '08")
   - **Email** (short answer, required) — *stays private, never published*
   - **Phone** (short answer, optional) — *stays private*
   - **Arrival day** (multiple choice: Wed / Thu / Fri / Sat)
   - **Departure day** (multiple choice: Fri / Sat / Sun / Mon)
   - **Need a roommate?** (multiple choice: Yes / No / Already have one)
   - **Notes / anything else** (paragraph, optional)
4. Settings → Responses → toggle **"Get email notifications for new responses"** ON.
5. Click **Send** → Link tab → copy the form URL. You'll need this in Step 5.

### Step 2 — Create the master Sheet

1. In the Form, click the **Responses** tab → click the green Sheets icon → "Create new spreadsheet".
2. The Sheet that opens has a tab called "Form Responses 1" — leave that alone, it's where new submissions land.
3. Add **two more tabs** (right-click any tab → Duplicate or Insert):
   - Rename one to **`Attendees`**
   - Rename one to **`Rooms`**
4. Set up the `Attendees` tab with these column headers in row 1 (left to right):
   ```
   Name | Chapter | Email | Phone | Arrival | Departure | Needs Roommate | Notes | Approved
   ```
   *(Email and Phone are private — they're collected here for your reference but **never** published to the site.)*
5. Set up the `Rooms` tab with these headers:
   ```
   Room | Occupants | Booked | Notes | Approved
   ```
6. **Sharing:** click Share (top right) → make sure it's "Restricted — only you" (the default). Do NOT make it public or "anyone with the link."

### Step 3 — Install the Apps Script

1. In the Sheet: **Extensions → Apps Script**. A new tab opens.
2. Delete the placeholder `function myFunction() {}`.
3. Copy the entire contents of [`apps-script/Code.gs`](./Code.gs) from this repo and paste it in.
4. Click the 💾 save icon. Name the project "Delta Chi Site Bridge" or whatever.

### Step 4 — Create a GitHub token for the Script

1. Go to https://github.com/settings/personal-access-tokens/new
2. Settings:
   - **Token name:** `deltachi-conv-roster-bridge`
   - **Expiration:** 1 year (or "No expiration" if you don't mind)
   - **Resource owner:** rwilson504
   - **Repository access:** "Only select repositories" → choose `rwilson504/deltachi-conv`
   - **Permissions → Repository permissions:**
     - **Contents:** Read and write *(this is the only one you need)*
3. Click **Generate token**. Copy the token immediately (starts with `github_pat_...`). Save it somewhere temporarily.

### Step 5 — Wire the token + form URL into Apps Script

1. Back in Apps Script: click the ⚙️ Project Settings icon (left sidebar).
2. Scroll to **Script Properties** → click **Add script property**.
3. Add these two:
   - Property: `GITHUB_TOKEN` → Value: paste the token from Step 4
   - Property: `SUBMIT_FORM_URL` → Value: paste the form link from Step 1 (the long `forms.gle/...` or `forms.google.com/...` URL)
4. Save.

### Step 6 — Run the setup function once

1. Back in the Apps Script editor.
2. In the function dropdown at the top, pick **`setupTriggers`**.
3. Click ▶ **Run**.
4. Google will pop up an authorization dialog — click "Review permissions" → pick your Google account → "Advanced" → "Go to Delta Chi Site Bridge (unsafe)" *(Google warns because it's an unverified personal script — this is fine for personal scripts you wrote yourself)* → "Allow".
5. After ~5 seconds you should see "Trigger installed" + "Pushed roster.json" in the execution log.
6. Refresh the site — the "Submit your info" button should now point at your form.

✅ **You're done.** Test it by:
- Filling out your own form once.
- Watch a new row appear in the **Attendees** tab automatically (with an amber Approved cell).
- Type `Y` in that Approved cell.
- Within ~30 sec the site shows your name in the Roster section.

---

## Daily use

When you get an email about a new submission:

1. Open the Sheet → **Attendees** tab.
2. The new submission is already there at the bottom — the **Approved** cell is highlighted amber.
3. Type `Y` to publish it, or `N` (or anything else) to hide it.
4. Site updates within ~30 sec.

That's the whole workflow. The amber highlight clears the moment you type — so the only amber cells in the sheet are submissions still awaiting your call.

To **un-approve** someone later: change their Approved cell to `N`. They disappear from the site within 30 sec.

To **edit** a published entry: just change the cell. The publisher only fires on Approved-column edits, so to push edits to other columns either toggle Approved off-and-on, or run `manualPublish` from the Apps Script editor.

---

## What's published vs what's private

**NEVER published to the site, no matter what:**
- Any column whose name contains: `email`, `phone`, `private`, `reviewer`, `timestamp`
- The Form Responses 1 tab in its entirety
- Any row where Approved is not `Y` / `Yes` / `True` / `1` / `✓`

**Published when Approved = Y:**
- All other columns from the Attendees / Rooms tabs

This is enforced server-side by the Apps Script — there's no way for someone to scrape private info from the public site, because the private fields are stripped out at the source before being pushed to GitHub.

## Adding new form questions later

If you add a new question to the Google Form, you also need to:
1. Add a matching column to the **Attendees** tab (left of the Approved column).
2. Add a row to the `FORM_TO_ATTENDEE_MAP` array near the top of `Code.gs` so the auto-copy knows where to put the answer. The `formContains` field is a case-insensitive substring of the form question text.

If you skip step 2, new submissions will still be auto-copied but the new field will be blank.

---

## Troubleshooting

**"GITHUB_TOKEN script property not set"** → Step 5 wasn't completed.

**"GitHub PUT failed: 403"** → Token doesn't have write access to the repo, or it was revoked. Recreate the token (Step 4) with the correct repo + Contents:write permission.

**"GitHub PUT failed: 404"** → Token's repository access doesn't include `deltachi-conv`. Edit the token, add the repo.

**Edits don't auto-publish** → Run `setupTriggers` again. Or run `manualPublish` after each edit batch.

**Need to change which fields are private** → Edit the `PRIVATE_COLS` array at the top of `Code.gs` and re-paste.

**Want to move sheet to a new GitHub repo** → Edit `REPO_OWNER` / `REPO_NAME` / `FILE_PATH` constants at the top of `Code.gs`.
