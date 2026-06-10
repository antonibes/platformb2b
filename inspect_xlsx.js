const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(process.cwd(), 'ASKATO_1006_HR.xlsx');
try {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet);
  
  console.log('Sheet Name:', sheetName);
  console.log('Number of rows:', rows.length);
  if (rows.length > 0) {
    console.log('Headers (Keys):', Object.keys(rows[0]));
    console.log('Sample Row 1:', rows[0]);
    console.log('Sample Row 2:', rows[1]);
  } else {
    console.log('No rows found');
  }
} catch (err) {
  console.error('Error reading file:', err);
}
