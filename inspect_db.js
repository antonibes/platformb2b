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
    const products = await sql`SELECT id, name, category, age, packaging, price FROM products WHERE offer_id = 'offer-1' ORDER BY id ASC LIMIT 5`;
    console.log('Products for offer-1 from DB:');
    console.log(JSON.stringify(products, null, 2));
  } catch (err) {
    console.error('DB Error:', err);
  }
}

main();
