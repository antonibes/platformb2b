const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(process.cwd(), 'ASKATO OFERTA ATENEUM wyłączność 09.03 stany.xlsx');
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Read with raw values
const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

console.log('=== ARKUSZE ===', workbook.SheetNames);
console.log('=== PIERWSZE 5 WIERSZY RAW ===');
for (let i = 0; i < Math.min(5, rawRows.length); i++) {
  console.log(`Wiersz ${i}:`, rawRows[i].map(v => `"${String(v).substring(0, 40)}"`).join(' | '));
}

// Find header row
let headerRowIdx = 0;
for (let i = 0; i < Math.min(rawRows.length, 8); i++) {
  const rowStr = rawRows[i].map(c => String(c).toLowerCase().trim());
  if (rowStr.some(c => c === 'kod' || c === 'sku' || c === 'nazwa' || c === 'name')) {
    headerRowIdx = i;
    break;
  }
}

const headerRow = rawRows[headerRowIdx].map(h => String(h).trim());
console.log(`\n=== NAGŁÓWKI (wiersz ${headerRowIdx}) ===`);
headerRow.forEach((h, i) => console.log(`  [${i}]: "${h}"`));

// Find key columns
const hdLower = headerRow.map(h => h.toLowerCase());
const skuIdx = hdLower.findIndex(h => ['kod', 'sku', 'symbol', 'indeks', 'artyk'].some(k => h === k || h.includes(k)));
const imgIdx = hdLower.findIndex(h => ['zdj', 'image', 'obraz', 'foto', 'url', 'link'].some(k => h.includes(k)));

console.log(`\nSKU kolumna: [${skuIdx}] = "${headerRow[skuIdx]}"`);
console.log(`Zdjęcie kolumna: [${imgIdx}] = "${imgIdx >= 0 ? headerRow[imgIdx] : 'BRAK'}" `);

// Data rows
const dataRows = rawRows.slice(headerRowIdx + 1).filter(r => !r.every(c => c === '' || c === null));

// Check SKUs vs local images
const imgDir = path.join(process.cwd(), 'public', 'products');
let found = 0, missing = 0;
const missingSamples = [];
const foundSamples = [];

dataRows.slice(0, 50).forEach(row => {
  const sku = String(row[skuIdx] || '').replace(/\.0+$/, '').trim();
  if (!sku) return;
  const fp = path.join(imgDir, `product_${sku}.jpeg`);
  if (fs.existsSync(fp)) {
    found++;
    if (foundSamples.length < 3) foundSamples.push(sku);
  } else {
    missing++;
    if (missingSamples.length < 10) missingSamples.push(sku);
  }
});

console.log(`\n=== POKRYCIE ZDJĘĆ (pierwsze 50 prod.) ===`);
console.log(`  ZNALEZIONE lokalnie: ${found}`);
console.log(`  BRAKUJĄCE: ${missing}`);
if (foundSamples.length) console.log(`  Przykłady z obrazkiem: ${foundSamples.join(', ')}`);
if (missingSamples.length) console.log(`  Przykłady BEZ obrazka: ${missingSamples.join(', ')}`);

// Check image column values
if (imgIdx >= 0) {
  console.log(`\n=== WARTOŚCI W KOLUMNIE ZDJĘCIA (pierwsze 10) ===`);
  dataRows.slice(0, 10).forEach((row, i) => {
    const val = String(row[imgIdx] || '').trim();
    console.log(`  [${i}] SKU=${String(row[skuIdx]).trim()}: "${val.substring(0, 100)}"`);
  });
} else {
  console.log('\n=== BRAK KOLUMNY ZDJĘCIA W EXCELU ===');
  // Scan ALL cells of first 5 rows for anything that looks like URL
  console.log('Szukam URL-i we wszystkich kolumnach...');
  dataRows.slice(0, 5).forEach((row, ri) => {
    row.forEach((val, ci) => {
      const v = String(val).trim();
      if (v.startsWith('http') || v.includes('.jpg') || v.includes('.png') || v.includes('.jpeg')) {
        console.log(`  Wiersz ${ri}, kolumna ${ci} "${headerRow[ci]}": "${v.substring(0, 100)}"`);
      }
    });
  });
}
