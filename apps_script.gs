// NILAM v2 — Apps Script (Google Apps Script)
// Salin kod ini sepenuhnya ke Google Apps Script Editor anda
// dan gantikan SPREADSHEET_ID dengan ID Google Sheet anda.

const SPREADSHEET_ID = "ID_GOOGLE_SHEET_ANDA"; // <-- GANTIKAN
const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
const studentsSheet = ss.getSheetByName("students");
const recordsSheet = ss.getSheetByName("nilam_records");

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;
    const payload = data.payload;
    switch (action) {
      case 'addRecord':          return addRecord(payload);
      case 'updateRecord':       return updateRecord(payload);
      case 'deleteNilamRecords': return deleteNilamRecords(payload);
      case 'uploadStudents':     return uploadStudents(payload);
      case 'updateStudent':      return updateStudent(payload);
      case 'deleteStudent':      return deleteStudent(payload);
      case 'deleteAllSessionStudents': return deleteAllSessionStudents(payload);
      case 'deleteAllNilam':     return deleteAllNilamRecords();
      case 'carryForwardSession': return carryForwardSession(payload); // BAHARU
      default: return createJsonResponse({ status: 'error', message: 'Tindakan tidak sah' });
    }
  } catch (err) {
    return createJsonResponse({ status: 'error', message: `Ralat Server: ${err.message}` });
  }
}

function doGet(e) {
  const action = e.parameter.action;
  if (action === 'readAll') return readAllData();
  return createJsonResponse({ status: 'error', message: 'Tindakan GET tidak sah' });
}

// -- HELPERS --
function getSheetData(sheet) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const header = data.shift().map(h => String(h).trim().toLowerCase());
  return data.map(row => {
    let obj = {};
    header.forEach((col, index) => { obj[col] = row[index]; });
    return obj;
  });
}

function buildRowData(sheet, dataObj) {
  const lastCol = sheet.getLastColumn();
  if (lastCol < 1) return [];
  const header = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  return header.map(col => {
    const key = String(col).trim().toLowerCase();
    return dataObj[key] !== undefined ? dataObj[key] : '';
  });
}

function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function findRowById(sheet, id) {
  const header = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
  const idColIndex = header.indexOf('id');
  if (idColIndex === -1) return -1;
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return -1;
  const ids = sheet.getRange(2, idColIndex + 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]).trim() == String(id).trim()) return i + 2;
  }
  return -1;
}

// -- READ --
function readAllData() {
  try {
    const students = getSheetData(studentsSheet);
    const records = getSheetData(recordsSheet);
    return createJsonResponse({ status: 'success', data: { students, records } });
  } catch (e) {
    return createJsonResponse({ status: 'error', message: e.message });
  }
}

// -- RECORDS --
function findExistingRecordRow(sheet, payload) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return -1;
  const header = data[0].map(h => String(h).trim().toLowerCase());
  const namaIdx = header.indexOf('nama');
  const sesiIdx = header.indexOf('sesi');
  const tahunIdx = header.indexOf('tahun');
  const kelasIdx = header.indexOf('kelas');
  const bulanIdx = header.indexOf('bulan');
  
  if (namaIdx < 0 || sesiIdx < 0 || bulanIdx < 0) return -1;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (
      String(row[namaIdx]).trim().toLowerCase() === String(payload.nama).trim().toLowerCase() &&
      String(row[sesiIdx]).trim() === String(payload.sesi).trim() &&
      String(row[tahunIdx]).trim().toLowerCase() === String(payload.tahun).trim().toLowerCase() &&
      String(row[kelasIdx]).trim().toLowerCase() === String(payload.kelas).trim().toLowerCase() &&
      String(row[bulanIdx]).trim() === String(payload.bulan).trim()
    ) {
      return i + 1; // Row number (1-based index)
    }
  }
  return -1;
}

function addRecord(payload) {
  const existingRowNum = findExistingRecordRow(recordsSheet, payload);
  
  if (existingRowNum !== -1) {
    // Update existing record by accumulating values
    const header = recordsSheet.getRange(1, 1, 1, recordsSheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
    const existingRowData = recordsSheet.getRange(existingRowNum, 1, 1, header.length).getValues()[0];
    
    const existingObj = {};
    header.forEach((col, idx) => { existingObj[col] = existingRowData[idx]; });
    
    existingObj.timestamp = new Date();
    existingObj.pages = (Number(existingObj.pages) || 0) + (Number(payload.pages) || 0);
    existingObj.cat_fiksyen = (Number(existingObj.cat_fiksyen) || 0) + (Number(payload.cat.fiksyen) || 0);
    existingObj.cat_bukanfiksyen = (Number(existingObj.cat_bukanfiksyen) || 0) + (Number(payload.cat.bukanFiksyen) || 0);
    existingObj.cat_bukanbuku = (Number(existingObj.cat_bukanbuku) || 0) + (Number(payload.cat.bukanBuku) || 0);
    existingObj.lang_bm = (Number(existingObj.lang_bm) || 0) + (Number(payload.lang.BM) || 0);
    existingObj.lang_bi = (Number(existingObj.lang_bi) || 0) + (Number(payload.lang.BI) || 0);
    existingObj.lang_lain = (Number(existingObj.lang_lain) || 0) + (Number(payload.lang.lain) || 0);
    
    const newRowData = header.map(col => existingObj[col] !== undefined ? existingObj[col] : '');
    recordsSheet.getRange(existingRowNum, 1, 1, header.length).setValues([newRowData]);
    return createJsonResponse({ status: 'success', id: existingObj.id, message: 'Updated existing record' });
  } else {
    // Insert new record
    const newId = Utilities.getUuid();
    const dObj = {
      'id': newId, 'createdat': new Date(), 'timestamp': new Date(), 'tarikh': new Date(),
      'nama': payload.nama, 'tahun': payload.tahun, 'kelas': payload.kelas, 'sesi': payload.sesi, 'bulan': payload.bulan,
      'pages': payload.pages, 'cat_fiksyen': payload.cat.fiksyen, 'cat_bukanfiksyen': payload.cat.bukanFiksyen,
      'cat_bukanbuku': payload.cat.bukanBuku, 'lang_bm': payload.lang.BM, 'lang_bi': payload.lang.BI, 'lang_lain': payload.lang.lain
    };
    recordsSheet.appendRow(buildRowData(recordsSheet, dObj));
    return createJsonResponse({ status: 'success', id: newId });
  }
}

function updateRecord(payload) {
  const rowNum = findRowById(recordsSheet, payload.id);
  if (rowNum === -1) return createJsonResponse({ status: 'error', message: 'Rekod tidak ditemui' });
  const header = recordsSheet.getRange(1, 1, 1, recordsSheet.getLastColumn()).getValues()[0];
  const dataToSet = {
    'id': payload.id, 'createdat': new Date(), 'timestamp': new Date(), 'tarikh': new Date(), 
    'nama': payload.nama, 'tahun': payload.tahun, 'kelas': payload.kelas, 'sesi': payload.sesi, 'bulan': payload.bulan, 
    'pages': payload.pages, 'cat_fiksyen': payload.cat.fiksyen, 'cat_bukanfiksyen': payload.cat.bukanFiksyen,
    'cat_bukanbuku': payload.cat.bukanBuku, 'lang_bm': payload.lang.BM, 'lang_bi': payload.lang.BI, 'lang_lain': payload.lang.lain
  };
  const rowData = header.map(col => {
    const key = String(col).trim().toLowerCase();
    return dataToSet[key] !== undefined ? dataToSet[key] : '';
  });
  recordsSheet.getRange(rowNum, 1, 1, header.length).setValues([rowData]);
  return createJsonResponse({ status: 'success' });
}

function deleteNilamRecords(payload) {
  const idsToDelete = [...payload.ids];
  for (let i = idsToDelete.length - 1; i >= 0; i--) {
    const rowNum = findRowById(recordsSheet, idsToDelete[i]);
    if (rowNum !== -1) recordsSheet.deleteRow(rowNum);
  }
  return createJsonResponse({ status: 'success' });
}

// -- STUDENTS --
function uploadStudents(payload) {
  try {
    const students = payload.students;
    if (!students || students.length === 0) return createJsonResponse({ status: 'error', message: 'Tiada data pelajar dalam CSV.' });
    
    // Anggap semua murid dalam muat naik ini merujuk kepada sesi yang sama
    const activeSesi = students[0].sesi;
    
    const data = studentsSheet.getDataRange().getValues();
    const header = data[0].map(h => String(h).trim().toLowerCase());
    const namaIdx = header.indexOf('nama'), sesiIdx = header.indexOf('sesi');
    const tahunIdx = header.indexOf('tahun'), kelasIdx = header.indexOf('kelas');
    
    if (namaIdx < 0 || sesiIdx < 0 || tahunIdx < 0 || kelasIdx < 0) {
      return createJsonResponse({ status: 'error', message: 'Struktur jadual GS tidak lengkap (tiada nama/sesi/tahun/kelas).' });
    }

    const incomingMap = new Map();
    students.forEach(s => incomingMap.set(String(s.nama).trim().toLowerCase(), s));

    const handledIncoming = new Set();
    
    // Gelung dari bawah untuk elak perubahan indeks (hanya update jika ada)
    for (let i = data.length - 1; i > 0; i--) {
      const row = data[i];
      if (String(row[sesiIdx]) == activeSesi) {
        const dbNama = String(row[namaIdx]).trim().toLowerCase();
        
        if (incomingMap.has(dbNama)) {
          // MURID WUJUD: Kemas kini Tahun & Kelas jika berbeza
          const inc = incomingMap.get(dbNama);
          if (String(row[tahunIdx]) !== String(inc.tahun)) {
            studentsSheet.getRange(i + 1, tahunIdx + 1).setValue(inc.tahun);
          }
          if (String(row[kelasIdx]) !== String(inc.kelas)) {
            studentsSheet.getRange(i + 1, kelasIdx + 1).setValue(inc.kelas);
          }
          handledIncoming.add(dbNama);
        }
      }
    }

    // MURID BAHARU: Tambah baris baru jika wujud dalam CSV tetapi belum diproses
    const newStudentRows = [];
    students.forEach(s => {
      const dbNama = String(s.nama).trim().toLowerCase();
      if (!handledIncoming.has(dbNama)) {
        const sObj = { 'id': Utilities.getUuid(), 'createdat': new Date(), 'timestamp': new Date(), 'nama': s.nama, 'sesi': s.sesi, 'tahun': s.tahun, 'kelas': s.kelas };
        newStudentRows.push(buildRowData(studentsSheet, sObj));
      }
    });

    if (newStudentRows.length > 0) {
      studentsSheet.getRange(studentsSheet.getLastRow() + 1, 1, newStudentRows.length, newStudentRows[0].length).setValues(newStudentRows);
    }

    return createJsonResponse({ status: 'success' });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: `Ralat penyegerakan CSV: ${err.message}` });
  }
}

function updateStudent(payload) {
  // ... exactly as before ...
  const rowNum = findRowById(studentsSheet, payload.id);
  if (rowNum === -1) return createJsonResponse({ status: 'error', message: 'Murid tidak ditemui' });
  const header = studentsSheet.getRange(1, 1, 1, studentsSheet.getLastColumn()).getValues()[0].map(h => String(h).trim().toLowerCase());
  const namaIdx = header.indexOf('nama'), tahunIdx = header.indexOf('tahun'), kelasIdx = header.indexOf('kelas');
  if (namaIdx > -1) studentsSheet.getRange(rowNum, namaIdx + 1).setValue(payload.nama);
  if (tahunIdx > -1) studentsSheet.getRange(rowNum, tahunIdx + 1).setValue(payload.tahun);
  if (kelasIdx > -1) studentsSheet.getRange(rowNum, kelasIdx + 1).setValue(payload.kelas);
  return createJsonResponse({ status: 'success' });
}

function deleteStudent(payload) {
  const rowNum = findRowById(studentsSheet, payload.id);
  if (rowNum !== -1) studentsSheet.deleteRow(rowNum);
  const recData = recordsSheet.getDataRange().getValues();
  const hdr = recData.shift().map(h => String(h).trim().toLowerCase());
  const nameIdx = hdr.indexOf('nama');
  for (let i = recData.length - 1; i >= 0; i--) {
    if (recData[i][nameIdx] == payload.name) recordsSheet.deleteRow(i + 2);
  }
  return createJsonResponse({ status: 'success' });
}

function deleteAllSessionStudents(payload) {
  const data = studentsSheet.getDataRange().getValues();
  const header = data[0].map(h => String(h).trim().toLowerCase());
  const sesiIdx = header.indexOf('sesi');
  if (sesiIdx === -1) return createJsonResponse({ status: 'error', message: "Lajur 'sesi' tidak ditemui." });
  const sessionYear = String(payload.sessionYear).trim();
  let deletedCount = 0;
  for (let i = data.length - 1; i > 0; i--) {
    if (String(data[i][sesiIdx]).trim() == sessionYear) {
      studentsSheet.deleteRow(i + 1);
      deletedCount++;
    }
  }
  if (deletedCount > 0) return createJsonResponse({ status: 'success', message: `${deletedCount} murid dipadam.` });
  return createJsonResponse({ status: 'error', message: `Tiada murid ditemui untuk sesi ${sessionYear}.` });
}

function deleteAllNilamRecords() {
  const lastRow = recordsSheet.getLastRow();
  if (lastRow > 1) recordsSheet.deleteRows(2, lastRow - 1);
  return createJsonResponse({ status: 'success' });
}

// -- CARRY-FORWARD (BAHARU) --
function carryForwardSession(payload) {
  try {
    const newStudents = payload.students || [];
    const newRecords = payload.records || [];

    // 1. Tambah murid baharu (jika belum ada dalam sesi baru)
    let addedStudents = 0;
    if (newStudents.length > 0) {
      const studData = studentsSheet.getDataRange().getValues();
      const sHdr = studData[0].map(h => String(h).trim().toLowerCase());
      const namaIdx = sHdr.indexOf('nama'), sesiIdx = sHdr.indexOf('sesi');
      const existingKeys = new Set();
      for (let i = 1; i < studData.length; i++) {
        existingKeys.add(`${studData[i][namaIdx]}_${studData[i][sesiIdx]}`);
      }
      
      const newStudentRows = [];
      newStudents.forEach(s => {
        const key = `${s.nama}_${s.sesi}`;
        if (!existingKeys.has(key)) {
          const sObj = { 'id': Utilities.getUuid(), 'createdat': new Date(), 'timestamp': new Date(), 'nama': s.nama, 'sesi': s.sesi, 'tahun': s.tahun, 'kelas': s.kelas };
          newStudentRows.push(buildRowData(studentsSheet, sObj));
          existingKeys.add(key);
        }
      });

      if (newStudentRows.length > 0) {
        studentsSheet.getRange(studentsSheet.getLastRow() + 1, 1, newStudentRows.length, newStudentRows[0].length).setValues(newStudentRows);
        addedStudents = newStudentRows.length;
      }
    }

    // 2. Tambah rekod baki kumulatif
    let addedRecords = 0;
    if (newRecords.length > 0) {
      const newRecordRows = [];
      newRecords.forEach(rec => {
        const total = (Number(rec.cat.fiksyen) || 0) + (Number(rec.cat.bukanFiksyen) || 0) + (Number(rec.cat.bukanBuku) || 0);
        if (total > 0) {
          const rObj = {
            'id': Utilities.getUuid(), 'createdat': new Date(), 'timestamp': new Date(), 'tarikh': new Date(),
            'nama': rec.nama, 'tahun': rec.tahun, 'kelas': rec.kelas, 'sesi': rec.sesi, 'bulan': rec.bulan,
            'pages': rec.pages, 'cat_fiksyen': rec.cat.fiksyen, 'cat_bukanfiksyen': rec.cat.bukanFiksyen,
            'cat_bukanbuku': rec.cat.bukanBuku, 'lang_bm': rec.lang.BM, 'lang_bi': rec.lang.BI, 'lang_lain': rec.lang.lain
          };
          newRecordRows.push(buildRowData(recordsSheet, rObj));
        }
      });

      if (newRecordRows.length > 0) {
        recordsSheet.getRange(recordsSheet.getLastRow() + 1, 1, newRecordRows.length, newRecordRows[0].length).setValues(newRecordRows);
        addedRecords = newRecordRows.length;
      }
    }

    return createJsonResponse({
      status: 'success',
      message: `${addedStudents} murid dan ${addedRecords} rekod baki berjaya disalin.`
    });
  } catch (err) {
    return createJsonResponse({ status: 'error', message: `Ralat carry-forward: ${err.message}` });
  }
}
