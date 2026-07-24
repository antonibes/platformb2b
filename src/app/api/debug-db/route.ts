import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import { db, DB_MODULE_VERSION } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const dbUrl = process.env.DATABASE_URL || '';
  const pgUrl = process.env.POSTGRES_URL || '';
  const activeUrl = dbUrl || pgUrl;
  const directUrl = activeUrl.replace(/-pooler\./, '.');

  const sanitize = (url: string) => {
    if (!url) return '(empty)';
    try {
      const u = new URL(url);
      return `${u.protocol}//${u.username}:***@${u.host}${u.pathname}`;
    } catch {
      return url.slice(0, 60) + '...';
    }
  };

  const poolerSql = activeUrl ? neon(activeUrl) : null;
  const directSql = directUrl ? neon(directUrl) : null;

  const [poolerOffers, directOffers] = await Promise.all([
    poolerSql ? poolerSql`SELECT id, title, slug, is_active, is_featured FROM offers ORDER BY created_at DESC` : [],
    directSql ? directSql`SELECT id, title, slug, is_active, is_featured FROM offers ORDER BY created_at DESC` : [],
  ]);

  const featured = await db.offers.findFeatured();
  const allOffers = await db.offers.findMany();

  return NextResponse.json({
    db_module_version: DB_MODULE_VERSION,
    pooler_url: sanitize(activeUrl),
    direct_url: sanitize(directUrl),
    pooler_offers: poolerOffers,
    direct_offers: directOffers,
    db_findMany: allOffers.map(o => ({ id: o.id, title: o.title, slug: o.slug, isFeatured: o.isFeatured, isActive: o.isActive })),
    db_findFeatured: featured ? { id: featured.id, title: featured.title, slug: featured.slug } : null,
  });
}
