import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const sql = neon(process.env.DATABASE_URL!);

    // Find all products with base64 images
    const products = await sql`
      SELECT id, sku, image_url FROM products
      WHERE image_url LIKE 'data:%'
      LIMIT 50
    `;

    if (products.length === 0) {
      return NextResponse.json({ done: true, migrated: 0, message: 'Brak obrazków do migracji' });
    }

    let migrated = 0;
    let failed = 0;

    for (const product of products) {
      try {
        const base64Data = product.image_url.includes(',')
          ? product.image_url.split(',')[1]
          : product.image_url;

        const buffer = Buffer.from(base64Data, 'base64');
        const filename = `products/${product.sku || product.id}.jpg`;

        const blob = await put(filename, buffer, {
          access: 'public',
          contentType: 'image/jpeg',
        });

        await sql`UPDATE products SET image_url = ${blob.url} WHERE id = ${product.id}`;
        migrated++;
      } catch (err: any) {
        console.error(`[migrate-images] Failed for product ${product.id}:`, err?.message);
        failed++;
      }
    }

    // Check if more remain
    const remaining = await sql`
      SELECT COUNT(*) as count FROM products WHERE image_url LIKE 'data:%'
    `;
    const remainingCount = Number(remaining[0].count);

    return NextResponse.json({
      done: remainingCount === 0,
      migrated,
      failed,
      remaining: remainingCount,
    });
  } catch (err: any) {
    console.error('[migrate-images]', err?.message);
    return NextResponse.json({ error: err?.message || 'Migration failed' }, { status: 500 });
  }
}
