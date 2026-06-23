const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'ASKATO_1006_HR.xlsx');
try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  const colCounts = Array(rawRows[1].length).fill(0);
  const colNonEmptySamples = Array(rawRows[1].length).fill(null).map(() => []);

  for (let i = 2; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== undefined && row[c] !== null && String(row[c]).trim() !== '') {
        colCounts[c]++;
        if (colNonEmptySamples[c].length < 5) {
          colNonEmptySamples[c].push(row[c]);
        }
      }
    }
  }

  const headerRow = rawRows[1];
  console.log('Column Analysis:');
  for (let c = 0; c < headerRow.length; c++) {
    console.log(`Col ${c} (${headerRow[c] || 'empty'}): Non-empty count = ${colCounts[c]}, Samples = ${JSON.stringify(colNonEmptySamples[c])}`);
  }
} catch (err) {
  console.error(err);
}
