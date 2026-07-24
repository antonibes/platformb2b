import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || '';
  const pgUrl = process.env.POSTGRES_URL || '';

  const sanitize = (url: string) => {
    if (!url) return '(empty)';
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.username}:***@${u.host}${u.pathname}`;
    } catch {
      return url.slice(0, 60) + '...';
    }
  };

  const allOffers = await db.offers.findMany();
  const bySlug = await db.offers.findBySlug('oferta');

  return NextResponse.json({
    DATABASE_URL: sanitize(dbUrl),
    POSTGRES_URL: sanitize(pgUrl),
    using: dbUrl ? 'DATABASE_URL' : pgUrl ? 'POSTGRES_URL' : 'none (db.json fallback)',
    allOffers: allOffers.map(o => ({ id: o.id, title: o.title, slug: o.slug, createdAt: o.createdAt })),
    findBySlug_oferta: bySlug ? { id: bySlug.id, title: bySlug.title, slug: bySlug.slug, createdAt: bySlug.createdAt } : null,
  });
}
