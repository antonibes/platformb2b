/**
 * Ekstrahuje osadzone obrazki z pliku xlsx i zapisuje jako product_{SKU}.jpeg
 * Mapowanie: obrazek w wierszu N → SKU z wiersza N
 */
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');
// const { DOMParser } = require('@xmldom/xmldom');

// Fallback XML parser using built-in string parsing
function extractDrawingAnchors(xmlStr) {
  // Parse <xdr:oneCellAnchor> and <xdr:twoCellAnchor> to get row and image ref
  const anchors = [];
  
  // Match twoCellAnchor blocks
  const anchorRegex = /<xdr:(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
  let match;
  
  while ((match = anchorRegex.exec(xmlStr)) !== null) {
    const block = match[1];
    
    // Get starting row (from element)
    const rowMatch = block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
    const row = rowMatch ? parseInt(rowMatch[1]) : null;
    
    // Get image relationship id
    const rIdMatch = block.match(/(?:r:embed|r:id)="(rId\d+)"/);
    const rId = rIdMatch ? rIdMatch[1] : null;
    
    if (row !== null && rId) {
      anchors.push({ row, rId });
    }
  }
  
  return anchors;
}

function extractRels(xmlStr) {
  const rels = {};
  const relRegex = /<Relationship[^>]*Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
  let match;
  while ((match = relRegex.exec(xmlStr)) !== null) {
    rels[match[1]] = match[2];
  }
  return rels;
}

async function main() {
  const xlsxPath = path.join(process.cwd(), 'ASKATO OFERTA ATENEUM wyłączność 09.03 stany.xlsx');
  const outputDir = path.join(process.cwd(), 'public', 'products');
  
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  
  // Read xlsx as zip
  const raw = fs.readFileSync(xlsxPath);
  
  // Extract ZIP manually using XLSX's zip reader
  const zip = XLSX.utils.cfb_new ? null : null;
  
  // Use JSZip approach via buffer
  const JSZip = (() => {
    try { return require('jszip'); } catch { return null; }
  })();
  
  let files;
  
  if (JSZip) {
    const z = await JSZip.loadAsync(raw);
    files = z.files;
    
    // Read drawing XML
    const drawingFile = files['xl/drawings/drawing1.xml'];
    if (!drawingFile) {
      console.log('Brak drawing1.xml');
      return;
    }
    const drawingXml = await drawingFile.async('string');
    
    // Read drawing rels
    const drawingRelsFile = files['xl/drawings/_rels/drawing1.xml.rels'];
    const drawingRelsXml = drawingRelsFile ? await drawingRelsFile.async('string') : '';
    
    const anchors = extractDrawingAnchors(drawingXml);
    const rels = extractRels(drawingRelsXml);
    
    console.log(`Znaleziono ${anchors.length} obrazków z powiązaniami wierszy`);
    
    // Read sheet data to map row → SKU
    const workbook = XLSX.read(raw, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    
    // Find header
    let headerRowIdx = 0;
    for (let i = 0; i < 5; i++) {
      const r = rawRows[i].map(c => String(c).toLowerCase().trim());
      if (r.some(c => c === 'kod' || c === 'sku')) { headerRowIdx = i; break; }
    }
    const headerRow = rawRows[headerRowIdx].map(h => String(h).trim().toLowerCase());
    const skuIdx = headerRow.findIndex(h => h === 'kod' || h === 'sku' || h === 'symbol');
    
    // Row in drawing is 0-based from start of sheet, data rows start after header
    // drawing row 0 = xlsx row 1 (row index), headerRowIdx+1 = first data row
    
    let saved = 0;
    const results = [];
    
    for (const anchor of anchors) {
      const excelRowIdx = anchor.row; // 0-based Excel row
      const dataRowIdx = excelRowIdx - (headerRowIdx + 1); // offset from data start
      const dataRow = rawRows[excelRowIdx + 1] || rawRows[excelRowIdx]; // +1 for 0-based
      
      // Try multiple row offsets to find SKU
      let sku = null;
      for (const offset of [0, 1, -1]) {
        const tryRow = rawRows[excelRowIdx + 1 + offset] || rawRows[excelRowIdx + offset];
        if (tryRow && tryRow[skuIdx]) {
          const s = String(tryRow[skuIdx]).replace(/\.0+$/, '').trim();
          if (s && s !== '') { sku = s; break; }
        }
      }
      
      if (!sku) {
        results.push(`  ⚠️  Wiersz ${anchor.row}: brak SKU`);
        continue;
      }
      
      const mediaTarget = rels[anchor.rId];
      if (!mediaTarget) {
        results.push(`  ❌ SKU ${sku}: brak relacji dla ${anchor.rId}`);
        continue;
      }
      
      const mediaPath = `xl/drawings/${mediaTarget}`.replace(/\/\.\.\//g, '/').replace('xl/drawings/../', 'xl/');
      const mediaFile = files[mediaPath] || files[mediaPath.replace('xl/drawings/', '')];
      
      if (!mediaFile) {
        // Try alternative paths
        const altPath = `xl/media/${path.basename(mediaTarget)}`;
        const altFile = files[altPath];
        if (!altFile) {
          results.push(`  ❌ SKU ${sku}: nie znaleziono pliku ${mediaPath}`);
          continue;
        }
        const buf = await altFile.async('nodebuffer');
        const dest = path.join(outputDir, `product_${sku}.jpeg`);
        fs.writeFileSync(dest, buf);
        saved++;
        results.push(`  ✅ SKU ${sku} → ${altPath}`);
        continue;
      }
      
      const buf = await mediaFile.async('nodebuffer');
      const dest = path.join(outputDir, `product_${sku}.jpeg`);
      fs.writeFileSync(dest, buf);
      saved++;
      results.push(`  ✅ SKU ${sku} → ${path.basename(mediaTarget)}`);
    }
    
    console.log('\nWyniki:');
    results.slice(0, 20).forEach(r => console.log(r));
    if (results.length > 20) console.log(`  ... i ${results.length - 20} więcej`);
    console.log(`\nZapisano: ${saved} obrazków`);
    
  } else {
    console.log('jszip nie jest zainstalowany. Instaluję...');
    require('child_process').execSync('npm install jszip', { stdio: 'inherit' });
    console.log('Zainstalowano jszip. Uruchom ponownie skrypt.');
  }
}

main().catch(console.error);
