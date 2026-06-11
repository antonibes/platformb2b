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
    const userId = searchParams.get('userId');

    // Find offer by slug
    const offer = await db.offers.findBySlug(slug);
    if (!offer) {
      return NextResponse.json({ error: 'Oferta nie została znaleziona' }, { status: 404 });
    }

    if (!offer.isActive) {
      return NextResponse.json({ error: 'Ta oferta jest obecnie nieaktywna' }, { status: 403 });
    }

    // Get products for this offer
    const products = await db.products.findByOfferId(offer.id);

    // Apply customer discount if user is logged in
    let discountRate = 0;

    // Map products preserving product-specific discounts, ignoring customer B2B discounts per client request
    const productsWithPrices = products.map(p => {
      return {
        ...p,
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
