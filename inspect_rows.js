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
  
  // Helper to find index
  const findColIdx = (...terms) => {
    for (const term of terms) {
      const t = term.toLowerCase().trim();
      const exactIdx = headerRow.findIndex(h => h === t);
      if (exactIdx !== -1) return exactIdx;
      const subIdx = headerRow.findIndex(h => h.includes(t));
      if (subIdx !== -1) return subIdx;
    }
    return undefined;
  };

  const skuIdx = findColIdx('kod', 'sku', 'symbol', 'indeks', 'artyk');
  const eanIdx = findColIdx('ean', 'barcod', 'kod kresk');
  const nameIdx = findColIdx('nazwa', 'name', 'tytuł', 'tytul', 'towar', 'produkt');
  const catIdx = findColIdx('kategoria', 'category', 'dział', 'dzial', 'grupa');
  const descIdx = findColIdx('opis', 'description', 'desc', 'specyfikacja');
  const priceIdx = findColIdx('cena netto', 'cena hurt', 'cena b2b', 'cena', 'netto');
  const stockIdx = findColIdx('zamówienie ilość', 'stan', 'stock', 'ilosc', 'ilość', 'dostęp', 'dostep');
  const pcbIdx = findColIdx('pcb', 'opakowanie', 'karton', 'zbiorcz');
  const ageIdx = findColIdx('wiek', 'age', 'od lat');
  const imgIdx = findColIdx('zdjęcie', 'zdjecie', 'image', 'obraz', 'foto');
  
  console.log('Detected Indices:');
  console.log({ skuIdx, eanIdx, nameIdx, catIdx, descIdx, priceIdx, stockIdx, pcbIdx, ageIdx, imgIdx });
  
  for (let i = 2; i < 12; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0) continue;
    console.log(`\n--- Row ${i} ---`);
    console.log('SKU:', row[skuIdx], 'Type:', typeof row[skuIdx]);
    console.log('EAN:', row[eanIdx]);
    console.log('Category:', row[catIdx]);
    console.log('Name:', row[nameIdx]);
    console.log('Price:', row[priceIdx]);
    console.log('Stock (raw):', row[stockIdx]);
    console.log('Packaging:', row[pcbIdx]);
    console.log('Age:', row[ageIdx]);
  }
} catch (err) {
  console.error('Error:', err);
}
