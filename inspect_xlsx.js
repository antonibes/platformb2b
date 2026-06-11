const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'ASKATO_1006_HR.xlsx');
try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  const headerRow = rawRows[1].map(h => String(h).trim().toLowerCase());
  const catIdx = headerRow.indexOf('kategoria');
  
  const uniqueCategories = new Map();
  
  for (let i = 2; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (row.length === 0 || row.every(c => c === '')) continue;
    
    const category = String(row[catIdx] || 'ZABAWKI').trim();
    uniqueCategories.set(category, (uniqueCategories.get(category) || 0) + 1);
  }
  
  console.log('Unique categories in sheet:');
  console.log(Array.from(uniqueCategories.entries()));
} catch (err) {
  console.error('Error:', err);
}


