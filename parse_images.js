const fs = require('fs');
const path = require('path');

// RegExp is used to parse the XML structure

// Paths
const extractedDir = path.join(__dirname, 'temp_extracted');
const drawingXmlPath = path.join(extractedDir, 'xl', 'drawings', 'drawing1.xml');
const drawingRelsPath = path.join(extractedDir, 'xl', 'drawings', '_rels', 'drawing1.xml.rels');
const mediaDir = path.join(extractedDir, 'xl', 'media');
const outputDir = path.join(__dirname, 'public', 'products');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 1. Read relations to map rId -> image filename (e.g. rId1 -> image1.jpeg)
const relsContent = fs.readFileSync(drawingRelsPath, 'utf8');
const relsMap = {};
// Example: <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image1.jpeg"/>
const relRegex = /Id="([^"]+)"[^>]+Target="[^"]*media\/([^"]+)"/g;
let match;
while ((match = relRegex.exec(relsContent)) !== null) {
  relsMap[match[1]] = match[2];
}

console.log('Mapped relationships count:', Object.keys(relsMap).length);

// 2. Read drawings XML to map row -> rId
const drawingContent = fs.readFileSync(drawingXmlPath, 'utf8');

// We need to parse each <xdr:twoCellAnchor> or <xdr:oneCellAnchor> block.
// A simple way is to split by </xdr:twoCellAnchor> or similar.
const anchors = drawingContent.split(/<\/xdr:twoCellAnchor>|<\/xdr:oneCellAnchor>/);
const imageToCellMap = {}; // row -> image name

anchors.forEach(anchor => {
  if (!anchor.trim()) return;

  // Extract from column and row
  // <xdr:from><xdr:col>3</xdr:col>...<xdr:row>1</xdr:row></xdr:from>
  const fromColMatch = anchor.match(/<xdr:from>[^]*?<xdr:col>(\d+)<\/xdr:col>[^]*?<xdr:row>(\d+)<\/xdr:row>/);
  if (!fromColMatch) return;

  const col = parseInt(fromColMatch[1], 10);
  const row = parseInt(fromColMatch[2], 10);

  // Extract embed relation ID
  // <a:blip r:embed="rId1"...
  const embedMatch = anchor.match(/r:embed="([^"]+)"/);
  if (!embedMatch) return;

  const rId = embedMatch[1];
  const imageName = relsMap[rId];

  if (imageName) {
    // Excel row indices are 0-based.
    // The Excel sheet data row index maps to this row number.
    imageToCellMap[row] = imageName;
  }
});

console.log('Mapped rows to images count:', Object.keys(imageToCellMap).length);

// 3. Update db.json
const dbPath = path.join(__dirname, 'db.json');
if (fs.existsSync(dbPath)) {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
  let updatedCount = 0;

  db.products = db.products.map(product => {
    // product.id is 'prod-seeded-X' where X is the row index in rows array (1-based sheet row index)
    // Excel row is row. Let's see: in seed_xlsx.js, rows[0] is Header (row 1 in excel).
    // rows[i] (index i) is row (i+1) in excel (which is index i in 0-based xml row).
    // Let's verify: rows[i] maps to row index i in 0-based drawing row.
    // Let's check:
    const idParts = product.id.split('-');
    const rowIndex = parseInt(idParts[idParts.length - 1], 10);
    
    // rowIndex is the loop index in seed_xlsx.js.
    // Let's check drawing row mapping.
    // In excel, row 1 is header (XML row 0). Product 1 is row 2 (XML row 1).
    // In seed_xlsx.js, parsedProducts.push for i = 1, i = 2, etc.
    // So for i = 1 (rowIndex = 1), the product is in row 2 of Excel, which is XML row 1.
    // So the XML row index matches the loop index `i`!
    const imageName = imageToCellMap[rowIndex];

    if (imageName) {
      const srcPath = path.join(mediaDir, imageName);
      const destName = `product_${product.sku}.jpeg`;
      const destPath = path.join(outputDir, destName);

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        product.imageUrl = `/products/${destName}`;
        updatedCount++;
      }
    } else {
      // Fallback placeholder if no image exists in excel for this row
      product.imageUrl = '/logo.png';
    }
    return product;
  });

  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  console.log(`Successfully updated ${updatedCount} products in db.json with Excel images!`);
} else {
  console.log('db.json not found');
}
