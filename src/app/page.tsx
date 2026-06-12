'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, CheckCircle2, ShoppingBag, Truck, Shield,
  Package, Users, Lock, Zap, Award, Star, Phone, Mail
} from 'lucide-react';

const FEATURES = [
  { icon: Zap, title: 'Błyskawiczne zamówienia', desc: 'Kompletuj koszyk w minuty i wysyłaj zamówienie jednym kliknięciem — bez papierologii.', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
  { icon: Shield, title: 'Dedykowane rabaty B2B', desc: 'Stałe, indywidualne rabaty dla zarejestrowanych partnerów. Ceny netto widoczne od razu.', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  { icon: Package, title: 'Pełny katalog zabawek', desc: 'Setki produktów edukacyjnych w jednym miejscu. Filtruj po marce, kategorii i dostępności.', color: 'text-[#1C60B0]', bg: 'bg-blue-50', border: 'border-blue-100' },
  { icon: Truck, title: 'Dostawa od 600 zł netto', desc: 'Zamów powyżej progu i zapomnij o kosztach wysyłki. Szybka realizacja w całej Polsce.', color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
];

const STEPS = [
  { n: '1', title: 'Przeglądaj katalog', desc: 'Filtruj produkty po kategorii, marce lub SKU. Ceny netto widoczne od razu.', icon: Package },
  { n: '2', title: 'Skompletuj koszyk', desc: 'Dodaj pozycje, ustaw ilości i sprawdź wartość zamówienia na bieżąco.', icon: ShoppingBag },
  { n: '3', title: 'Wyślij zamówienie', desc: 'Jeden klik — zamówienie trafia do nas mailem lub eksportujesz CSV do swojego systemu.', icon: Truck },
];

export default function LandingPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    localStorage.removeItem('askato_user');
    localStorage.removeItem('askato_guest_name');
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Nieprawidłowe dane logowania');
      localStorage.setItem('askato_user', JSON.stringify(data.user));
      router.push(data.user.role === 'admin' ? '/admin' : '/client/dashboard');
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd logowania');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">

      {/* ── HEADER ── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white border-b border-slate-200 shadow-sm' : 'bg-white/80 backdrop-blur-sm'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <img src="/logo.png" alt="Askato" className="h-9 object-contain" />
          <nav className="hidden md:flex items-center space-x-8 text-sm font-semibold text-slate-500">
            <a href="#oferta" className="hover:text-[#1C60B0] transition">Oferta</a>
            <a href="#jak-to-dziala" className="hover:text-[#1C60B0] transition">Jak to działa</a>
            <a href="#kontakt" className="hover:text-[#1C60B0] transition">Kontakt</a>
          </nav>
          <div className="flex items-center space-x-3">
            <a href="#login" className="text-sm font-bold text-[#1C60B0] hidden sm:block hover:underline">Zaloguj się</a>
            <button
              onClick={() => router.push('/offer/oferta-czerwcowa2026')}
              className="bg-[#1C60B0] hover:bg-[#1A54A5] text-white text-sm font-bold px-4 py-2 rounded-xl transition shadow-sm"
            >
              Przeglądaj katalog
            </button>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="pt-32 pb-20 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left */}
            <div>
              <div className="inline-flex items-center space-x-2 bg-[#1C60B0]/8 border border-[#1C60B0]/15 px-4 py-2 rounded-full mb-7">
                <span className="w-2 h-2 rounded-full bg-[#1C60B0]" />
                <span className="text-xs font-bold text-[#1C60B0] uppercase tracking-wide">Platforma Hurtowa B2B — Zabawki</span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-black text-slate-900 leading-[1.1] mb-6">
                Hurtownia zabawek
                <span className="block text-[#1C60B0] mt-1">dla profesjonalistów</span>
              </h1>

              <p className="text-lg text-slate-500 mb-8 max-w-lg leading-relaxed">
                Askato Sp. z o.o. — specjalista w dystrybucji zabawek edukacyjnych. Zamawiaj hurtowo z indywidualnymi rabatami B2B i zarządzaj zamówieniami online.
              </p>

              <div className="flex flex-col sm:flex-row gap-3 mb-10">
                <button
                  onClick={() => router.push('/offer/oferta-czerwcowa2026')}
                  className="bg-[#1C60B0] hover:bg-[#1A54A5] text-white font-bold px-7 py-3.5 rounded-2xl flex items-center justify-center space-x-2 transition shadow-md shadow-blue-500/20"
                >
                  <ShoppingBag size={18} />
                  <span>Przeglądaj aktualny katalog</span>
                  <ArrowRight size={16} />
                </button>
                <a
                  href="#login"
                  className="bg-white border-2 border-slate-200 hover:border-[#1C60B0]/40 text-slate-700 hover:text-[#1C60B0] font-bold px-7 py-3.5 rounded-2xl flex items-center justify-center space-x-2 transition"
                >
                  <Lock size={16} />
                  <span>Logowanie partnera</span>
                </a>
              </div>

              <div className="flex flex-wrap gap-5">
                {[
                  'Ceny netto dla firm',
                  'Indywidualne rabaty',
                  'Eksport CSV',
                  'Darmowa dostawa od 600 zł',
                ].map(text => (
                  <div key={text} className="flex items-center space-x-1.5 text-slate-500 text-sm">
                    <CheckCircle2 size={15} className="text-emerald-500 flex-shrink-0" />
                    <span>{text}</span>
                  </div>
                ))}
              </div>

              {/* Stats row */}
              <div className="mt-12 pt-8 border-t border-slate-100 grid grid-cols-3 gap-6">
                {[
                  { value: '2 000+', label: 'Produktów' },
                  { value: '150+', label: 'Partnerów B2B' },
                  { value: '15 lat', label: 'Doświadczenia' },
                ].map(({ value, label }) => (
                  <div key={label}>
                    <div className="text-2xl font-black text-slate-900">{value}</div>
                    <div className="text-xs text-slate-400 font-medium mt-0.5">{label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — login card */}
            <div id="login" className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto">
              <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-xl shadow-slate-200/60">
                <div className="flex items-center space-x-3 mb-7">
                  <div className="w-11 h-11 bg-[#1C60B0]/10 rounded-xl flex items-center justify-center">
                    <Lock size={20} className="text-[#1C60B0]" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Panel Partnera B2B</h2>
                    <p className="text-xs text-slate-400">Zaloguj się, aby zobaczyć swoje ceny</p>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-[#CD2628] font-medium">
                      {error}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Adres e-mail</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="partner@firma.pl"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1C60B0]/25 focus:border-[#1C60B0]/50 focus:bg-white transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hasło</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#1C60B0]/25 focus:border-[#1C60B0]/50 focus:bg-white transition"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-[#1C60B0] hover:bg-[#1A54A5] text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2 transition shadow-md shadow-blue-500/20 disabled:opacity-50"
                  >
                    <span>{loading ? 'Logowanie...' : 'Zaloguj się do panelu'}</span>
                    {!loading && <ArrowRight size={16} />}
                  </button>
                </form>

                <div className="mt-5 pt-5 border-t border-slate-100">
                  <p className="text-xs text-slate-400 text-center mb-3">Lub wejdź bez konta</p>
                  <button
                    onClick={() => router.push('/offer/oferta-czerwcowa2026')}
                    className="w-full bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-sm flex items-center justify-center space-x-2 transition"
                  >
                    <ShoppingBag size={15} />
                    <span>Przeglądaj katalog jako gość</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section id="oferta" className="py-20 bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-14">
            <span className="inline-block bg-[#1C60B0]/8 text-[#1C60B0] text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full mb-4 border border-[#1C60B0]/15">
              Dlaczego Askato?
            </span>
            <h2 className="text-3xl font-black text-slate-900 mb-3">
              Wszystko czego potrzebujesz<br className="hidden sm:block" /> do zamówień hurtowych
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Od 15 lat dostarczamy zabawki edukacyjne do hurtowni i sklepów w całej Polsce.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(({ icon: Icon, title, desc, color, bg, border }) => (
              <div key={title} className={`bg-white border ${border} rounded-2xl p-6 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200`}>
                <div className={`w-11 h-11 ${bg} rounded-xl flex items-center justify-center mb-5`}>
                  <Icon size={22} className={color} />
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section id="jak-to-dziala" className="py-20 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full mb-4 border border-emerald-100">
            Jak to działa
          </span>
          <h2 className="text-3xl font-black text-slate-900 mb-14">
            Zamów w <span className="text-emerald-600">3 prostych krokach</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-6 relative">
            {/* Connector line on desktop */}
            <div className="hidden md:block absolute top-14 left-1/3 right-1/3 h-px bg-slate-200" />

            {STEPS.map(({ n, title, desc, icon: Icon }) => (
              <div key={n} className="relative">
                <div className="bg-white border border-slate-200 rounded-2xl p-7 shadow-sm hover:shadow-md transition-shadow">
                  <div className="w-12 h-12 bg-[#1C60B0]/10 rounded-xl flex items-center justify-center mx-auto mb-5">
                    <Icon size={22} className="text-[#1C60B0]" />
                  </div>
                  <div className="absolute top-5 right-5 text-4xl font-black text-slate-100 select-none">{n}</div>
                  <h3 className="font-black text-slate-900 mb-2">{title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA BAND ── */}
      <section className="py-16 bg-[#1C60B0]">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center space-x-1 mb-4">
            {[...Array(5)].map((_, i) => <Star key={i} size={18} className="text-amber-400 fill-amber-400" />)}
          </div>
          <h2 className="text-2xl md:text-3xl font-black text-white mb-3">
            Dołącz do 150+ aktywnych partnerów Askato
          </h2>
          <p className="text-white/70 mb-8 text-base max-w-xl mx-auto">
            Zarejestruj się jako kontrahent i korzystaj z dedykowanych cen netto, priorytetowej obsługi i wygodnych zamówień online.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => router.push('/offer/oferta-czerwcowa2026')}
              className="bg-white text-[#1C60B0] hover:bg-slate-50 font-black px-8 py-3.5 rounded-2xl flex items-center justify-center space-x-2 transition shadow-lg"
            >
              <ShoppingBag size={18} />
              <span>Otwórz aktualny katalog</span>
              <ArrowRight size={16} />
            </button>
            <a
              href="#login"
              className="bg-white/10 hover:bg-white/20 border border-white/30 text-white font-bold px-8 py-3.5 rounded-2xl flex items-center justify-center space-x-2 transition"
            >
              <Lock size={16} />
              <span>Zaloguj się</span>
            </a>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer id="kontakt" className="bg-slate-900 text-white py-14">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-10 mb-10">
            <div>
              <img src="/logo.png" alt="Askato" className="h-9 object-contain mb-4 brightness-0 invert" />
              <p className="text-slate-400 text-sm leading-relaxed">
                Specjalista w dystrybucji zabawek edukacyjnych. Hurtownia B2B dla profesjonalnych kontrahentów z całej Polski.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Kontakt</h4>
              <div className="space-y-2.5 text-slate-400 text-sm">
                <div className="flex items-center space-x-2"><Phone size={14} className="text-[#1C60B0]" /><span>+48 XXX XXX XXX</span></div>
                <div className="flex items-center space-x-2"><Mail size={14} className="text-[#1C60B0]" /><span>biuro@askato.pl</span></div>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Administracja</h4>
              <a href="/admin" className="text-slate-400 text-sm hover:text-[#1C60B0] transition">Panel pracownika →</a>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-slate-500 text-xs">
            © {new Date().getFullYear()} Askato Sp. z o.o. Wszelkie prawa zastrzeżone.
          </div>
        </div>
      </footer>
    </div>
  );
}
