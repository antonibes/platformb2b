'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Users, ShoppingBag, ArrowRight, CheckCircle2, Lock } from 'lucide-react';

export default function PortalPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Clear any existing session on mount
  useEffect(() => {
    localStorage.removeItem('askato_user');
    localStorage.removeItem('askato_guest_name');
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Nieprawidłowe dane logowania');
      }

      // Save user to localStorage
      localStorage.setItem('askato_user', JSON.stringify(data.user));

      if (data.user.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/client/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Wystąpił błąd logowania');
    } finally {
      setLoading(false);
    }
  };

  const handleGuestAccess = () => {
    // Redirect immediately to default catalog page without asking for details
    router.push('/offer/oferta-czerwcowa2026');
  };

  return (
    <main className="min-h-screen bg-gradient-to-tr from-slate-100 via-white to-slate-50 flex flex-col justify-between py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background soft color spots */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-[#1C60B0]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#CD2628]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-7xl mx-auto w-full flex-grow flex flex-col justify-center relative z-10">
        
        {/* Brand Header with Logo Image */}
        <div className="text-center mb-12 flex flex-col items-center">
          <div className="bg-white p-4 rounded-2xl shadow-md border border-slate-200 mb-6 flex items-center justify-center max-w-[280px]">
            <img src="/logo.png" alt="Askato Logo" className="h-16 object-contain" />
          </div>
          
          <div className="inline-flex items-center space-x-2 bg-[#1C60B0]/10 px-4 py-1.5 rounded-full border border-[#1C60B0]/20 mb-4">
            <span className="w-2 h-2 rounded-full bg-[#1C60B0]" />
            <span className="text-xs font-bold text-[#1C60B0] tracking-wider uppercase">Platforma Hurtowa B2B</span>
          </div>
          
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 tracking-tight">
            System Zakupów Hurtowych
          </h1>
          <p className="mt-3 text-sm sm:text-base text-slate-500 max-w-xl mx-auto font-light">
            Szybkie i wygodne składanie zamówień, eksport do CSV oraz integracja z systemem handlowym Askato.
          </p>
        </div>

        {/* Portal cards grid */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto w-full items-stretch mt-4">
          
          {/* Card 1: Guest Access */}
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-[#1C60B0]/30 transition-all duration-300 group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#1C60B0]/10 flex items-center justify-center text-[#1C60B0] mb-6">
                <ShoppingBag size={24} />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-850 mb-3">Szybkie Zakupy (Jako Gość)</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6 font-light">
                Chcesz zapoznać się z aktualną ofertą i skompletować koszyk? Nie musisz się logować. Skompletuj zamówienie i podaj dane swojej firmy dopiero na końcu przy wysyłce koszyka.
              </p>

              <ul className="space-y-2.5 text-xs text-slate-500 mb-8">
                <li className="flex items-center space-x-2">
                  <CheckCircle2 size={14} className="text-[#1C60B0]" />
                  <span>Dostęp do aktualnego katalogu zabawek</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 size={14} className="text-[#1C60B0]" />
                  <span>Pobieranie zamówień do pliku CSV</span>
                </li>
                <li className="flex items-center space-x-2">
                  <CheckCircle2 size={14} className="text-[#1C60B0]" />
                  <span>Szybki formularz wysyłki zamówienia na końcu</span>
                </li>
              </ul>
            </div>

            <div>
              <button
                onClick={handleGuestAccess}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-3.5 px-4 font-bold flex items-center justify-center space-x-2 transition-all duration-200 shadow-sm"
              >
                <span>Wejdź jako Gość</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </div>

          {/* Card 2: Registered Client Login */}
          <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm flex flex-col justify-between hover:shadow-md hover:border-[#1C60B0]/30 transition-all duration-300 group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-[#CD2628]/10 flex items-center justify-center text-[#CD2628] mb-6">
                <Lock size={24} />
              </div>
              <h2 className="text-2xl font-extrabold text-slate-850 mb-3">Strefa Partnera (Zaloguj się)</h2>
              <p className="text-slate-500 text-sm leading-relaxed mb-6 font-light">
                Zaloguj się, aby uzyskać dostęp do spersonalizowanego Panelu Kontrahenta, Twoich stałych rabatów handlowych B2B oraz pełnej historii zamówień.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              {error && (
                <div className="bg-[#CD2628]/10 border border-[#CD2628]/20 rounded-xl px-4 py-2.5 text-xs text-[#CD2628]">
                  {error}
                </div>
              )}
              <div>
                <label htmlFor="email" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Adres E-mail</label>
                <input
                  type="email"
                  id="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="partner@firma.pl"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#CD2628]/30 focus:bg-white transition"
                />
              </div>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="password" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider">Hasło</label>
                </div>
                <input
                  type="password"
                  id="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#CD2628]/30 focus:bg-white transition"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-[#1C60B0] to-[#1A54A5] text-white hover:brightness-105 rounded-xl py-3.5 px-4 font-bold flex items-center justify-center space-x-2 transition-all duration-200 shadow-md shadow-blue-500/10 disabled:opacity-50"
              >
                <span>{loading ? 'Logowanie...' : 'Zaloguj się do panelu'}</span>
                <ArrowRight size={16} />
              </button>
            </form>
          </div>

        </div>

        {/* Small quick login hints */}
        <div className="max-w-md mx-auto mt-8 bg-slate-100 border border-slate-200 rounded-xl p-4 text-center">
          <p className="text-xs text-slate-500 font-semibold mb-2">Dane do testów:</p>
          <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-500">
            <div>
              <span className="font-semibold text-slate-600">Admin:</span> admin@askato.pl / admin123
            </div>
            <div>
              <span className="font-semibold text-slate-600">Klient B2B:</span> hurtownik@example.com / client123
            </div>
          </div>
        </div>

      </div>

      {/* Brand Footer */}
      <footer className="text-center text-slate-400 text-xs mt-12 relative z-10">
        <p>&copy; {new Date().getFullYear()} Askato Sp. z o.o. Wszelkie prawa zastrzeżone.</p>
        <p className="mt-1 font-light">Administrator panelu: <a href="/admin" className="text-[#1C60B0] hover:underline">Zaloguj jako pracownik</a></p>
      </footer>
    </main>
  );
}
