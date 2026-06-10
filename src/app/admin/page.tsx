'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  BarChart3, PlusCircle, ClipboardList, LogOut, 
  Upload, FileSpreadsheet, Eye, Users, DollarSign, Percent, 
  Download, AlertCircle, ShoppingCart, RefreshCw, Clock,
  CheckCircle, Terminal, Search, Edit3, X, FileText, Settings, Image
} from 'lucide-react';

interface AnalyticsSummary {
  totalViews: number;
  uniqueDevices: number;
  totalOrders: number;
  totalRevenue: number;
  conversionRate: number;
  abandonedCartsCount: number;
}

interface AbandonedCart {
  deviceId: string;
  offerSlug: string;
  lastActive: string;
  itemsCount: number;
  items: Array<{ name: string; sku: string; price: number; quantity: number }>;
}

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
  clientEmail: string;
  clientPhone: string;
  comments: string;
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
  productCount: number;
  createdAt: string;
}

interface ActivityEvent {
  id: string;
  deviceId: string;
  eventType: string;
  offerSlug: string;
  userIdentity: string;
  payload: any;
  createdAt: string;
}

interface ClientUser {
  id: string;
  email: string;
  companyName: string;
  nip: string;
  discountRate: number;
}

interface Product {
  id: string;
  offerId: string;
  sku: string;
  ean: string;
  category?: string;
  name: string;
  price: number;
  imageUrl: string;
  packaging: string;
  stock: number;
  description?: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'offers' | 'orders' | 'clients'>('overview');
  
  // Data States
  const [offers, setOffers] = useState<Offer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<ClientUser[]>([]);
  const [analytics, setAnalytics] = useState<{
    summary: AnalyticsSummary;
    popularProducts: any[];
    abandonedCarts: AbandonedCart[];
    recentEvents: ActivityEvent[];
  } | null>(null);
  
  const [loading, setLoading] = useState(true);
  
  // Offer Create Form State
  const [newTitle, setNewTitle] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState(false);

  // Filter & Search states
  const [orderSearch, setOrderSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');

  // Catalog Product Editor states
  const [selectedOfferForEdit, setSelectedOfferForEdit] = useState<Offer | null>(null);
  const [offerProducts, setOfferProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingClient, setEditingClient] = useState<ClientUser | null>(null);

  // 1. Session check
  useEffect(() => {
    const storedUser = localStorage.getItem('askato_user');
    if (!storedUser) {
      router.push('/');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== 'admin') {
      router.push('/');
      return;
    }
    setAdmin(parsedUser);
    
    // Load initial data
    refreshData();
  }, [router]);

  // Refresh dashboard data
  const refreshData = async () => {
    setLoading(true);
    try {
      const offersRes = await fetch('/api/admin/offers');
      const offersData = await offersRes.json();
      setOffers(offersData.offers || []);

      const ordersRes = await fetch('/api/admin/orders');
      const ordersData = await ordersRes.json();
      setOrders(ordersData.orders || []);

      const analyticsRes = await fetch('/api/admin/analytics');
      const analyticsData = await analyticsRes.json();
      setAnalytics(analyticsData);

      const clientsRes = await fetch('/api/admin/clients');
      const clientsData = await clientsRes.json();
      setClients(clientsData.clients || []);
    } catch (error) {
      console.error('Error refreshing admin dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('askato_user');
    router.push('/');
  };

  // Fetch products when an offer is selected for editing
  const handleSelectOfferForEdit = async (offer: Offer) => {
    setSelectedOfferForEdit(offer);
    setProductsLoading(true);
    setProductSearch('');
    try {
      const res = await fetch(`/api/admin/products?offerId=${offer.id}`);
      const data = await res.json();
      setOfferProducts(data.products || []);
    } catch (err) {
      console.error('Error fetching products for edit:', err);
    } finally {
      setProductsLoading(false);
    }
  };

  // Save changes to edited product
  const handleSaveProductChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;

    try {
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: editingProduct.id,
          name: editingProduct.name,
          sku: editingProduct.sku,
          ean: editingProduct.ean,
          category: editingProduct.category,
          price: editingProduct.price,
          stock: editingProduct.stock,
          packaging: editingProduct.packaging,
          imageUrl: editingProduct.imageUrl,
          description: editingProduct.description
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Błąd serwera');
      }

      const resData = await res.json();
      // Update local state
      setOfferProducts(prev => prev.map(p => p.id === editingProduct.id ? resData.product : p));
      setEditingProduct(null);
    } catch (err: any) {
      alert(`Nie udało się zapisać zmian: ${err.message}`);
    }
  };

  // Save changes to client discount
  const handleSaveClientDiscount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;

    try {
      const res = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clientId: editingClient.id,
          discountRate: editingClient.discountRate
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Błąd serwera');
      }

      // Update local state
      setClients(prev => prev.map(c => c.id === editingClient.id ? { ...c, discountRate: editingClient.discountRate } : c));
      setEditingClient(null);
    } catch (err: any) {
      alert(`Nie udało się zapisać rabatu: ${err.message}`);
    }
  };

  // Create offer file upload handler
  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setUploadSuccess(false);
    
    if (!uploadFile) {
      setUploadError('Wybierz plik Excel (.xlsx) lub CSV z produktami');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('title', newTitle);
    formData.append('slug', newSlug);
    formData.append('file', uploadFile);

    try {
      const res = await fetch('/api/admin/offers', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Nie udało się wgrać oferty');
      }

      setUploadSuccess(true);
      setNewTitle('');
      setNewSlug('');
      setUploadFile(null);
      
      const fileInput = document.getElementById('offerFile') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      await refreshData();
    } catch (err: any) {
      setUploadError(err.message || 'Wystąpił błąd podczas wgrywania oferty.');
    } finally {
      setUploading(false);
    }
  };

  // Change order status
  const handleUpdateOrderStatus = async (orderId: string, newStatus: Order['status']) => {
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status: newStatus })
      });
      
      if (!res.ok) {
        throw new Error('Failed to update status');
      }

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
      
      const analyticsRes = await fetch('/api/admin/analytics');
      const analyticsData = await analyticsRes.json();
      setAnalytics(analyticsData);
    } catch (err) {
      alert('Nie udało się zaktualizować statusu zamówienia.');
    }
  };

  // Export Order as CSV
  const downloadOrderCSV = (order: Order) => {
    let csvContent = '\uFEFF';
    csvContent += 'EAN;SKU;Nazwa;Cena;Ilosc;Wartosc\n';
    
    order.items.forEach(item => {
      const lineVal = parseFloat((item.price * item.quantity).toFixed(2));
      const nameEscaped = item.name.replace(/"/g, '""');
      csvContent += `"${item.sku}";"${item.sku}";"${nameEscaped}";${item.price.toFixed(2).replace('.', ',')};${item.quantity};${lineVal.toFixed(2).replace('.', ',')}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `zamowienie_${order.id}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredOrders = orders.filter(o => 
    o.id.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.clientName.toLowerCase().includes(orderSearch.toLowerCase()) ||
    o.clientNip.includes(orderSearch) ||
    o.clientEmail.toLowerCase().includes(orderSearch.toLowerCase())
  );

  const filteredClients = clients.filter(c =>
    c.companyName.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.email.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.nip.includes(clientSearch)
  );

  const filteredOfferProducts = offerProducts.filter(p =>
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.sku.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.ean.includes(productSearch) ||
    (p.category && p.category.toLowerCase().includes(productSearch.toLowerCase()))
  );

  if (loading && !analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800">
        <div className="text-center animate-pulse">
          <div className="w-16 h-16 border-4 border-[#1C60B0] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-bold">Uruchamianie Panelu Administratora Askato...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col md:flex-row font-sans">
      
      {/* Sidebar Navigation - Clean White Layout */}
      <aside className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-slate-200 flex-shrink-0 flex flex-col justify-between p-6 shadow-sm">
        <div className="space-y-8">
          {/* Logo container */}
          <div className="p-3 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm">
            <img src="/logo.png" alt="Askato Logo" className="h-10 object-contain" />
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <button
              onClick={() => { setActiveTab('overview'); setSelectedOfferForEdit(null); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'overview' && !selectedOfferForEdit
                  ? 'bg-[#1C60B0] text-white shadow-md shadow-blue-500/10' 
                  : 'text-slate-655 hover:text-[#1C60B0] hover:bg-slate-50'
              }`}
            >
              <BarChart3 size={18} />
              <span>Dziennik i Live</span>
            </button>

            <button
              onClick={() => { setActiveTab('offers'); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'offers' 
                  ? 'bg-[#1C60B0] text-white shadow-md shadow-blue-500/10' 
                  : 'text-slate-655 hover:text-[#1C60B0] hover:bg-slate-50'
              }`}
            >
              <PlusCircle size={18} />
              <span>Generator & Edycja</span>
            </button>

            <button
              onClick={() => { setActiveTab('orders'); setSelectedOfferForEdit(null); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'orders' && !selectedOfferForEdit
                  ? 'bg-[#1C60B0] text-white shadow-md shadow-blue-500/10' 
                  : 'text-slate-655 hover:text-[#1C60B0] hover:bg-slate-50'
              }`}
            >
              <ClipboardList size={18} />
              <span>Zamówienia B2B</span>
              {orders.filter(o => o.status === 'new').length > 0 && (
                <span className="ml-auto bg-[#CD2628] text-white text-[10px] font-extrabold px-2 py-0.5 rounded-full">
                  {orders.filter(o => o.status === 'new').length}
                </span>
              )}
            </button>

            <button
              onClick={() => { setActiveTab('clients'); setSelectedOfferForEdit(null); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'clients' && !selectedOfferForEdit
                  ? 'bg-[#1C60B0] text-white shadow-md shadow-blue-500/10' 
                  : 'text-slate-655 hover:text-[#1C60B0] hover:bg-slate-50'
              }`}
            >
              <Users size={18} />
              <span>Klienci i Rabaty</span>
            </button>
          </nav>
        </div>

        {/* User Card & Logout */}
        <div className="pt-6 border-t border-slate-100 mt-8 space-y-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-700 font-black text-xs uppercase border border-slate-200">
              AD
            </div>
            <div className="min-w-0">
              <span className="block text-xs font-bold text-slate-700 truncate leading-none">Askato Admin</span>
              <span className="text-[10px] text-slate-400 truncate block mt-0.5">{admin?.email}</span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center space-x-1.5 py-2 border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-500 hover:text-[#CD2628] text-xs rounded-xl transition-all font-semibold"
          >
            <LogOut size={12} />
            <span>Wyloguj panel</span>
          </button>
        </div>
      </aside>

      {/* Main Panel Content Area */}
      <main className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 animate-fade-in">
        
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              {selectedOfferForEdit && `Edycja katalogu: ${selectedOfferForEdit.title}`}
              {!selectedOfferForEdit && activeTab === 'overview' && 'Analityka i Śledzenie Ruchu B2B'}
              {!selectedOfferForEdit && activeTab === 'offers' && 'Generator Ofert & Zarządzanie Towarami'}
              {!selectedOfferForEdit && activeTab === 'orders' && 'Rejestr i Taryfikacja Zamówień'}
              {!selectedOfferForEdit && activeTab === 'clients' && 'Baza Klientów i Rabaty B2B'}
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Bieżące zarządzanie i wgląd w procesy sprzedażowe Askato Sp. z o.o.
            </p>
          </div>

          <div className="flex space-x-2">
            {selectedOfferForEdit && (
              <button
                onClick={() => setSelectedOfferForEdit(null)}
                className="inline-flex items-center space-x-1 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-600 transition"
              >
                <span>Wróć do list</span>
              </button>
            )}
            <button
              onClick={refreshData}
              className="inline-flex items-center space-x-1.5 bg-white hover:bg-slate-50 border border-slate-200 px-4 py-2 rounded-xl text-xs font-bold text-slate-650 transition"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              <span>Odśwież dane</span>
            </button>
          </div>
        </div>

        {/* ==================== SUB-TAB: SELECTED OFFER PRODUCT EDIT ==================== */}
        {selectedOfferForEdit && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4 border-b border-slate-150">
              <div className="flex items-center space-x-2.5">
                <FileText className="text-[#1C60B0]" size={18} />
                <span className="text-sm font-bold text-slate-800">Spis produktów w tej ofercie ({filteredOfferProducts.length})</span>
              </div>
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Filtruj produkty po nazwie, SKU, EAN lub kategorii..."
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#1C60B0] bg-slate-50"
                />
              </div>
            </div>

            {productsLoading ? (
              <div className="py-16 text-center">
                <div className="w-10 h-10 border-4 border-[#1C60B0] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">Pobieranie listy produktów...</p>
              </div>
            ) : filteredOfferProducts.length === 0 ? (
              <p className="text-xs text-slate-500 text-center py-16">Brak pasujących produktów w ofercie</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50">
                      <th className="p-3">Zdjęcie</th>
                      <th className="p-3">Nazwa produktu</th>
                      <th className="p-3">SKU / Kod</th>
                      <th className="p-3">Kategoria</th>
                      <th className="p-3 text-right">Cena</th>
                      <th className="p-3 text-right">Stan (szt)</th>
                      <th className="p-3 text-center">Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOfferProducts.map((prod) => (
                      <tr key={prod.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="p-3">
                          <div className="w-10 h-10 bg-white border border-slate-200 rounded p-1 flex items-center justify-center overflow-hidden">
                            <img src={prod.imageUrl} alt={prod.name} className="max-h-full max-w-full object-contain" />
                          </div>
                        </td>
                        <td className="p-3 font-semibold text-slate-800 max-w-xs truncate" title={prod.name}>
                          {prod.name}
                        </td>
                        <td className="p-3 font-mono text-slate-500">{prod.sku}</td>
                        <td className="p-3 text-slate-500">{prod.category || 'Zabawki'}</td>
                        <td className="p-3 text-right font-bold text-slate-700">{prod.price.toFixed(2)} PLN</td>
                        <td className="p-3 text-right text-slate-600">{prod.stock}</td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setEditingProduct(prod)}
                            className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-[#1C60B0] px-2.5 py-1.5 rounded-lg transition font-semibold"
                          >
                            <Edit3 size={12} />
                            <span>Edytuj</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 1: OVERVIEW & ANALYTICS */}
        {activeTab === 'overview' && !selectedOfferForEdit && analytics && (
          <div className="space-y-8">
            {/* KPI Metrics Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              
              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Odsłony katalogów</span>
                <div className="flex items-baseline justify-between mt-3">
                  <span className="text-2xl font-black text-slate-800">{analytics.summary.totalViews}</span>
                  <Eye size={18} className="text-[#1C60B0]" />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Urządzenia</span>
                <div className="flex items-baseline justify-between mt-3">
                  <span className="text-2xl font-black text-slate-800">{analytics.summary.uniqueDevices}</span>
                  <Users size={18} className="text-cyan-500" />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Zamówień B2B</span>
                <div className="flex items-baseline justify-between mt-3">
                  <span className="text-2xl font-black text-slate-800">{analytics.summary.totalOrders}</span>
                  <ShoppingCart size={18} className="text-emerald-550" />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Suma netto</span>
                <div className="flex items-baseline justify-between mt-3">
                  <span className="text-xl font-black text-emerald-600">{analytics.summary.totalRevenue.toFixed(2)} <span className="text-[10px] text-slate-500">PLN</span></span>
                  <DollarSign size={18} className="text-emerald-600" />
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col justify-between shadow-sm">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Konwersja</span>
                <div className="flex items-baseline justify-between mt-3">
                  <span className="text-2xl font-black text-amber-600">{analytics.summary.conversionRate}%</span>
                  <Percent size={18} className="text-amber-500" />
                </div>
              </div>

            </div>

            {/* Middle Section: Popular & Abandoned Carts */}
            <div className="grid lg:grid-cols-2 gap-8">
              
              {/* Popular Products in Carts */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-sm text-slate-800">Popularne produkty w koszykach</h3>
                  <span className="text-[10px] bg-[#1C60B0]/10 text-[#1C60B0] px-2 py-0.5 rounded font-bold uppercase">Top 5</span>
                </div>
                <div className="space-y-3">
                  {analytics.popularProducts.length === 0 ? (
                    <p className="text-xs text-slate-450 text-center py-8">Brak wystarczających danych do rankingu</p>
                  ) : (
                    analytics.popularProducts.map((p, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs p-3 bg-slate-50 border border-slate-150 rounded-xl">
                        <div className="min-w-0 pr-4">
                          <span className="font-bold text-slate-700 block truncate">{p.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">Kod: {p.sku}</span>
                        </div>
                        <span className="font-bold bg-[#1C60B0]/10 text-[#1C60B0] border border-[#1C60B0]/20 px-2.5 py-1 rounded-lg flex-shrink-0">
                          Dodano {p.count}x
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Abandoned Carts Analyzer */}
              <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-sm text-slate-800">Porzucone koszyki (Wykryto: {analytics.summary.abandonedCartsCount})</h3>
                  <span className="text-[10px] bg-[#CD2628]/10 text-[#CD2628] px-2 py-0.5 rounded font-bold uppercase">Live</span>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {analytics.abandonedCarts.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">Wszystkie aktywne koszyki zostały sfinalizowane lub są puste.</p>
                  ) : (
                    analytics.abandonedCarts.map((cart, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-2 text-xs">
                        <div className="flex justify-between items-center text-[10px] text-slate-400">
                          <span className="font-mono">Urządzenie: {cart.deviceId.substring(0, 12)}...</span>
                          <span>{new Date(cart.lastActive).toLocaleTimeString('pl-PL')}</span>
                        </div>
                        <div className="font-semibold text-slate-700">
                          Porzucono <span className="text-[#CD2628] font-bold">{cart.itemsCount}</span> pozycji w ofercie <code className="bg-slate-200 text-slate-600 px-1 rounded text-[10px]">{cart.offerSlug}</code>
                        </div>
                        <div className="text-[10px] text-slate-500 pl-2 border-l border-red-400">
                          {cart.items.map((it) => `${it.quantity}x ${it.name}`).join(', ')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* Bottom Timeline: Live events */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Terminal size={16} className="text-[#1C60B0]" />
                  <h3 className="font-bold text-sm text-slate-800 font-sans">Konsola zdarzeń analitycznych w czasie rzeczywistym</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-medium">Ostatnie 20 zdarzeń</span>
              </div>
              <div className="space-y-2.5 max-h-[300px] overflow-y-auto font-mono text-[11px] pr-2">
                {analytics.recentEvents.map((evt) => {
                  let badgeColor = 'text-slate-500';
                  let description = '';

                  if (evt.eventType === 'page_view') {
                    badgeColor = 'text-blue-600 font-bold';
                    description = `wyświetlił ofertę: ${evt.offerSlug}`;
                  } else if (evt.eventType === 'add_to_cart') {
                    badgeColor = 'text-amber-650 font-bold';
                    description = `dodał do koszyka: ${evt.payload?.quantity}x ${evt.payload?.productName}`;
                  } else if (evt.eventType === 'remove_from_cart') {
                    badgeColor = 'text-red-500 font-bold';
                    description = `usunął z koszyka: ${evt.payload?.productName}`;
                  } else if (evt.eventType === 'csv_export') {
                    badgeColor = 'text-cyan-600 font-bold';
                    description = `wyeksportował zamówienie do pliku CSV (${evt.payload?.totalValue?.toFixed(2)} PLN)`;
                  } else if (evt.eventType === 'email_order') {
                    badgeColor = 'text-emerald-600 font-bold';
                    description = `wysłał zamówienie e-mailem (ID: ${evt.payload?.orderId}, ${evt.payload?.totalValue?.toFixed(2)} PLN)`;
                  }

                  return (
                    <div key={evt.id} className="flex justify-between py-1.5 border-b border-slate-100 text-slate-600">
                      <div className="min-w-0 pr-4">
                        <span className="text-slate-400">[{new Date(evt.createdAt).toLocaleTimeString('pl-PL')}]</span>{' '}
                        <span className="font-bold text-slate-700">{evt.userIdentity}</span>{' '}
                        <span className={`${badgeColor}`}>{evt.eventType.toUpperCase()}</span>{' '}
                        <span className="text-slate-600">{description}</span>
                      </div>
                      <span className="text-[9px] text-slate-400 flex-shrink-0 self-center">Urządzenie: {evt.deviceId.substring(0, 8)}...</span>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: OFFERS MANAGER */}
        {activeTab === 'offers' && !selectedOfferForEdit && (
          <div className="grid lg:grid-cols-3 gap-8">
            
            {/* Create Offer Form */}
            <div className="lg:col-span-1 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm h-fit">
              <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-3 mb-6">Generuj Nową Ofertę</h3>
              
              <form onSubmit={handleCreateOffer} className="space-y-4">
                {uploadError && (
                  <div className="bg-red-50 border border-red-200 text-xs text-[#CD2628] rounded-xl p-3 flex items-center space-x-2">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    <span>{uploadError}</span>
                  </div>
                )}
                {uploadSuccess && (
                  <div className="bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 rounded-xl p-3 flex items-center space-x-2">
                    <CheckCircle size={14} className="flex-shrink-0" />
                    <span>Nowy katalog został pomyślnie wygenerowany!</span>
                  </div>
                )}

                <div>
                  <label htmlFor="offerTitle" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Tytuł Katalogu *</label>
                  <input
                    type="text"
                    id="offerTitle"
                    required
                    value={newTitle}
                    onChange={(e) => {
                      setNewTitle(e.target.value);
                      setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-'));
                    }}
                    placeholder="Np. Oferta Zimowa 2026"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                  />
                </div>

                <div>
                  <label htmlFor="offerSlug" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Adres URL Oferty (Slug) *</label>
                  <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl overflow-hidden px-3 py-2 text-sm">
                    <span className="text-slate-400 select-none">/offer/</span>
                    <input
                      type="text"
                      id="offerSlug"
                      required
                      value={newSlug}
                      onChange={(e) => setNewSlug(e.target.value)}
                      placeholder="oferta-zimowa"
                      className="w-full bg-transparent border-0 p-0 focus:outline-none focus:ring-0 ml-0.5"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="offerFile" className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Plik Excel z towarami (.xlsx) *</label>
                  <div className="border border-dashed border-slate-300 hover:border-[#1C60B0] bg-slate-50 rounded-xl p-6 text-center cursor-pointer relative transition">
                    <input
                      type="file"
                      id="offerFile"
                      required
                      accept=".xlsx,.xls,.csv"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                    <FileSpreadsheet className="mx-auto text-slate-400 mb-2" size={24} />
                    <span className="text-xs text-slate-600 block font-medium">
                      {uploadFile ? uploadFile.name : 'Przeciągnij lub kliknij, by wybrać'}
                    </span>
                    <span className="text-[10px] text-slate-400 block mt-1">
                      Wspierane pliki: Excel XLSX lub CSV
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={uploading}
                  className="w-full bg-[#1C60B0] hover:bg-[#1A54A5] text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center space-x-1.5 transition disabled:opacity-50 shadow-sm"
                >
                  {uploading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload size={14} />
                  )}
                  <span>{uploading ? 'Przetwarzanie wierszy...' : 'Wygeneruj Ofertę Askato'}</span>
                </button>

              </form>
            </div>

            {/* Offers List */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-3">Utworzone Oferty B2B</h3>
              
              <div className="space-y-3">
                {offers.map((o) => (
                  <div key={o.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                    <div>
                      <h4 className="font-bold text-sm text-slate-800">{o.title}</h4>
                      <code className="text-[10px] text-slate-500 block mt-0.5">Link: /offer/{o.slug}</code>
                      <div className="flex space-x-4 text-[10px] text-slate-400 mt-2">
                        <span>Liczba towarów: <strong className="text-slate-600">{o.productCount}</strong></span>
                        <span>Utworzono: <strong>{new Date(o.createdAt).toLocaleDateString('pl-PL')}</strong></span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleSelectOfferForEdit(o)}
                        className="bg-[#1C60B0] hover:bg-[#1A54A5] text-white font-bold px-3 py-1.5 rounded-lg transition flex items-center space-x-1"
                        title="Zarządzaj i edytuj towary"
                      >
                        <Settings size={12} />
                        <span>Edytuj towary</span>
                      </button>
                      
                      <button
                        onClick={() => window.open(`/offer/${o.slug}`, '_blank')}
                        className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 p-2 rounded-lg transition"
                        title="Otwórz ofertę"
                      >
                        <Eye size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {/* TAB 3: ORDERS ARCHIVE */}
        {activeTab === 'orders' && !selectedOfferForEdit && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            
            {/* Search filter */}
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Filtruj zamówienia po ID, nazwie firmy, NIP..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                />
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Zamówień w bazie: <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">{filteredOrders.length}</span>
              </div>
            </div>

            {/* Orders list container */}
            <div className="space-y-4">
              {filteredOrders.length === 0 ? (
                <div className="text-center py-16 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-slate-200">
                  <ClipboardList size={36} className="mx-auto opacity-35 mb-2 text-slate-400" />
                  <p className="font-bold">Brak pasujących zamówień w historii</p>
                </div>
              ) : (
                filteredOrders.map((order) => (
                  <div key={order.id} className="p-5 bg-slate-50/50 border border-slate-200 rounded-2xl space-y-4 shadow-sm">
                    {/* Header */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200">
                      <div>
                        <div className="flex items-center space-x-2">
                          <code className="text-xs font-bold text-slate-700 font-mono bg-slate-200 px-2 py-0.5 rounded">{order.id}</code>
                          <span className="text-[10px] text-slate-400">{new Date(order.createdAt).toLocaleString('pl-PL')}</span>
                        </div>
                        <h4 className="font-bold text-sm text-[#1C60B0] mt-2.5">{order.clientName}</h4>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500 mt-1">
                          <span>NIP: <strong className="text-slate-600">{order.clientNip || 'Brak (Gość)'}</strong></span>
                          <span>E-mail: <strong className="text-slate-600">{order.clientEmail}</strong></span>
                          <span>Telefon: <strong className="text-slate-600">{order.clientPhone || 'Brak'}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="flex flex-col items-end">
                          <span className="text-[9px] text-slate-400 font-bold mb-1 uppercase tracking-wider">Status:</span>
                          <select
                            value={order.status}
                            onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value as any)}
                            className="bg-white border border-slate-200 text-slate-700 text-xs rounded-lg px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                          >
                            <option value="new">Nowe</option>
                            <option value="processing">W realizacji</option>
                            <option value="shipped">Wysłane</option>
                            <option value="cancelled">Anulowane</option>
                          </select>
                        </div>

                        {/* Export/download CSV button */}
                        <button
                          onClick={() => downloadOrderCSV(order)}
                          className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 p-2.5 rounded-xl transition flex items-center space-x-1"
                          title="Pobierz plik CSV dla ERP"
                        >
                          <Download size={14} />
                          <span className="text-[10px] font-bold">CSV</span>
                        </button>
                      </div>
                    </div>

                    {/* Order items grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Products List */}
                      <div className="space-y-1.5 max-h-[150px] overflow-y-auto pr-1">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">Pozycje zamówienia ({order.items.length})</span>
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between items-center text-[10px] p-2 bg-white border border-slate-150 rounded-lg">
                            <span className="font-bold text-slate-700 truncate max-w-[200px]" title={item.name}>{item.name}</span>
                            <span className="text-slate-400 flex-shrink-0 ml-2 font-mono">{item.quantity} szt. x {item.price.toFixed(2)} PLN</span>
                          </div>
                        ))}
                      </div>

                      {/* Comments & Value */}
                      <div className="flex flex-col justify-between p-3 bg-white border border-slate-200 rounded-xl text-xs space-y-3">
                        <div>
                          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Uwagi partnera</span>
                          <p className="text-slate-600 italic text-[11px] mt-1 leading-relaxed">
                            {order.comments || 'Brak dodatkowych uwag.'}
                          </p>
                        </div>
                        
                        <div className="flex justify-between items-baseline pt-2 border-t border-slate-100 self-end w-full">
                          <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Suma netto:</span>
                          <span className="text-base font-extrabold text-[#CD2628]">{order.totalValue.toFixed(2)} PLN</span>
                        </div>
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>

          </div>
        )}

        {/* TAB 4: CLIENTS & DISCOUNTS */}
        {activeTab === 'clients' && !selectedOfferForEdit && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Filtruj partnerów po firmie, e-mailu, NIP..."
                  value={clientSearch}
                  onChange={(e) => setClientSearch(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                />
              </div>
              <div className="text-xs text-slate-500 font-medium">
                Zarejestrowanych firm: <span className="font-bold text-slate-700 bg-slate-100 px-2 py-1 rounded">{filteredClients.length}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50">
                    <th className="p-3">Nazwa firmy / partnera</th>
                    <th className="p-3">NIP</th>
                    <th className="p-3">E-mail logowania</th>
                    <th className="p-3 text-right">Rabat B2B</th>
                    <th className="p-3 text-center">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => (
                    <tr key={client.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                      <td className="p-3 font-bold text-slate-800">{client.companyName}</td>
                      <td className="p-3 font-mono text-slate-600">{client.nip}</td>
                      <td className="p-3 text-slate-500">{client.email}</td>
                      <td className="p-3 text-right">
                        <span className="bg-emerald-50 text-emerald-700 font-extrabold px-2 py-1 rounded border border-emerald-100">
                          -{(client.discountRate * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <button
                          onClick={() => setEditingClient(client)}
                          className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-[#1C60B0] px-3 py-1.5 rounded-lg transition font-semibold"
                        >
                          <Edit3 size={12} />
                          <span>Zmień rabat</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </main>

      {/* ==================== MODAL 1: PRODUCT EDITOR MODAL ==================== */}
      {editingProduct && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-150 pb-3">
              <div className="flex items-center space-x-2">
                <Edit3 className="text-[#1C60B0]" size={18} />
                <h3 className="font-bold text-slate-800 text-sm">Edytuj właściwości towaru</h3>
              </div>
              <button onClick={() => setEditingProduct(null)} className="text-slate-400 hover:text-slate-600 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveProductChanges} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="md:col-span-2">
                <label className="block text-slate-500 font-semibold mb-1">Nazwa zabawki *</label>
                <input
                  type="text"
                  required
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Kod SKU *</label>
                <input
                  type="text"
                  required
                  value={editingProduct.sku}
                  onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">EAN Barcode *</label>
                <input
                  type="text"
                  required
                  value={editingProduct.ean}
                  onChange={(e) => setEditingProduct({ ...editingProduct, ean: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Kategoria w ofercie</label>
                <input
                  type="text"
                  value={editingProduct.category || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, category: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                  placeholder="Np. KLOCKI MAGNETYCZNE"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Pakowanie zbiorcze (PCB)</label>
                <input
                  type="text"
                  value={editingProduct.packaging}
                  onChange={(e) => setEditingProduct({ ...editingProduct, packaging: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Cena netto PLN *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={editingProduct.price}
                  onChange={(e) => setEditingProduct({ ...editingProduct, price: parseFloat(e.target.value) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Stan magazynu (szt) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={editingProduct.stock}
                  onChange={(e) => setEditingProduct({ ...editingProduct, stock: parseInt(e.target.value, 10) || 0 })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-500 font-semibold mb-1">URL Zdjęcia produktu (lokalne lub zdalne)</label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={editingProduct.imageUrl}
                    onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                  />
                  <div className="w-10 h-10 bg-slate-100 border border-slate-200 rounded p-1 flex items-center justify-center overflow-hidden flex-shrink-0">
                    <img src={editingProduct.imageUrl} alt="preview" className="max-h-full max-w-full object-contain" />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-500 font-semibold mb-1">Opis produktu (specyfikacja z Excela)</label>
                <textarea
                  rows={4}
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                  placeholder="Parametry techniczne, zalecany wiek itp."
                />
              </div>

              <div className="md:col-span-2 flex justify-end space-x-2.5 pt-4 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="bg-slate-100 hover:bg-slate-250 text-slate-600 px-5 py-2.5 rounded-xl font-bold transition"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-[#1C60B0] hover:bg-[#1A54A5] text-white px-5 py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  Zapisz poprawki
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL 2: CLIENT DISCOUNT EDIT MODAL ==================== */}
      {editingClient && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-150 pb-3">
              <div className="flex items-center space-x-2">
                <Percent className="text-[#1C60B0]" size={18} />
                <h3 className="font-bold text-slate-850 text-sm">Zarządzaj rabatem partnera</h3>
              </div>
              <button onClick={() => setEditingClient(null)} className="text-slate-400 hover:text-slate-600 transition">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveClientDiscount} className="space-y-4 text-xs">
              <div>
                <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px]">Firma</span>
                <span className="text-sm font-bold text-slate-800 mt-1 block">{editingClient.companyName}</span>
              </div>

              <div>
                <span className="text-slate-400 font-semibold block uppercase tracking-wider text-[10px] mt-2">Adres E-mail</span>
                <span className="text-slate-600 mt-1 block">{editingClient.email}</span>
              </div>

              <div>
                <label className="block text-slate-500 font-bold mb-1 uppercase tracking-wider text-[10px]">Stawka upustu B2B (Wartość 0 - 1.0)</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="1.0"
                    required
                    value={editingClient.discountRate}
                    onChange={(e) => setEditingClient({ ...editingClient, discountRate: parseFloat(e.target.value) || 0 })}
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-bold focus:outline-none focus:ring-1 focus:ring-[#1C60B0] w-28 text-center"
                  />
                  <span className="text-xs font-extrabold text-[#CD2628] bg-red-50 border border-red-100 rounded px-2.5 py-1.5">
                    Rabat: -{(editingClient.discountRate * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-[10px] text-slate-450 mt-1">Stawka rabatu np. 0.15 oznacza 15% zniżki na wszystkie ceny netto w katalogu.</p>
              </div>

              <div className="flex justify-end space-x-2.5 pt-4 border-t border-slate-150">
                <button
                  type="button"
                  onClick={() => setEditingClient(null)}
                  className="bg-slate-100 hover:bg-slate-200 text-slate-650 px-5 py-2.5 rounded-xl font-bold transition"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  className="bg-[#1C60B0] hover:bg-[#1A54A5] text-white px-5 py-2.5 rounded-xl font-bold transition shadow-sm"
                >
                  Zapisz rabat
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
