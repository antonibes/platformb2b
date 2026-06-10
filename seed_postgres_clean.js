const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { neon } = require('@neondatabase/serverless');

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is missing');
  process.exit(1);
}
const sql = neon(connectionString);

async function run() {
  console.log('Rozpoczynanie importu produktów z uwzględnieniem wieku...');
  
  // 1. Load Excel
  const xlsxPath = path.join(process.cwd(), 'ASKATO_1006_HR.xlsx');
  const workbook = XLSX.readFile(xlsxPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // 2. Load Drawing image map
  const extractedDir = path.join(process.cwd(), 'temp_extracted');
  const drawingXmlPath = path.join(extractedDir, 'xl', 'drawings', 'drawing1.xml');
  const drawingRelsPath = path.join(extractedDir, 'xl', 'drawings', '_rels', 'drawing1.xml.rels');
  const mediaDir = path.join(extractedDir, 'xl', 'media');
  const outputDir = path.join(process.cwd(), 'public', 'products');
  
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const relsContent = fs.readFileSync(drawingRelsPath, 'utf8');
  const relsMap = {};
  const relRegex = /Id="([^"]+)"[^>]+Target="[^"]*media\/([^"]+)"/g;
  let match;
  while ((match = relRegex.exec(relsContent)) !== null) {
    relsMap[match[1]] = match[2];
  }
  
  const drawingContent = fs.readFileSync(drawingXmlPath, 'utf8');
  const anchors = drawingContent.split(/<\/xdr:twoCellAnchor>|<\/xdr:oneCellAnchor>/);
  const imageToCellMap = {};
  anchors.forEach(anchor => {
    if (!anchor.trim()) return;
    const fromColMatch = anchor.match(/<xdr:from>[^]*?<xdr:col>(\d+)<\/xdr:col>[^]*?<xdr:row>(\d+)<\/xdr:row>/);
    if (!fromColMatch) return;
    const row = parseInt(fromColMatch[2], 10);
    const embedMatch = anchor.match(/r:embed="([^"]+)"/);
    if (!embedMatch) return;
    const imageName = relsMap[embedMatch[1]];
    if (imageName) {
      imageToCellMap[row] = imageName;
    }
  });

  // 3. Update or Create Offer 'offer-1'
  const offerId = 'offer-1';
  const offerTitle = 'Oferta Czerwcowa 2026 - Askato Sp. z o.o.';
  const offerSlug = 'oferta-czerwcowa2026';
  
  console.log('Aktualizacja oferty w bazie...');
  await sql`
    INSERT INTO offers (id, title, slug, is_active, created_at)
    VALUES (${offerId}, ${offerTitle}, ${offerSlug}, true, NOW())
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      slug = EXCLUDED.slug,
      is_active = EXCLUDED.is_active
  `;

  // Clear existing products for this offer
  console.log('Czyszczenie starych produktów z bazy...');
  await sql`DELETE FROM products WHERE offer_id = ${offerId}`;

  // 4. Parse physical rows and map images
  console.log('Przetwarzanie wierszy i dopasowywanie obrazków...');
  const productsToInsert = [];
  
  // Row 0 is title block, Row 1 is header labels. Products start at Row 2.
  for (let r = 2; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!row || row.length === 0) continue;
    
    const sku = String(row[0] || '').trim();
    const ean = String(row[1] || '').trim();
    const category = String(row[2] || 'ZABAWKI').trim();
    const name = String(row[4] || '').trim();
    const rawPrice = row[6]; // CENA NETTO is in column G (index 6)
    const pcb = row[10]; // PCB is in column K (index 10)
    const description = String(row[5] || '').trim(); // Opis is in column F (index 5)
    
    // Parse age from column L (index 11)
    const rawAge = row[11];
    let age = '3+';
    if (rawAge !== undefined && rawAge !== '') {
      const parsedAge = parseInt(String(rawAge).trim(), 10);
      if (!isNaN(parsedAge)) {
        if (parsedAge >= 12) {
          age = `${parsedAge}m+`;
        } else {
          age = `${parsedAge}+`;
        }
      } else {
        age = String(rawAge).trim();
      }
    }
    
    if (!sku || !name || rawPrice === undefined) continue;
    
    let price = 0.0;
    if (typeof rawPrice === 'number') {
      price = rawPrice;
    } else {
      price = parseFloat(String(rawPrice).replace(',', '.').replace(/[^\d.]/g, ''));
    }
    if (isNaN(price) || price <= 0) continue;
    
    const packaging = pcb ? `Karton: ${pcb} szt.` : 'opak. 1 szt.';
    const stock = 100 + Math.floor(Math.random() * 200);
    
    // Get image from map (using exact drawing row coordinate)
    const imageName = imageToCellMap[r];
    let imageUrl = '/logo.png';
    
    if (imageName) {
      const srcPath = path.join(mediaDir, imageName);
      const destName = `product_${sku}.jpeg`;
      const destPath = path.join(outputDir, destName);
      
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        imageUrl = `/products/${destName}`;
      }
    }
    
    productsToInsert.push({
      id: `prod-seeded-${r}`,
      offerId,
      sku,
      ean,
      category,
      name,
      price: parseFloat(price.toFixed(2)),
      imageUrl,
      packaging,
      stock,
      description,
      age
    });
  }

  console.log(`Przygotowano ${productsToInsert.length} produktów do zapisu.`);
  
  // 5. Bulk insert products using parameterized query
  if (productsToInsert.length > 0) {
    const values = [];
    const placeholders = [];
    let index = 1;
    
    productsToInsert.forEach((p) => {
      placeholders.push(`($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4}, $${index + 5}, $${index + 6}, $${index + 7}, $${index + 8}, $${index + 9}, $${index + 10}, $${index + 11})`);
      values.push(
        p.id,
        p.offerId,
        p.sku,
        p.ean,
        p.category,
        p.name,
        p.price,
        p.imageUrl,
        p.packaging,
        p.stock,
        p.description || null,
        p.age
      );
      index += 12;
    });
    
    const query = `
      INSERT INTO products (id, offer_id, sku, ean, category, name, price, image_url, packaging, stock, description, age)
      VALUES ${placeholders.join(', ')}
    `;
    
    await sql.query(query, values);
    console.log(`Pomyślnie wstawiono ${productsToInsert.length} produktów do Neon Postgres!`);
  }

  // 6. Update local db.json as well so local matches remote
  const dbJsonPath = path.join(process.cwd(), 'db.json');
  if (fs.existsSync(dbJsonPath)) {
    const db = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));
    db.offers = [{
      id: offerId,
      title: offerTitle,
      slug: offerSlug,
      isActive: true,
      createdAt: new Date().toISOString()
    }];
    db.products = productsToInsert;
    fs.writeFileSync(dbJsonPath, JSON.stringify(db, null, 2), 'utf-8');
    console.log('Lokalny db.json zaktualizowany.');
  }

  console.log('Import zakończony pełnym sukcesem!');
}

run().catch(console.error);
