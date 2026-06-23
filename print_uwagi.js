const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'ASKATO_1006_HR.xlsx');
try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  const headerRowIdx = 1;
  const headerRow = rawRows[headerRowIdx].map(h => String(h).trim().toLowerCase());
  const uwagiIdx = headerRow.indexOf('uwagi');
  const catIdx = headerRow.indexOf('kategoria');

  const uniqueUwagi = new Map();
  for (let i = 2; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0 || row.every(c => c === '')) continue;
    
    const uwagi = String(row[uwagiIdx] || '').trim();
    const cat = String(row[catIdx] || '').trim();
    const key = `${cat} | ${uwagi}`;
    uniqueUwagi.set(key, (uniqueUwagi.get(key) || 0) + 1);
  }
  
  console.log('Unique combinations of Kategoria | Uwagi:');
  console.log(Array.from(uniqueUwagi.entries()));
} catch (err) {
  console.error(err);
}
