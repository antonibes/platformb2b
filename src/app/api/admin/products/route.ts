import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const offerId = searchParams.get('offerId');

    if (!offerId) {
      return NextResponse.json({ error: 'Brak parametru offerId' }, { status: 400 });
    }

    const products = await db.products.findByOfferId(offerId);
    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error fetching offer products:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productId, ...updates } = body;

    if (!productId) {
      return NextResponse.json({ error: 'Brak parametru productId' }, { status: 400 });
    }

    // Clean and validate pricing and stock if they are provided
    const cleanUpdates: any = {};
    if (updates.name !== undefined) cleanUpdates.name = String(updates.name).trim();
    if (updates.sku !== undefined) cleanUpdates.sku = String(updates.sku).trim();
    if (updates.ean !== undefined) cleanUpdates.ean = String(updates.ean).trim();
    if (updates.category !== undefined) cleanUpdates.category = String(updates.category).trim();
    if (updates.imageUrl !== undefined) cleanUpdates.imageUrl = String(updates.imageUrl).trim();
    if (updates.packaging !== undefined) cleanUpdates.packaging = String(updates.packaging).trim();
    if (updates.description !== undefined) cleanUpdates.description = String(updates.description).trim();
    
    if (updates.price !== undefined) {
      const priceVal = parseFloat(updates.price);
      if (!isNaN(priceVal) && priceVal >= 0) {
        cleanUpdates.price = priceVal;
      }
    }
    
    if (updates.stock !== undefined) {
      const stockVal = parseInt(updates.stock, 10);
      if (!isNaN(stockVal) && stockVal >= 0) {
        cleanUpdates.stock = stockVal;
      }
    }

    const updated = await db.products.update(productId, cleanUpdates);
    if (!updated) {
      return NextResponse.json({ error: 'Nie znaleziono produktu' }, { status: 404 });
    }

    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    console.error('Error updating product details:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
