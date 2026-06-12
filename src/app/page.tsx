import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  try {
    const featured = await db.offers.findFeatured();
    if (featured) {
      redirect(`/offer/${featured.slug}`);
    }
  } catch {
    // DB unavailable — show fallback
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-6">
      <img src="/logo.png" alt="Askato" className="h-14 object-contain" />
      <p className="text-slate-500 text-sm">Brak aktywnej oferty. Skontaktuj się z administratorem.</p>
      <div className="flex gap-4">
        <a href="/login" className="bg-[#1C60B0] text-white font-bold px-5 py-2.5 rounded-xl text-sm hover:bg-[#1A54A5] transition">
          Zaloguj się
        </a>
        <a href="/admin" className="border border-slate-200 text-slate-600 font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-slate-100 transition">
          Panel admina
        </a>
      </div>
    </div>
  );
}
