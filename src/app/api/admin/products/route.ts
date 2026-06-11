import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const getSql = () => {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  return url ? neon(url) : null;
};

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
    const { productId, action, ...updates } = body;

    // Action: add new product to offer
    if (action === 'add') {
      const { offerId, sku, ean, name, price, imageUrl, packaging, stock, category, description, age } = updates;
      if (!offerId || !name) {
        return NextResponse.json({ error: 'Brak wymaganych pól (offerId, name)' }, { status: 400 });
      }
      const id = `prod-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const sql = getSql();
      const newProd = {
        id,
        offerId,
        sku: sku || `SKU-${id}`,
        ean: ean || '',
        category: category || 'ZABAWKI',
        name,
        price: parseFloat(price || '0'),
        imageUrl: imageUrl || 'https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=500&auto=format&fit=crop&q=60',
        packaging: packaging || 'opak. 1 szt.',
        stock: parseInt(stock || '100', 10),
        description: description || '',
        age: age || '3+'
      };

      if (sql) {
        await sql`
          INSERT INTO products (id, offer_id, sku, ean, category, name, price, image_url, packaging, stock, description, age)
          VALUES (${newProd.id}, ${newProd.offerId}, ${newProd.sku}, ${newProd.ean}, ${newProd.category},
                  ${newProd.name}, ${newProd.price}, ${newProd.imageUrl}, ${newProd.packaging},
                  ${newProd.stock}, ${newProd.description}, ${newProd.age})
        `;
      }
      return NextResponse.json({ success: true, product: newProd });
    }

    // Action: reorder products and update their categories
    if (action === 'reorder_and_categorize') {
      const { products } = updates;
      if (!Array.isArray(products)) {
        return NextResponse.json({ error: 'Brak lub niepoprawna lista produktów' }, { status: 400 });
      }
      await db.products.updateManyPositionsAndCategories(products);
      return NextResponse.json({ success: true });
    }

    // Action: rename a category for all products in an offer
    if (action === 'rename_category') {
      const { offerId, oldCategoryName, newCategoryName } = updates;
      if (!offerId || !oldCategoryName || !newCategoryName) {
        return NextResponse.json({ error: 'Brak wymaganych parametrów (offerId, oldCategoryName, newCategoryName)' }, { status: 400 });
      }
      const allProds = await db.products.findByOfferId(offerId);
      const targetProds = allProds.filter(p => (p.category || 'Zabawki').toUpperCase().trim() === oldCategoryName.toUpperCase().trim());
      for (const p of targetProds) {
        await db.products.update(p.id, { category: newCategoryName.trim() });
      }
      return NextResponse.json({ success: true });
    }

    // Default: update existing product
    if (!productId && !action) {
      return NextResponse.json({ error: 'Brak parametru productId' }, { status: 400 });
    }

    const cleanUpdates: any = {};
    if (updates.name !== undefined) cleanUpdates.name = String(updates.name).trim();
    if (updates.sku !== undefined) cleanUpdates.sku = String(updates.sku).trim();
    if (updates.ean !== undefined) cleanUpdates.ean = String(updates.ean).trim();
    if (updates.category !== undefined) cleanUpdates.category = String(updates.category).trim();
    if (updates.imageUrl !== undefined) cleanUpdates.imageUrl = String(updates.imageUrl).trim();
    if (updates.packaging !== undefined) cleanUpdates.packaging = String(updates.packaging).trim();
    if (updates.description !== undefined) cleanUpdates.description = String(updates.description).trim();
    if (updates.age !== undefined) cleanUpdates.age = String(updates.age).trim();

    if (updates.price !== undefined) {
      const priceVal = parseFloat(updates.price);
      if (!isNaN(priceVal) && priceVal >= 0) cleanUpdates.price = priceVal;
    }
    if (updates.stock !== undefined) {
      const stockVal = parseInt(updates.stock, 10);
      if (!isNaN(stockVal) && stockVal >= 0) cleanUpdates.stock = stockVal;
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

export async function DELETE(request: NextRequest) {
  try {
    const { productId } = await request.json();
    if (!productId) return NextResponse.json({ error: 'Brak productId' }, { status: 400 });

    const sql = getSql();
    if (sql) {
      await sql`DELETE FROM products WHERE id = ${productId}`;
    }
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
