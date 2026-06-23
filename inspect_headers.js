const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'ASKATO_1006_HR.xlsx');
try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  
  console.log('Row 0:', rawRows[0]);
  console.log('Row 1:', rawRows[1]);
  console.log('Row 2:', rawRows[2]);
  console.log('Row 3:', rawRows[3]);
  
  // Print non-empty columns from row 1 to see names
  const row1 = rawRows[1] || [];
  console.log('Row 1 columns count:', row1.length);
  row1.forEach((val, idx) => {
    if (val !== '') {
      console.log(`Column ${idx}: "${val}"`);
    }
  });

} catch (err) {
  console.error('Error:', err);
}
