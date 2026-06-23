const fs = require('fs');
const path = require('path');
const { neon } = require('@neondatabase/serverless');

const envPath = path.join(process.cwd(), '.env.local');
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
    const orders = await sql`SELECT id, created_at, client_name FROM orders ORDER BY created_at DESC LIMIT 5`;
    console.log('Last 5 orders:');
    console.log(orders);
  } catch (err) {
    console.error('DB Error:', err);
  }
}

main();
