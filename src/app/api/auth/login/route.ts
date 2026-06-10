import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: 'E-mail i hasło są wymagane' }, { status: 400 });
    }

    const user = await db.users.findByEmail(email);
    if (!user) {
      return NextResponse.json({ error: 'Nieprawidłowy e-mail lub hasło' }, { status: 401 });
    }

    // In a production app, we would hash/check password with bcrypt
    if (user.passwordHash !== password) {
      return NextResponse.json({ error: 'Nieprawidłowy e-mail lub hasło' }, { status: 401 });
    }

    // Return user details without password
    const { passwordHash, ...userSession } = user;

    return NextResponse.json({
      success: true,
      user: userSession
    });
  } catch (error) {
    console.error('Error logging in:', error);
    return NextResponse.json({ error: 'Błąd serwera podczas logowania' }, { status: 500 });
  }
}
