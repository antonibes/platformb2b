import fs from 'fs';
import path from 'path';

// Define database file path for fallback local JSON storage
const DB_FILE = path.join(process.cwd(), 'db.json');

export interface B2BUser {
  id: string;
  email: string;
  passwordHash: string;
  companyName: string;
  nip: string;
  discountRate: number; // e.g. 0.15 = 15% discount
  role: 'admin' | 'client';
}

export interface Offer {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
}

export interface Product {
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

export interface OrderItem {
  productId: string;
  sku: string;
  ean: string;
  name: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  userId: string | null;
  guestDeviceId: string | null;
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

export interface TrackingEvent {
  id: string;
  deviceId: string;
  userId: string | null;
  eventType: 'page_view' | 'add_to_cart' | 'csv_export' | 'email_order' | 'remove_from_cart';
  offerSlug: string;
  payload: any;
  createdAt: string;
}

interface DatabaseSchema {
  users: B2BUser[];
  offers: Offer[];
  products: Product[];
  orders: Order[];
  trackingEvents: TrackingEvent[];
}

const DEFAULT_DB: DatabaseSchema = {
  users: [
    {
      id: 'admin-1',
      email: 'admin@askato.pl',
      passwordHash: 'admin123', // Cleartext for MVP testing simple auth
      companyName: 'Askato Sp. z o.o.',
      nip: '1234567890',
      discountRate: 0,
      role: 'admin',
    },
    {
      id: 'client-1',
      email: 'hurtownik@example.com',
      passwordHash: 'client123',
      companyName: 'Zabawki i Radość S.A.',
      nip: '9876543210',
      discountRate: 0.15, // 15% discount
      role: 'client',
    },
    {
      id: 'client-2',
      email: 'sklep@dladzieci.pl',
      passwordHash: 'sklep123',
      companyName: 'Świat Malucha P.P.H.U.',
      nip: '5556667778',
      discountRate: 0.10, // 10% discount
      role: 'client',
    }
  ],
  offers: [
    {
      id: 'offer-1',
      title: 'Letnia Promocja 2026 - Zabawki Ogrodowe',
      slug: 'letnia-promocja-2026',
      isActive: true,
      createdAt: new Date().toISOString(),
    }
  ],
  products: [
    {
      id: 'prod-1',
      offerId: 'offer-1',
      sku: 'ASK-BAS-001',
      ean: '5901234567890',
      name: 'Basen Rozporowy Ogrodowy 305x76 cm',
      price: 189.90,
      imageUrl: 'https://images.unsplash.com/photo-1576016770956-debb63d900bb?w=500&auto=format&fit=crop&q=60',
      packaging: 'opak. 1 szt.',
      stock: 45,
    },
    {
      id: 'prod-2',
      offerId: 'offer-1',
      sku: 'ASK-PIAS-002',
      ean: '5901234567891',
      name: 'Piaskownica Drewniana Zamykana z Ławkami',
      price: 149.00,
      imageUrl: 'https://images.unsplash.com/photo-1596464716127-f2a82984de30?w=500&auto=format&fit=crop&q=60',
      packaging: 'opak. 1 szt.',
      stock: 30,
    },
    {
      id: 'prod-3',
      offerId: 'offer-1',
      sku: 'ASK-PIL-003',
      ean: '5901234567892',
      name: 'Piłka Plażowa Askato Jumbo 60cm',
      price: 12.50,
      imageUrl: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?w=500&auto=format&fit=crop&q=60',
      packaging: 'opak. 12 szt.',
      stock: 500,
    },
    {
      id: 'prod-4',
      offerId: 'offer-1',
      sku: 'ASK-KOLO-004',
      ean: '5901234567893',
      name: 'Koło do Pływania z Uchwytami 90cm',
      price: 19.99,
      imageUrl: 'https://images.unsplash.com/photo-1562184552-997c461abbe6?w=500&auto=format&fit=crop&q=60',
      packaging: 'opak. 6 szt.',
      stock: 250,
    },
    {
      id: 'prod-5',
      offerId: 'offer-1',
      sku: 'ASK-REK-005',
      ean: '5901234567894',
      name: 'Rękawki do Nauki Pływania Askato Kids',
      price: 8.90,
      imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?w=500&auto=format&fit=crop&q=60',
      packaging: 'opak. 24 szt.',
      stock: 800,
    }
  ],
  orders: [],
  trackingEvents: []
};

// Ensure database file exists
function initializeDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
  }
}

// Read database
export function readDb(): DatabaseSchema {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file, using fallback default data', error);
    return DEFAULT_DB;
  }
}

// Write database
export function writeDb(data: DatabaseSchema): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to database file', error);
  }
}

// Helper query functions
export const db = {
  users: {
    findMany: () => readDb().users,
    findByEmail: (email: string) => readDb().users.find(u => u.email.toLowerCase() === email.toLowerCase()),
    findById: (id: string) => readDb().users.find(u => u.id === id),
    create: (user: Omit<B2BUser, 'id'>) => {
      const current = readDb();
      const newUser = { ...user, id: `user-${Date.now()}` };
      current.users.push(newUser);
      writeDb(current);
      return newUser;
    },
    update: (id: string, updates: Partial<B2BUser>) => {
      const current = readDb();
      const index = current.users.findIndex(u => u.id === id);
      if (index !== -1) {
        current.users[index] = { ...current.users[index], ...updates };
        writeDb(current);
        return current.users[index];
      }
      return null;
    }
  },
  offers: {
    findMany: () => readDb().offers,
    findBySlug: (slug: string) => readDb().offers.find(o => o.slug === slug),
    create: (offer: Omit<Offer, 'id' | 'createdAt'>) => {
      const current = readDb();
      const newOffer = { 
        ...offer, 
        id: `offer-${Date.now()}`,
        createdAt: new Date().toISOString()
      };
      current.offers.push(newOffer);
      writeDb(current);
      return newOffer;
    },
    update: (id: string, updates: Partial<Offer>) => {
      const current = readDb();
      const index = current.offers.findIndex(o => o.id === id);
      if (index !== -1) {
        current.offers[index] = { ...current.offers[index], ...updates };
        writeDb(current);
        return current.offers[index];
      }
      return null;
    }
  },
  products: {
    findMany: () => readDb().products,
    findByOfferId: (offerId: string) => readDb().products.filter(p => p.offerId === offerId),
    createMany: (newProducts: Omit<Product, 'id'>[]) => {
      const current = readDb();
      const addedProducts: Product[] = [];
      newProducts.forEach((p, index) => {
        const prod = { ...p, id: `prod-${Date.now()}-${index}` };
        current.products.push(prod);
        addedProducts.push(prod);
      });
      writeDb(current);
      return addedProducts;
    },
    update: (id: string, updates: Partial<Product>) => {
      const current = readDb();
      const index = current.products.findIndex(p => p.id === id);
      if (index !== -1) {
        current.products[index] = { ...current.products[index], ...updates };
        writeDb(current);
        return current.products[index];
      }
      return null;
    },
    deleteByOfferId: (offerId: string) => {
      const current = readDb();
      current.products = current.products.filter(p => p.offerId !== offerId);
      writeDb(current);
    }
  },
  orders: {
    findMany: () => readDb().orders,
    findByUserId: (userId: string) => readDb().orders.filter(o => o.userId === userId),
    create: (order: Omit<Order, 'id' | 'createdAt' | 'status'>) => {
      const current = readDb();
      const newOrder: Order = {
        ...order,
        id: `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        status: 'new',
        createdAt: new Date().toISOString()
      };
      current.orders.push(newOrder);
      writeDb(current);
      return newOrder;
    },
    updateStatus: (id: string, status: Order['status']) => {
      const current = readDb();
      const index = current.orders.findIndex(o => o.id === id);
      if (index !== -1) {
        current.orders[index].status = status;
        writeDb(current);
        return current.orders[index];
      }
      return null;
    }
  },
  tracking: {
    findMany: () => readDb().trackingEvents,
    create: (event: Omit<TrackingEvent, 'id' | 'createdAt'>) => {
      const current = readDb();
      const newEvent: TrackingEvent = {
        ...event,
        id: `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        createdAt: new Date().toISOString()
      };
      current.trackingEvents.push(newEvent);
      writeDb(current);
      return newEvent;
    }
  }
};
