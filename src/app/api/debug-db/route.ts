import { NextResponse } from 'next/server';

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

  return NextResponse.json({
    DATABASE_URL: sanitize(dbUrl),
    POSTGRES_URL: sanitize(pgUrl),
    using: dbUrl ? 'DATABASE_URL' : pgUrl ? 'POSTGRES_URL' : 'none (db.json fallback)',
  });
}
