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
   ============================================ */

const SECRET_TOKEN = 'CHANGE-THIS-TO-A-LONG-RANDOM-STRING';
const DRIVE_FOLDER_ID = 'PASTE-YOUR-DRIVE-FOLDER-ID-HERE';

const SHEET_NAMES = [
  'customers', 'appointments', 'services', 'bills', 'products',
  'purchases', 'stockTransactions', 'expenses', 'staff', 'attendance',
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
