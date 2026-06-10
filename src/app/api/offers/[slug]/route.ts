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
    if (userId) {
      const user = await db.users.findById(userId);
      if (user && user.role === 'client') {
        discountRate = user.discountRate;
      }
    }

    // Map products with calculated prices
    const productsWithPrices = products.map(p => {
      const finalPrice = discountRate > 0 ? parseFloat((p.price * (1 - discountRate)).toFixed(2)) : p.price;
      return {
        ...p,
        originalPrice: p.price,
        price: finalPrice,
        discountRate: discountRate
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
