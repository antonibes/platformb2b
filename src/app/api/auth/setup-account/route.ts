import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const getSql = () => {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  return url ? neon(url) : null;
};

// GET: verify token and return user info (for pre-filling form)
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get('token');
    if (!token) return NextResponse.json({ error: 'Brak tokenu' }, { status: 400 });

    const user = await db.users.findBySetupToken(token);
    if (!user) return NextResponse.json({ error: 'Nieprawidłowy lub wygasły link aktywacyjny' }, { status: 404 });

    return NextResponse.json({
      success: true,
      clientId: user.clientId,
      companyName: user.companyName,
      email: user.email
    });
  } catch (error) {
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

// POST: complete account setup
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { token, password, companyName, nip, phone, clientId } = body;

    if (!token || !password) {
      return NextResponse.json({ error: 'Token i hasło są wymagane' }, { status: 400 });
    }

    const user = await db.users.findBySetupToken(token);
    if (!user) {
      return NextResponse.json({ error: 'Nieprawidłowy lub wygasły link aktywacyjny' }, { status: 404 });
    }

    // If clientId is being changed, check it's not taken
    const newClientId = clientId?.trim() || user.clientId;
    if (newClientId !== user.clientId) {
      const existing = await db.users.findByClientId(newClientId);
      if (existing && existing.id !== user.id) {
        return NextResponse.json({ error: 'Ten identyfikator jest już zajęty' }, { status: 400 });
      }
    }

    const sql = getSql();
    if (sql) {
      await sql`
        UPDATE b2b_users
        SET password_hash = ${password},
            company_name = ${companyName || user.companyName},
            nip = ${nip || user.nip},
            phone = ${phone || ''},
            client_id = ${newClientId},
            setup_token = NULL,
            setup_complete = true
        WHERE id = ${user.id}
      `;
    } else {
      await db.users.update(user.id, {
        passwordHash: password,
        companyName: companyName || user.companyName,
        nip: nip || user.nip,
        phone: phone || '',
        clientId: newClientId,
        setupToken: undefined,
        setupComplete: true
      });
    }

    return NextResponse.json({ success: true, clientId: newClientId });
  } catch (error: any) {
    console.error('Setup account error:', error);
    return NextResponse.json({ error: error.message || 'Błąd serwera' }, { status: 500 });
  }
}
