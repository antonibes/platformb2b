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
  
  const ageIdx = headerRow.indexOf('wiek');
  const descIdx = headerRow.indexOf('opis');

  function parseAge(rawAge, description) {
    if (rawAge !== undefined && rawAge !== null && String(rawAge).trim() !== '') {
      return String(rawAge).trim();
    }
    // Try to extract from description
    if (description) {
      const match = description.match(/wiek[:\s]*(\d+m?\+?|\d+-\d+|\d+\s*lat|\d+\s*m-cy|\d+\s*mies)/i);
      if (match) {
        return match[1].trim();
      }
    }
    return '3+';
  }

  const results = [];
  for (let i = 2; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!row || row.length === 0 || row.every(c => c === '')) continue;
    const rawAge = row[ageIdx];
    const desc = row[descIdx];
    const parsed = parseAge(rawAge, desc);
    results.push({ row: i, rawAge, parsed, descSnippet: String(desc).substring(0, 50).replace(/\r?\n/g, ' ') });
  }

  // Print unique parsed values
  const uniqueParsed = new Set(results.map(r => r.parsed));
  console.log('Unique parsed ages:', Array.from(uniqueParsed));
  
  console.log('\nSample rows:');
  console.log(results.slice(0, 30));

} catch (err) {
  console.error('Error:', err);
}
