const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

const envPath = path.join(__dirname, '.env.local');
let databaseUrl = '';
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(/DATABASE_URL=["']?([^"'\r\n]+)["']?/);
  if (match) {
    databaseUrl = match[1];
  }
}

if (!databaseUrl) {
  console.error('No database URL found');
  process.exit(1);
}

const sql = neon(databaseUrl);

async function main() {
  try {
    const id = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const createdAt = new Date().toISOString();
    const status = 'new';
    
    // Attempting insertion as a logged-in client
    console.log('Inserting order into DB...');
    await sql`
      INSERT INTO orders (id, user_id, guest_device_id, client_name, client_nip, client_email, client_phone, comments, total_value, status, items, created_at)
      VALUES (${id}, 'user-test-client', null, 'Test Client Company', '1234567890', 'client@test.com', '123456789', 'Some comments', 123.45, ${status}, ${JSON.stringify([])}, ${new Date(createdAt)})
    `;
    console.log('Order inserted successfully!');
    
    // Clean up
    await sql`DELETE FROM orders WHERE id = ${id}`;
    console.log('Cleaned up test order.');
  } catch (err) {
    console.error('DB Order Insertion Error:', err);
  }
}

main();
