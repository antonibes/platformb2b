const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const xlsxPath = path.join(process.cwd(), 'ASKATO_1006_HR.xlsx');
const dbPath = path.join(process.cwd(), 'db.json');

try {
  // Read Excel
  const workbook = XLSX.readFile(xlsxPath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  // raw: true to preserve exact numbers
  const rows = XLSX.utils.sheet_to_json(sheet);
  
  if (rows.length === 0) {
    console.error('No rows found in Excel sheet.');
    process.exit(1);
  }

  // Load existing DB
  let db = {
    users: [],
    offers: [],
    products: [],
    orders: [],
    trackingEvents: []
  };

  if (fs.existsSync(dbPath)) {
    db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
  }

  // Set the default offer
  const offerId = 'offer-1';
  db.offers = [
    {
      id: offerId,
      title: 'OFERTA CZERWIEC 2026 - Askato Sp. z o.o.',
      slug: 'letnia-promocja-2026',
      isActive: true,
      createdAt: new Date().toISOString()
    }
  ];

  // Parse products (skip headers, which is index 0 in sheet_to_json usually if it read row 1 as keys)
  // Wait, sheet_to_json used row 1 (index 0) as header keys like '__EMPTY', '__EMPTY_1' because the top cell was merged or text.
  // So rows[0] is: { __EMPTY: 'Kod', __EMPTY_1: 'EAN', __EMPTY_2: 'Kategoria', __EMPTY_4: 'Nazwa', ... }
  // We need to skip rows[0] because it's just headers.
  
  const parsedProducts = [];
  
  // Toy images fallback pool
  const toyImages = [
    'https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=500&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1539627831859-a911cf04d3cd?w=500&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1558060370-d644479cb6f7?w=500&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1515488042361-404e9250afef?w=500&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1566577134770-3d85bb3a9cc4?w=500&auto=format&fit=crop&q=80'
  ];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    
    const sku = String(row.__EMPTY || '').trim();
    const ean = String(row.__EMPTY_1 || '').trim();
    const category = String(row.__EMPTY_2 || 'ZABAWKI').trim();
    const name = String(row.__EMPTY_4 || '').trim();
    const rawPrice = row.__EMPTY_5;
    const pcb = row.__EMPTY_9; // Packaging multiplier

    if (!name || !rawPrice) continue;

    let price = 0.0;
    if (typeof rawPrice === 'number') {
      price = rawPrice;
    } else {
      price = parseFloat(String(rawPrice).replace(',', '.').replace(/[^\d.]/g, ''));
    }

    if (isNaN(price) || price <= 0) continue;

    const packaging = pcb ? `Karton: ${pcb} szt.` : 'opak. 1 szt.';
    const stock = 100 + Math.floor(Math.random() * 200); // Random mock stock for B2B order limits
    const description = row['OFERTA CZERWIEC 2026'] ? String(row['OFERTA CZERWIEC 2026']).trim() : '';

    // Select image based on hash of SKU to keep it consistent
    const imgIndex = Math.abs(sku.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % toyImages.length;
    const imageUrl = toyImages[imgIndex];

    parsedProducts.push({
      id: `prod-seeded-${i}`,
      offerId: offerId,
      sku: sku,
      ean: ean,
      category: category,
      name: name,
      price: parseFloat(price.toFixed(2)),
      imageUrl: imageUrl,
      packaging: packaging,
      stock: stock,
      description: description
    });
  }

  db.products = parsedProducts;
  fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
  console.log(`Seeded ${parsedProducts.length} products successfully!`);

} catch (error) {
  console.error('Error during database seeding:', error);
}
