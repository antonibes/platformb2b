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
  const bySlug = await db.offers.findBySlug('oferta');

  return NextResponse.json({
    DATABASE_URL: sanitize(dbUrl),
    POSTGRES_URL: sanitize(pgUrl),
    using: dbUrl ? 'DATABASE_URL' : pgUrl ? 'POSTGRES_URL' : 'none',
    raw_all_offers: rawAll,
    raw_findBySlug: rawBySlug,
    db_module_findMany: allOffers.map(o => ({ id: o.id, title: o.title, slug: o.slug })),
    db_module_findBySlug: bySlug ? { id: bySlug.id, title: bySlug.title, slug: bySlug.slug } : null,
    db_module_version: DB_MODULE_VERSION,
  });
}
