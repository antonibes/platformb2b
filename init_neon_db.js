const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

// Load environment variables from .env.local manually
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      } else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  });
}

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('Błąd: Brak zmiennej DATABASE_URL w .env.local lub środowisku!');
  process.exit(1);
}

const sql = neon(connectionString);

async function run() {
  console.log('Rozpoczynanie migracji do Neon PostgreSQL...');

  try {
    // 1. Create Tables
    console.log('Tworzenie tabel...');

    await sql`
      CREATE TABLE IF NOT EXISTS b2b_users (
        id VARCHAR(100) PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        company_name VARCHAR(255) NOT NULL,
        nip VARCHAR(50) NOT NULL,
        discount_rate DECIMAL(5,2) DEFAULT 0.00,
        role VARCHAR(50) DEFAULT 'client'
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS offers (
        id VARCHAR(100) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        slug VARCHAR(255) UNIQUE NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(100) PRIMARY KEY,
        offer_id VARCHAR(100) REFERENCES offers(id) ON DELETE CASCADE,
        sku VARCHAR(100) NOT NULL,
        ean VARCHAR(100) NOT NULL,
        category VARCHAR(255),
        name TEXT NOT NULL,
        price DECIMAL(12,2) NOT NULL,
        image_url TEXT NOT NULL,
        packaging VARCHAR(255) NOT NULL,
        stock INT NOT NULL,
        description TEXT,
        position INT DEFAULT 0
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100),
        guest_device_id VARCHAR(100),
        client_name VARCHAR(255),
        client_nip VARCHAR(50),
        client_email VARCHAR(255),
        client_phone VARCHAR(100),
        comments TEXT,
        total_value DECIMAL(12,2),
        status VARCHAR(50) DEFAULT 'new',
        items JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS tracking_events (
        id VARCHAR(100) PRIMARY KEY,
        device_id VARCHAR(100),
        user_id VARCHAR(100),
        event_type VARCHAR(100),
        offer_slug VARCHAR(255),
        payload JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    console.log('Tabele zostały pomyślnie utworzone.');

    // 2. Read db.json
    const dbJsonPath = path.join(process.cwd(), 'db.json');
    if (!fs.existsSync(dbJsonPath)) {
      console.log('Brak pliku db.json do zmigrowania. Zakończono pomyślnie.');
      return;
    }

    console.log('Odczytywanie danych z db.json...');
    const dbData = JSON.parse(fs.readFileSync(dbJsonPath, 'utf8'));

    // 3. Migrate Users
    if (dbData.users && dbData.users.length > 0) {
      console.log(`Migracja użytkowników (${dbData.users.length})...`);
      for (const u of dbData.users) {
        await sql`
          INSERT INTO b2b_users (id, email, password_hash, company_name, nip, discount_rate, role)
          VALUES (${u.id}, ${u.email}, ${u.passwordHash}, ${u.companyName}, ${u.nip}, ${u.discountRate}, ${u.role})
          ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            password_hash = EXCLUDED.password_hash,
            company_name = EXCLUDED.company_name,
            nip = EXCLUDED.nip,
            discount_rate = EXCLUDED.discount_rate,
            role = EXCLUDED.role
        `;
      }
    }

    // 4. Migrate Offers
    if (dbData.offers && dbData.offers.length > 0) {
      console.log(`Migracja ofert (${dbData.offers.length})...`);
      for (const o of dbData.offers) {
        await sql`
          INSERT INTO offers (id, title, slug, is_active, created_at)
          VALUES (${o.id}, ${o.title}, ${o.slug}, ${o.isActive}, ${new Date(o.createdAt)})
          ON CONFLICT (id) DO UPDATE SET
            title = EXCLUDED.title,
            slug = EXCLUDED.slug,
            is_active = EXCLUDED.is_active,
            created_at = EXCLUDED.created_at
        `;
      }
    }

    // 5. Migrate Products
    if (dbData.products && dbData.products.length > 0) {
      console.log(`Migracja produktów (${dbData.products.length})...`);
      for (const p of dbData.products) {
        await sql`
          INSERT INTO products (id, offer_id, sku, ean, category, name, price, image_url, packaging, stock, description)
          VALUES (${p.id}, ${p.offerId}, ${p.sku}, ${p.ean}, ${p.category || 'Zabawki'}, ${p.name}, ${p.price}, ${p.imageUrl}, ${p.packaging}, ${p.stock}, ${p.description || null})
          ON CONFLICT (id) DO UPDATE SET
            offer_id = EXCLUDED.offer_id,
            sku = EXCLUDED.sku,
            ean = EXCLUDED.ean,
            category = EXCLUDED.category,
            name = EXCLUDED.name,
            price = EXCLUDED.price,
            image_url = EXCLUDED.image_url,
            packaging = EXCLUDED.packaging,
            stock = EXCLUDED.stock,
            description = EXCLUDED.description
        `;
      }
    }

    // 6. Migrate Orders
    if (dbData.orders && dbData.orders.length > 0) {
      console.log(`Migracja zamówień (${dbData.orders.length})...`);
      for (const o of dbData.orders) {
        await sql`
          INSERT INTO orders (id, user_id, guest_device_id, client_name, client_nip, client_email, client_phone, comments, total_value, status, items, created_at)
          VALUES (${o.id}, ${o.userId}, ${o.guestDeviceId}, ${o.clientName}, ${o.clientNip}, ${o.clientEmail}, ${o.clientPhone}, ${o.comments}, ${o.totalValue}, ${o.status}, ${JSON.stringify(o.items)}, ${new Date(o.createdAt)})
          ON CONFLICT (id) DO UPDATE SET
            user_id = EXCLUDED.user_id,
            guest_device_id = EXCLUDED.guest_device_id,
            client_name = EXCLUDED.client_name,
            client_nip = EXCLUDED.client_nip,
            client_email = EXCLUDED.client_email,
            client_phone = EXCLUDED.client_phone,
            comments = EXCLUDED.comments,
            total_value = EXCLUDED.total_value,
            status = EXCLUDED.status,
            items = EXCLUDED.items,
            created_at = EXCLUDED.created_at
        `;
      }
    }

    // 7. Migrate Tracking Events
    if (dbData.trackingEvents && dbData.trackingEvents.length > 0) {
      console.log(`Migracja zdarzeń trackingowych (${dbData.trackingEvents.length})...`);
      for (const e of dbData.trackingEvents) {
        await sql`
          INSERT INTO tracking_events (id, device_id, user_id, event_type, offer_slug, payload, created_at)
          VALUES (${e.id}, ${e.deviceId}, ${e.userId}, ${e.eventType}, ${e.offerSlug}, ${JSON.stringify(e.payload)}, ${new Date(e.createdAt)})
          ON CONFLICT (id) DO UPDATE SET
            device_id = EXCLUDED.device_id,
            user_id = EXCLUDED.user_id,
            event_type = EXCLUDED.event_type,
            offer_slug = EXCLUDED.offer_slug,
            payload = EXCLUDED.payload,
            created_at = EXCLUDED.created_at
        `;
      }
    }

    console.log('Migracja danych zakończona pełnym sukcesem!');
  } catch (error) {
    console.error('Wystąpił błąd podczas migracji:', error);
    process.exit(1);
  }
}

run();
