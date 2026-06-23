const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(process.cwd(), 'ASKATO_1006_HR.xlsx');
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

// Find header row
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
const imgDir = path.join(process.cwd(), 'public', 'products');

let found = 0, missing = 0;
const missingSKUs = [];

dataRows.forEach(row => {
  const sku = String(row[skuIdx] || '').trim();
  if (!sku) return;
  const fp = path.join(imgDir, `product_${sku}.jpeg`);
  if (fs.existsSync(fp)) {
    found++;
  } else {
    missing++;
    missingSKUs.push(sku);
  }
});

console.log(`\nŁącznie produktów: ${found + missing}`);
console.log(`Zdjęcia ZNALEZIONE lokalnie: ${found}`);
console.log(`Zdjęcia BRAKUJĄCE: ${missing}`);
if (missingSKUs.length > 0) {
  console.log(`\nPrzykłady brakujących SKU (pierwsze 20):`);
  missingSKUs.slice(0, 20).forEach(s => console.log(`  - ${s}`));
}
