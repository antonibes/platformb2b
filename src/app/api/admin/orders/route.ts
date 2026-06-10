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
    const orders = (await db.orders.findMany()).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return NextResponse.json({ orders });
  } catch (error) {
    console.error('Error fetching admin orders:', error);
    return NextResponse.json({ error: 'Błąd serwera podczas pobierania zamówień' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { orderId, status } = body;

    if (!orderId || !status) {
      return NextResponse.json({ error: 'Brakujące parametry (orderId lub status)' }, { status: 400 });
    }

    const updated = await db.orders.updateStatus(orderId, status);
    if (!updated) {
      return NextResponse.json({ error: 'Zamówienie nie istnieje' }, { status: 404 });
    }

    return NextResponse.json({ success: true, order: updated });
  } catch (error) {
    console.error('Error updating order status:', error);
    return NextResponse.json({ error: 'Błąd serwera podczas aktualizacji statusu' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { orderId } = await request.json();
    if (!orderId) return NextResponse.json({ error: 'Brak orderId' }, { status: 400 });

    const sql = getSql();
    if (sql) {
      await sql`DELETE FROM orders WHERE id = ${orderId}`;
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting order:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
