'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  User, ClipboardList, TrendingDown, ArrowRight, LogOut, 
  ShoppingBag, Calendar, CheckCircle2, Truck, HelpCircle, Package, Clock, ChevronRight
} from 'lucide-react';

interface OrderItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: string;
  clientName: string;
  clientNip: string;
  totalValue: number;
  status: 'new' | 'processing' | 'shipped' | 'cancelled';
  items: OrderItem[];
  createdAt: string;
}

interface Offer {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  productCount?: number;
}

export default function ClientDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'offers' | 'orders'>('offers');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  useEffect(() => {
    // Validate session
    const storedUser = localStorage.getItem('askato_user');
    if (!storedUser) {
      router.push('/');
      return;
    }
    
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== 'client') {
      router.push('/');
      return;
    }
    setUser(parsedUser);

    // Fetch offers and orders
    const fetchData = async () => {
      try {
        const offersRes = await fetch('/api/admin/offers');
        const offersData = await offersRes.json();
        const activeOffers = (offersData.offers || []).filter((o: any) => o.isActive);
        setOffers(activeOffers);

        const ordersRes = await fetch('/api/admin/orders');
        const ordersData = await ordersRes.json();
        const clientOrders = (ordersData.orders || []).filter((o: any) => 
          o.userId === parsedUser.id || o.clientNip === parsedUser.nip
        );
        setOrders(clientOrders);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('askato_user');
    router.push('/');
  };

  const handleReorder = (order: Order) => {
    const targetSlug = 'letnia-promocja-2026';
    
    const cartItems = order.items.map(item => ({
      id: item.productId,
      sku: item.sku,
      ean: '', 
      name: item.name,
      price: item.price,
      originalPrice: item.price,
      imageUrl: 'https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=500&auto=format&fit=crop&q=60',
      packaging: 'opak. 1 szt.',
      stock: 100, 
      discountRate: user?.discountRate || 0,
      quantity: item.quantity
    }));

    localStorage.setItem(`askato_cart_${targetSlug}`, JSON.stringify(cartItems));
    router.push(`/offer/${targetSlug}?cartOpen=true`);
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center space-x-1 bg-blue-50 text-blue-700 border border-blue-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
            <Clock size={12} />
            <span>Nowe</span>
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center space-x-1 bg-amber-50 text-amber-700 border border-amber-250 px-2.5 py-0.5 rounded-full text-xs font-bold">
            <Package size={12} />
            <span>W realizacji</span>
          </span>
        );
      case 'shipped':
        return (
          <span className="inline-flex items-center space-x-1 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
            <Truck size={12} />
            <span>Wysłane</span>
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center space-x-1 bg-red-50 text-[#CD2628] border-red-200 px-2.5 py-0.5 rounded-full text-xs font-bold">
            <LogOut size={12} className="rotate-180" />
            <span>Anulowane</span>
          </span>
        );
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#1C60B0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium">Wczytywanie panelu partnera...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-between">
      <div>
        {/* Header with corporate logo */}
        <header className="bg-white border-b border-slate-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img src="/logo.png" alt="Askato Logo" className="h-12 object-contain" />
              <div className="border-l border-slate-200 pl-4">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest block leading-none">Panel B2B</span>
                <span className="text-xs font-bold text-slate-700 block mt-0.5">Strefa Zakupów Hurtowych</span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 text-slate-500 hover:text-[#CD2628] text-xs border border-slate-200 hover:border-red-200 px-3.5 py-2 rounded-xl transition"
            >
              <LogOut size={14} />
              <span>Wyloguj panel</span>
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-1 lg:grid-cols-4 gap-8">
          
          {/* Sidebar - Profile Card */}
          <div className="lg:col-span-1 space-y-6 animate-fade-in">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
              <div className="flex items-center space-x-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-[#1C60B0]">
                  <User size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-slate-800 text-sm leading-tight truncate">{user?.companyName}</h3>
                  <span className="text-[10px] text-slate-450 font-bold uppercase tracking-wider block mt-0.5">Klient Hurtowy B2B</span>
                </div>
              </div>

              <div className="space-y-4 pt-4 border-t border-slate-100 text-xs">
                <div>
                  <span className="text-slate-400 block font-medium">NIP:</span>
                  <span className="font-semibold text-slate-750">{user?.nip || 'Brak'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Kontakt E-mail:</span>
                  <span className="font-semibold text-slate-750">{user?.email}</span>
                </div>
                <div className="bg-emerald-50/70 border border-emerald-100 rounded-xl p-3.5 flex items-center justify-between shadow-sm">
                  <div>
                    <span className="text-emerald-800 font-extrabold text-xs block">Twój rabat hurtowy</span>
                    <span className="text-[9px] text-emerald-600 block mt-0.5">Naliczany na ofercie</span>
                  </div>
                  <span className="text-2xl font-black text-emerald-600">
                    -{(user?.discountRate * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Help block */}
            <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm relative overflow-hidden">
              <div className="absolute top-[-10px] right-[-10px] w-24 h-24 bg-[#1C60B0]/10 rounded-full blur-xl" />
              <HelpCircle size={28} className="text-[#1C60B0] mb-3" />
              <h4 className="font-bold text-sm mb-1">Dedykowany Opiekun</h4>
              <p className="text-[11px] text-slate-350 leading-relaxed font-light mb-4">
                Masz pytania dotyczące faktury lub warunków dostawy? Skontaktuj się ze swoim opiekunem w Askato.
              </p>
              <div className="text-xs text-blue-300 font-bold">
                infolinia@askato.pl
              </div>
            </div>
          </div>

          {/* Main Panel Area */}
          <div className="lg:col-span-3 space-y-6">
            
            {/* Navigation Tabs */}
            <div className="border-b border-slate-200 flex space-x-6">
              <button
                onClick={() => setActiveTab('offers')}
                className={`pb-3 font-bold text-sm border-b-2 transition-all flex items-center space-x-1.5 ${
                  activeTab === 'offers' 
                    ? 'border-[#1C60B0] text-[#1C60B0]' 
                    : 'border-transparent text-slate-400 hover:text-slate-750'
                }`}
              >
                <ShoppingBag size={16} />
                <span>Aktualne Katalogi i Promocje</span>
                <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                  {offers.length}
                </span>
              </button>
              
              <button
                onClick={() => setActiveTab('orders')}
                className={`pb-3 font-bold text-sm border-b-2 transition-all flex items-center space-x-1.5 ${
                  activeTab === 'orders' 
                    ? 'border-[#1C60B0] text-[#1C60B0]' 
                    : 'border-transparent text-slate-400 hover:text-slate-750'
                }`}
              >
                <ClipboardList size={16} />
                <span>Twoja Historia Zamówień</span>
                <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">
                  {orders.length}
                </span>
              </button>
            </div>

            {/* TAB CONTENT: ACTIVE OFFERS */}
            {activeTab === 'offers' && (
              <div className="space-y-4">
                {offers.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                    <ShoppingBag size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="font-semibold">Brak aktywnych katalogów</p>
                    <p className="text-xs mt-1">Obecnie nie ma aktywnych ofert w systemie.</p>
                  </div>
                ) : (
                  offers.map((offer) => (
                    <div 
                      key={offer.id}
                      className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-md hover:border-slate-350 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group"
                    >
                      <div>
                        <span className="inline-flex items-center bg-[#1C60B0]/10 text-[#1C60B0] border border-[#1C60B0]/20 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mb-2">
                          Katalog Aktywny
                        </span>
                        <h4 className="text-lg font-bold text-slate-800 group-hover:text-[#1C60B0] transition-colors leading-tight">
                          {offer.title}
                        </h4>
                        <p className="text-xs text-slate-400 mt-1.5 flex items-center space-x-1.5 font-medium">
                          <Package size={12} />
                          <span>Wgranych pozycji: <span className="font-extrabold text-slate-600">{offer.productCount || 0}</span></span>
                        </p>
                      </div>

                      <button
                        onClick={() => router.push(`/offer/${offer.slug}`)}
                        className="bg-[#1C60B0] hover:bg-[#1A54A5] text-white py-2.5 px-5 rounded-xl text-xs font-bold flex items-center space-x-1 transition shadow group-hover:scale-102"
                      >
                        <span>Rozpocznij zamówienie</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* TAB CONTENT: ORDER HISTORY */}
            {activeTab === 'orders' && (
              <div className="space-y-4">
                {orders.length === 0 ? (
                  <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                    <ClipboardList size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="font-semibold">Brak złożonych zamówień</p>
                    <p className="text-xs mt-1">Nie złożyłeś jeszcze żadnego zamówienia za pośrednictwem platformy B2B.</p>
                  </div>
                ) : (
                  orders.map((order) => (
                    <div 
                      key={order.id}
                      className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:border-slate-300 transition"
                    >
                      {/* Order Header Summary */}
                      <div className="p-5 flex flex-wrap justify-between items-center gap-4 border-b border-slate-100 bg-slate-50/50">
                        <div className="flex items-center space-x-4">
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Kod transakcji</span>
                            <span className="text-xs font-bold text-slate-700 font-mono">{order.id}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Wysłano dnia</span>
                            <span className="text-xs font-medium text-slate-600 flex items-center space-x-1">
                              <Calendar size={12} />
                              <span>{new Date(order.createdAt).toLocaleDateString('pl-PL')}</span>
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-4">
                          <div className="text-right">
                            <span className="text-[9px] text-slate-400 font-bold block uppercase tracking-wider">Wartość netto</span>
                            <span className="text-sm sm:text-base font-extrabold text-[#1C60B0]">{order.totalValue.toFixed(2)} PLN</span>
                          </div>
                          <div>
                            {getStatusBadge(order.status)}
                          </div>
                        </div>
                      </div>

                      {/* Expandable items details / actions */}
                      <div className="p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="text-xs text-slate-550">
                          Suma sztuk: <span className="font-bold text-slate-700">{order.items.reduce((sum, i) => sum + i.quantity, 0)}</span> w <span className="font-bold text-slate-700">{order.items.length}</span> pozycjach produktowych.
                          <button
                            onClick={() => setSelectedOrder(selectedOrder?.id === order.id ? null : order)}
                            className="text-[#1C60B0] font-bold ml-2 hover:underline focus:outline-none"
                          >
                            {selectedOrder?.id === order.id ? 'Ukryj spis' : 'Pokaż produkty'}
                          </button>
                        </div>

                        <button
                          onClick={() => handleReorder(order)}
                          className="bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs py-2 px-4 rounded-xl transition flex items-center space-x-1.5 shadow-sm"
                        >
                          <ShoppingBag size={14} className="text-[#1C60B0]" />
                          <span>Zamów te produkty ponownie</span>
                        </button>
                      </div>

                      {/* Expandable Items List */}
                      {selectedOrder?.id === order.id && (
                        <div className="bg-slate-50 border-t border-slate-100 p-5 space-y-3">
                          <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lista zakupionych zabawek:</h5>
                          <div className="space-y-2">
                            {order.items.map((item, idx) => (
                              <div key={idx} className="flex justify-between items-center text-xs p-2.5 bg-white border border-slate-150 rounded-lg">
                                <div className="min-w-0 pr-4">
                                  <span className="font-bold text-slate-800 text-xs block truncate leading-tight">{item.name}</span>
                                  <span className="text-[9px] text-slate-400 font-mono block mt-0.5">Kod: {item.sku}</span>
                                </div>
                                <div className="flex items-center space-x-6 flex-shrink-0">
                                  <span className="text-slate-500 font-light">{item.quantity} opak. x {item.price.toFixed(2)} PLN</span>
                                  <span className="font-bold text-slate-750 w-16 text-right">{(item.price * item.quantity).toFixed(2)} PLN</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

          </div>

        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <p>&copy; {new Date().getFullYear()} Askato Sp. z o.o. Wszystkie prawa zastrzeżone.</p>
      </footer>
    </div>
  );
}
