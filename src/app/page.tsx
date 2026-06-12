'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight, CheckCircle2, ShoppingBag, Star, Truck, Shield,
  Package, Users, TrendingUp, Phone, Mail, ChevronDown, Lock, Zap, Award
} from 'lucide-react';

const FEATURES = [
  { icon: Zap, title: 'Błyskawiczne zamówienia', desc: 'Kompletuj koszyk w minuty. Zero papierologii — wyślij zamówienie jednym kliknięciem.', color: 'text-amber-500', bg: 'bg-amber-50' },
  { icon: Shield, title: 'Dedykowane rabaty B2B', desc: 'Stałe, indywidualne rabaty dla zarejestrowanych kontrahentów. Ceny netto widoczne od razu.', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  { icon: Package, title: 'Pełny katalog zabawek', desc: 'Setki produktów w jednym miejscu. Filtruj po marce, kategorii i dostępności.', color: 'text-[#1C60B0]', bg: 'bg-blue-50' },
  { icon: Truck, title: 'Darmowa dostawa od 600 zł', desc: 'Zamów powyżej progu i zapomnij o kosztach wysyłki. Szybka realizacja.', color: 'text-purple-600', bg: 'bg-purple-50' },
];

const BRANDS = ['Genialny Dzieciak', 'Pomysłowy Skrzat', 'Klocki Małych Geniuszy', 'Zabawki Edukacyjne', 'Fun & Learn'];

const STATS = [
  { value: '2 000+', label: 'Produktów w katalogu' },
  { value: '150+', label: 'Aktywnych kontrahentów' },
  { value: '15 lat', label: 'Na rynku zabawek' },
  { value: '99%', label: 'Zadowolonych klientów' },
];

function AnimatedCounter({ value }: { value: string }) {
  const [display, setDisplay] = useState('0');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setDisplay(value);
        observer.disconnect();
      }
    }, { threshold: 0.5 });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [value]);
  return <div ref={ref} className="text-3xl md:text-4xl font-black text-white transition-all">{display}</div>;
}

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
    const onScroll = () => setScrolled(window.scrollY > 40);
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

      {/* ===== STICKY HEADER ===== */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <img src="/logo.png" alt="Askato" className="h-9 object-contain" />
          <div className="hidden md:flex items-center space-x-6 text-sm font-semibold text-slate-600">
            <a href="#oferta" className="hover:text-[#1C60B0] transition">Oferta</a>
            <a href="#dlaczego" className="hover:text-[#1C60B0] transition">O nas</a>
            <a href="#kontakt" className="hover:text-[#1C60B0] transition">Kontakt</a>
          </div>
          <div className="flex items-center space-x-3">
            <a href="#login" className="text-sm font-bold text-[#1C60B0] hover:underline hidden sm:block">Zaloguj się</a>
            <a href="#login" className="bg-[#1C60B0] text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-[#1A54A5] transition shadow-sm">Zamów teraz</a>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-gradient-to-br from-slate-900 via-[#0d2d5e] to-[#1C60B0]">
        {/* Animated background blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#CD2628]/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-[#1C60B0]/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/5 rounded-full blur-3xl" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-20">
          <div className="grid lg:grid-cols-2 gap-16 items-center">

            {/* Left: Hero text */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center space-x-2 bg-white/10 border border-white/20 px-4 py-2 rounded-full mb-8 backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-bold text-white/90 uppercase tracking-wider">Platforma Hurtowa B2B — Zabawki</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-white leading-[1.1] mb-6">
                Twój profesjonalny
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-400 mt-1">
                  sklep hurtowy
                </span>
                <span className="block text-white/90">z zabawkami</span>
              </h1>

              <p className="text-lg text-white/70 mb-10 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                Askato Sp. z o.o. — specjalista w branży zabawek edukacyjnych. Zamawiaj hurtowo, korzystaj z rabatów B2B i zarządzaj zamówieniami online w jednym miejscu.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <button
                  onClick={() => router.push('/offer/oferta-czerwcowa2026')}
                  className="bg-[#CD2628] hover:bg-red-700 text-white font-bold px-8 py-4 rounded-2xl flex items-center justify-center space-x-2 transition shadow-xl shadow-red-900/30 text-base"
                >
                  <ShoppingBag size={20} />
                  <span>Przeglądaj katalog</span>
                  <ArrowRight size={18} />
                </button>
                <a
                  href="#login"
                  className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold px-8 py-4 rounded-2xl flex items-center justify-center space-x-2 transition backdrop-blur-sm text-base"
                >
                  <Lock size={18} />
                  <span>Logowanie partnera</span>
                </a>
              </div>

              <div className="mt-12 flex items-center gap-6 justify-center lg:justify-start">
                {[
                  { icon: CheckCircle2, text: 'Ceny netto dla firm' },
                  { icon: CheckCircle2, text: 'Rabaty kontrahenckie' },
                  { icon: CheckCircle2, text: 'Eksport zamówień CSV' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center space-x-1.5 text-white/70 text-xs">
                    <Icon size={14} className="text-emerald-400 flex-shrink-0" />
                    <span className="font-semibold">{text}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: Login panel */}
            <div id="login" className="w-full max-w-md mx-auto">
              <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-8 shadow-2xl">
                <div className="text-center mb-7">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Lock size={24} className="text-white" />
                  </div>
                  <h2 className="text-xl font-black text-white">Panel Partnera B2B</h2>
                  <p className="text-white/60 text-sm mt-1">Zaloguj się, aby zobaczyć swoje ceny</p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <div className="bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-3 text-sm text-red-200 font-medium">
                      {error}
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Adres e-mail</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="partner@firma.pl"
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-white/70 uppercase tracking-wider mb-2">Hasło</label>
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 text-sm focus:outline-none focus:ring-2 focus:ring-white/30 focus:bg-white/15 transition"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-[#CD2628] to-red-600 hover:from-red-600 hover:to-red-700 text-white font-black py-3.5 rounded-xl flex items-center justify-center space-x-2 transition shadow-lg shadow-red-900/30 disabled:opacity-50"
                  >
                    <span>{loading ? 'Logowanie...' : 'Zaloguj się do panelu'}</span>
                    {!loading && <ArrowRight size={17} />}
                  </button>
                </form>

                <div className="mt-6 pt-6 border-t border-white/10 text-center">
                  <p className="text-white/50 text-xs mb-3">Lub wejdź bez logowania jako gość</p>
                  <button
                    onClick={() => router.push('/offer/oferta-czerwcowa2026')}
                    className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center space-x-2 transition"
                  >
                    <ShoppingBag size={16} />
                    <span>Przeglądaj jako gość</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/40 animate-bounce">
          <ChevronDown size={24} />
        </div>
      </section>

      {/* ===== STATS BAND ===== */}
      <section className="bg-gradient-to-r from-[#1C60B0] to-[#0d2d5e] py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {STATS.map(({ value, label }) => (
              <div key={label}>
                <AnimatedCounter value={value} />
                <p className="text-white/60 text-sm font-medium mt-1">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section id="dlaczego" className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="inline-block bg-[#1C60B0]/10 text-[#1C60B0] text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full mb-4 border border-[#1C60B0]/20">
              Dlaczego Askato?
            </span>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
              Hurtownia zabawek stworzona<br />
              <span className="text-[#1C60B0]">dla profesjonalistów</span>
            </h2>
            <p className="text-slate-500 max-w-xl mx-auto text-base leading-relaxed">
              Od 15 lat dostarczamy najlepsze zabawki edukacyjne do hurtowni, sklepów i placówek w całej Polsce.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc, color, bg }) => (
              <div
                key={title}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all duration-300 group"
              >
                <div className={`w-12 h-12 ${bg} rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform`}>
                  <Icon size={24} className={color} />
                </div>
                <h3 className="font-bold text-slate-900 mb-2 text-base">{title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== BRANDS ===== */}
      <section id="oferta" className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block bg-amber-50 text-amber-600 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full mb-4 border border-amber-200">
            Nasze Marki
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-4">
            Ekskluzywne marki
            <span className="text-[#CD2628]"> tylko u nas</span>
          </h2>
          <p className="text-slate-500 max-w-lg mx-auto mb-14 text-base">
            Jesteśmy wyłącznym dystrybutorem wiodących marek zabawek edukacyjnych w Polsce.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-16">
            {BRANDS.map((brand, i) => (
              <div
                key={brand}
                className="bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 rounded-2xl px-6 py-4 font-bold text-slate-700 hover:border-[#1C60B0]/40 hover:text-[#1C60B0] hover:shadow-md transition-all cursor-default"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <Award size={16} className="inline mr-2 text-amber-500" />
                {brand}
              </div>
            ))}
          </div>

          {/* CTA Banner */}
          <div className="bg-gradient-to-r from-[#1C60B0] via-[#1548A0] to-[#0d2d5e] rounded-3xl p-10 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-[#CD2628]/20 rounded-full translate-y-1/2 -translate-x-1/2" />
            <div className="relative z-10">
              <div className="flex items-center justify-center space-x-2 mb-4">
                <Star size={20} className="text-amber-400 fill-amber-400" />
                <Star size={20} className="text-amber-400 fill-amber-400" />
                <Star size={20} className="text-amber-400 fill-amber-400" />
                <Star size={20} className="text-amber-400 fill-amber-400" />
                <Star size={20} className="text-amber-400 fill-amber-400" />
              </div>
              <h3 className="text-2xl md:text-3xl font-black mb-3">Gotowy na hurtowe zakupy?</h3>
              <p className="text-white/70 mb-8 text-base max-w-lg mx-auto">
                Dołącz do ponad 150 aktywnych kontrahentów B2B i ciesz się dedykowanymi cenami netto oraz priorytetową obsługą.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={() => router.push('/offer/oferta-czerwcowa2026')}
                  className="bg-[#CD2628] hover:bg-red-700 text-white font-black px-8 py-4 rounded-2xl flex items-center justify-center space-x-2 transition shadow-xl shadow-red-900/40"
                >
                  <ShoppingBag size={20} />
                  <span>Otwórz aktualny katalog</span>
                  <ArrowRight size={18} />
                </button>
                <a
                  href="#login"
                  className="bg-white/15 hover:bg-white/25 border border-white/20 text-white font-bold px-8 py-4 rounded-2xl flex items-center justify-center space-x-2 transition"
                >
                  <Lock size={18} />
                  <span>Zaloguj się</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <span className="inline-block bg-emerald-50 text-emerald-700 text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full mb-4 border border-emerald-200">
            Jak to działa
          </span>
          <h2 className="text-3xl md:text-4xl font-black text-slate-900 mb-16">
            Zamów w <span className="text-emerald-600">3 krokach</span>
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '01', icon: Package, title: 'Przeglądaj katalog', desc: 'Wejdź na platformę i przeglądaj setki produktów. Filtruj po kategorii, marce lub cenie.', color: 'text-[#1C60B0]', border: 'border-blue-200', bg: 'bg-blue-50' },
              { step: '02', icon: ShoppingBag, title: 'Skompletuj koszyk', desc: 'Dodaj produkty do koszyka, ustaw ilości i sprawdź wartość zamówienia w czasie rzeczywistym.', color: 'text-purple-600', border: 'border-purple-200', bg: 'bg-purple-50' },
              { step: '03', icon: Truck, title: 'Wyślij zamówienie', desc: 'Jeden klik wysyła zamówienie mailem lub eksportuje je do pliku CSV dla Twojego systemu.', color: 'text-emerald-600', border: 'border-emerald-200', bg: 'bg-emerald-50' },
            ].map(({ step, icon: Icon, title, desc, color, border, bg }) => (
              <div key={step} className="relative">
                <div className={`bg-white border ${border} rounded-3xl p-8 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1`}>
                  <div className={`w-14 h-14 ${bg} rounded-2xl flex items-center justify-center mx-auto mb-6`}>
                    <Icon size={26} className={color} />
                  </div>
                  <div className={`text-5xl font-black ${color} opacity-15 absolute top-6 right-6`}>{step}</div>
                  <h3 className="font-black text-slate-900 text-lg mb-3">{title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CONTACT FOOTER ===== */}
      <footer id="kontakt" className="bg-slate-900 text-white py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-12 mb-12">
            <div>
              <img src="/logo.png" alt="Askato" className="h-10 object-contain mb-5 brightness-0 invert" />
              <p className="text-slate-400 text-sm leading-relaxed">
                Specjalista w branży zabawek edukacyjnych. Hurtownia B2B dla profesjonalnych kontrahentów z całej Polski.
              </p>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Kontakt</h4>
              <div className="space-y-3 text-slate-400 text-sm">
                <div className="flex items-center space-x-2"><Phone size={14} className="text-[#1C60B0]" /><span>+48 XXX XXX XXX</span></div>
                <div className="flex items-center space-x-2"><Mail size={14} className="text-[#1C60B0]" /><span>biuro@askato.pl</span></div>
              </div>
            </div>
            <div>
              <h4 className="font-bold text-white mb-4 text-sm uppercase tracking-wider">Panel administracyjny</h4>
              <a href="/admin" className="text-slate-400 text-sm hover:text-[#1C60B0] transition">Zaloguj jako pracownik →</a>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-slate-500 text-xs">
            <p>© {new Date().getFullYear()} Askato Sp. z o.o. Wszelkie prawa zastrzeżone.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
