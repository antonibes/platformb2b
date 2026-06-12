import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const offers = await db.offers.findMany();
    const offersWithCounts = await Promise.all(
      offers.map(async (o) => {
        const prods = await db.products.findByOfferId(o.id);
        return { ...o, productCount: prods.length };
      })
    );
    return NextResponse.json({ offers: offersWithCounts });
  } catch (error) {
    console.error('Error fetching offers list:', error);
    return NextResponse.json({ error: 'Błąd serwera podczas pobierania ofert' }, { status: 500 });
  }
}

/**
 * Parse a numeric age from any input (string or number).
 * Returns formatted string like "6+" or "18m+" or "3+".
 */
function parseAge(rawAge: any): string {
  if (rawAge === undefined || rawAge === null || String(rawAge).trim() === '') return '3+';
  const str = String(rawAge).trim().toLowerCase();
  
  // Check if it's explicitly months
  const isMonths = str.includes('m') || str.includes('mies') || str.includes('mc') || str.includes('m-cy');
  
  // Extract the first number
  const numMatch = str.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    return isMonths ? `${num}m+` : `${num}+`;
  }
  
  return String(rawAge).trim() || '3+';
}

/**
 * Parse a price from any input. Returns number >= 0.
 */
function parsePrice(raw: any): number {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === 'number') return isNaN(raw) ? 0 : Math.max(0, raw);
  const n = parseFloat(String(raw).replace(',', '.').replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : Math.max(0, n);
}

/**
 * Parse a stock number from any input. Returns integer >= 0.
 */
function parseStock(raw: any): number {
  if (raw === undefined || raw === null) return 100;
  const n = parseInt(String(raw), 10);
  return isNaN(n) ? 100 : Math.max(0, n);
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

    const cleanedSlug = slug.toLowerCase().trim().replace(/[^a-z0-9-_]/g, '-');
    const existing = await db.offers.findBySlug(cleanedSlug);
    if (existing) {
      return NextResponse.json({ error: `Oferta o adresie /offer/${cleanedSlug} już istnieje` }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Use raw rows (array of arrays) to handle __EMPTY_ columns properly
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];

    if (rawRows.length < 2) {
      return NextResponse.json({ error: 'Plik jest pusty lub nie ma poprawnego formatu' }, { status: 400 });
    }

    // Find the header row — it's the first row where a cell contains 'Kod' or 'kod' or 'SKU'
    let headerRowIdx = 0;
    for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
      const rowStr = rawRows[i].map(c => String(c).toLowerCase());
      if (rowStr.some(c => c === 'kod' || c === 'sku' || c === 'name' || c === 'nazwa')) {
        headerRowIdx = i;
        break;
      }
    }

    const headerRow = rawRows[headerRowIdx].map(h => String(h).trim().toLowerCase());
    const dataRows = rawRows.slice(headerRowIdx + 1);

    // Helper to find column index using fuzzy search
    const findColIdx = (...terms: string[]): number | undefined => {
      for (const term of terms) {
        const t = term.toLowerCase().trim();
        // 1. Exact match
        const exactIdx = headerRow.findIndex(h => h === t);
        if (exactIdx !== -1) return exactIdx;
        
        // 2. Substring match
        const subIdx = headerRow.findIndex(h => h.includes(t));
        if (subIdx !== -1) return subIdx;
      }
      return undefined;
    };

    // Precalculate column indices
    const skuIdx = findColIdx('kod', 'sku', 'symbol', 'indeks', 'artyk');
    const eanIdx = findColIdx('ean', 'barcod', 'kod kresk');
    const nameIdx = findColIdx('nazwa', 'name', 'tytuł', 'tytul', 'towar', 'produkt');
    const catIdx = findColIdx('kategoria', 'category', 'dział', 'dzial', 'grupa');
    const descIdx = findColIdx('opis', 'description', 'desc', 'specyfikacja');
    const priceIdx = findColIdx('cena netto', 'cena hurt', 'cena b2b', 'cena', 'netto');
    const stockIdx = findColIdx('zamówienie ilość', 'stan', 'stock', 'ilosc', 'ilość', 'dostęp', 'dostep');
    const pcbIdx = findColIdx('pcb', 'opakowanie', 'karton', 'zbiorcz');
    const ageIdx = findColIdx('wiek', 'age', 'od lat');
    const imgIdx = findColIdx('zdjęcie', 'zdjecie', 'image', 'obraz', 'foto');
    const discountIdx = findColIdx('rabat', 'discount', 'promocja', 'obniżka');
    const origPriceIdx = findColIdx('cena detaliczna', 'cena regularna', 'cena przed rabatem', 'cena katalogowa', 'detaliczna', 'katalogowa');

    // Helper to get value by index
    const getVal = (row: any[], idx: number | undefined): any => {
      if (idx !== undefined && idx < row.length) {
        const v = row[idx];
        if (v !== undefined && v !== null && String(v).trim() !== '') return v;
      }
      return undefined;
    };

    // Try to extract embedded images from the XLSX ZIP package
    const skuToImageBuffer: { [sku: string]: Buffer } = {};
    try {
      const zip = await JSZip.loadAsync(buffer);
      const drawingFile = zip.file('xl/drawings/drawing1.xml');
      const drawingRelsFile = zip.file('xl/drawings/_rels/drawing1.xml.rels');

      if (drawingFile && drawingRelsFile && skuIdx !== undefined) {
        const drawingXml = await drawingFile.async('string');
        const drawingRelsXml = await drawingRelsFile.async('string');

        // Parse drawing relationship IDs to target files
        const rels: { [rId: string]: string } = {};
        const relRegex = /<Relationship[^>]*Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
        let relMatch;
        while ((relMatch = relRegex.exec(drawingRelsXml)) !== null) {
          rels[relMatch[1]] = relMatch[2];
        }

        // Parse twoCellAnchor/oneCellAnchor tags to match drawing row to relationship ID
        const anchors: { row: number; rId: string }[] = [];
        const anchorRegex = /<xdr:(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
        let anchorMatch;
        while ((anchorMatch = anchorRegex.exec(drawingXml)) !== null) {
          const block = anchorMatch[1];
          const rowMatch = block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
          const row = rowMatch ? parseInt(rowMatch[1], 10) : null;
          const rIdMatch = block.match(/(?:r:embed|r:id)="(rId\d+)"/);
          const rId = rIdMatch ? rIdMatch[1] : null;
          if (row !== null && rId) {
            anchors.push({ row, rId });
          }
        }

        // Retrieve binary image file and map it to the SKU found on or near that row
        for (const anchor of anchors) {
          const mediaTarget = rels[anchor.rId];
          if (!mediaTarget) continue;

          const filename = mediaTarget.split('/').pop() || '';
          if (!filename) continue;

          const mediaPath = `xl/drawings/${mediaTarget}`.replace(/\/\.\.\//g, '/').replace('xl/drawings/../', 'xl/');
          let mediaFile = zip.file(mediaPath);
          if (!mediaFile) {
            mediaFile = zip.file(`xl/media/${filename}`);
          }

          if (mediaFile) {
            const imgBuffer = await mediaFile.async('nodebuffer');
            let sku: string | null = null;
            // Check adjacent rows to handle slight alignment variations (e.g. headers, merged cells)
            for (const offset of [0, 1, -1, 2, -2]) {
              const tryRow = rawRows[anchor.row + offset];
              if (tryRow && tryRow[skuIdx]) {
                const s = String(tryRow[skuIdx]).replace(/\.0+$/, '').trim();
                if (s) {
                  sku = s;
                  break;
                }
              }
            }

            if (sku) {
              skuToImageBuffer[sku] = imgBuffer;
            }
          }
        }
      }
    } catch (zipErr) {
      console.warn('[ZIP Images] Could not extract embedded images from XLSX ZIP structure:', zipErr);
    }

    // Create the offer
    const newOffer = await db.offers.create({ title, slug: cleanedSlug, isActive: true });

    const parsedProducts: any[] = [];

    // Helper: try to download an image from URL and save it locally
    const downloadAndSaveImage = async (url: string, destPath: string): Promise<boolean> => {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
        if (!res.ok) return false;
        const contentType = res.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) return false;
        const arrayBuf = await res.arrayBuffer();
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.writeFileSync(destPath, Buffer.from(arrayBuf));
        return true;
      } catch {
        return false;
      }
    };

    for (let index = 0; index < dataRows.length; index++) {
      const row = dataRows[index];
      // Skip completely empty rows
      if (row.every((c: any) => c === '' || c === null || c === undefined)) continue;

      const sku = getVal(row, skuIdx) ?? `ASK-${1000 + index}`;
      const ean = getVal(row, eanIdx) ?? `590${Math.floor(1000000000 + Math.random() * 9000000000)}`;
      const name = getVal(row, nameIdx) ?? `Produkt ${index + 1}`;
      const category = getVal(row, catIdx) ?? 'ZABAWKI';
      const description = getVal(row, descIdx) ?? '';
      const rawPrice = getVal(row, priceIdx);
      const rawStock = getVal(row, stockIdx);
      const rawPackaging = getVal(row, pcbIdx);
      const rawAge = getVal(row, ageIdx);
      const rawImage = getVal(row, imgIdx);
      const rawDiscount = getVal(row, discountIdx);
      const rawOrigPrice = getVal(row, origPriceIdx);

      // Skip row if no meaningful SKU or name
      if (!sku && !name) continue;

      const priceVal = parsePrice(rawPrice);
      const stockVal = parseStock(rawStock);
      const ageVal = parseAge(rawAge);

      // Parse discount rate (e.g. "50%" or "0.5" or "50")
      let discountRateVal = 0;
      if (rawDiscount !== undefined) {
        const cleanDiscount = String(rawDiscount).replace('%', '').trim();
        const parsedD = parseFloat(cleanDiscount);
        if (!isNaN(parsedD)) {
          discountRateVal = parsedD > 1 ? parsedD / 100 : parsedD;
        }
      }

      // Parse original price
      let origPriceVal = priceVal;
      if (rawOrigPrice !== undefined) {
        origPriceVal = parsePrice(rawOrigPrice);
      } else if (discountRateVal > 0) {
        origPriceVal = parseFloat((priceVal / (1 - discountRateVal)).toFixed(2));
      }

      // PCB/Packaging formatting
      let packagingStr = 'PCB 1';
      if (rawPackaging !== undefined && rawPackaging !== null && String(rawPackaging).trim() !== '') {
        const pcbNum = parseInt(String(rawPackaging).trim(), 10);
        if (!isNaN(pcbNum) && pcbNum > 0) {
          packagingStr = `PCB ${pcbNum}`;
        } else {
          const cleanPkg = String(rawPackaging).trim();
          packagingStr = cleanPkg.toLowerCase().startsWith('pcb') ? cleanPkg : `PCB ${cleanPkg}`;
        }
      }

      // --- Image URL resolution (priority order) ---
      // 1. Embedded image extracted from ZIP -> convert to Base64 data URL (works in serverless environments like Vercel)
      // 2. Excel has an external HTTP URL -> use directly to avoid serverless function timeouts
      // 3. Local file already exists -> use it
      // 4. No image -> use placeholder
      const skuStr = String(sku).trim();
      const localImagePath = path.join(process.cwd(), 'public', 'products', `product_${skuStr}.jpeg`);
      const localImageUrl = `/products/product_${skuStr}.jpeg`;
      let imageUrl: string;

      if (skuToImageBuffer[skuStr]) {
        const base64Str = skuToImageBuffer[skuStr].toString('base64');
        imageUrl = `data:image/jpeg;base64,${base64Str}`;
        try {
          fs.mkdirSync(path.dirname(localImagePath), { recursive: true });
          fs.writeFileSync(localImagePath, skuToImageBuffer[skuStr]);
        } catch (_) {
          // Ignore write-only errors on serverless environments
        }
      } else if (rawImage && String(rawImage).trim().startsWith('http')) {
        imageUrl = String(rawImage).trim();
        try {
          fs.mkdirSync(path.dirname(localImagePath), { recursive: true });
          downloadAndSaveImage(imageUrl, localImagePath).catch(() => {});
        } catch (_) {
          // Ignore write-only errors on serverless environments
        }
      } else if (fs.existsSync(localImagePath)) {
        imageUrl = localImageUrl;
      } else {
        imageUrl = `https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=500&auto=format&fit=crop&q=60`;
      }

      parsedProducts.push({
        offerId: newOffer.id,
        sku: skuStr,
        ean: String(ean).trim(),
        category: String(category).trim().toUpperCase(),
        name: String(name).trim(),
        price: parseFloat(priceVal.toFixed(2)),
        imageUrl,
        packaging: packagingStr,
        stock: stockVal,
        description: String(description).trim(),
        age: ageVal,
        discountRate: discountRateVal,
        originalPrice: parseFloat(origPriceVal.toFixed(2))
      });
    }

    if (parsedProducts.length === 0) {
      // Roll back offer creation
      return NextResponse.json({ error: 'Nie znaleziono żadnych produktów w pliku. Sprawdź format kolumn.' }, { status: 400 });
    }

    const createdProducts = await db.products.createMany(parsedProducts);

    return NextResponse.json({
      success: true,
      offer: newOffer,
      productsCount: createdProducts.length,
      detectedHeaders: headerRow.join(', ')
    });
  } catch (error: any) {
    console.error('Error creating offer from file:', error);
    return NextResponse.json({ error: `Błąd serwera podczas wgrywania oferty: ${error.message}` }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { offerId } = await request.json();
    if (!offerId) return NextResponse.json({ error: 'Brak offerId' }, { status: 400 });

    // Delete all products in offer first
    await db.products.deleteByOfferId(offerId);

    // Then delete offer
    await db.offers.delete(offerId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting offer:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
