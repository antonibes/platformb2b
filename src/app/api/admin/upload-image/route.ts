import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { base64, filename } = await request.json();
    if (!base64 || !filename) {
      return NextResponse.json({ error: 'Missing base64 or filename' }, { status: 400 });
    }

    // Strip data URL prefix if present
    const base64Data = base64.includes(',') ? base64.split(',')[1] : base64;
    const buffer = Buffer.from(base64Data, 'base64');

    const blob = await put(`products/${filename}`, buffer, {
      access: 'public',
      contentType: 'image/jpeg',
    });

    return NextResponse.json({ url: blob.url });
  } catch (err: any) {
    console.error('[upload-image]', err?.message);
    return NextResponse.json({ error: err?.message || 'Upload failed' }, { status: 500 });
  }
}
