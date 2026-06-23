const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'ASKATO_1006_HR.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

// Find header row
let headerRowIdx = 0;
for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
  const rowStr = rawRows[i].map(c => String(c).toLowerCase());
  if (rowStr.some(c => c === 'kod' || c === 'sku' || c === 'nazwa')) {
    headerRowIdx = i;
    break;
  }
}

const headerRow = rawRows[headerRowIdx].map(h => String(h).trim());
console.log('\n=== WSZYSTKIE NAGŁÓWKI (indeks: nazwa) ===');
headerRow.forEach((h, i) => console.log(`  [${i}]: "${h}"`));

// Find image-related columns
const imgKeywords = ['zdj', 'image', 'obraz', 'foto', 'url', 'link', 'http'];
const imgCols = headerRow
  .map((h, i) => ({ idx: i, name: h }))
  .filter(({ name }) => imgKeywords.some(k => name.toLowerCase().includes(k)));

console.log('\n=== KOLUMNY ZWIĄZANE ZE ZDJĘCIAMI ===');
if (imgCols.length === 0) {
  console.log('  BRAK kolumny ze zdjęciami!');
} else {
  imgCols.forEach(({ idx, name }) => console.log(`  [${idx}]: "${name}"`));
}

// Find SKU column
const skuIdx = headerRow.findIndex(h => ['kod', 'sku', 'symbol', 'indeks'].includes(h.toLowerCase().trim()));
console.log(`\n=== KOLUMNA SKU: [${skuIdx}] = "${headerRow[skuIdx]}" ===`);

// Show first 5 data rows
const dataRows = rawRows.slice(headerRowIdx + 1).filter(r => !r.every(c => c === '' || c === null));
console.log('\n=== PIERWSZE 3 WIERSZE DANYCH ===');
dataRows.slice(0, 3).forEach((row, i) => {
  const sku = row[skuIdx];
  console.log(`\nWiersz ${i + 1}: SKU="${sku}"`);
  if (imgCols.length > 0) {
    imgCols.forEach(({ idx, name }) => {
      console.log(`  Kolumna zdjęcia "${name}": "${String(row[idx]).substring(0, 100)}"`);
    });
  }
  // Also show ALL non-empty values
  row.forEach((val, colIdx) => {
    const v = String(val).trim();
    if (v && (v.startsWith('http') || v.includes('.jpg') || v.includes('.png') || v.includes('.jpeg'))) {
      console.log(`  !! Możliwy URL w kolumnie [${colIdx}] "${headerRow[colIdx]}": "${v.substring(0, 120)}"`);
    }
  });
});
