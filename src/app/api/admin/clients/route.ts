import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const getSql = () => {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  return url ? neon(url) : null;
};

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

    // Action: create new client
    if (action === 'create') {
      const { email, password, companyName, nip, discountRate } = body;
      if (!email || !password || !companyName) {
        return NextResponse.json({ error: 'Email, hasło i nazwa firmy są wymagane' }, { status: 400 });
      }

      const existing = await db.users.findByEmail(email);
      if (existing) {
        return NextResponse.json({ error: 'Klient z tym adresem email już istnieje' }, { status: 400 });
      }

      const id = `client-${Date.now()}`;
      const sql = getSql();
      const rate = parseFloat(discountRate || '0') || 0;

      if (sql) {
        await sql`
          INSERT INTO b2b_users (id, email, password_hash, company_name, nip, discount_rate, role)
          VALUES (${id}, ${email}, ${password}, ${companyName}, ${nip || ''}, ${rate}, 'client')
        `;
      }

      const newClient = {
        id,
        email,
        companyName,
        nip: nip || '',
        discountRate: rate,
        role: 'client' as const
      };
      return NextResponse.json({ success: true, client: newClient });
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
