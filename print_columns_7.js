const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'ASKATO_1006_HR.xlsx');
try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  const headerRow = rawRows[1];
  console.log('Header Row:', headerRow);

  console.log('\nFirst 10 data rows details:');
  for (let i = 2; i < Math.min(rawRows.length, 12); i++) {
    const row = rawRows[i];
    console.log(`Row ${i}:`, row.map((val, idx) => `Col ${idx} (${headerRow[idx] || 'empty'}): "${val}"`));
  }
} catch (err) {
  console.error(err);
}
