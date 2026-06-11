import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const slug = params.slug;
    const searchParams = request.nextUrl.searchParams;
    const preview = searchParams.get('preview') === 'true';

    // Find offer by slug
    const offer = await db.offers.findBySlug(slug);
    if (!offer) {
      return NextResponse.json({ error: 'Oferta nie została znaleziona' }, { status: 404 });
    }

    if (!offer.isActive && !preview) {
      return NextResponse.json({ error: 'Ta oferta jest obecnie nieaktywna' }, { status: 403 });
    }

    // Get products for this offer
    const products = await db.products.findByOfferId(offer.id);

    // Apply customer discount if user is logged in
    let discountRate = 0;

    // Map products — compute imageUrl from SKU (normalize SKU: trim .0 decimal if number)
    const FALLBACK_IMG = 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&auto=format&fit=crop&q=60';
    const productsWithPrices = products.map(p => {
      // Normalize SKU — Excel sometimes gives "127972.0" instead of "127972"
      const normalizedSku = String(p.sku).replace(/\.0+$/, '').trim();
      const computedImageUrl = `/products/product_${normalizedSku}.jpeg`;
      return {
        ...p,
        sku: normalizedSku,
        imageUrl: computedImageUrl,
        _fallbackImage: p.imageUrl && p.imageUrl.startsWith('http') ? p.imageUrl : FALLBACK_IMG,
        originalPrice: p.originalPrice || p.price,
        price: p.price,
        discountRate: p.discountRate || 0
      };
    });

    return NextResponse.json({
      offer,
      products: productsWithPrices,
      discountRate
    });
  } catch (error) {
    console.error('Error fetching offer:', error);
    return NextResponse.json({ error: 'Błąd serwera podczas pobierania oferty' }, { status: 500 });
  }
}
