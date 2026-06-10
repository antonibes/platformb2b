const { neon } = require('@neondatabase/serverless');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      process.env[key] = value;
    }
  });
}

const sql = neon(process.env.DATABASE_URL);

async function testOrder() {
  const id = `ORD-test-${Date.now()}`;
  const createdAt = new Date().toISOString();
  const status = 'new';
  const order = {
    userId: 'client-1',
    guestDeviceId: null,
    clientName: 'Test Client',
    clientNip: '1234567890',
    clientEmail: 'hurtownik@example.com',
    clientPhone: '123456789',
    comments: 'no comments',
    totalValue: 100.50,
    items: [
      {
        productId: 'prod-1',
        sku: 'SKU1',
        ean: 'EAN1',
        name: 'Test Product',
        quantity: 5,
        price: 20.10
      }
    ]
  };

  try {
    console.log('Testing SQL insert...');
    await sql`
      INSERT INTO orders (id, user_id, guest_device_id, client_name, client_nip, client_email, client_phone, comments, total_value, status, items, created_at)
      VALUES (${id}, ${order.userId}, ${order.guestDeviceId}, ${order.clientName}, ${order.clientNip}, ${order.clientEmail}, ${order.clientPhone}, ${order.comments}, ${order.totalValue}, ${status}, ${JSON.stringify(order.items)}, ${new Date(createdAt)})
    `;
    console.log('SQL insert success!');
  } catch (err) {
    console.error('SQL insert failed:', err);
  }
}

testOrder();
