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
  const pcbIdx = findColIdx('pcb', 'opakowanie', 'karton', 'zbiorcz');
  const ageIdx = findColIdx('wiek', 'age', 'od lat');

  console.log('Validating all rows...');
  let emptySkuCount = 0;
  let emptyNameCount = 0;
  let weirdAgeCount = 0;
  let totalRowsChecked = 0;

  for (let i = 2; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0 || row.every(c => c === '')) continue;
    totalRowsChecked++;
    
    const sku = row[skuIdx];
    const name = row[nameIdx];
    const age = row[ageIdx];
    
    if (!sku) {
      emptySkuCount++;
      if (emptySkuCount <= 5) console.log(`Row ${i} has empty SKU! Name: ${name}`);
    }
    if (!name) {
      emptyNameCount++;
      if (emptyNameCount <= 5) console.log(`Row ${i} has empty Name! SKU: ${sku}`);
    }
    
    const cleanAge = String(age || '').trim();
    if (cleanAge && !cleanAge.match(/^\d+m?\+?$/) && !cleanAge.match(/^\d+-\d+$/)) {
      weirdAgeCount++;
      if (weirdAgeCount <= 10) console.log(`Row ${i} has weird age: "${age}" (SKU: ${sku}, Name: ${name})`);
    }
  }

  console.log('\nValidation Summary:');
  console.log({ totalRowsChecked, emptySkuCount, emptyNameCount, weirdAgeCount });
} catch (err) {
  console.error('Error:', err);
}
