'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart3, PlusCircle, ClipboardList, LogOut,
  Upload, FileSpreadsheet, Eye, Users, DollarSign, Percent,
  Download, AlertCircle, ShoppingCart, RefreshCw, Clock,
  CheckCircle, Terminal, Search, Edit3, X, FileText, Settings, Image
} from 'lucide-react';

// ─── Client-side XLSX parsing utilities ───────────────────────────────────────

function _parseAgeC(rawAge: any): string {
  if (rawAge === undefined || rawAge === null || String(rawAge).trim() === '') return '3+';
  const str = String(rawAge).trim().toLowerCase();
  const isMonths = str.includes('m') || str.includes('mies') || str.includes('mc') || str.includes('m-cy');
  const numMatch = str.match(/\d+/);
  if (numMatch) { const n = parseInt(numMatch[0], 10); return isMonths ? `${n}m+` : `${n}+`; }
  return String(rawAge).trim() || '3+';
}
function _parsePriceC(raw: any): number {
  if (raw == null) return 0;
  if (typeof raw === 'number') return isNaN(raw) ? 0 : Math.max(0, raw);
  const n = parseFloat(String(raw).replace(',', '.').replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : Math.max(0, n);
}
function _parseStockC(raw: any): number {
  if (raw == null) return 100;
  const n = parseInt(String(raw), 10);
  return isNaN(n) ? 100 : Math.max(0, n);
}

async function compressImageToBase64(buf: ArrayBuffer, maxDim = 600, quality = 0.75): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([buf]));
    const img = new window.Image();
    img.onload = () => {
      try {
        const scale = Math.min(1, maxDim / Math.max(img.width || 1, img.height || 1));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round((img.width || 1) * scale);
        canvas.height = Math.round((img.height || 1) * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) { resolve(''); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(''); };
    img.src = url;
  });
}

async function parseXlsxClientSide(file: File): Promise<{ textProducts: any[]; imageMap: Record<string, ArrayBuffer> }> {
  const XLSX = await import('xlsx');
  const JSZip = (await import('jszip')).default;

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];

  if (rawRows.length < 2) throw new Error('Plik jest pusty lub nie ma poprawnego formatu');

  // Detect header row
  let headerRowIdx = 0;
  for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
    const r = rawRows[i].map((c: any) => String(c).toLowerCase());
    if (r.some((c: string) => c === 'kod' || c === 'sku' || c === 'name' || c === 'nazwa')) { headerRowIdx = i; break; }
  }
  const headerRow = rawRows[headerRowIdx].map((h: any) => String(h).trim().toLowerCase());
  const dataRows = rawRows.slice(headerRowIdx + 1);

  const col = (...terms: string[]): number | undefined => {
    for (const t of terms) {
      const lo = t.toLowerCase().trim();
      const e = headerRow.findIndex((h: string) => h === lo);
      if (e !== -1) return e;
      const s = headerRow.findIndex((h: string) => h.includes(lo));
      if (s !== -1) return s;
    }
    return undefined;
  };

  const skuIdx = col('kod', 'sku', 'symbol', 'indeks', 'artyk');
  const eanIdx = col('ean', 'barcod', 'kod kresk');
  const nameIdx = col('nazwa', 'name', 'tytuł', 'tytul', 'towar', 'produkt');
  const catIdx = col('kategoria', 'category', 'dział', 'dzial', 'grupa');
  const descIdx = col('opis', 'description', 'desc', 'specyfikacja');
  const priceIdx = col('cena netto', 'cena hurt', 'cena b2b', 'cena', 'netto');
  const stockIdx = col('zamówienie ilość', 'stan', 'stock', 'ilosc', 'ilość', 'dostęp', 'dostep');
  const pcbIdx = col('pcb', 'opakowanie', 'karton', 'zbiorcz');
  const ageIdx = col('wiek', 'age', 'od lat');
  const imgIdx = col('zdjęcie', 'zdjecie', 'image', 'obraz', 'foto');
  const discountIdx = col('rabat', 'discount', 'promocja', 'obniżka');
  const origPriceIdx = col('cena detaliczna', 'cena regularna', 'cena przed rabatem', 'cena katalogowa', 'detaliczna', 'katalogowa');

  const gv = (row: any[], idx?: number) => {
    if (idx !== undefined && idx < row.length) {
      const v = row[idx];
      if (v !== undefined && v !== null && String(v).trim() !== '') return v;
    }
    return undefined;
  };

  // Extract embedded images from XLSX ZIP
  const imageMap: Record<string, ArrayBuffer> = {};
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    const drawingFile = zip.file('xl/drawings/drawing1.xml');
    const drawingRelsFile = zip.file('xl/drawings/_rels/drawing1.xml.rels');
    if (drawingFile && drawingRelsFile && skuIdx !== undefined) {
      const drawingXml = await drawingFile.async('string');
      const drawingRelsXml = await drawingRelsFile.async('string');
      const rels: Record<string, string> = {};
      const relRx = /<Relationship[^>]*Id="(rId\d+)"[^>]*Target="([^"]+)"/g;
      let m;
      while ((m = relRx.exec(drawingRelsXml)) !== null) rels[m[1]] = m[2];
      const anchors: { row: number; rId: string }[] = [];
      const anchorRx = /<xdr:(?:twoCellAnchor|oneCellAnchor)[^>]*>([\s\S]*?)<\/xdr:(?:twoCellAnchor|oneCellAnchor)>/g;
      while ((m = anchorRx.exec(drawingXml)) !== null) {
        const block = m[1];
        const rm = block.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/);
        const rid = block.match(/(?:r:embed|r:id)="(rId\d+)"/);
        if (rm && rid) anchors.push({ row: parseInt(rm[1], 10), rId: rid[1] });
      }
      for (const anchor of anchors) {
        const target = rels[anchor.rId];
        if (!target) continue;
        const fname = target.split('/').pop() || '';
        const mpath = `xl/drawings/${target}`.replace(/\/\.\.\//g, '/').replace('xl/drawings/../', 'xl/');
        const mf = zip.file(mpath) || zip.file(`xl/media/${fname}`);
        if (!mf) continue;
        const imgBuf = await mf.async('arraybuffer');
        let sku: string | null = null;
        for (const offset of [0, 1, -1, 2, -2]) {
          const tr = rawRows[anchor.row + offset];
          if (tr && skuIdx !== undefined && tr[skuIdx]) {
            const s = String(tr[skuIdx]).replace(/\.0+$/, '').trim();
            if (s) { sku = s; break; }
          }
        }
        if (sku) imageMap[sku] = imgBuf;
      }
    }
  } catch { /* ZIP image extraction optional */ }

  // Parse product rows (text data only — images sent separately)
  const PLACEHOLDER = 'https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=500&auto=format&fit=crop&q=60';
  const textProducts: any[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (row.every((c: any) => c === '' || c === null || c === undefined)) continue;
    const sku = gv(row, skuIdx) ?? `ASK-${1000 + i}`;
    const ean = gv(row, eanIdx) ?? `590${Math.floor(1000000000 + Math.random() * 9000000000)}`;
    const name = gv(row, nameIdx) ?? `Produkt ${i + 1}`;
    if (!sku && !name) continue;
    const rawPrice = gv(row, priceIdx);
    const rawDiscount = gv(row, discountIdx);
    const rawOrigPrice = gv(row, origPriceIdx);
    const priceVal = _parsePriceC(rawPrice);
    let discountRate = 0;
    if (rawDiscount !== undefined) {
      const d = parseFloat(String(rawDiscount).replace('%', '').trim());
      if (!isNaN(d)) discountRate = d > 1 ? d / 100 : d;
    }
    let origPrice = priceVal;
    if (rawOrigPrice !== undefined) origPrice = _parsePriceC(rawOrigPrice);
    else if (discountRate > 0) origPrice = parseFloat((priceVal / (1 - discountRate)).toFixed(2));
    const rawPkg = gv(row, pcbIdx);
    let packaging = 'PCB 1';
    if (rawPkg !== undefined && String(rawPkg).trim() !== '') {
      const n = parseInt(String(rawPkg).trim(), 10);
      if (!isNaN(n) && n > 0) packaging = `PCB ${n}`;
      else { const c = String(rawPkg).trim(); packaging = c.toLowerCase().startsWith('pcb') ? c : `PCB ${c}`; }
    }
    const skuStr = String(sku).trim();
    const rawImg = gv(row, imgIdx);
    const imageUrl = (rawImg && String(rawImg).trim().startsWith('http')) ? String(rawImg).trim() : PLACEHOLDER;
    textProducts.push({
      sku: skuStr,
      ean: String(ean).trim(),
      category: String(gv(row, catIdx) ?? 'ZABAWKI').trim().toUpperCase(),
      name: String(name).trim(),
      price: parseFloat(priceVal.toFixed(2)),
      imageUrl,
      packaging,
      stock: _parseStockC(gv(row, stockIdx)),
      description: String(gv(row, descIdx) ?? '').trim(),
      age: _parseAgeC(gv(row, ageIdx)),
      discountRate,
      originalPrice: parseFloat(origPrice.toFixed(2))
    });
  }
  if (textProducts.length === 0) throw new Error('Nie znaleziono żadnych produktów w pliku. Sprawdź format kolumn.');
  return { textProducts, imageMap };
}

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
  isFeatured?: boolean;
  orderMode?: 'panel' | 'email';
  orderEmail?: string;
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
  age?: string;
  discountRate?: number;
  originalPrice?: number;
  position?: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [admin, setAdmin] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'offers' | 'orders' | 'clients' | 'stats'>('overview');
  
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
  const [uploadProgress, setUploadProgress] = useState('');
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
  const [showAddClient, setShowAddClient] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [newClient, setNewClient] = useState({ email: '', password: '', companyName: '', nip: '', discountRate: '0' });
  const [newProduct, setNewProduct] = useState({ name: '', sku: '', ean: '', category: '', price: '', stock: '100', packaging: 'PCB 1', imageUrl: '', age: '3+', description: '', discountRate: '0', originalPrice: '' });

  // Order settings per offer
  const [offerOrderMode, setOfferOrderMode] = useState<'panel' | 'email'>('panel');
  const [offerOrderEmail, setOfferOrderEmail] = useState('');
  const [savingOrderSettings, setSavingOrderSettings] = useState(false);

  // Organizer and Order status states
  const [editorMode, setEditorMode] = useState<'table' | 'organizer' | 'settings'>('table');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [localOrganizerProducts, setLocalOrganizerProducts] = useState<Product[]>([]);
  const [uniqueCategoriesList, setUniqueCategoriesList] = useState<string[]>([]);
  const [selectedOrganizerCategory, setSelectedOrganizerCategory] = useState<string>('');
  const [savingOrganizer, setSavingOrganizer] = useState(false);

  // Custom confirm dialog state (replaces window.confirm which can be blocked)
  const [confirmDeleteOfferId, setConfirmDeleteOfferId] = useState<string | null>(null);
  const [confirmDeleteOfferTitle, setConfirmDeleteOfferTitle] = useState('');

  // Sync organizer states when offerProducts updates
  useEffect(() => {
    const catsSet = new Set<string>();
    offerProducts.forEach(p => {
      catsSet.add((p.category || 'Zabawki').toUpperCase().trim());
    });
    
    const newCats = Array.from(catsSet);
    
    setUniqueCategoriesList(prev => {
      const existing = [...prev];
      const combined = [...existing];
      newCats.forEach(c => {
        if (!combined.includes(c)) {
          combined.push(c);
        }
      });
      const filtered = combined.filter(c => newCats.includes(c));
      
      // Select the first category by default if none is selected
      if (filtered.length > 0 && (!selectedOrganizerCategory || !filtered.includes(selectedOrganizerCategory))) {
        setSelectedOrganizerCategory(filtered[0]);
      }
      return filtered;
    });

    setLocalOrganizerProducts(prev => {
      const map = new Map(prev.map(p => [p.id, p]));
      return [...offerProducts].map(p => {
        const existingProd = map.get(p.id);
        if (existingProd) {
          return { ...p, category: existingProd.category, position: existingProd.position };
        }
        return p;
      }).sort((a, b) => (a.position || 0) - (b.position || 0));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offerProducts]);

  const currentCategoryProducts = useMemo(() => {
    if (!selectedOrganizerCategory) return [];
    return localOrganizerProducts.filter(
      p => (p.category || 'Zabawki').toUpperCase().trim() === selectedOrganizerCategory.toUpperCase().trim()
    );
  }, [localOrganizerProducts, selectedOrganizerCategory]);

  // 1. Session check
  useEffect(() => {
    const storedUser = localStorage.getItem('askato_user');
    if (!storedUser) {
      router.push('/login');
      return;
    }
    const parsedUser = JSON.parse(storedUser);
    if (parsedUser.role !== 'admin') {
      router.push('/login');
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
    router.push('/login');
  };

  // Fetch products when an offer is selected for editing
  const handleSelectOfferForEdit = async (offer: Offer) => {
    setSelectedOfferForEdit(offer);
    setProductsLoading(true);
    setProductSearch('');
    setOfferOrderMode(offer.orderMode || 'panel');
    setOfferOrderEmail(offer.orderEmail || '');
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
          description: editingProduct.description,
          age: editingProduct.age || '3+',
          discountRate: editingProduct.discountRate || 0,
          originalPrice: editingProduct.originalPrice || editingProduct.price
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

  // Create offer — parses XLSX in the browser, sends small JSON requests to stay under Vercel limits
  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setUploadError('');
    setUploadSuccess(false);
    setUploadProgress('');

    if (!uploadFile) {
      setUploadError('Wybierz plik Excel (.xlsx) lub CSV z produktami');
      return;
    }

    setUploading(true);
    try {
      // Step 1: parse XLSX client-side (no server involved yet)
      setUploadProgress('Parsowanie pliku XLSX w przeglądarce...');
      const { textProducts, imageMap } = await parseXlsxClientSide(uploadFile);

      // Step 2: create offer + products (text data only, no images)
      setUploadProgress(`Tworzenie oferty (${textProducts.length} produktów)...`);
      const res = await fetch('/api/admin/offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle, slug: newSlug, products: textProducts })
      });
      let data: any;
      try { data = await res.json(); } catch {
        throw new Error(`Błąd serwera (${res.status}). Spróbuj ponownie.`);
      }
      if (!res.ok) throw new Error(data.error || 'Nie udało się wgrać oferty');

      // Step 3: upload compressed images one by one (each request tiny: ~30-100 KB)
      const createdProducts: any[] = data.products || [];
      const skusWithImages = Object.keys(imageMap);
      if (skusWithImages.length > 0) {
        let done = 0;
        for (const prod of createdProducts) {
          const imgBuf = imageMap[prod.sku];
          if (!imgBuf) continue;
          done++;
          setUploadProgress(`Wgrywanie zdjęć (${done}/${skusWithImages.length})...`);
          try {
            const b64 = await compressImageToBase64(imgBuf);
            if (b64) {
              await fetch('/api/admin/products', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId: prod.id, imageUrl: b64 })
              });
            }
          } catch { /* skip failed image, rest continue */ }
        }
      }

      setUploadSuccess(true);
      setUploadProgress('');
      setNewTitle('');
      setNewSlug('');
      setUploadFile(null);
      const fileInput = document.getElementById('offerFile') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      await refreshData();
    } catch (err: any) {
      setUploadError(err.message || 'Wystąpił błąd podczas wgrywania oferty.');
      setUploadProgress('');
    } finally {
      setUploading(false);
    }
  };

  const handleSaveOrganizer = async () => {
    if (!selectedOfferForEdit) return;
    setSavingOrganizer(true);
    try {
      const categoriesOrder = uniqueCategoriesList;
      const orderedProducts: Product[] = [];
      categoriesOrder.forEach(cat => {
        const catProds = localOrganizerProducts.filter(p => (p.category || 'Zabawki').toUpperCase().trim() === cat.toUpperCase().trim());
        orderedProducts.push(...catProds);
      });
      
      const updatedProductsPayload = orderedProducts.map((p, idx) => ({
        id: p.id,
        category: p.category || 'ZABAWKI',
        position: idx
      }));

      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reorder_and_categorize',
          products: updatedProductsPayload
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Nie udało się zapisać kolejności');
      }

      setOfferProducts(prev => {
        const map = new Map(updatedProductsPayload.map(x => [x.id, x]));
        return prev.map(p => {
          const upd = map.get(p.id);
          if (upd) {
            return { ...p, category: upd.category, position: upd.position };
          }
          return p;
        }).sort((a, b) => (a.position || 0) - (b.position || 0));
      });

      alert('Ułożenie i kategorie zostały pomyślnie zapisane!');
    } catch (err: any) {
      alert(`Błąd zapisu: ${err.message}`);
    } finally {
      setSavingOrganizer(false);
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

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm(`Usunąć zamówienie ${orderId}?`)) return;
    try {
      await fetch('/api/admin/orders', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ orderId }) });
      setOrders(prev => prev.filter(o => o.id !== orderId));
    } catch { alert('Błąd usuwania zamówienia'); }
  };

  const handleDeleteClient = async (clientId: string) => {
    if (!confirm('Usunąć tego klienta?')) return;
    try {
      await fetch('/api/admin/clients', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }) });
      setClients(prev => prev.filter(c => c.id !== clientId));
    } catch { alert('Błąd usuwania klienta'); }
  };

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'create', ...newClient, discountRate: parseFloat(newClient.discountRate) / 100 }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setClients(prev => [...prev, data.client]);
      setNewClient({ email: '', password: '', companyName: '', nip: '', discountRate: '0' });
      setShowAddClient(false);
    } catch (err: any) { alert(`Błąd: ${err.message}`); }
  };

  const handleSaveOrderSettings = async () => {
    if (!selectedOfferForEdit) return;
    if (offerOrderMode === 'email' && !offerOrderEmail.trim()) {
      alert('Podaj adres e-mail odbiorcy zamówień.');
      return;
    }
    setSavingOrderSettings(true);
    try {
      const res = await fetch('/api/admin/offers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId: selectedOfferForEdit.id, action: 'orderSettings', orderMode: offerOrderMode, orderEmail: offerOrderEmail }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Błąd serwera');
      setSelectedOfferForEdit(prev => prev ? { ...prev, orderMode: offerOrderMode, orderEmail: offerOrderEmail } : prev);
      setOffers(prev => prev.map(o => o.id === selectedOfferForEdit.id ? { ...o, orderMode: offerOrderMode, orderEmail: offerOrderEmail } : o));
    } catch (err: any) {
      alert(`Błąd: ${err.message}`);
    } finally {
      setSavingOrderSettings(false);
    }
  };

  const handleSetFeatured = async (offerId: string) => {
    try {
      const res = await fetch('/api/admin/offers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId }),
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Błąd serwera');
      }
      setOffers(prev => prev.map(o => ({ ...o, isFeatured: o.id === offerId })));
    } catch (err: any) {
      alert(`Błąd: ${err.message}`);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    try {
      const res = await fetch('/api/admin/offers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offerId })
      });
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || 'Błąd serwera');
      }
      setOffers(prev => prev.filter(o => o.id !== offerId));
      if (selectedOfferForEdit && selectedOfferForEdit.id === offerId) {
        setSelectedOfferForEdit(null);
      }
    } catch (err: any) {
      setUploadError(`Błąd usuwania oferty: ${err.message}`);
    } finally {
      setConfirmDeleteOfferId(null);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Usunąć ten produkt z oferty?')) return;
    try {
      await fetch('/api/admin/products', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId }) });
      setOfferProducts(prev => prev.filter(p => p.id !== productId));
    } catch { alert('Błąd usuwania produktu'); }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOfferForEdit) return;
    try {
      const priceVal = parseFloat(newProduct.price) || 0;
      const discountRateVal = parseFloat(newProduct.discountRate) || 0;
      const originalPriceVal = newProduct.originalPrice ? parseFloat(newProduct.originalPrice) : priceVal;
      const res = await fetch('/api/admin/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add',
          offerId: selectedOfferForEdit.id,
          ...newProduct,
          price: priceVal,
          stock: parseInt(newProduct.stock) || 100,
          discountRate: discountRateVal / 100,
          originalPrice: originalPriceVal
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setOfferProducts(prev => [...prev, data.product]);
      setNewProduct({ name: '', sku: '', ean: '', category: '', price: '', stock: '100', packaging: 'PCB 1', imageUrl: '', age: '3+', description: '', discountRate: '0', originalPrice: '' });
      setShowAddProduct(false);
    } catch (err: any) { alert(`Błąd: ${err.message}`); }
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

            <button
              onClick={() => { setActiveTab('stats'); setSelectedOfferForEdit(null); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'stats' && !selectedOfferForEdit
                  ? 'bg-[#1C60B0] text-white shadow-md shadow-blue-500/10' 
                  : 'text-slate-655 hover:text-[#1C60B0] hover:bg-slate-50'
              }`}
            >
              <BarChart3 size={18} />
              <span>Statystyki sprzedaży</span>
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
              {!selectedOfferForEdit && activeTab === 'orders' && 'Rejestr Zamówień B2B'}
              {!selectedOfferForEdit && activeTab === 'clients' && 'Baza Klientów i Rabaty B2B'}
              {!selectedOfferForEdit && activeTab === 'stats' && 'Statystyki Sprzedaży'}
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
            
            {/* Organizer View Mode Tab Toggle */}
            <div className="flex border-b border-slate-250 pb-px">
              <button
                onClick={() => setEditorMode('table')}
                className={`py-2 px-4 font-bold text-xs border-b-2 transition-all ${
                  editorMode === 'table'
                    ? 'border-[#1C60B0] text-[#1C60B0]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Lista produktów (Tabela)
              </button>
              <button
                onClick={() => setEditorMode('organizer')}
                className={`py-2 px-4 font-bold text-xs border-b-2 transition-all flex items-center space-x-1.5 ${
                  editorMode === 'organizer'
                    ? 'border-[#1C60B0] text-[#1C60B0]'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                <span>Układ kategorii i kolejność produktów</span>
                <span className="bg-indigo-50 text-[#1C60B0] text-[9px] px-1.5 py-0.5 rounded font-extrabold border border-indigo-100">Nowość</span>
              </button>
              <button
                onClick={() => setEditorMode('settings')}
                className={`py-2 px-4 font-bold text-xs border-b-2 transition-all ${
                  editorMode === 'settings'
                    ? 'border-amber-500 text-amber-600'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                Ustawienia zamówień
              </button>
            </div>

            {editorMode === 'table' && (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pb-4 border-b border-slate-150">
                  <div className="flex items-center space-x-2.5">
                    <FileText className="text-[#1C60B0]" size={18} />
                    <span className="text-sm font-bold text-slate-800">Spis produktów w tej ofercie ({filteredOfferProducts.length})</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="relative w-full sm:max-w-xs">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                      <input
                        type="text"
                        placeholder="Filtruj produkty..."
                        value={productSearch}
                        onChange={(e) => setProductSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-[#1C60B0] bg-slate-50"
                      />
                    </div>
                    <button
                      onClick={() => setShowAddProduct(true)}
                      className="flex-shrink-0 bg-[#1C60B0] hover:bg-[#1A54A5] text-white font-bold px-3 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition"
                    >
                      <PlusCircle size={14} />
                      <span>Dodaj produkt</span>
                    </button>
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
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => setEditingProduct(prod)}
                                  className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-[#1C60B0] px-2.5 py-1.5 rounded-lg transition font-semibold"
                                >
                                  <Edit3 size={12} />
                                  <span>Edytuj</span>
                                </button>
                                <button
                                  onClick={() => handleDeleteProduct(prod.id)}
                                  className="p-1.5 text-slate-400 hover:text-[#CD2628] hover:bg-red-50 rounded-lg transition"
                                  title="Usuń produkt"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {editorMode === 'organizer' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Info banner */}
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fade-in">
                  <div className="space-y-1">
                    <h4 className="font-bold text-xs text-slate-800">Organizator ułożenia oferty B2B</h4>
                    <p className="text-[11px] text-slate-550 leading-relaxed">
                      Zmień kolejność kategorii przyciskami ▲ / ▼ (jak kanały na Discordzie). Zmieniaj nazwy kategorii zbiorczo lub przenoś produkty do innych grup. Kliknij <strong>Zapisz układ katalogu</strong>, aby zapisać ułożenie w bazie danych.
                    </p>
                  </div>
                  <button
                    onClick={handleSaveOrganizer}
                    disabled={savingOrganizer}
                    className="w-full md:w-auto flex-shrink-0 bg-[#1C60B0] hover:bg-[#1A54A5] text-white text-xs font-bold px-5 py-2.5 rounded-xl transition flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50"
                  >
                    {savingOrganizer ? (
                      <>
                        <RefreshCw className="animate-spin" size={14} />
                        <span>Zapisywanie...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle size={14} />
                        <span>Zapisz układ katalogu</span>
                      </>
                    )}
                  </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Left Column: Categories List */}
                  <div className="lg:col-span-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-200">
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Kategorie ({uniqueCategoriesList.length})</span>
                      <button
                        onClick={() => {
                          const newCatName = prompt('Podaj nazwę nowej kategorii:');
                          if (newCatName && newCatName.trim()) {
                            const trimmed = newCatName.trim().toUpperCase();
                            if (!uniqueCategoriesList.includes(trimmed)) {
                              setUniqueCategoriesList([...uniqueCategoriesList, trimmed]);
                              setSelectedOrganizerCategory(trimmed);
                            }
                          }
                        }}
                        className="text-[#1C60B0] hover:text-[#1A54A5] text-[10px] font-bold flex items-center space-x-1"
                      >
                        <PlusCircle size={12} />
                        <span>Dodaj</span>
                      </button>
                    </div>

                    <div className="space-y-1.5 max-h-[450px] overflow-y-auto pr-1">
                      {uniqueCategoriesList.map((cat, idx) => (
                        <div
                          key={cat}
                          className={`group flex items-center justify-between p-2.5 rounded-xl border text-xs font-bold transition-all ${
                            selectedOrganizerCategory === cat
                              ? 'bg-[#1C60B0] text-white border-[#1C60B0]'
                              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <span
                            className="truncate pr-2 flex-1 cursor-pointer"
                            onClick={() => setSelectedOrganizerCategory(cat)}
                          >{cat}</span>

                          {/* Controls */}
                          <div className="flex items-center space-x-1.5 opacity-80 group-hover:opacity-100 flex-shrink-0">
                            {/* Rename */}
                            <button
                              onClick={() => {
                                const newName = prompt(`Zmień nazwę kategorii "${cat}" dla wszystkich produktów:`, cat);
                                if (newName && newName.trim() && newName.trim().toUpperCase() !== cat) {
                                  const trimmedNew = newName.trim().toUpperCase();
                                  setLocalOrganizerProducts(prev =>
                                    prev.map(p => (p.category || 'Zabawki').toUpperCase().trim() === cat ? { ...p, category: trimmedNew } : p)
                                  );
                                  setUniqueCategoriesList(prev =>
                                    prev.map(c => c === cat ? trimmedNew : c)
                                  );
                                  if (selectedOrganizerCategory === cat) {
                                    setSelectedOrganizerCategory(trimmedNew);
                                  }
                                }
                              }}
                              className={`p-1 rounded hover:bg-black/10 transition ${
                                selectedOrganizerCategory === cat ? 'text-white' : 'text-slate-400 hover:text-slate-700'
                              }`}
                              title="Zmień nazwę kategorii"
                            >
                              <Edit3 size={11} />
                            </button>

                            {/* Up */}
                            <button
                              disabled={idx === 0}
                              onClick={() => {
                                setUniqueCategoriesList(prev => {
                                  const list = [...prev];
                                  const currentIdx = list.indexOf(cat);
                                  if (currentIdx <= 0) return prev;
                                  const temp = list[currentIdx - 1];
                                  list[currentIdx - 1] = list[currentIdx];
                                  list[currentIdx] = temp;
                                  return list;
                                });
                              }}
                              className={`p-1 rounded hover:bg-black/10 disabled:opacity-30 transition ${
                                selectedOrganizerCategory === cat ? 'text-white' : 'text-slate-400 hover:text-slate-700'
                              }`}
                            >
                              ▲
                            </button>

                            {/* Down */}
                            <button
                              disabled={idx === uniqueCategoriesList.length - 1}
                              onClick={() => {
                                setUniqueCategoriesList(prev => {
                                  const list = [...prev];
                                  const currentIdx = list.indexOf(cat);
                                  if (currentIdx < 0 || currentIdx >= list.length - 1) return prev;
                                  const temp = list[currentIdx + 1];
                                  list[currentIdx + 1] = list[currentIdx];
                                  list[currentIdx] = temp;
                                  return list;
                                });
                              }}
                              className={`p-1 rounded hover:bg-black/10 disabled:opacity-30 transition ${
                                selectedOrganizerCategory === cat ? 'text-white' : 'text-slate-400 hover:text-slate-700'
                              }`}
                            >
                              ▼
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Right Column: Products List */}
                  <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
                    <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                      <div className="space-y-0.5">
                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">Produkty w kategorii</span>
                        <h4 className="font-extrabold text-sm text-slate-800">{selectedOrganizerCategory || 'Wybierz kategorię'}</h4>
                      </div>
                      <span className="text-xs text-slate-500 font-bold">
                        Sztuk: <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-extrabold">{currentCategoryProducts.length}</span>
                      </span>
                    </div>

                    {!selectedOrganizerCategory ? (
                      <div className="text-center py-20 text-slate-400 text-xs">
                        <span>Wybierz kategorię po lewej stronie</span>
                      </div>
                    ) : currentCategoryProducts.length === 0 ? (
                      <div className="text-center py-20 text-slate-450 text-xs bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                        <span>Ta kategoria jest obecnie pusta. Przenieś tu produkty z innych grup za pomocą selektora w innych kategoriach.</span>
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1">
                        {currentCategoryProducts.map((p, idx) => (
                          <div
                            key={p.id}
                            className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100/60 border border-slate-200 rounded-xl text-xs transition-all animate-fade-in"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-10 h-10 bg-white border border-slate-200 rounded p-1 flex items-center justify-center overflow-hidden flex-shrink-0">
                                <img src={p.imageUrl} alt={p.name} className="max-h-full max-w-full object-contain" />
                              </div>
                              <div className="min-w-0">
                                <span className="font-bold text-slate-850 block truncate max-w-[240px] md:max-w-[320px]" title={p.name}>{p.name}</span>
                                <span className="text-[10px] text-slate-400 font-mono">SKU: {p.sku} | EAN: {p.ean}</span>
                              </div>
                            </div>

                            <div className="flex items-center space-x-4 flex-shrink-0">
                              {/* Category selector */}
                              <div className="flex flex-col items-end">
                                <label className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mb-0.5">Grupa:</label>
                                <select
                                  value={(p.category || 'Zabawki').toUpperCase().trim()}
                                  onChange={(e) => {
                                    const targetCat = e.target.value;
                                    setLocalOrganizerProducts(prev =>
                                      prev.map(item => item.id === p.id ? { ...item, category: targetCat } : item)
                                    );
                                  }}
                                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-bold text-slate-650 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                                >
                                  {uniqueCategoriesList.map(c => (
                                    <option key={c} value={c}>{c}</option>
                                  ))}
                                </select>
                              </div>

                              {/* Up/Down buttons */}
                              <div className="flex items-center space-x-1">
                                <button
                                  disabled={idx === 0}
                                  onClick={() => {
                                    if (idx > 0) {
                                      const prevProd = currentCategoryProducts[idx - 1];
                                      setLocalOrganizerProducts(prev => {
                                        const list = [...prev];
                                        const idxA = list.findIndex(x => x.id === p.id);
                                        const idxB = list.findIndex(x => x.id === prevProd.id);
                                        const temp = list[idxA];
                                        list[idxA] = list[idxB];
                                        list[idxB] = temp;
                                        return list;
                                      });
                                    }
                                  }}
                                  className="p-1.5 bg-white hover:bg-slate-200 border border-slate-200 rounded text-slate-500 hover:text-slate-800 disabled:opacity-30 transition"
                                >
                                  ▲
                                </button>
                                <button
                                  disabled={idx === currentCategoryProducts.length - 1}
                                  onClick={() => {
                                    if (idx < currentCategoryProducts.length - 1) {
                                      const nextProd = currentCategoryProducts[idx + 1];
                                      setLocalOrganizerProducts(prev => {
                                        const list = [...prev];
                                        const idxA = list.findIndex(x => x.id === p.id);
                                        const idxB = list.findIndex(x => x.id === nextProd.id);
                                        const temp = list[idxA];
                                        list[idxA] = list[idxB];
                                        list[idxB] = temp;
                                        return list;
                                      });
                                    }
                                  }}
                                  className="p-1.5 bg-white hover:bg-slate-200 border border-slate-200 rounded text-slate-500 hover:text-slate-800 disabled:opacity-30 transition"
                                >
                                  ▼
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {editorMode === 'settings' && (
              <div className="space-y-6 max-w-lg animate-fade-in">
                <div>
                  <h4 className="font-bold text-sm text-slate-800 mb-1">Jak klient wysyła zamówienie?</h4>
                  <p className="text-xs text-slate-500 mb-4">Wybierz czy zamówienia trafiają do panelu administracyjnego (domyślnie), czy klient pobiera CSV i otwiera swojego maila.</p>

                  <div className="space-y-3">
                    <label className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition ${offerOrderMode === 'panel' ? 'border-[#1C60B0] bg-blue-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                      <input
                        type="radio"
                        name="orderMode"
                        value="panel"
                        checked={offerOrderMode === 'panel'}
                        onChange={() => setOfferOrderMode('panel')}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-sm text-slate-800 block">Wyślij do panelu (domyślnie)</span>
                        <span className="text-xs text-slate-500">Zamówienie zapisuje się w zakładce "Zamówienia" w panelu admina. Nie wymaga konfiguracji.</span>
                      </div>
                    </label>

                    <label className={`flex items-start gap-3 p-4 border rounded-xl cursor-pointer transition ${offerOrderMode === 'email' ? 'border-amber-400 bg-amber-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                      <input
                        type="radio"
                        name="orderMode"
                        value="email"
                        checked={offerOrderMode === 'email'}
                        onChange={() => setOfferOrderMode('email')}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="font-bold text-sm text-slate-800 block">Przez e-mail klienta</span>
                        <span className="text-xs text-slate-500">Klient klika "Wyślij" → automatycznie pobiera plik CSV z kodami i ilościami → otwiera mu się skrzynka pocztowa z gotową wiadomością do Ciebie.</span>
                      </div>
                    </label>
                  </div>
                </div>

                {offerOrderMode === 'email' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1.5">
                      Adres e-mail odbiorcy zamówień
                    </label>
                    <input
                      type="email"
                      value={offerOrderEmail}
                      onChange={(e) => setOfferOrderEmail(e.target.value)}
                      placeholder="np. biuro@askato.pl"
                      className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 bg-slate-50"
                    />
                    <p className="text-[10px] text-slate-400 mt-1.5">Na ten adres trafi wiadomość od klienta z zamówieniem (plik CSV w treści).</p>
                  </div>
                )}

                <button
                  onClick={handleSaveOrderSettings}
                  disabled={savingOrderSettings}
                  className="bg-[#1C60B0] hover:bg-[#1A54A5] disabled:opacity-50 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition flex items-center gap-2"
                >
                  {savingOrderSettings ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /><span>Zapisywanie...</span></> : 'Zapisz ustawienia'}
                </button>
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
                  <span>{uploading ? (uploadProgress || 'Przetwarzanie...') : 'Wygeneruj Ofertę Askato'}</span>
                </button>

              </form>
            </div>

            {/* Offers List */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="font-bold text-sm text-slate-800 border-b border-slate-100 pb-3">Utworzone Oferty B2B</h3>
              
              <div className="space-y-3">
                {offers.map((o) => (
                  <div key={o.id} className={`p-4 border rounded-xl flex items-center justify-between text-xs ${o.isFeatured ? 'bg-amber-50 border-amber-300' : 'bg-slate-50 border-slate-200'}`}>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-800">{o.title}</h4>
                        {o.isFeatured && (
                          <span className="inline-flex items-center gap-1 bg-amber-400 text-white text-[9px] font-black px-1.5 py-0.5 rounded-md uppercase tracking-wide">
                            ★ Główna
                          </span>
                        )}
                      </div>
                      <code className="text-[10px] text-slate-500 block mt-0.5">Link: /offer/{o.slug}</code>
                      <div className="flex space-x-4 text-[10px] text-slate-400 mt-2">
                        <span>Liczba towarów: <strong className="text-slate-600">{o.productCount}</strong></span>
                        <span>Utworzono: <strong>{new Date(o.createdAt).toLocaleDateString('pl-PL')}</strong></span>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      {!o.isFeatured && (
                        <button
                          onClick={() => handleSetFeatured(o.id)}
                          className="bg-amber-400 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg transition flex items-center space-x-1 text-[11px]"
                          title="Ustaw jako główna oferta (dostępna pod /)"
                        >
                          <span>★</span>
                          <span>Ustaw jako główną</span>
                        </button>
                      )}

                      <button
                        onClick={() => handleSelectOfferForEdit(o)}
                        className="bg-[#1C60B0] hover:bg-[#1A54A5] text-white font-bold px-3 py-1.5 rounded-lg transition flex items-center space-x-1"
                        title="Zarządzaj i edytuj towary"
                      >
                        <Settings size={12} />
                        <span>Edytuj towary</span>
                      </button>

                      <a
                        href={`/offer/${o.slug}?preview=true`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 p-2 rounded-lg transition inline-flex items-center justify-center"
                        title="Otwórz ofertę"
                      >
                        <Eye size={14} />
                      </a>

                      <button
                        onClick={() => { setConfirmDeleteOfferId(o.id); setConfirmDeleteOfferTitle(o.title); }}
                        className="bg-white border border-slate-200 hover:bg-red-50 text-slate-450 hover:text-[#CD2628] hover:border-red-200 p-2 rounded-lg transition"
                        title="Usuń ofertę"
                      >
                        <X size={14} />
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
                        <button
                          onClick={() => handleDeleteOrder(order.id)}
                          className="bg-white hover:bg-red-50 border border-slate-200 hover:border-red-200 text-slate-400 hover:text-[#CD2628] p-2.5 rounded-xl transition"
                          title="Usuń zamówienie z historii"
                        >
                          <X size={14} />
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

        {activeTab === 'clients' && !selectedOfferForEdit && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input type="text" placeholder="Filtruj po firmie, e-mailu, NIP..." value={clientSearch} onChange={(e) => setClientSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-500">Firm: <strong className="text-slate-700">{filteredClients.length}</strong></span>
                <button onClick={() => setShowAddClient(true)} className="bg-[#1C60B0] hover:bg-[#1A54A5] text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center space-x-1.5 transition">
                  <PlusCircle size={14} /><span>Dodaj klienta</span>
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50">
                    <th className="p-3">Nazwa firmy</th>
                    <th className="p-3">NIP</th>
                    <th className="p-3">E-mail</th>
                    <th className="p-3 text-right">Rabat B2B</th>
                    <th className="p-3 text-right">Obrót</th>
                    <th className="p-3 text-center">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClients.map((client) => {
                    const clientOrders = orders.filter(o => o.clientNip === client.nip || o.clientEmail === client.email);
                    const totalRevenue = clientOrders.reduce((s, o) => s + o.totalValue, 0);
                    return (
                      <tr key={client.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                        <td className="p-3 font-bold text-slate-800">{client.companyName}</td>
                        <td className="p-3 font-mono text-slate-600">{client.nip}</td>
                        <td className="p-3 text-slate-500">{client.email}</td>
                        <td className="p-3 text-right">
                          <span className="bg-emerald-50 text-emerald-700 font-extrabold px-2 py-1 rounded border border-emerald-100">-{(client.discountRate * 100).toFixed(0)}%</span>
                        </td>
                        <td className="p-3 text-right font-bold text-slate-700">{totalRevenue.toFixed(2)} PLN</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => setEditingClient(client)} className="inline-flex items-center space-x-1 bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-[#1C60B0] px-2.5 py-1.5 rounded-lg transition font-semibold">
                              <Edit3 size={12} /><span>Rabat</span>
                            </button>
                            <button onClick={() => handleDeleteClient(client.id)} className="p-1.5 text-slate-400 hover:text-[#CD2628] hover:bg-red-50 rounded-lg transition" title="Usuń klienta">
                              <X size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 5: STATS */}
        {activeTab === 'stats' && !selectedOfferForEdit && (
          <div className="space-y-8 animate-fade-in text-slate-800">
            
            {/* Dynamic Metric Cards */}
            {(() => {
              const totalOrdersCount = orders.length;
              const totalRevenue = orders.reduce((s, o) => s + o.totalValue, 0);
              const averageOrderValue = totalOrdersCount > 0 ? totalRevenue / totalOrdersCount : 0;
              const totalItemsSold = orders.reduce((sum, o) => sum + o.items.reduce((s, item) => s + item.quantity, 0), 0);
              
              // Calculate category performance
              const categoryStats: { [cat: string]: { qty: number; revenue: number } } = {};
              orders.forEach(o => {
                o.items.forEach(item => {
                  const prod = offerProducts.find(p => p.sku === item.sku);
                  const cat = (prod?.category || 'Zabawki').toUpperCase().trim();
                  if (!categoryStats[cat]) {
                    categoryStats[cat] = { qty: 0, revenue: 0 };
                  }
                  categoryStats[cat].qty += item.quantity;
                  categoryStats[cat].revenue += item.price * item.quantity;
                });
              });

              // Bestselling products
              const productCounts: { [sku: string]: { name: string; sku: string; qty: number; revenue: number; imgUrl?: string } } = {};
              orders.forEach(o => o.items.forEach(item => {
                if (!productCounts[item.sku]) {
                  const prod = offerProducts.find(p => p.sku === item.sku);
                  productCounts[item.sku] = { 
                    name: item.name, 
                    sku: item.sku, 
                    qty: 0, 
                    revenue: 0,
                    imgUrl: prod?.imageUrl 
                  };
                }
                productCounts[item.sku].qty += item.quantity;
                productCounts[item.sku].revenue += item.price * item.quantity;
              }));
              const topProductsSorted = Object.values(productCounts).sort((a, b) => b.qty - a.qty).slice(0, 10);

              // Client detailed stats
              const detailedClientStats = clients.map(c => {
                const clientOrders = orders.filter(o => o.clientEmail === c.email || o.clientNip === c.nip);
                const totalSpent = clientOrders.reduce((sum, o) => sum + o.totalValue, 0);
                const avgVal = clientOrders.length > 0 ? totalSpent / clientOrders.length : 0;
                
                const clientCategories: { [cat: string]: number } = {};
                clientOrders.forEach(o => o.items.forEach(item => {
                  const prod = offerProducts.find(p => p.sku === item.sku);
                  const cat = (prod?.category || 'Zabawki').toUpperCase().trim();
                  clientCategories[cat] = (clientCategories[cat] || 0) + item.quantity;
                }));
                const topCat = Object.entries(clientCategories).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Brak';
                const lastOrd = clientOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
                const lastOrderDate = lastOrd ? new Date(lastOrd.createdAt).toLocaleString('pl-PL') : 'Brak zamówień';

                return {
                  ...c,
                  ordersCount: clientOrders.length,
                  totalSpent,
                  avgOrderValue: avgVal,
                  topCategory: topCat,
                  lastOrderDate
                };
              }).sort((a, b) => b.totalSpent - a.totalSpent);

              // Orders by hour distribution
              const hourCounts = Array(24).fill(0);
              orders.forEach(o => { 
                const h = new Date(o.createdAt).getHours(); 
                if (h >= 0 && h < 24) hourCounts[h]++; 
              });
              const maxHourCount = Math.max(...hourCounts, 1);

              // Orders by day of week distribution
              const dayNames = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
              const dayCounts = Array(7).fill(0);
              orders.forEach(o => {
                const d = new Date(o.createdAt).getDay();
                if (d >= 0 && d < 7) dayCounts[d]++;
              });
              const maxDayCount = Math.max(...dayCounts, 1);

              return (
                <div className="space-y-8">
                  {/* KPI Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Łączny obrót netto</span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-slate-800">{totalRevenue.toFixed(2)} PLN</span>
                        <DollarSign className="text-emerald-500" size={18} />
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">Na podstawie zrealizowanych koszyków</div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Średnia wartość zamówienia</span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-slate-800">{averageOrderValue.toFixed(2)} PLN</span>
                        <ClipboardList className="text-[#1C60B0]" size={18} />
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">AOV dla zamówień B2B</div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Łącznie sprzedanych sztuk</span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-slate-800">{totalItemsSold} szt.</span>
                        <ShoppingCart className="text-indigo-500" size={18} />
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">Suma towarów wydanych z magazynu</div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-2">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Zarejestrowane zamówienia</span>
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-black text-slate-800">{totalOrdersCount}</span>
                        <Clock className="text-rose-500" size={18} />
                      </div>
                      <div className="text-[10px] text-slate-500 font-medium">Liczba wszystkich transakcji</div>
                    </div>
                  </div>

                  {/* Client purchasing behavior */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div>
                      <h3 className="font-black text-slate-800 text-sm">Szczegółowa analityka zakupowa klientów B2B</h3>
                      <p className="text-[10px] text-slate-400">Kompleksowe podsumowanie obrotów, średniej wartości zamówienia, najczęściej wybieranej kategorii oraz ostatniej aktywności.</p>
                    </div>

                    {detailedClientStats.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-8">Brak aktywnych klientów</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50">
                              <th className="p-3">Firma</th>
                              <th className="p-3">E-mail / Login</th>
                              <th className="p-3 text-center">Zamówienia</th>
                              <th className="p-3 text-right">Suma wydatków</th>
                              <th className="p-3 text-right">Średni koszyk</th>
                              <th className="p-3">Główna kategoria</th>
                              <th className="p-3 text-right">Ostatnie zamówienie</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailedClientStats.map(c => (
                              <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                                <td className="p-3 font-bold text-slate-850">{c.companyName}</td>
                                <td className="p-3 text-slate-500 font-mono">{c.email}</td>
                                <td className="p-3 text-center font-bold text-[#1C60B0]">{c.ordersCount}</td>
                                <td className="p-3 text-right font-extrabold text-slate-800">{c.totalSpent.toFixed(2)} PLN</td>
                                <td className="p-3 text-right font-semibold text-slate-600">{c.avgOrderValue.toFixed(2)} PLN</td>
                                <td className="p-3">
                                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-200">{c.topCategory}</span>
                                </td>
                                <td className="p-3 text-right text-slate-500 font-mono text-[10px]">{c.lastOrderDate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Charts Row */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Hourly Distribution */}
                    <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                      <div>
                        <h3 className="font-bold text-sm text-slate-800">Rozkład godzinowy zamówień B2B</h3>
                        <p className="text-[10px] text-slate-400">Analiza godzin, w których klienci najchętniej składają zamówienia.</p>
                      </div>

                      <div className="flex items-end gap-1 h-36 pt-4 border-b border-slate-150 pb-1">
                        {hourCounts.map((count, h) => (
                          <div key={h} className="flex-1 flex flex-col items-center gap-1 group relative">
                            <div className="absolute bottom-full mb-1 bg-slate-800 text-white text-[9px] px-1 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity font-bold pointer-events-none whitespace-nowrap z-10">
                              {count} zam.
                            </div>
                            <div 
                              className="w-full bg-[#1C60B0] hover:bg-[#1A54A5] rounded-t-sm transition-all duration-500" 
                              style={{ height: `${(count / maxHourCount) * 110}px`, minHeight: count > 0 ? '4px' : '0' }} 
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-[9px] text-slate-400 font-mono px-1">
                        <span>00:00</span>
                        <span>06:00</span>
                        <span>12:00</span>
                        <span>18:00</span>
                        <span>23:00</span>
                      </div>
                    </div>

                    {/* Day of Week Distribution */}
                    <div className="lg:col-span-6 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                      <div>
                        <h3 className="font-bold text-sm text-slate-800">Dni tygodnia o najwyższej sprzedaży</h3>
                        <p className="text-[10px] text-slate-400">Rozkład liczby transakcji w poszczególnych dniach tygodnia.</p>
                      </div>

                      <div className="space-y-2.5 pt-2">
                        {dayNames.map((name, d) => {
                          const count = dayCounts[d];
                          const percent = maxDayCount > 0 ? (count / maxDayCount) * 100 : 0;
                          return (
                            <div key={d} className="flex items-center gap-3">
                              <div className="w-24 text-[10px] font-bold text-slate-600 truncate">{name}</div>
                              <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
                                <div 
                                  className="h-full bg-gradient-to-r from-[#1C60B0] to-indigo-500 rounded-full transition-all duration-500" 
                                  style={{ width: `${percent}%` }} 
                                />
                              </div>
                              <div className="text-[10px] font-extrabold text-slate-700 w-12 text-right">{count} zam.</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Categories Performance */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div>
                      <h3 className="font-bold text-sm text-slate-800">Podział sprzedaży według kategorii towarowych</h3>
                      <p className="text-[10px] text-slate-400">Przychód oraz liczba sztuk sprzedanych w ramach poszczególnych grup produktowych.</p>
                    </div>

                    {Object.keys(categoryStats).length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-8">Brak danych kategorii</p>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(categoryStats).map(([cat, stats]) => {
                          const maxCatRev = Math.max(...Object.values(categoryStats).map(s => s.revenue), 1);
                          const percent = (stats.revenue / maxCatRev) * 100;
                          return (
                            <div key={cat} className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 p-3 bg-slate-50 border border-slate-150 rounded-xl">
                              <div className="w-full md:w-48 text-xs font-bold text-slate-850 truncate">{cat}</div>
                              <div className="flex-1 bg-slate-200 rounded-full h-3 overflow-hidden">
                                <div 
                                  className="h-full bg-[#1C60B0] rounded-full transition-all duration-500" 
                                  style={{ width: `${percent}%` }} 
                                />
                              </div>
                              <div className="flex items-center justify-between md:justify-end gap-6 flex-shrink-0 text-xs font-bold text-slate-700">
                                <span>{stats.qty} szt.</span>
                                <span className="w-28 text-right text-emerald-600">{stats.revenue.toFixed(2)} PLN</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Best Selling Products */}
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
                    <div>
                      <h3 className="font-bold text-sm text-slate-800">Top 10 bestsellerów produktowych (B2B)</h3>
                      <p className="text-[10px] text-slate-400">Najczęściej zamawiane produkty uszeregowane według liczby sprzedanych sztuk.</p>
                    </div>

                    {topProductsSorted.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-8">Brak danych sprzedaży produktów</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead>
                            <tr className="border-b border-slate-200 text-slate-400 font-bold bg-slate-50">
                              <th className="p-3">Zdjęcie</th>
                              <th className="p-3">Produkt</th>
                              <th className="p-3">SKU</th>
                              <th className="p-3 text-right">Sprzedane (szt.)</th>
                              <th className="p-3 text-right">Przychód</th>
                            </tr>
                          </thead>
                          <tbody>
                            {topProductsSorted.map((p, i) => (
                              <tr key={p.sku} className="border-b border-slate-100 hover:bg-slate-50/50 transition">
                                <td className="p-3">
                                  <div className="w-10 h-10 bg-white border border-slate-200 rounded p-1 flex items-center justify-center overflow-hidden">
                                    {p.imgUrl ? (
                                      <img src={p.imgUrl} alt={p.name} className="max-h-full max-w-full object-contain" />
                                    ) : (
                                      <div className="w-full h-full bg-slate-100 rounded flex items-center justify-center text-[8px] text-slate-400 font-bold">BRAK</div>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3 font-bold text-slate-800 max-w-xs truncate">{i + 1}. {p.name}</td>
                                <td className="p-3 font-mono text-slate-550">{p.sku}</td>
                                <td className="p-3 text-right font-extrabold text-[#1C60B0]">{p.qty}</td>
                                <td className="p-3 text-right font-extrabold text-emerald-600">{p.revenue.toFixed(2)} PLN</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      </main>

      {/* MODAL: Add Client */}
      {showAddClient && (
        <div onClick={() => setShowAddClient(false)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800">Dodaj nowego klienta B2B</h3>
              <button onClick={() => setShowAddClient(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleCreateClient} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-500 font-semibold mb-1">Nazwa firmy *</label><input required value={newClient.companyName} onChange={e => setNewClient({...newClient, companyName: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" /></div>
                <div><label className="block text-slate-500 font-semibold mb-1">NIP</label><input value={newClient.nip} onChange={e => setNewClient({...newClient, nip: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" /></div>
              </div>
              <div><label className="block text-slate-500 font-semibold mb-1">E-mail (login) *</label><input required type="email" value={newClient.email} onChange={e => setNewClient({...newClient, email: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" /></div>
              <div><label className="block text-slate-500 font-semibold mb-1">Hasło *</label><input required type="password" value={newClient.password} onChange={e => setNewClient({...newClient, password: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" /></div>
              <div><label className="block text-slate-500 font-semibold mb-1">Rabat B2B (%)</label><input type="number" min="0" max="100" value={newClient.discountRate} onChange={e => setNewClient({...newClient, discountRate: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" /></div>
              <button type="submit" className="w-full bg-[#1C60B0] text-white font-bold py-2.5 rounded-xl text-xs transition hover:bg-[#1A54A5]">Utwórz konto klienta</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Add Product to Offer */}
      {showAddProduct && selectedOfferForEdit && (
        <div onClick={() => setShowAddProduct(false)} className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800">Dodaj produkt do oferty</h3>
              <button onClick={() => setShowAddProduct(false)}><X size={20} className="text-slate-400" /></button>
            </div>
            <form onSubmit={handleAddProduct} className="space-y-3 text-xs">
              <div><label className="block text-slate-500 font-semibold mb-1">Nazwa produktu *</label><input required value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-slate-500 font-semibold mb-1">SKU / Kod</label><input value={newProduct.sku} onChange={e => setNewProduct({...newProduct, sku: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" /></div>
                <div><label className="block text-slate-500 font-semibold mb-1">EAN</label><input value={newProduct.ean} onChange={e => setNewProduct({...newProduct, ean: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" /></div>
                <div><label className="block text-slate-500 font-semibold mb-1">Cena netto (PLN) *</label><input required type="number" step="0.01" value={newProduct.price} onChange={e => setNewProduct({...newProduct, price: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" /></div>
                <div><label className="block text-slate-500 font-semibold mb-1">Stan (szt.)</label><input type="number" value={newProduct.stock} onChange={e => setNewProduct({...newProduct, stock: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" /></div>
                <div><label className="block text-slate-500 font-semibold mb-1">Kategoria</label><input value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} placeholder="ZABAWKI" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" /></div>
                <div><label className="block text-slate-500 font-semibold mb-1">Wiek</label><input value={newProduct.age} onChange={e => setNewProduct({...newProduct, age: e.target.value})} placeholder="3+" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" /></div>
                <div><label className="block text-slate-500 font-semibold mb-1">Pakowanie zbiorcze (PCB)</label><input value={newProduct.packaging} onChange={e => setNewProduct({...newProduct, packaging: e.target.value})} placeholder="PCB 1" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" /></div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Rabat (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={newProduct.discountRate}
                    onChange={(e) => {
                      const pct = e.target.value;
                      const discountRate = parseFloat(pct) || 0;
                      const priceVal = parseFloat(newProduct.price) || 0;
                      const originalPrice = discountRate > 0 ? (priceVal / (1 - discountRate / 100)).toFixed(2) : priceVal.toString();
                      setNewProduct({ ...newProduct, discountRate: pct, originalPrice });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                    placeholder="np. 50"
                  />
                </div>
                <div>
                  <label className="block text-slate-500 font-semibold mb-1">Cena przed rabatem (PLN)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newProduct.originalPrice}
                    onChange={(e) => {
                      const origPrice = e.target.value;
                      const origPriceVal = parseFloat(origPrice) || 0;
                      const priceVal = parseFloat(newProduct.price) || 0;
                      const discountRate = origPriceVal > priceVal ? Math.round(((origPriceVal - priceVal) / origPriceVal) * 100).toString() : '0';
                      setNewProduct({ ...newProduct, originalPrice: origPrice, discountRate });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                    placeholder="Opcjonalnie"
                  />
                </div>
              </div>
              <div><label className="block text-slate-500 font-semibold mb-1">URL zdjecia</label><input type="url" value={newProduct.imageUrl} onChange={e => setNewProduct({...newProduct, imageUrl: e.target.value})} placeholder="https://..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" /></div>
              <div><label className="block text-slate-500 font-semibold mb-1">Opis produktu</label><textarea rows={3} value={newProduct.description} onChange={e => setNewProduct({...newProduct, description: e.target.value})} placeholder="Opis i specyfikacja..." className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]" /></div>
              <button type="submit" className="w-full bg-[#1C60B0] text-white font-bold py-2.5 rounded-xl text-xs transition hover:bg-[#1A54A5]">Dodaj produkt do oferty</button>
            </form>
          </div>
        </div>
      )}

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
                  onChange={(e) => {
                    const price = parseFloat(e.target.value) || 0;
                    const discountRate = editingProduct.discountRate || 0;
                    const originalPrice = discountRate > 0 ? parseFloat((price / (1 - discountRate)).toFixed(2)) : price;
                    setEditingProduct({ ...editingProduct, price, originalPrice });
                  }}
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

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Rekomendowany wiek</label>
                <input
                  type="text"
                  value={editingProduct.age || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, age: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                  placeholder="np. 3+"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Rabat (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={Math.round((editingProduct.discountRate || 0) * 100)}
                  onChange={(e) => {
                    const pct = parseFloat(e.target.value) || 0;
                    const discountRate = pct / 100;
                    const originalPrice = discountRate > 0 ? parseFloat((editingProduct.price / (1 - discountRate)).toFixed(2)) : editingProduct.price;
                    setEditingProduct({ ...editingProduct, discountRate, originalPrice });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                  placeholder="np. 50"
                />
              </div>

              <div>
                <label className="block text-slate-500 font-semibold mb-1">Cena przed rabatem (PLN)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={editingProduct.originalPrice || editingProduct.price}
                  onChange={(e) => {
                    const originalPrice = parseFloat(e.target.value) || 0;
                    const discountRate = originalPrice > editingProduct.price ? parseFloat(((originalPrice - editingProduct.price) / originalPrice).toFixed(4)) : 0;
                    setEditingProduct({ ...editingProduct, originalPrice, discountRate });
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                  placeholder="np. 100.00"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-slate-500 font-semibold mb-2">Zdjęcie produktu</label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 bg-slate-100 border border-slate-200 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center">
                    <img src={editingProduct.imageUrl} alt="preview" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <label className="block w-full cursor-pointer bg-slate-50 hover:bg-slate-100 border border-dashed border-slate-300 rounded-xl px-4 py-3 text-center transition">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const buf = await file.arrayBuffer();
                          const b64 = await compressImageToBase64(buf, 600, 0.75);
                          if (b64) setEditingProduct({ ...editingProduct, imageUrl: b64 });
                        }}
                      />
                      <span className="text-xs font-semibold text-[#1C60B0]">Kliknij aby wybrać nowe zdjęcie</span>
                      <span className="block text-[10px] text-slate-400 mt-0.5">JPG, PNG, WEBP — automatycznie skompresowane</span>
                    </label>
                    <input
                      type="text"
                      value={editingProduct.imageUrl.startsWith('data:') ? '' : editingProduct.imageUrl}
                      onChange={(e) => setEditingProduct({ ...editingProduct, imageUrl: e.target.value })}
                      placeholder="…lub wklej link do zdjęcia (https://...)"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-[#1C60B0]"
                    />
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

      {/* Custom Delete Offer Confirm Modal */}
      {confirmDeleteOfferId && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setConfirmDeleteOfferId(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8 border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center text-[#CD2628] mx-auto mb-5">
              <X size={28} />
            </div>
            <h3 className="text-xl font-black text-slate-900 text-center mb-2">Usunąć ofertę?</h3>
            <p className="text-sm text-slate-500 text-center mb-1">Zamierzasz trwale usunąć:</p>
            <p className="text-sm font-bold text-slate-800 text-center mb-3 px-4">&bdquo;{confirmDeleteOfferTitle}&rdquo;</p>
            <p className="text-xs text-slate-400 text-center mb-8">Ta operacja jest nieodwracalna. Wszystkie produkty w tej ofercie zostaną usunięte.</p>
            <div className="flex space-x-3">
              <button
                onClick={() => setConfirmDeleteOfferId(null)}
                className="flex-1 py-3 border border-slate-200 text-slate-600 font-bold text-sm rounded-xl hover:bg-slate-50 transition"
              >
                Anuluj
              </button>
              <button
                onClick={() => handleDeleteOffer(confirmDeleteOfferId)}
                className="flex-1 py-3 bg-[#CD2628] hover:bg-red-700 text-white font-bold text-sm rounded-xl transition shadow-md"
              >
                Tak, usuń ofertę
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
