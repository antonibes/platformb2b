import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

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
    const { clientId, discountRate } = await request.json();
    if (!clientId || discountRate === undefined) {
      return NextResponse.json({ error: 'Brakujące parametry' }, { status: 400 });
    }

    const rate = parseFloat(discountRate);
    if (isNaN(rate) || rate < 0 || rate > 1) {
      return NextResponse.json({ error: 'Nieprawidłowa wartość rabatu (musi być od 0 do 1)' }, { status: 400 });
    }

    const updated = await db.users.update(clientId, { discountRate: rate });
    if (!updated) {
      return NextResponse.json({ error: 'Nie znaleziono klienta' }, { status: 404 });
    }

    return NextResponse.json({ success: true, client: updated });
  } catch (error: any) {
    console.error('Error updating client discount:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
