import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { db, DB_MODULE_VERSION } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || '';
  const pgUrl = process.env.POSTGRES_URL || '';
  const activeUrl = dbUrl || pgUrl;

  const sanitize = (url: string) => {
    if (!url) return '(empty)';
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.username}:***@${u.host}${u.pathname}`;
    } catch {
      return url.slice(0, 60) + '...';
    }
  };

  // Raw SQL queries using neon directly (bypass db module)
  const rawSql = activeUrl ? neon(activeUrl) : null;

  const rawAll = rawSql
    ? await rawSql`SELECT id, title, slug, created_at FROM offers ORDER BY created_at DESC`
    : [];

  const rawBySlug = rawSql
    ? await rawSql`SELECT id, title, slug, created_at FROM offers WHERE slug = 'oferta' ORDER BY created_at DESC LIMIT 1`
    : [];

  // Through db module
  const allOffers = await db.offers.findMany();
  const bySlugOferta = await db.offers.findBySlug('oferta');
  const bySlugOferta2 = await db.offers.findBySlug('oferta-2');
  const featured = await db.offers.findFeatured();

  // Raw featured query
  const rawFeatured = rawSql ? await rawSql`SELECT id, title, slug, is_active, is_featured FROM offers WHERE is_featured = true ORDER BY created_at DESC LIMIT 1` : [];
  const ghostCheck = rawSql ? await rawSql`SELECT id, title, slug, created_at, is_featured FROM offers WHERE id = 'offer-1784030050900'` : [];
  const allWithFeatured = rawSql ? await rawSql`SELECT id, title, slug, created_at, is_featured, is_active FROM offers` : [];

  return NextResponse.json({
    DATABASE_URL: sanitize(dbUrl),
    POSTGRES_URL: sanitize(pgUrl),
    using: dbUrl ? 'DATABASE_URL' : pgUrl ? 'POSTGRES_URL' : 'none',
    raw_all_offers: rawAll,
    raw_findBySlug_oferta: rawBySlug,
    raw_featured: rawFeatured,
    db_findMany: allOffers.map(o => ({ id: o.id, title: o.title, slug: o.slug })),
    db_findBySlug_oferta: bySlugOferta ? { id: bySlugOferta.id, slug: bySlugOferta.slug } : null,
    db_findBySlug_oferta2: bySlugOferta2 ? { id: bySlugOferta2.id, slug: bySlugOferta2.slug } : null,
    db_findFeatured: featured ? { id: featured.id, title: featured.title, slug: featured.slug } : null,
    db_module_version: DB_MODULE_VERSION,
    ghost_check: ghostCheck,
    all_with_featured: allWithFeatured,
  });
}
