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
    console.log('Adding column "position" to table "products" if it doesn\'t exist...');
    await sql`ALTER TABLE products ADD COLUMN IF NOT EXISTS position INT DEFAULT 0`;
    console.log('Success! Column "position" is ready.');
  } catch (err) {
    console.error('Migration Error:', err);
  }
}

main();
