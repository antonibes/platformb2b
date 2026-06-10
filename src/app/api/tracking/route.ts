import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { deviceId, userId, eventType, offerSlug, payload } = body;

    if (!deviceId || !eventType || !offerSlug) {
      return NextResponse.json({ error: 'Brakujące parametry śledzenia' }, { status: 400 });
    }

    const event = db.tracking.create({
      deviceId,
      userId: userId || null,
      eventType,
      offerSlug,
      payload: payload || {},
    });

    return NextResponse.json({ success: true, eventId: event.id });
  } catch (error) {
    console.error('Error saving tracking event:', error);
    return NextResponse.json({ error: 'Błąd serwera podczas zapisu śledzenia' }, { status: 500 });
  }
}
