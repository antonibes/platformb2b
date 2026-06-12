import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let featured = null;
  try {
    featured = await db.offers.findFeatured();
  } catch {
    // DB unavailable — show fallback
  }

  if (featured) {
    redirect(`/offer/${featured.slug}`);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6">
      <img src="/logo.png" alt="Askato" className="h-14 object-contain" />
      <p className="text-slate-500 text-sm">Brak aktywnej oferty. Skontaktuj się z administratorem.</p>
      <a href="/login" className="bg-[#1C60B0] text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-[#1A54A5] transition">
        Zaloguj się
      </a>
    </div>
  );
}
