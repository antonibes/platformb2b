const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const filePath = path.join(process.cwd(), 'ASKATO OFERTA ATENEUM wyłączność 09.03 stany.xlsx');

// Read raw ZIP content to check for embedded images
const AdmZip = (() => {
  try { return require('adm-zip'); } catch { return null; }
})();

if (!AdmZip) {
  // Fallback: check file structure manually
  const raw = fs.readFileSync(filePath);
  console.log('Rozmiar pliku:', (raw.length / 1024 / 1024).toFixed(2), 'MB');
  
  // xlsx is a zip - check if it has images folder
  const content = raw.toString('binary');
  const hasMedia = content.includes('xl/media/');
  const hasDrawings = content.includes('xl/drawings/');
  console.log('Czy ma xl/media/ (osadzone obrazki):', hasMedia);
  console.log('Czy ma xl/drawings/:', hasDrawings);
  
  // Count JPEG signatures in file
  let jpegCount = 0;
  for (let i = 0; i < raw.length - 2; i++) {
    if (raw[i] === 0xFF && raw[i+1] === 0xD8 && raw[i+2] === 0xFF) {
      jpegCount++;
    }
  }
  console.log('Liczba sygnatur JPEG w pliku:', jpegCount);
} else {
  const zip = new AdmZip(filePath);
  const entries = zip.getEntries();
  const mediaEntries = entries.filter(e => e.entryName.startsWith('xl/media/'));
  console.log('Osadzone pliki graficzne:', mediaEntries.length);
  mediaEntries.slice(0, 10).forEach(e => console.log(' -', e.entryName, e.header.size, 'bytes'));
}
