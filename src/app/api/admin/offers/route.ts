import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const offers = await db.offers.findMany();
    // Attach product counts to each offer
    const offersWithCounts = await Promise.all(
      offers.map(async (o) => {
        const prods = await db.products.findByOfferId(o.id);
        return {
          ...o,
          productCount: prods.length
        };
      })
    );
    return NextResponse.json({ offers: offersWithCounts });
  } catch (error) {
    console.error('Error fetching offers list:', error);
    return NextResponse.json({ error: 'Błąd serwera podczas pobierania ofert' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const title = formData.get('title') as string;
    const slug = formData.get('slug') as string;
    const file = formData.get('file') as File;

    if (!title || !slug || !file) {
      return NextResponse.json({ error: 'Brakujące parametry (tytuł, slug lub plik)' }, { status: 400 });
    }

    // Clean slug
    const cleanedSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-');

    // Check if slug already exists
    const existing = await db.offers.findBySlug(cleanedSlug);
    if (existing) {
      return NextResponse.json({ error: `Oferta o adresie /offer/${cleanedSlug} już istnieje` }, { status: 400 });
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse Excel/CSV
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet) as any[];

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Plik jest pusty lub nie ma poprawnego formatu' }, { status: 400 });
    }

    // Create the offer
    const newOffer = await db.offers.create({
      title,
      slug: cleanedSlug,
      isActive: true
    });

    // Parse products from rows
    const parsedProducts: any[] = [];
    rows.forEach((row, index) => {
      // Robust key matching for common Polish/English column headers
      const sku = row.sku || row.SKU || row.Kod || row.kod || `ASK-${1000 + index}`;
      const ean = row.ean || row.EAN || row.KodEAN || row.kodean || `590${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      const name = row.name || row.nazwa || row.Nazwa || row.Tytuł || row.tytul || `Produkt ${index + 1}`;
      
      // Parse price
      let priceVal = 0.0;
      const rawPrice = row.price || row.cena || row.Cena || row.netto || row.Netto;
      if (rawPrice !== undefined) {
        if (typeof rawPrice === 'number') {
          priceVal = rawPrice;
        } else {
          priceVal = parseFloat(String(rawPrice).replace(',', '.').replace(/[^\d.]/g, ''));
        }
      }
      if (isNaN(priceVal) || priceVal <= 0) {
        priceVal = 10.0; // fallback price
      }

      const packaging = row.packaging || row.opakowanie || row.Opakowanie || row.Karton || 'opak. 1 szt.';
      
      // Parse stock
      let stockVal = 100;
      const rawStock = row.stock || row.stan || row.Stan || row.ilosc || row.Ilość || row.ilosc_na_magazynie;
      if (rawStock !== undefined) {
        const parsedStock = parseInt(String(rawStock), 10);
        if (!isNaN(parsedStock)) {
          stockVal = parsedStock;
        }
      }

      // Fallback image url (using Unsplash toy placeholders if not provided)
      const rawImage = row.image || row.zdjecie || row.zdjęcie || row.image_url || row.ImageUrl;
      const imageUrl = rawImage || `https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=500&auto=format&fit=crop&q=60`;

      // Parse age
      const rawAge = row.age || row.wiek || row.Wiek || row.Age || '';
      let ageVal = '3+';
      if (rawAge !== undefined && rawAge !== '') {
        const parsedAge = parseInt(String(rawAge).trim(), 10);
        if (!isNaN(parsedAge)) {
          if (parsedAge >= 12) {
            ageVal = `${parsedAge}m+`;
          } else {
            ageVal = `${parsedAge}+`;
          }
        } else {
          ageVal = String(rawAge).trim();
        }
      }

      parsedProducts.push({
        offerId: newOffer.id,
        sku: String(sku).trim(),
        ean: String(ean).trim(),
        name: String(name).trim(),
        price: parseFloat(priceVal.toFixed(2)),
        imageUrl: String(imageUrl).trim(),
        packaging: String(packaging).trim(),
        stock: stockVal,
        age: ageVal
      });
    });

    // Bulk save products to db
    const createdProducts = await db.products.createMany(parsedProducts);

    return NextResponse.json({
      success: true,
      offer: newOffer,
      productsCount: createdProducts.length
    });
  } catch (error: any) {
    console.error('Error creating offer from file:', error);
    return NextResponse.json({ error: `Błąd serwera podczas wgrywania oferty: ${error.message}` }, { status: 500 });
  }
}
