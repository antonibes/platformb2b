import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, email, password } = body;
    const identifier = clientId || email;

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Identyfikator klienta i hasło są wymagane' }, { status: 400 });
    }

    // Try login by clientId first, then fall back to email
    let user = await db.users.findByClientId(identifier).catch(() => null);
    if (!user) {
      user = await db.users.findByEmail(identifier);
    }

    if (!user) {
      return NextResponse.json({ error: 'Nieprawidłowy identyfikator lub hasło' }, { status: 401 });
    }

    if (!user.passwordHash || user.passwordHash !== password) {
      return NextResponse.json({ error: 'Nieprawidłowy identyfikator lub hasło' }, { status: 401 });
    }

    if (user.setupToken && !user.setupComplete) {
      return NextResponse.json({ error: 'Konto nie zostało jeszcze aktywowane. Sprawdź swój e-mail i dokończ rejestrację.' }, { status: 403 });
    }

    const { passwordHash, setupToken, ...userSession } = user;
    return NextResponse.json({ success: true, user: userSession });
  } catch (error) {
    console.error('Error logging in:', error);
    return NextResponse.json({ error: 'Błąd serwera podczas logowania' }, { status: 500 });
  }
}
