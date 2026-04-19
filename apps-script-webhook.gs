/**
 * Passaic Debris Tracker — Google Sheets Webhook Backend
 * --------------------------------------------------------
 * Paste this entire file into a Google Apps Script project
 * attached to a Google Sheet. When deployed as a Web App,
 * it gives the Passaic Debris Tracker site a shared backend
 * so every rower sees the same data.
 *
 * SETUP (5 minutes):
 *   1. Go to https://sheets.google.com and create a new spreadsheet.
 *      Name it something like "Passaic Debris Log".
 *   2. In that spreadsheet: Extensions → Apps Script.
 *   3. Delete the default Code.gs contents and paste THIS ENTIRE FILE.
 *   4. Save (Ctrl/Cmd+S). Name the project "Passaic Debris Webhook".
 *   5. Click "Deploy" → "New deployment".
 *   6. Click the gear icon ⚙ → choose "Web app".
 *   7. Fill in:
 *        Description:     Passaic debris webhook v1
 *        Execute as:      Me (your Google account)
 *        Who has access:  Anyone
 *   8. Click "Deploy".
 *   9. Authorize: pick your account → "Advanced" → "Go to project (unsafe)"
 *      → "Allow". (It's unsafe only because it's your own unverified script.)
 *  10. Copy the "Web app URL" — it looks like:
 *        https://script.google.com/macros/s/AKfyc.../exec
 *  11. Open the Passaic Debris Tracker site → click ⚙ Settings → paste the
 *      URL → Save. Reports from every rower will now flow into this sheet.
 *
 * Re-deploying after code changes:
 *   Deploy → Manage deployments → pencil icon → Version: "New version"
 *   → Deploy. (The URL stays the same.)
 */

const SHEET_NAME = 'Reports';
const PHOTO_FOLDER_NAME = 'Passaic Debris Photos';

// ---- Contact form settings ----
// Email address that receives submissions from the "Contact Us" button on the
// main page. Change this if the treasurer's address ever rotates.
const CONTACT_TO_EMAIL = 'treasurer@nereidbc.org';
// Optional: CC the person who deployed the script so they can see every
// message that comes through (comment out to disable).
const CONTACT_BCC_OWNER = true;
// Minimum seconds between messages from the same client (basic rate limit
// above and beyond the client-side cooldown).
const CONTACT_MIN_INTERVAL_SEC = 20;
// ts        = when the debris was OBSERVED (rower-specified)
// reported_at = when the Save button was actually pressed (audit trail)
// photo_url   = public Drive link to optional photo attachment
const HEADERS = [
  'id', 'ts', 'reported_at', 'zoneId', 'zoneName', 'level', 'type', 'rower', 'notes',
  'lat', 'lng', 'tide_level_ft', 'tide_phase', 'flow_cfs', 'photo_url'
];

/** Lazy-create the Drive folder where photo attachments live. */
function getOrCreatePhotoFolder_() {
  const folders = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  if (folders.hasNext()) return folders.next();
  return DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

/** Save a base64 data URL to Drive and return the shareable URL. */
function uploadPhoto_(dataUrl, suggestedName) {
  if (!dataUrl) return '';
  const m = String(dataUrl).match(/^data:(image\/[a-z]+);base64,(.+)$/i);
  if (!m) return '';
  const mime = m[1];
  const ext = mime.split('/')[1] || 'jpg';
  const safeName = (suggestedName || ('photo_' + Date.now())).replace(/[^a-zA-Z0-9._-]/g, '_');
  const filename = safeName.endsWith('.' + ext) ? safeName : (safeName + '.' + ext);
  const blob = Utilities.newBlob(Utilities.base64Decode(m[2]), mime, filename);
  const folder = getOrCreatePhotoFolder_();
  const file = folder.createFile(blob);
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (e) { /* some Workspace domains restrict ANYONE_WITH_LINK; the URL still resolves for org members */ }
  return file.getUrl();
}

/** Lazy-create the Reports sheet with a header row, and migrate older
 *  sheets that were created before a column was added. */
function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#123a5a')
      .setFontColor('#ffffff');
    sheet.setColumnWidth(1, 180); // id
    sheet.setColumnWidth(2, 170); // ts
    sheet.setColumnWidth(3, 170); // reported_at
    return sheet;
  }

  // Migrate: if any new columns have been added to HEADERS since the sheet
  // was created, insert them at the correct position.
  const existing = sheet.getRange(1, 1, 1, Math.max(1, sheet.getLastColumn())).getValues()[0].map(String);
  let needsRewrite = false;
  for (let i = 0; i < HEADERS.length; i++) {
    if (existing[i] !== HEADERS[i]) { needsRewrite = true; break; }
  }
  if (needsRewrite) {
    // Build a mapping: for each target header, find its old column index (if any)
    const oldByName = {};
    existing.forEach((h, i) => { if (h) oldByName[h] = i; });
    const numRows = Math.max(1, sheet.getLastRow());
    const oldData = numRows > 1
      ? sheet.getRange(2, 1, numRows - 1, existing.length).getValues()
      : [];
    // Rewrite the header row
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length)
      .setFontWeight('bold')
      .setBackground('#123a5a')
      .setFontColor('#ffffff');
    // Rewrite data under the new column order
    if (oldData.length) {
      const newData = oldData.map(row => HEADERS.map(h =>
        oldByName[h] !== undefined ? row[oldByName[h]] : ''
      ));
      // Clear old data area then write back
      sheet.getRange(2, 1, oldData.length, Math.max(existing.length, HEADERS.length)).clearContent();
      sheet.getRange(2, 1, newData.length, HEADERS.length).setValues(newData);
    }
  }
  return sheet;
}

/** GET → return every report in the sheet as JSON. */
function doGet(e) {
  try {
    const sheet = getOrCreateSheet_();
    const values = sheet.getDataRange().getValues();
    const header = values[0];
    const reports = values.slice(1)
      .filter(row => row[0] !== '' && row[0] !== null) // skip blank rows
      .map(row => {
        const obj = {};
        header.forEach((h, i) => { obj[h] = row[i]; });
        // Reconstruct nested snapshots the client expects
        if (obj.tide_level_ft !== '' || obj.tide_phase !== '') {
          obj.tideSnapshot = {
            level: obj.tide_level_ft,
            phase: obj.tide_phase
          };
        }
        if (obj.flow_cfs !== '') {
          obj.flowSnapshot = { discharge: obj.flow_cfs };
        }
        // Ensure timestamps are ISO strings (Sheets may return Date objects)
        if (obj.ts instanceof Date) obj.ts = obj.ts.toISOString();
        if (obj.reported_at instanceof Date) obj.reported_at = obj.reported_at.toISOString();
        // Expose reported_at / photo_url under the camelCase names the client uses
        if (obj.reported_at) obj.reportedAt = obj.reported_at;
        if (obj.photo_url)   obj.photoUrl = obj.photo_url;
        return obj;
      });
    return jsonOut_({ ok: true, count: reports.length, reports: reports });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.toString() });
  }
}

/** POST → either append a report row, or relay a contact-form message. */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);

    // Contact form messages come in with action="contact" — relay via email
    // instead of writing to the Reports sheet.
    if (body && body.action === 'contact') {
      return handleContact_(body);
    }

    const sheet = getOrCreateSheet_();
    const report = body;

    if (!report || !report.id || !report.zoneId) {
      return jsonOut_({ ok: false, error: 'Missing id or zoneId' });
    }

    // Dedupe: if a row with this id already exists, update it instead of appending
    const existingIds = sheet
      .getRange(2, 1, Math.max(1, sheet.getLastRow() - 1), 1)
      .getValues()
      .map(r => r[0]);
    const existingRowIndex = existingIds.indexOf(report.id); // 0-based from row 2

    // If a photo data URL was attached, upload it to Drive and replace with the URL
    let photoUrl = report.photo_url || '';
    if (report.photoData) {
      try {
        photoUrl = uploadPhoto_(report.photoData, report.photoFilename || (report.id + '.jpg'));
      } catch (e) {
        // Don't fail the whole report if the photo upload errors — just log it
        photoUrl = 'ERR:' + e.message;
      }
    }

    const row = HEADERS.map(h => {
      if (h === 'tide_level_ft') return report.tideSnapshot ? report.tideSnapshot.level : '';
      if (h === 'tide_phase')    return report.tideSnapshot ? report.tideSnapshot.phase : '';
      if (h === 'flow_cfs')      return report.flowSnapshot ? report.flowSnapshot.discharge : '';
      if (h === 'reported_at')   return report.reportedAt || report.reported_at || '';
      if (h === 'photo_url')     return photoUrl;
      const v = report[h];
      return v === undefined || v === null ? '' : v;
    });

    if (existingRowIndex >= 0) {
      sheet.getRange(existingRowIndex + 2, 1, 1, HEADERS.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return jsonOut_({ ok: true, id: report.id, updated: existingRowIndex >= 0, photoUrl: photoUrl });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.toString() });
  }
}

function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Tiny HTML-escape for the message body. */
function escapeHtml_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Relay a contact-form submission via email. Body:
 *    { action: 'contact', name, email, phone, message, page, userAgent, submittedAt }
 *  Validates minimally, sends to CONTACT_TO_EMAIL (BCC's the script owner if
 *  configured), and logs the submission to a "ContactLog" sheet so the club
 *  has an audit trail even if an email is missed.
 */
function handleContact_(body) {
  try {
    const name    = String(body.name    || '').trim();
    const email   = String(body.email   || '').trim();
    const phone   = String(body.phone   || '').trim();
    const message = String(body.message || '').trim();
    const page    = String(body.page    || '').trim();
    const ua      = String(body.userAgent  || '').trim();
    const submittedAt = body.submittedAt
      ? new Date(body.submittedAt)
      : new Date();

    // Basic validation (mirrors the client)
    if (!name)    return jsonOut_({ ok: false, error: 'Missing name' });
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonOut_({ ok: false, error: 'Invalid email' });
    }
    if (!message || message.length < 5) return jsonOut_({ ok: false, error: 'Message too short' });
    if (message.length > 5000)           return jsonOut_({ ok: false, error: 'Message too long' });

    // Simple rate limit using ScriptProperties keyed on email.
    try {
      const props = PropertiesService.getScriptProperties();
      const k = 'contact:last:' + email.toLowerCase();
      const lastStr = props.getProperty(k);
      if (lastStr) {
        const last = parseInt(lastStr, 10);
        if (!isNaN(last) && (Date.now() - last) < CONTACT_MIN_INTERVAL_SEC * 1000) {
          return jsonOut_({ ok: false, error: 'Rate limit — please wait a moment before resending.' });
        }
      }
      props.setProperty(k, String(Date.now()));
    } catch (e) { /* non-fatal */ }

    const subject = '[passaictrash.com] Contact from ' + name;

    const textBody =
      'A new message came in from the Passaic Debris Tracker contact form.\n\n' +
      'Name:   ' + name  + '\n' +
      'Email:  ' + email + '\n' +
      'Phone:  ' + (phone || '(not provided)') + '\n' +
      'When:   ' + submittedAt.toLocaleString() + '\n' +
      (page ? 'Page:   ' + page + '\n' : '') +
      (ua   ? 'Device: ' + ua   + '\n' : '') +
      '\n----- Message -----\n' +
      message + '\n';

    const htmlBody =
      '<div style="font-family:system-ui,sans-serif;max-width:640px;">' +
        '<h2 style="color:#123a5a;margin:0 0 12px 0;">New message from passaictrash.com</h2>' +
        '<table style="border-collapse:collapse;font-size:14px;">' +
          '<tr><td style="color:#667;padding:4px 10px 4px 0;">Name</td><td><b>'  + escapeHtml_(name)  + '</b></td></tr>' +
          '<tr><td style="color:#667;padding:4px 10px 4px 0;">Email</td><td><a href="mailto:' + escapeHtml_(email) + '">' + escapeHtml_(email) + '</a></td></tr>' +
          '<tr><td style="color:#667;padding:4px 10px 4px 0;">Phone</td><td>' + escapeHtml_(phone || '(not provided)') + '</td></tr>' +
          '<tr><td style="color:#667;padding:4px 10px 4px 0;">When</td><td>'  + escapeHtml_(submittedAt.toLocaleString()) + '</td></tr>' +
          (page ? '<tr><td style="color:#667;padding:4px 10px 4px 0;">Page</td><td style="font-size:12px;color:#444;">' + escapeHtml_(page) + '</td></tr>' : '') +
          (ua   ? '<tr><td style="color:#667;padding:4px 10px 4px 0;">Device</td><td style="font-size:12px;color:#666;">' + escapeHtml_(ua) + '</td></tr>' : '') +
        '</table>' +
        '<h3 style="margin:18px 0 6px 0;color:#123a5a;">Message</h3>' +
        '<div style="white-space:pre-wrap;padding:12px 14px;background:#f5f7fb;border:1px solid #dce3ed;border-radius:6px;font-size:14px;line-height:1.5;">' +
          escapeHtml_(message) +
        '</div>' +
        '<p style="color:#89a;font-size:12px;margin-top:16px;">' +
          'Reply directly to this email to respond to ' + escapeHtml_(name) + '.' +
        '</p>' +
      '</div>';

    const mailOpts = {
      to: CONTACT_TO_EMAIL,
      subject: subject,
      replyTo: email,
      name: 'Passaic Debris Tracker',
      body: textBody,
      htmlBody: htmlBody,
    };
    if (CONTACT_BCC_OWNER) {
      try {
        const owner = Session.getEffectiveUser().getEmail();
        if (owner && owner !== CONTACT_TO_EMAIL) mailOpts.bcc = owner;
      } catch (e) { /* Session may be unavailable in some execution contexts */ }
    }

    MailApp.sendEmail(mailOpts);

    // Append to a ContactLog sheet for an audit trail (best-effort).
    try {
      const ss = SpreadsheetApp.getActive();
      let log = ss.getSheetByName('ContactLog');
      if (!log) {
        log = ss.insertSheet('ContactLog');
        log.appendRow(['reported_at', 'submitted_at', 'name', 'email', 'phone', 'message', 'page', 'user_agent']);
        log.setFrozenRows(1);
        log.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#123a5a').setFontColor('#ffffff');
      }
      log.appendRow([new Date().toISOString(), submittedAt.toISOString(), name, email, phone, message, page, ua]);
    } catch (e) { /* non-fatal */ }

    return jsonOut_({ ok: true, relayed: CONTACT_TO_EMAIL });
  } catch (err) {
    return jsonOut_({ ok: false, error: err.toString() });
  }
}

/** Optional: run this once manually from the Apps Script editor to initialize. */
function initSheet() {
  getOrCreateSheet_();
  SpreadsheetApp.getActive().toast('Reports sheet is ready.');
}
