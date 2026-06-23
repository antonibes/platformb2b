const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'ASKATO_1006_HR.xlsx');
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

let headerRowIdx = 0;
for (let i = 0; i < 5; i++) {
  const rowStr = rawRows[i].map(c => String(c).toLowerCase());
  if (rowStr.some(c => c === 'kod' || c === 'sku' || c === 'nazwa')) {
    headerRowIdx = i; break;
  }
}

const headerRow = rawRows[headerRowIdx].map(h => String(h).trim().toLowerCase());
const skuIdx = headerRow.findIndex(h => ['kod', 'sku', 'symbol', 'indeks'].includes(h));

const dataRows = rawRows.slice(headerRowIdx + 1).filter(r => !r.every(c => c === '' || c === null));

console.log('Pierwsze 10 SKU (raw):', dataRows.slice(0, 10).map(r => {
  const v = r[skuIdx];
  return { raw: v, type: typeof v, str: String(v).trim(), repr: JSON.stringify(String(v).trim()) };
}));
