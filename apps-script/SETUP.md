# Roster Setup — Google Form → Private Sheet → Site (with your approval)

This is the workflow for the **Roster** section of the site. Brothers self-submit via a Google Form, the data lands in a **private** Google Sheet only you can see, and only rows you mark `Approved = Y` are pushed to the public site.

```
Brother fills Google Form
        ↓
Submission → private Sheet "Form Responses 1"
        ↓
You copy/move the row into the "Attendees" or "Rooms" tab
        ↓
You set the row's Approved column to Y
        ↓
Apps Script trigger pushes data/roster.json to GitHub
        ↓
GitHub Pages rebuilds → site updates in ~30 sec
```

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
   Name | Chapter | Arrival | Departure | Needs Roommate | Notes | Approved
   ```
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
- Copy the submitted row from "Form Responses 1" into the `Attendees` tab.
- Set the Approved column to `Y`.
- Within ~30 sec the site should show your name in the Roster section.

---

## Daily use

When you get an email about a new submission:

1. Open the Sheet → **Form Responses 1** tab → look at the new row.
2. **If you want to publish:** copy the relevant fields (Name, Chapter, Arrival, etc.) to a new row in the **Attendees** tab. Set the **Approved** cell to `Y`.
3. **If you want to deny:** do nothing, or move the row to a hidden "Denied" tab if you want a paper trail.
4. The site auto-updates within 30 sec of the edit (Apps Script trigger fires).

To **un-approve** someone later: change their Approved cell to `N` (or blank). They disappear from the site on next edit.

To **edit** a published entry: just change the cell in the Attendees tab. The edit trigger fires on any edit to the Approved column; for edits to other columns, run `manualPublish` from the Apps Script editor (or just toggle Approved off and back on).

---

## What's published vs what's private

**NEVER published to the site, no matter what:**
- Any column whose name contains: `email`, `phone`, `private`, `notes (private)`, `reviewer`
- The Form Responses 1 tab in its entirety
- Any row where Approved is not `Y` / `Yes` / `True` / `1` / `✓`

**Published when Approved = Y:**
- All other columns from the Attendees / Rooms tabs

This is enforced server-side by the Apps Script — there's no way for someone to scrape private info from the public site, because the private fields are stripped out at the source before being pushed to GitHub.

---

## Troubleshooting

**"GITHUB_TOKEN script property not set"** → Step 5 wasn't completed.

**"GitHub PUT failed: 403"** → Token doesn't have write access to the repo, or it was revoked. Recreate the token (Step 4) with the correct repo + Contents:write permission.

**"GitHub PUT failed: 404"** → Token's repository access doesn't include `deltachi-conv`. Edit the token, add the repo.

**Edits don't auto-publish** → Run `setupTriggers` again. Or run `manualPublish` after each edit batch.

**Need to change which fields are private** → Edit the `PRIVATE_COLS` array at the top of `Code.gs` and re-paste.

**Want to move sheet to a new GitHub repo** → Edit `REPO_OWNER` / `REPO_NAME` / `FILE_PATH` constants at the top of `Code.gs`.
