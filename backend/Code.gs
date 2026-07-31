/* ============================================
   Code.gs — Get Gorgeous backend
   HOW TO USE:
   1. Open your Google Sheet → Extensions → Apps Script
   2. Delete any starter code, paste this whole file
   3. Replace SECRET_TOKEN below with your own long random string
   4. Create a Drive folder for photos, paste its ID into DRIVE_FOLDER_ID
   5. Deploy → New deployment → type "Web app"
        - Execute as: Me
        - Who has access: Anyone
      Click Deploy, copy the Web App URL.
   6. Paste that URL + your SECRET_TOKEN into the app's Settings page.

   FOR PUSH NOTIFICATIONS (optional but you asked for it):
   7. Set up a Firebase project (see the separate instructions given
      alongside this file) and get a service account key.
   8. In THIS Apps Script project: Project Settings (⚙ left sidebar)
      → Script Properties → Add 3 properties:
        FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY
      (values come from the Firebase service account JSON file —
      NEVER put these directly in this code file, since this file
      may end up in a public GitHub repo; Script Properties stays
      private to this Apps Script project.)
   9. Whenever you edit this file, redeploy: Deploy → Manage
      deployments → Edit (pencil) → New version → Deploy.
   ============================================ */

const SECRET_TOKEN = 'CHANGE-THIS-TO-A-LONG-RANDOM-STRING';
const DRIVE_FOLDER_ID = 'PASTE-YOUR-DRIVE-FOLDER-ID-HERE';

const SHEET_NAMES = [
  'customers', 'appointments', 'services', 'bills', 'products',
  'purchases', 'stockTransactions', 'expenses', 'staff', 'attendance', 'pendingMessages', 'deviceTokens',
];

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    if (body.token !== SECRET_TOKEN) {
      return jsonResponse({ ok: false, error: 'Invalid token' });
    }

    if (body.action === 'pushRecords') {
      return jsonResponse(pushRecords(body.storeName, body.records));
    }
    if (body.action === 'uploadPhoto') {
      return jsonResponse(uploadPhoto(body.dataUrl, body.fileName));
    }
    return jsonResponse({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  try {
    const token = e.parameter.token;
    if (token !== SECRET_TOKEN) return jsonResponse({ ok: false, error: 'Invalid token' });

    if (e.parameter.action === 'pullAll') {
      return jsonResponse(pullAll());
    }
    return jsonResponse({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

/* ---------- Push: upsert rows into the matching sheet tab ---------- */

function pushRecords(storeName, records) {
  if (!SHEET_NAMES.includes(storeName)) return { ok: false, error: 'Unknown store: ' + storeName };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(storeName);
  if (!sheet) sheet = ss.insertSheet(storeName);

  records.forEach((record) => {
    const flat = flattenRecord(record);
    const headers = getOrCreateHeaders(sheet, flat);
    const rowIndex = findRowById(sheet, flat.id);
    const rowValues = headers.map((h) => (flat[h] !== undefined ? flat[h] : ''));

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, headers.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }
  });

  logSync(storeName, records.length);

  if (storeName === 'pendingMessages') {
    const newPending = records.filter((r) => r.status === 'pending');
    if (newPending.length) {
      try { notifyMasterDevices(newPending.length); } catch (err) { /* don't fail the sync over a notification error */ }
    }
  }

  return { ok: true, synced: records.length };
}

function flattenRecord(record) {
  const flat = {};
  Object.keys(record).forEach((k) => {
    const v = record[k];
    flat[k] = (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v;
  });
  return flat;
}

function getOrCreateHeaders(sheet, sampleFlatRecord) {
  const lastCol = sheet.getLastColumn();
  if (lastCol === 0) {
    const headers = Object.keys(sampleFlatRecord);
    sheet.appendRow(headers);
    return headers;
  }
  return sheet.getRange(1, 1, 1, lastCol).getValues()[0];
}

function findRowById(sheet, id) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().flat();
  const idx = ids.indexOf(id);
  return idx === -1 ? -1 : idx + 2;
}

/* ---------- Pull: full backup/restore ---------- */

function pullAll() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const result = {};
  SHEET_NAMES.forEach((name) => {
    const sheet = ss.getSheetByName(name);
    if (!sheet || sheet.getLastRow() < 2) { result[name] = []; return; }
    const values = sheet.getDataRange().getValues();
    const headers = values[0];
    result[name] = values.slice(1).map((row) => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
  });
  return { ok: true, data: result };
}

/* ---------- Photos → Drive ---------- */

function uploadPhoto(dataUrl, fileName) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const parts = dataUrl.split(',');
  const mime = parts[0].match(/data:(.*);base64/)[1];
  const bytes = Utilities.base64Decode(parts[1]);
  const blob = Utilities.newBlob(bytes, mime, fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return { ok: true, url: file.getUrl(), id: file.getId() };
}

/* ---------- Sync log ---------- */

function logSync(storeName, count) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName('Sync_Log');
  if (!sheet) {
    sheet = ss.insertSheet('Sync_Log');
    sheet.appendRow(['timestamp', 'store', 'recordCount']);
  }
  sheet.appendRow([new Date().toISOString(), storeName, count]);
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ============================================
   Push Notifications (Firebase Cloud Messaging)
   Requires Script Properties (Project Settings ⚙ →
   Script Properties in the Apps Script editor):
     FCM_PROJECT_ID   → Firebase project ID
     FCM_CLIENT_EMAIL → service account "client_email"
     FCM_PRIVATE_KEY  → service account "private_key"
                        (paste exactly as in the JSON file,
                        including the \n sequences)
   ============================================ */

function notifyMasterDevices(count) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('deviceTokens');
  if (!sheet || sheet.getLastRow() < 2) return;

  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const tokenIdx = headers.indexOf('fcmToken');
  const masterIdx = headers.indexOf('isMaster');
  if (tokenIdx === -1 || masterIdx === -1) return;

  let accessToken = null;

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    const isMaster = row[masterIdx] === true || row[masterIdx] === 'TRUE';
    const token = row[tokenIdx];
    if (!isMaster || !token) continue;

    if (!accessToken) accessToken = getFCMAccessToken(); // fetch once, reuse for all devices
    try {
      sendPushNotification(accessToken, token, 'New WhatsApp Message to Send',
        `${count} bill/offer message(s) waiting in the WhatsApp Queue`);
    } catch (err) { /* keep trying other devices */ }
  }
}

function getFCMAccessToken() {
  const props = PropertiesService.getScriptProperties();
  const clientEmail = props.getProperty('FCM_CLIENT_EMAIL');
  const privateKey = props.getProperty('FCM_PRIVATE_KEY').replace(/\\n/g, '\n');

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  const base64url = (obj) => Utilities.base64EncodeWebSafe(JSON.stringify(obj)).replace(/=+$/, '');
  const toSign = base64url(header) + '.' + base64url(claimSet);
  const signatureBytes = Utilities.computeRsaSha256Signature(toSign, privateKey);
  const signature = Utilities.base64EncodeWebSafe(signatureBytes).replace(/=+$/, '');
  const jwt = toSign + '.' + signature;

  const response = UrlFetchApp.fetch('https://oauth2.googleapis.com/token', {
    method: 'post',
    contentType: 'application/x-www-form-urlencoded',
    payload: {
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    },
    muteHttpExceptions: true,
  });
  const json = JSON.parse(response.getContentText());
  if (!json.access_token) throw new Error('FCM auth failed: ' + response.getContentText());
  return json.access_token;
}

function sendPushNotification(accessToken, fcmToken, title, body) {
  const projectId = PropertiesService.getScriptProperties().getProperty('FCM_PROJECT_ID');
  const message = {
    message: {
      token: fcmToken,
      notification: { title: title, body: body },
      webpush: {
        notification: { icon: '/assets/icons/icon-192.png' },
        fcm_options: { link: '/whatsapp-queue.html' },
      },
    },
  };

  UrlFetchApp.fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + accessToken },
    payload: JSON.stringify(message),
    muteHttpExceptions: true,
  });
}
