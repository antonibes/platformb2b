import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { clientId, password } = body;

    if (!clientId || !password) {
      return NextResponse.json({ error: 'Identyfikator klienta i hasło są wymagane' }, { status: 400 });
    }

    // Try login by clientId first, then fall back to email for admin
    let user = await db.users.findByClientId(clientId);
    if (!user) {
      user = await db.users.findByEmail(clientId); // admin still uses email
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
