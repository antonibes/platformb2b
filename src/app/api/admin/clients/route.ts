import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const getSql = () => {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  return url ? neon(url) : null;
};

function generateToken(): string {
  return `setup_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

export async function GET() {
  try {
    const clients = (await db.users.findMany()).filter(u => u.role === 'client');
    return NextResponse.json({ clients });
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Action: update discount
    if (action === 'update_discount' || (!action && body.clientId && body.discountRate !== undefined)) {
      const { clientId, discountRate } = body;
      const rate = parseFloat(discountRate);
      if (isNaN(rate) || rate < 0 || rate > 1) {
        return NextResponse.json({ error: 'Nieprawidłowa wartość rabatu (musi być od 0 do 1)' }, { status: 400 });
      }
      const updated = await db.users.update(clientId, { discountRate: rate });
      if (!updated) return NextResponse.json({ error: 'Nie znaleziono klienta' }, { status: 404 });
      return NextResponse.json({ success: true, client: updated });
    }

    // Action: create new client (clientId-based, no password required at creation)
    if (action === 'create') {
      const { clientId, email, companyName, nip, discountRate, sendSetupLink } = body;
      if (!clientId) {
        return NextResponse.json({ error: 'Identyfikator klienta jest wymagany' }, { status: 400 });
      }

      // Check uniqueness
      const existingById = await db.users.findByClientId(clientId);
      if (existingById) {
        return NextResponse.json({ error: 'Klient z tym identyfikatorem już istnieje' }, { status: 400 });
      }

      const id = `client-${Date.now()}`;
      const sql = getSql();
      const rate = parseFloat(discountRate || '0') || 0;
      const setupToken = generateToken();

      if (sql) {
        // Try to add new columns if not exist (graceful migration)
        try {
          await sql`ALTER TABLE b2b_users ADD COLUMN IF NOT EXISTS client_id TEXT`;
          await sql`ALTER TABLE b2b_users ADD COLUMN IF NOT EXISTS phone TEXT DEFAULT ''`;
          await sql`ALTER TABLE b2b_users ADD COLUMN IF NOT EXISTS setup_token TEXT`;
          await sql`ALTER TABLE b2b_users ADD COLUMN IF NOT EXISTS setup_complete BOOLEAN DEFAULT false`;
        } catch (_) { /* columns may already exist */ }

        await sql`
          INSERT INTO b2b_users (id, client_id, email, password_hash, company_name, nip, discount_rate, role, setup_token, setup_complete)
          VALUES (${id}, ${clientId}, ${email || ''}, '', ${companyName || ''}, ${nip || ''}, ${rate}, 'client', ${setupToken}, false)
        `;
      }

      const newClient = {
        id, clientId, email: email || '',
        companyName: companyName || '',
        nip: nip || '', discountRate: rate,
        role: 'client' as const,
        setupToken,
        setupComplete: false,
        passwordHash: ''
      };

      return NextResponse.json({ success: true, client: newClient, setupToken });
    }

    return NextResponse.json({ error: 'Nieznana akcja' }, { status: 400 });
  } catch (error: any) {
    console.error('Error managing client:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { clientId } = await request.json();
    if (!clientId) return NextResponse.json({ error: 'Brak clientId' }, { status: 400 });

    const sql = getSql();
    if (sql) {
      await sql`DELETE FROM b2b_users WHERE id = ${clientId} AND role = 'client'`;
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting client:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
