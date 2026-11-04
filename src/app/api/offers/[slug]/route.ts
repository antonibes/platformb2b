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

      // Priority: use imageUrl stored in DB (may be local path, data: URL, or http URL)
      // Fall back to constructed local path, then Unsplash placeholder
      const localPath = `/products/product_${normalizedSku}.jpeg`;
      const storedUrl = p.imageUrl ? String(p.imageUrl).trim() : '';
      const resolvedImageUrl = storedUrl || localPath;

      // For onError fallback: if stored URL is http → use it, else Unsplash
      const fallbackUrl = storedUrl.startsWith('http') ? storedUrl : FALLBACK_IMG;

      // Promo prices apply only when the offer has them switched on and the promo is lower than the regular price.
      // Otherwise the product shows its plain regular price with no strikethrough.
      const promo = p.promoPrice && p.promoPrice > 0 && p.promoPrice < p.price ? p.promoPrice : null;
      const isPromo = !!offer.promoEnabled && promo !== null;

      return {
        ...p,
        sku: normalizedSku,
        imageUrl: resolvedImageUrl,
        _fallbackImage: fallbackUrl,
        originalPrice: p.price,
        price: isPromo ? promo! : p.price,
        discountRate: isPromo ? 1 - promo! / p.price : 0,
        isPromo
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
