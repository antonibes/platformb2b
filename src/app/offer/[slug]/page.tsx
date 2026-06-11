'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShoppingBag, Search, ArrowLeft, Trash2, Download, Send, 
  Check, X, CheckCircle2, ChevronRight, Package, ArrowRight, HelpCircle, User
} from 'lucide-react';
import canvasConfetti from 'canvas-confetti';

interface Product {
  id: string;
  sku: string;
  ean: string;
  category?: string;
  name: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
  packaging: string;
  stock: number;
  discountRate: number;
  description?: string;
  age?: string;
}

interface Offer {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

interface CartItem extends Product {
  quantity: number;
}

const formatPCB = (pkg: string) => {
  if (!pkg) return 'PCB 1';
  const cleaned = pkg.trim();
  if (cleaned.toLowerCase().startsWith('pcb')) return cleaned;
  const numMatch = cleaned.match(/\d+/);
  if (numMatch) return `PCB ${numMatch[0]}`;
  return `PCB ${cleaned}`;
};


export default function OfferPage({ params }: { params: { slug: string } }) {
  const router = useRouter();
  const { slug } = params;

  // State variables
  const [offer, setOffer] = useState<Offer | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [discountRate, setDiscountRate] = useState(0);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Checkout Modal State
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [nip, setNip] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [comments, setComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState<string | null>(null);
  const [selectedProductDetails, setSelectedProductDetails] = useState<Product | null>(null);

  // Get user details and device ID
  const [user, setUser] = useState<any>(null);
  const [deviceId, setDeviceId] = useState('');

  // 1. Initial Device & User checks
  useEffect(() => {
    const storedUser = localStorage.getItem('askato_user');
    if (storedUser) {
      const parsedUser = JSON.parse(storedUser);
      setUser(parsedUser);
      setCompanyName(parsedUser.companyName || '');
      setNip(parsedUser.nip || '');
      setEmail(parsedUser.email || '');
    } else {
      const storedGuestName = localStorage.getItem('askato_guest_name');
      if (storedGuestName) {
        setCompanyName(storedGuestName);
      }
    }

    let storedDeviceId = localStorage.getItem('askato_deviceId');
    if (!storedDeviceId) {
      storedDeviceId = 'dev_' + Math.random().toString(36).substring(2, 15);
      localStorage.setItem('askato_deviceId', storedDeviceId);
    }
    setDeviceId(storedDeviceId);
  }, []);

  // 2. Fetch Offer Data and trigger Page View event
  useEffect(() => {
    if (!deviceId) return;

    const fetchOffer = async () => {
      try {
        const queryParams = new URLSearchParams(window.location.search);
        if (user?.id) {
          queryParams.set('userId', user.id);
        }
        const queryString = queryParams.toString();
        const res = await fetch(`/api/offers/${slug}${queryString ? `?${queryString}` : ''}`);
        const data = await res.json();
        
        if (!res.ok) {
          throw new Error(data.error || 'Nie udało się pobrać oferty');
        }

        setOffer(data.offer);
        setProducts(data.products);
        setDiscountRate(data.discountRate || 0);

        // Load existing cart
        const savedCart = localStorage.getItem(`askato_cart_${slug}`);
        if (savedCart) {
          setCart(JSON.parse(savedCart));
        }

        // Track page view event
        fetch('/api/tracking', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId,
            userId: user?.id || null,
            eventType: 'page_view',
            offerSlug: slug,
            payload: { title: data.offer.title }
          })
        }).catch(err => console.error('Tracking failed', err));

      } catch (err: any) {
        setError(err.message || 'Wystąpił błąd wczytywania oferty');
      } finally {
        setLoading(false);
      }
    };

    fetchOffer();
  }, [slug, deviceId, user?.id]);

  // Check query parameters to open cart automatically (for reorder actions)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      if (searchParams.get('cartOpen') === 'true') {
        setIsCartOpen(true);
      }
    }
  }, [loading]);

  const saveCart = (updatedCart: CartItem[]) => {
    setCart(updatedCart);
    localStorage.setItem(`askato_cart_${slug}`, JSON.stringify(updatedCart));
  };

  const handleAddToCart = (product: Product, quantity: number) => {
    if (quantity <= 0) return;

    const existingIndex = cart.findIndex(item => item.id === product.id);
    let updatedCart = [...cart];

    const currentQtyInCart = existingIndex !== -1 ? cart[existingIndex].quantity : 0;
    const newQuantity = currentQtyInCart + quantity;

    if (newQuantity > product.stock) {
      alert(`Przepraszamy, nie posiadamy tylu sztuk na stanie. Maksymalna dostępna ilość: ${product.stock}`);
      return;
    }

    if (existingIndex !== -1) {
      updatedCart[existingIndex].quantity = newQuantity;
    } else {
      updatedCart.push({ ...product, quantity });
    }

    saveCart(updatedCart);

    // Track addition
    fetch('/api/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        userId: user?.id || null,
        eventType: 'add_to_cart',
        offerSlug: slug,
        payload: {
          productId: product.id,
          productSku: product.sku,
          productName: product.name,
          price: product.price,
          quantity: quantity
        }
      })
    }).catch(err => console.error('Tracking failed', err));
  };

  const handleUpdateQuantity = (productId: string, quantity: number) => {
    const item = cart.find(item => item.id === productId);
    if (!item) return;

    if (quantity <= 0) {
      handleRemoveFromCart(productId);
      return;
    }

    if (quantity > item.stock) {
      alert(`Maksymalna dostępna ilość to ${item.stock} szt.`);
      return;
    }

    const updatedCart = cart.map(item => 
      item.id === productId ? { ...item, quantity } : item
    );
    saveCart(updatedCart);
  };

  const handleRemoveFromCart = (productId: string) => {
    const item = cart.find(i => i.id === productId);
    const updatedCart = cart.filter(item => item.id !== productId);
    saveCart(updatedCart);

    if (item) {
      fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          userId: user?.id || null,
          eventType: 'remove_from_cart',
          offerSlug: slug,
          payload: {
            productId: item.id,
            productSku: item.sku,
            productName: item.name
          }
        })
      }).catch(err => console.error('Tracking failed', err));
    }
  };

  const getProductBrand = (product: Product): string => {
    const nameLower = product.name.toLowerCase();
    if (nameLower.includes('genialny dzieciak')) return 'GENIALNY DZIECIAK';
    if (nameLower.includes('pomysłowy skrzat') || nameLower.includes('pomyslowy skrzat')) return 'POMYSŁOWY SKRZAT';
    if (nameLower.includes('klocki małych geniuszy') || nameLower.includes('klocki malych geniuszy')) return 'KLOCKI MAŁYCH GENIUSZY';
    
    const cat = (product.category || '').toUpperCase();
    if (cat.includes('GENIALNY DZIECIAK')) return 'GENIALNY DZIECIAK';
    if (cat.includes('POMYSŁOWY SKRZAT')) return 'POMYSŁOWY SKRZAT';
    if (cat.includes('KLOCKI MAŁYCH GENIUSZY')) return 'KLOCKI MAŁYCH GENIUSZY';
    
    return 'Pozostałe';
  };

  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    products.forEach(p => {
      if (p.category) {
        cats.add(p.category.toUpperCase().trim());
      }
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'pl'));
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                            p.sku.toLowerCase().includes(search.toLowerCase()) ||
                            p.ean.includes(search);
      
      const matchesCategory = selectedCategory === 'all' || 
                              (p.category && p.category.toUpperCase().trim() === selectedCategory.toUpperCase().trim());
      
      const brand = getProductBrand(p);
      const matchesBrand = selectedBrand === 'all' || brand === selectedBrand;
      
      return matchesSearch && matchesCategory && matchesBrand;
    });
  }, [products, search, selectedCategory, selectedBrand]);

  const groupedProducts = useMemo(() => {
    const groups: { [key: string]: Product[] } = {};
    const categoryOrder: string[] = [];
    filteredProducts.forEach(product => {
      const cat = (product.category || 'ZABAWKI').toUpperCase().trim();
      if (!groups[cat]) {
        groups[cat] = [];
        categoryOrder.push(cat);
      }
      groups[cat].push(product);
    });
    
    const sortedGroups: { [key: string]: Product[] } = {};
    categoryOrder.forEach(key => {
      sortedGroups[key] = groups[key];
    });
      
    return sortedGroups;
  }, [filteredProducts]);

  const cartSummary = useMemo(() => {
    const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
    const totalNet = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const totalOriginal = cart.reduce((sum, item) => sum + ((item.originalPrice || item.price) * item.quantity), 0);
    return { totalCount, totalNet, totalOriginal };
  }, [cart]);

  const handleExportCSV = () => {
    if (cart.length === 0) return;

    let csvContent = '\uFEFF';
    csvContent += 'EAN;SKU;Nazwa;Cena;Ilosc;Wartosc\n';

    cart.forEach(item => {
      const lineVal = parseFloat((item.price * item.quantity).toFixed(2));
      const nameEscaped = item.name.replace(/"/g, '""');
      csvContent += `"${item.ean}";"${item.sku}";"${nameEscaped}";${item.price.toFixed(2).replace('.', ',')};${item.quantity};${lineVal.toFixed(2).replace('.', ',')}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `zamowienie_${slug}_askato.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Track CSV Export
    fetch('/api/tracking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId,
        userId: user?.id || null,
        eventType: 'csv_export',
        offerSlug: slug,
        payload: {
          itemsCount: cart.length,
          totalValue: cartSummary.totalNet
        }
      })
    }).catch(err => console.error('Tracking failed', err));
  };

  const handleSubmitEmailOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id || null,
          guestDeviceId: user ? null : deviceId,
          clientName: companyName,
          clientNip: nip,
          clientEmail: email,
          clientPhone: phone,
          comments,
          items: cart
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Błąd wysyłania zamówienia');
      }

      setOrderSuccess(data.orderId);

      // Track email order
      fetch('/api/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          userId: user?.id || null,
          eventType: 'email_order',
          offerSlug: slug,
          payload: {
            orderId: data.orderId,
            itemsCount: cart.length,
            totalValue: cartSummary.totalNet,
            emailSent: data.emailSent
          }
        })
      }).catch(err => console.error('Tracking failed', err));

      canvasConfetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });

      saveCart([]);
    } catch (err: any) {
      alert(err.message || 'Nie udało się wysłać zamówienia. Spróbuj pobrać plik CSV.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('askato_user');
    router.push('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#1C60B0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Wczytywanie katalogu zabawek Askato...</p>
        </div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-55 p-4">
        <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-xl border border-slate-100 text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-[#CD2628] mx-auto mb-4">
            <X size={32} />
          </div>
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Błąd wczytywania</h2>
          <p className="text-slate-500 mb-6">{error || 'Brak aktywnego katalogu pod tym adresem.'}</p>
          <button
            onClick={() => router.push('/')}
            className="inline-flex items-center space-x-2 bg-[#1C60B0] hover:bg-[#1A54A5] text-white rounded-xl py-2.5 px-6 font-semibold transition"
          >
            <ArrowLeft size={16} />
            <span>Wróć do portalu</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 relative pb-16">
      
      {/* Top Navigation */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-md py-4">
        <div className="max-w-[95%] w-full mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-5">
            <button
              onClick={() => router.push(user ? '/client/dashboard' : '/')}
              className="text-slate-500 hover:text-slate-800 p-2.5 hover:bg-slate-100 rounded-xl transition border border-slate-200 shadow-sm"
              title="Wróć"
            >
              <ArrowLeft size={20} />
            </button>
            
            {/* Corporate Logo Display */}
            <div className="flex items-center space-x-4 border-l border-slate-200 pl-5">
              <img src="/logo.png" alt="Askato Logo" className="h-14 object-contain" />
              <div className="hidden md:block">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block leading-none">Hurtownia Zabawek</span>
                <span className="text-xs font-bold text-slate-755 block mt-1">{offer.title}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {user ? (
              <div className="hidden sm:flex flex-col items-end text-xs">
                <span className="font-bold text-slate-800">{user.companyName}</span>
                <span className="text-slate-500 font-medium">Klient B2B (Ceny Netto)</span>
              </div>
            ) : (
              <div className="hidden sm:flex flex-col items-end text-xs">
                <span className="font-semibold text-slate-500">Sesja Gościa (Ceny Netto)</span>
              </div>
            )}

            {user && (
              <button
                onClick={handleLogout}
                className="text-slate-500 hover:text-[#CD2628] text-xs px-2.5 py-1.5 border border-slate-200 hover:border-red-200 rounded-lg transition"
              >
                Wyloguj
              </button>
            )}

            {/* Cart Trigger Button - Styled with Brand Red & Price Display */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="flex items-center space-x-3 bg-slate-50 border border-slate-200 hover:border-slate-350 hover:bg-slate-100 p-2.5 px-4 rounded-2xl transition-all shadow-sm group"
            >
              <div className="relative text-slate-600 group-hover:text-[#1C60B0] transition-colors">
                <ShoppingBag size={22} />
                {cartSummary.totalCount > 0 && (
                  <span className="absolute -top-2.5 -right-2.5 bg-[#CD2628] text-white text-[9px] font-black px-1.5 py-0.5 rounded-full leading-none scale-90">
                    {cartSummary.totalCount}
                  </span>
                )}
              </div>
              <div className="hidden md:flex flex-col items-start leading-none text-left">
                <span className="text-[8px] text-slate-400 uppercase tracking-widest font-extrabold">Twój koszyk</span>
                <span className="text-xs font-extrabold text-[#CD2628] mt-0.5">{cartSummary.totalNet.toFixed(2)} PLN</span>
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Offer Banner info */}
      <div className="bg-[#1C60B0]/5 border-b border-[#1C60B0]/10">
        <div className="max-w-[95%] w-full mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#1C60B0]">
          <div className="flex items-center space-x-2 font-medium">
            <Package size={14} className="text-[#1C60B0]" />
            <span>Pakowanie zbiorcze (PCB). Minimalne zamówienie to 1 PCB.</span>
          </div>
          <div className="bg-emerald-600 text-white font-extrabold px-3 py-1 rounded-full text-[11px] shadow-sm flex items-center space-x-1">
            <span>🚚</span>
            <span>Darmowa dostawa od 600 zł netto przed rabatem!</span>
          </div>
        </div>
      </div>

      {/* Search & Filter bar */}
      <div className="max-w-[95%] w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col lg:flex-row gap-4 items-center justify-between">
          <div className="flex flex-col md:flex-row gap-3 w-full lg:max-w-3xl">
            {/* Search Input */}
            <div className="relative flex-grow">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Filtruj produkty po nazwie, SKU lub EAN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#1C60B0]/50 text-sm font-medium"
              />
            </div>
            
            {/* Category Dropdown */}
            <div className="w-full md:w-64">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-[#1C60B0]/50 text-sm font-medium bg-white"
              >
                <option value="all">Wszystkie kategorie</option>
                {uniqueCategories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-slate-500 self-end lg:self-center font-medium shrink-0">
            Wyświetlono: <span className="font-extrabold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">{filteredProducts.length}</span> pozycji zabawek
          </div>
        </div>

        {/* Brand Filter Row */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm space-y-3">
          <span className="text-xs font-bold text-slate-450 uppercase tracking-wider block">Filtruj według marki:</span>
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'all', label: 'Wszystkie marki' },
              { id: 'GENIALNY DZIECIAK', label: 'Genialny Dzieciak' },
              { id: 'POMYSŁOWY SKRZAT', label: 'Pomysłowy Skrzat' },
              { id: 'KLOCKI MAŁYCH GENIUSZY', label: 'Klocki Małych Geniuszy' },
              { id: 'Pozostałe', label: 'Pozostałe marki' }
            ].map(brand => {
              const isActive = selectedBrand === brand.id;
              return (
                <button
                  key={brand.id}
                  onClick={() => setSelectedBrand(brand.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isActive
                      ? 'bg-[#1C60B0] border-[#1C60B0] text-white shadow-sm shadow-blue-500/20'
                      : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  {brand.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category Sections */}
        <div className="mt-8 space-y-12">
          {Object.entries(groupedProducts).map(([categoryName, catProducts]) => {
            if (catProducts.length === 0) return null;
            return (
              <div key={categoryName} className="space-y-4">
                {/* Category Header */}
                <div className="border-b border-[#1C60B0]/20 pb-1.5 flex items-center space-x-2.5">
                  <h2 className="text-[#1C60B0] font-black text-sm uppercase tracking-wider">
                    {categoryName}
                  </h2>
                  <span className="bg-[#1C60B0] text-white text-xs font-bold px-1.5 py-0.5 rounded-sm">
                    {catProducts.length}
                  </span>
                </div>

                {/* Product Grid - Large Images, Mobile-friendly 2 cols */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                  {catProducts.map((product) => {
                    const inCart = cart.find(item => item.id === product.id);
                    return (
                      <div
                        key={product.id}
                        className="bg-[#F4F7FC] p-3 rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group"
                      >
                        {/* Product Image */}
                        <div 
                          onClick={() => setSelectedProductDetails(product)}
                          className="relative w-full bg-white rounded-2xl flex items-center justify-center border border-slate-100 cursor-pointer overflow-hidden shadow-sm"
                          style={{ aspectRatio: '1 / 1' }}
                        >
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300 p-3"
                            onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect width="100" height="100" fill="%23f1f5f9"/><text x="50" y="55" text-anchor="middle" fill="%2394a3b8" font-size="11" font-family="sans-serif">Brak zdjęcia</text></svg>'; }}
                          />
                          {product.stock <= 10 && (
                            <span className="absolute top-2 right-2 bg-[#CD2628] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider shadow z-10">
                              Limit: {product.stock}
                            </span>
                          )}
                          {product.discountRate > 0 && (
                            <span className="absolute top-2 left-2 bg-[#CD2628] text-white text-[10px] font-black px-2 py-0.5 rounded-lg shadow-md z-10 animate-bounce">
                              -{Math.round(product.discountRate * 100)}%
                            </span>
                          )}
                          {inCart && (
                            <span className="absolute bottom-2 left-2 bg-[#1C60B0] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full flex items-center space-x-0.5 shadow z-10">
                              <Check size={8} />
                              <span>{inCart.quantity} szt.</span>
                            </span>
                          )}
                        </div>

                        {/* Divider line */}
                        <div className="w-full h-[1px] bg-slate-200/70 my-3" />

                        {/* Product Info */}
                        <div className="flex-grow flex flex-col justify-between">
                          <div>
                            <h3 
                              onClick={() => setSelectedProductDetails(product)}
                              className="font-extrabold text-slate-800 uppercase leading-snug text-xs sm:text-[11px] hover:text-[#1C60B0] transition-colors cursor-pointer mb-2.5 break-words"
                            >
                              {product.name}
                            </h3>
                            
                            {/* Pills */}
                            <div className="flex flex-wrap gap-1.5 mb-3">
                              <span className="bg-[#EDF2F9] text-[#4F709C] px-2.5 py-0.5 rounded-lg text-[10px] font-semibold border border-blue-50/50">
                                {product.ean}
                              </span>
                              <span className="bg-[#EDF2F9] text-[#4F709C] px-2.5 py-0.5 rounded-lg text-[10px] font-semibold border border-blue-50/50 flex items-center gap-1">
                                <User size={10} className="inline text-[#4F709C]" /> {product.age || '3+'}
                              </span>
                              <span className="bg-[#EDF2F9] text-[#4F709C] px-2.5 py-0.5 rounded-lg text-[10px] font-semibold border border-blue-50/50">
                                {formatPCB(product.packaging)}
                              </span>
                            </div>
                          </div>

                          {/* Pricing and Cart button */}
                          <div className="pt-2 border-t border-slate-100/50 flex items-center justify-between mt-auto gap-2">
                            <div className="shrink-0">
                              {product.discountRate > 0 && (
                                <span className="text-[10px] text-slate-400 line-through block leading-none mb-0.5">
                                  {product.originalPrice.toFixed(2).replace('.', ',')} zł
                                </span>
                              )}
                              <span className="text-lg font-black text-[#CD2628] leading-none">
                                {product.price.toFixed(2).replace('.', ',')}
                              </span>
                              <span className="text-[10px] text-slate-400 block mt-1 font-semibold leading-none">zł netto</span>
                            </div>

                            {/* Add quantity controls — stacked on mobile, inline on desktop */}
                            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1.5 sm:gap-1 ml-auto">
                              <input
                                type="number"
                                min="1"
                                max={product.stock}
                                defaultValue="1"
                                id={`qty-${product.id}`}
                                className="w-14 sm:w-10 border border-slate-200 rounded-lg text-center text-xs py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1C60B0] bg-white font-semibold"
                              />
                              <button
                                onClick={() => {
                                  const input = document.getElementById(`qty-${product.id}`) as HTMLInputElement;
                                  const qty = parseInt(input?.value || '1', 10);
                                  handleAddToCart(product, qty);
                                }}
                                className="w-full sm:w-auto bg-[#2D6AD5] hover:bg-[#1E56B8] text-white font-bold py-2 sm:py-1.5 px-4 sm:px-3.5 rounded-xl text-xs flex items-center justify-center space-x-1 transition shadow-sm whitespace-nowrap"
                              >
                                <span>+ Dodaj</span>
                              </button>
                            </div>
                          </div>

                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Sticky Bottom Cart summary */}
      {cart.length > 0 && !isCartOpen && (
        <div className="fixed bottom-4 right-4 z-40 animate-fade-in">
          <button
            onClick={() => setIsCartOpen(true)}
            className="bg-gradient-to-r from-[#1C60B0] to-[#1A54A5] text-white rounded-full py-3.5 px-6 shadow-2xl flex items-center space-x-3 transition-all scale-102 border border-blue-500/10"
          >
            <ShoppingBag size={20} />
            <div className="text-left leading-none">
              <span className="block text-[9px] text-blue-200 uppercase tracking-widest font-extrabold">Aktualny Koszyk B2B</span>
              <span className="text-sm font-extrabold">{cartSummary.totalNet.toFixed(2)} PLN netto</span>
            </div>
            <span className="bg-[#CD2628] text-white font-extrabold px-2 py-0.5 rounded-full text-xs">
              {cartSummary.totalCount}
            </span>
          </button>
        </div>
      )}

      {/* SLIDE-OUT CART DRAWER */}
      {isCartOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div 
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => setIsCartOpen(false)}
          />
          
          <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col justify-between animate-slide-in-right">
              
              {/* Drawer Header */}
              <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShoppingBag size={22} className="text-[#1C60B0]" />
                  <h2 className="text-lg font-bold text-slate-800">Twój Koszyk B2B</h2>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="text-slate-400 hover:text-slate-650 p-1 rounded-lg hover:bg-slate-100 transition"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Drawer Body - Items list */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-16 text-slate-400">
                    <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="font-semibold">Koszyk jest obecnie pusty</p>
                    <p className="text-xs mt-1">Dodaj produkty z powyższego katalogu Askato.</p>
                  </div>
                ) : (
                  cart.map((item) => (
                    <div key={item.id} className="flex space-x-4 p-3 border border-slate-150 rounded-xl bg-slate-50 relative group">
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-white border border-slate-200 flex-shrink-0">
                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect width="64" height="64" fill="%23f1f5f9"/></svg>'; }} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-slate-800 text-xs truncate pr-6">{item.name}</h4>
                        <p className="text-[9px] text-slate-450 font-mono mt-0.5">Kod: {item.sku}</p>
                        
                        <div className="flex items-center justify-between mt-2.5">
                          {/* Quantity selector inside cart */}
                          <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                              className="px-2.5 py-0.5 hover:bg-slate-100 text-xs font-bold text-slate-500 transition"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => handleUpdateQuantity(item.id, parseInt(e.target.value, 10) || 0)}
                              className="w-10 text-center text-xs focus:outline-none font-semibold text-slate-700"
                            />
                            <button
                              onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                              className="px-2.5 py-0.5 hover:bg-slate-100 text-xs font-bold text-slate-500 transition"
                            >
                              +
                            </button>
                          </div>

                          <div className="text-right">
                            <span className="text-xs text-slate-400 block font-light">{(item.price * item.quantity).toFixed(2)} PLN</span>
                            <span className="text-xs font-extrabold text-[#1C60B0]">netto</span>
                          </div>
                        </div>
                      </div>

                      {/* Delete button */}
                      <button
                        onClick={() => handleRemoveFromCart(item.id)}
                        className="absolute top-2 right-2 text-slate-400 hover:text-[#CD2628] p-1 rounded transition opacity-0 group-hover:opacity-100 focus:opacity-100"
                        title="Usuń"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* Drawer Footer */}
              {cart.length > 0 && (
                <div className="border-t border-slate-200 p-6 bg-slate-50 space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Liczba pozycji:</span>
                      <span className="font-semibold text-slate-700">{cart.length}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-500">
                      <span>Opakowań zbiorczych (PCB):</span>
                      <span className="font-semibold text-slate-700">{cartSummary.totalCount} szt.</span>
                    </div>
                    <div className="flex justify-between items-baseline pt-2.5 border-t border-slate-200">
                      <span className="text-sm font-bold text-slate-800">Łączna Wartość Netto:</span>
                      <div className="text-right">
                        <span className="text-xl font-black text-[#1C60B0]">{cartSummary.totalNet.toFixed(2)} PLN</span>
                        <span className="block text-[9px] text-slate-400 font-light">Cena nie zawiera podatku VAT</span>
                      </div>
                    </div>
                  </div>

                  {/* Dynamic Free Shipping Alert */}
                  <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${
                    cartSummary.totalOriginal >= 600 
                      ? 'bg-emerald-50 border-emerald-250 text-emerald-800 animate-pulse' 
                      : 'bg-amber-50 border-amber-250 text-amber-800'
                  }`}>
                    <div className="flex items-center space-x-2">
                      <span className="text-base">🚚</span>
                      <div>
                        {cartSummary.totalOriginal >= 600 ? (
                          <span>Kwalifikujesz się do <strong>DARMOWEJ DOSTAWY!</strong></span>
                        ) : (
                          <span>Darmowa dostawa od 600 zł netto przed rabatem (brakuje <strong>{(600 - cartSummary.totalOriginal).toFixed(2).replace('.', ',')} PLN</strong>)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Checkout Actions */}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      onClick={handleExportCSV}
                      className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl py-3 px-4 font-semibold text-xs flex items-center justify-center space-x-1.5 transition"
                    >
                      <Download size={14} />
                      <span>Pobierz CSV</span>
                    </button>
                    <button
                      onClick={() => {
                        setIsCartOpen(false);
                        setIsCheckoutOpen(true);
                      }}
                      className="bg-[#1C60B0] hover:bg-[#1A54A5] text-white rounded-xl py-3 px-4 font-semibold text-xs flex items-center justify-center space-x-1.5 transition shadow-lg shadow-blue-500/10"
                    >
                      <Send size={14} />
                      <span>Wyślij Zamówienie</span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT / ORDER MODAL */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
            onClick={() => { if (!isSubmitting) setIsCheckoutOpen(false); }}
          />

          <div className="bg-white rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-slate-100 z-10 relative animate-scale-in">
            {!isSubmitting && !orderSuccess && (
              <button
                onClick={() => setIsCheckoutOpen(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-655 p-1 rounded-lg hover:bg-slate-100 transition"
              >
                <X size={18} />
              </button>
            )}

            {!orderSuccess ? (
              <div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">Finalizacja Zamówienia B2B</h3>
                <p className="text-xs text-slate-500 mb-6">
                  Wypełnij dane kontaktowe do faktury i wysyłki. Twoje zamówienie zostanie automatycznie przetworzone w systemie handlowym Askato.
                </p>

                <form onSubmit={handleSubmitEmailOrder} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="compName" className="block text-xs font-semibold text-slate-600 mb-1">Nazwa Firmy *</label>
                      <input
                        type="text"
                        id="compName"
                        required
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        placeholder="Np. Hurt-Zabawki Sp. z o.o."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                    <div>
                      <label htmlFor="clientNip" className="block text-xs font-semibold text-slate-600 mb-1">NIP Firmy</label>
                      <input
                        type="text"
                        id="clientNip"
                        value={nip}
                        onChange={(e) => setNip(e.target.value)}
                        placeholder="Np. 1234567890"
                        className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="clientEmail" className="block text-xs font-semibold text-slate-600 mb-1">Adres E-mail *</label>
                    <input
                      type="email"
                      id="clientEmail"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="email@firma.pl"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>

                  <div>
                    <label htmlFor="clientComments" className="block text-xs font-semibold text-slate-600 mb-1">Uwagi do zamówienia</label>
                    <textarea
                      id="clientComments"
                      rows={3}
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      placeholder="Np. preferowana data dostawy, specyficzne pakowanie..."
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-semibold block text-slate-750">Suma netto do zamówienia:</span>
                      <span className="text-[10px] text-slate-400">Bez VAT i kosztów transportu</span>
                    </div>
                    <span className="text-lg font-black text-[#1C60B0]">{cartSummary.totalNet.toFixed(2)} PLN</span>
                  </div>

                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-[#1C60B0] hover:bg-[#1A54A5] text-white font-bold py-3 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    <span>{isSubmitting ? 'Wysyłanie zamówienia...' : 'Potwierdzam i wysyłam zamówienie'}</span>
                  </button>
                </form>
              </div>
            ) : (
              /* Success screen */
              <div className="text-center py-6">
                <div className="w-16 h-16 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-4 animate-scale-in">
                  <Check size={32} />
                </div>
                <h3 className="text-2xl font-black text-slate-800 mb-2">Zamówienie Zostało Złożone!</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mb-6">
                  Dziękujemy. Zlecenie hurtowe zostało poprawnie przekazane. Trwa generowanie faktury proforma.
                </p>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Numer Referencyjny</span>
                  <span className="text-sm font-mono font-bold text-slate-700 bg-white border border-slate-200 px-3 py-1 rounded-md block mt-1.5 w-fit mx-auto">
                    {orderSuccess}
                  </span>
                </div>

                <div className="flex space-x-3 max-w-xs mx-auto">
                  <button
                    onClick={() => {
                      setOrderSuccess(null);
                      setIsCheckoutOpen(false);
                    }}
                    className="w-1/2 bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-4 rounded-xl text-xs transition"
                  >
                    Kontynuuj zakupy
                  </button>
                  <button
                    onClick={() => router.push(user ? '/client/dashboard' : '/')}
                    className="w-1/2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-2.5 px-4 rounded-xl text-xs transition"
                  >
                    Powrót do portalu
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product Detail Modal */}
      {selectedProductDetails && (
        <div 
          onClick={() => setSelectedProductDetails(null)} 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in cursor-pointer"
        >
          <div 
            onClick={(e) => e.stopPropagation()} 
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 relative cursor-default"
          >
            {/* Close Button */}
            <button 
              onClick={() => setSelectedProductDetails(null)} 
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-655 transition p-2 bg-slate-50 hover:bg-slate-100 rounded-full z-10"
            >
              <X size={20} />
            </button>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 pt-4">
              {/* Image Column */}
              <div className="md:col-span-6 flex flex-col items-center justify-center bg-slate-50 border border-slate-200 rounded-2xl p-6 h-80 md:h-[420px] overflow-hidden">
                <img 
                  src={selectedProductDetails.imageUrl} 
                  alt={selectedProductDetails.name} 
                  className="max-h-full max-w-full object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="%23f1f5f9"/><text x="100" y="108" text-anchor="middle" fill="%2394a3b8" font-size="14" font-family="sans-serif">Brak zdjęcia</text></svg>'; }}
                />
              </div>

              {/* Info Column */}
              <div className="md:col-span-6 flex flex-col justify-between space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="bg-[#1C60B0]/10 text-[#1C60B0] text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-wider">
                      {selectedProductDetails.category || 'Zabawki'}
                    </span>
                    <span className="bg-slate-100 text-slate-500 text-[10px] font-bold px-2.5 py-1 rounded-full font-mono border border-slate-200">
                      EAN: {selectedProductDetails.ean}
                    </span>
                  </div>
                  
                  <h3 className="text-base md:text-lg font-black text-slate-800 leading-snug">
                    {selectedProductDetails.name}
                  </h3>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs border-t border-b border-slate-150 py-3.5">
                    <div>
                      <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">Kod SKU:</span>
                      <span className="font-mono text-slate-700 font-bold">{selectedProductDetails.sku}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">Rekomendowany wiek:</span>
                      <span className="text-slate-700 font-bold">{selectedProductDetails.age || '3+'}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">Pakowanie zbiorcze (PCB):</span>
                      <span className="text-slate-700 font-bold">{formatPCB(selectedProductDetails.packaging)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">Dostępność:</span>
                      <span className="text-slate-700 font-bold">{selectedProductDetails.stock} szt.</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold">Cena katalogowa netto:</span>
                      {selectedProductDetails.discountRate > 0 ? (
                        <div className="flex flex-col">
                          <span className="text-slate-450 line-through text-xs font-semibold">
                            {selectedProductDetails.originalPrice.toFixed(2).replace('.', ',')} PLN
                          </span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-base font-black text-[#CD2628]">
                              {selectedProductDetails.price.toFixed(2).replace('.', ',')} PLN
                            </span>
                            <span className="bg-[#CD2628] text-white font-extrabold text-[10px] px-1.5 py-0.5 rounded shadow animate-pulse">
                              -{Math.round(selectedProductDetails.discountRate * 100)}%
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-800 font-black text-[#CD2628] text-sm">
                          {selectedProductDetails.price.toFixed(2).replace('.', ',')} PLN
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Description Section */}
                  {selectedProductDetails.description && (
                    <div className="mt-4">
                      <span className="text-slate-400 block uppercase tracking-wider text-[9px] font-bold mb-1.5">Opis i specyfikacja:</span>
                      <div className="text-slate-655 text-xs leading-relaxed max-h-[150px] overflow-y-auto pr-1 whitespace-pre-wrap bg-slate-50 p-3 rounded-xl border border-slate-200">
                        {selectedProductDetails.description}
                      </div>
                    </div>
                  )}
                </div>

                {/* Add to Cart Actions */}
                <div className="pt-4 border-t border-slate-150 flex items-center justify-between gap-4">
                  <div className="flex items-center space-x-2.5">
                    <span className="text-xs text-slate-500 font-bold">Ilość:</span>
                    <input
                      type="number"
                      min="1"
                      max={selectedProductDetails.stock}
                      defaultValue="1"
                      id={`modal-qty-${selectedProductDetails.id}`}
                      className="w-14 border border-slate-200 rounded-xl text-center text-sm py-1.5 font-bold focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                    />
                  </div>

                  <button
                    onClick={() => {
                      const input = document.getElementById(`modal-qty-${selectedProductDetails.id}`) as HTMLInputElement;
                      const qty = parseInt(input?.value || '1', 10);
                      handleAddToCart(selectedProductDetails, qty);
                      setSelectedProductDetails(null); // Close modal after adding
                    }}
                    className="flex-grow bg-[#1C60B0] hover:bg-[#1A54A5] text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition shadow-sm"
                  >
                    <ShoppingBag size={14} />
                    <span>Dodaj do koszyka</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
