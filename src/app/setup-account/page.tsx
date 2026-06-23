'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Lock, User, Building2, Phone, Hash, Eye, EyeOff, ArrowRight } from 'lucide-react';

export default function SetupAccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [step, setStep] = useState<'loading' | 'form' | 'done' | 'error'>('loading');
  const [prefill, setPrefill] = useState({ clientId: '', companyName: '', email: '' });
  const [form, setForm] = useState({ clientId: '', password: '', password2: '', companyName: '', nip: '', phone: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) { setStep('error'); return; }
    fetch(`/api/auth/setup-account?token=${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setStep('error'); return; }
        setPrefill(data);
        setForm(f => ({ ...f, clientId: data.clientId || '', companyName: data.companyName || '' }));
        setStep('form');
      })
      .catch(() => setStep('error'));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.password2) { setError('Hasła nie są zgodne'); return; }
    if (form.password.length < 6) { setError('Hasło musi mieć co najmniej 6 znaków'); return; }
    if (!form.clientId.trim()) { setError('Identyfikator klienta jest wymagany'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/setup-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, ...form }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Błąd serwera');
      setStep('done');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'loading') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-[#1C60B0] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (step === 'error') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-red-200 rounded-3xl p-10 max-w-md w-full text-center shadow-xl">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <Lock size={28} className="text-[#CD2628]" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Nieprawidłowy link</h1>
        <p className="text-slate-500 text-sm mb-6">Ten link aktywacyjny jest nieprawidłowy lub już wygasł. Skontaktuj się z administratorem Askato.</p>
        <a href="/" className="text-[#1C60B0] text-sm font-bold hover:underline">← Wróć do strony głównej</a>
      </div>
    </div>
  );

  if (step === 'done') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-emerald-200 rounded-3xl p-10 max-w-md w-full text-center shadow-xl">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 size={30} className="text-emerald-600" />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">Konto aktywowane!</h1>
        <p className="text-slate-500 text-sm mb-2">Twoje konto zostało pomyślnie skonfigurowane.</p>
        <p className="text-slate-600 text-sm font-bold mb-6">Twój identyfikator logowania: <span className="text-[#1C60B0]">{form.clientId}</span></p>
        <button
          onClick={() => router.push('/')}
          className="w-full bg-[#1C60B0] hover:bg-[#1A54A5] text-white font-bold py-3 rounded-xl flex items-center justify-center space-x-2 transition"
        >
          <span>Przejdź do logowania</span>
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl p-8 max-w-lg w-full shadow-xl">
        <div className="text-center mb-8">
          <img src="/logo.png" alt="Askato" className="h-10 object-contain mx-auto mb-5" />
          <h1 className="text-2xl font-black text-slate-900 mb-1">Aktywacja konta B2B</h1>
          <p className="text-slate-500 text-sm">Uzupełnij dane i ustaw swoje hasło dostępu do platformy.</p>
          {prefill.email && <p className="text-xs text-slate-400 mt-1">Konto dla: <strong>{prefill.email}</strong></p>}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-[#CD2628] font-medium">{error}</div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
              Identyfikator logowania *
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={form.clientId}
                onChange={e => setForm(f => ({ ...f, clientId: e.target.value.replace(/\s/g, '') }))}
                placeholder="np. misiek, firma123"
                className="w-full pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C60B0]/25 focus:border-[#1C60B0]/50 focus:bg-white transition"
              />
            </div>
            <p className="text-xs text-slate-400 mt-1">Tego identyfikatora będziesz używać zamiast adresu e-mail. Bez spacji.</p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Nazwa firmy *</label>
            <div className="relative">
              <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                required
                value={form.companyName}
                onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                placeholder="Nazwa Sp. z o.o."
                className="w-full pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C60B0]/25 focus:border-[#1C60B0]/50 focus:bg-white transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">NIP</label>
              <div className="relative">
                <Hash size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={form.nip}
                  onChange={e => setForm(f => ({ ...f, nip: e.target.value }))}
                  placeholder="1234567890"
                  className="w-full pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C60B0]/25 focus:border-[#1C60B0]/50 focus:bg-white transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Telefon</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+48 600 000 000"
                  className="w-full pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C60B0]/25 focus:border-[#1C60B0]/50 focus:bg-white transition"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Hasło *</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                placeholder="Minimum 6 znaków"
                className="w-full pl-9 pr-10 bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C60B0]/25 focus:border-[#1C60B0]/50 focus:bg-white transition"
              />
              <button type="button" onClick={() => setShowPwd(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Powtórz hasło *</label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type={showPwd ? 'text' : 'password'}
                required
                value={form.password2}
                onChange={e => setForm(f => ({ ...f, password2: e.target.value }))}
                placeholder="Powtórz hasło"
                className="w-full pl-9 pr-4 bg-slate-50 border border-slate-200 rounded-xl py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1C60B0]/25 focus:border-[#1C60B0]/50 focus:bg-white transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#1C60B0] hover:bg-[#1A54A5] text-white font-bold py-3.5 rounded-xl flex items-center justify-center space-x-2 transition shadow-md disabled:opacity-50 mt-2"
          >
            <span>{submitting ? 'Aktywowanie konta...' : 'Aktywuj konto i zaloguj się'}</span>
            {!submitting && <ArrowRight size={16} />}
          </button>
        </form>
      </div>
    </div>
  );
}
