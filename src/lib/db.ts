import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

// Define database file path for fallback local JSON storage
const DB_FILE = path.join(process.cwd(), 'db.json');

export interface B2BUser {
  id: string;
  clientId: string;   // simple login identifier e.g. "misiek"
  email: string;
  passwordHash: string;
  companyName: string;
  nip: string;
  phone?: string;
  discountRate: number;
  role: 'admin' | 'client';
  setupToken?: string; // one-time account setup token
  setupComplete?: boolean;
}

export interface Offer {
  id: string;
  title: string;
  slug: string;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  orderMode: 'panel' | 'email';
  orderEmail: string;
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
  age?: string;
  discountRate?: number;
  originalPrice?: number;
  position?: number;
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
      clientId: 'admin@askato.pl',
      email: 'admin@askato.pl',
      passwordHash: 'admin123',
      companyName: 'Askato Sp. z o.o.',
      nip: '1234567890',
      discountRate: 0,
      role: 'admin',
    }
  ],
  offers: [],
  products: [],
  orders: [],
  trackingEvents: []
};

// Check if we are connected to Postgres
const getSql = () => {
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) {
    return neon(url);
  }
  return null;
};

// Fallback JSON DB methods
function initializeDb() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
  }
}

function readDb(): DatabaseSchema {
  initializeDb();
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading database file, using fallback default data', error);
    return DEFAULT_DB;
  }
}

function writeDb(data: DatabaseSchema): void {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error writing to database file', error);
  }
}

// SQL Mapping Helpers
function toUtcIsoString(dateInput: any): string {
  if (!dateInput) return new Date().toISOString();
  if (dateInput instanceof Date) {
    return dateInput.toISOString();
  }
  try {
    return new Date(dateInput).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

function mapUser(row: any): B2BUser {
  return {
    id: row.id,
    clientId: row.client_id || row.email || row.id,
    email: row.email || '',
    passwordHash: row.password_hash || '',
    companyName: row.company_name || '',
    nip: row.nip || '',
    phone: row.phone || '',
    discountRate: parseFloat(row.discount_rate) || 0,
    role: row.role as 'admin' | 'client',
    setupToken: row.setup_token || undefined,
    setupComplete: !!row.setup_complete
  };
}

function mapOffer(row: any): Offer {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    isActive: !!row.is_active,
    isFeatured: !!row.is_featured,
    createdAt: toUtcIsoString(row.created_at),
    orderMode: (row.order_mode === 'email' ? 'email' : 'panel') as 'panel' | 'email',
    orderEmail: row.order_email || '',
  };
}

function mapProduct(row: any): Product {
  return {
    id: row.id,
    offerId: row.offer_id,
    sku: row.sku,
    ean: row.ean,
    category: row.category || undefined,
    name: row.name,
    price: parseFloat(row.price),
    imageUrl: row.image_url,
    packaging: row.packaging,
    stock: parseInt(row.stock, 10),
    description: row.description || undefined,
    age: row.age || undefined,
    discountRate: row.discount_rate !== undefined && row.discount_rate !== null ? parseFloat(row.discount_rate) : 0,
    originalPrice: row.original_price !== undefined && row.original_price !== null ? parseFloat(row.original_price) : parseFloat(row.price),
    position: row.position !== undefined && row.position !== null ? parseInt(row.position, 10) : 0
  };
}

function mapOrder(row: any): Order {
  return {
    id: row.id,
    userId: row.user_id,
    guestDeviceId: row.guest_device_id,
    clientName: row.client_name,
    clientNip: row.client_nip,
    clientEmail: row.client_email,
    clientPhone: row.client_phone,
    comments: row.comments || '',
    totalValue: parseFloat(row.total_value),
    status: row.status as Order['status'],
    items: typeof row.items === 'string' ? JSON.parse(row.items) : row.items,
    createdAt: toUtcIsoString(row.created_at)
  };
}

function mapTrackingEvent(row: any): TrackingEvent {
  return {
    id: row.id,
    deviceId: row.device_id,
    userId: row.user_id,
    eventType: row.event_type as TrackingEvent['eventType'],
    offerSlug: row.offer_slug,
    payload: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
    createdAt: toUtcIsoString(row.created_at)
  };
}

// Unified Async Database API
export const db = {
  users: {
    findMany: async (): Promise<B2BUser[]> => {
      const sql = getSql();
      if (sql) {
        const rows = await sql`SELECT * FROM b2b_users`;
        return rows.map(mapUser);
      }
      return readDb().users;
    },
    findByEmail: async (email: string): Promise<B2BUser | null> => {
      const sql = getSql();
      if (sql) {
        const rows = await sql`SELECT * FROM b2b_users WHERE LOWER(email) = LOWER(${email}) LIMIT 1`;
        return rows.length > 0 ? mapUser(rows[0]) : null;
      }
      return readDb().users.find(u => u.email?.toLowerCase() === email.toLowerCase()) || null;
    },
    findByClientId: async (clientId: string): Promise<B2BUser | null> => {
      const sql = getSql();
      if (sql) {
        try {
          const rows = await sql`SELECT * FROM b2b_users WHERE LOWER(client_id) = LOWER(${clientId}) LIMIT 1`;
          return rows.length > 0 ? mapUser(rows[0]) : null;
        } catch {
          // client_id column may not exist in current schema — fall back to email
          const rows = await sql`SELECT * FROM b2b_users WHERE LOWER(email) = LOWER(${clientId}) LIMIT 1`;
          return rows.length > 0 ? mapUser(rows[0]) : null;
        }
      }
      return readDb().users.find(u => (u.clientId || '').toLowerCase() === clientId.toLowerCase()) || null;
    },
    findBySetupToken: async (token: string): Promise<B2BUser | null> => {
      const sql = getSql();
      if (sql) {
        const rows = await sql`SELECT * FROM b2b_users WHERE setup_token = ${token} LIMIT 1`;
        return rows.length > 0 ? mapUser(rows[0]) : null;
      }
      return readDb().users.find(u => u.setupToken === token) || null;
    },
    findById: async (id: string): Promise<B2BUser | null> => {
      const sql = getSql();
      if (sql) {
        const rows = await sql`SELECT * FROM b2b_users WHERE id = ${id} LIMIT 1`;
        return rows.length > 0 ? mapUser(rows[0]) : null;
      }
      return readDb().users.find(u => u.id === id) || null;
    },
    create: async (user: Omit<B2BUser, 'id'>): Promise<B2BUser> => {
      const id = `user-${Date.now()}`;
      const sql = getSql();
      if (sql) {
        await sql`
          INSERT INTO b2b_users (id, email, password_hash, company_name, nip, discount_rate, role)
          VALUES (${id}, ${user.email}, ${user.passwordHash}, ${user.companyName}, ${user.nip}, ${user.discountRate}, ${user.role})
        `;
        return { ...user, id };
      }
      const current = readDb();
      const newUser = { ...user, id };
      current.users.push(newUser);
      writeDb(current);
      return newUser;
    },
    update: async (id: string, updates: Partial<B2BUser>): Promise<B2BUser | null> => {
      const sql = getSql();
      if (sql) {
        const existing = await db.users.findById(id);
        if (!existing) return null;
        const merged = { ...existing, ...updates };
        await sql`
          UPDATE b2b_users 
          SET email = ${merged.email}, password_hash = ${merged.passwordHash}, 
              company_name = ${merged.companyName}, nip = ${merged.nip}, 
              discount_rate = ${merged.discountRate}, role = ${merged.role},
              client_id = ${merged.clientId || merged.email},
              phone = ${merged.phone || ''},
              setup_token = ${merged.setupToken || null},
              setup_complete = ${merged.setupComplete ? 1 : 0}
          WHERE id = ${id}
        `;
        return merged;
      }
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
    findMany: async (): Promise<Offer[]> => {
      const sql = getSql();
      if (sql) {
        const rows = await sql`SELECT * FROM offers ORDER BY created_at DESC`;
        return rows.map(mapOffer);
      }
      return readDb().offers;
    },
    findBySlug: async (slug: string): Promise<Offer | null> => {
      const sql = getSql();
      if (sql) {
        const rows = await sql`SELECT * FROM offers WHERE slug = ${slug} LIMIT 1`;
        return rows.length > 0 ? mapOffer(rows[0]) : null;
      }
      return readDb().offers.find(o => o.slug === slug) || null;
    },
    create: async (offer: Omit<Offer, 'id' | 'createdAt'>): Promise<Offer> => {
      const id = `offer-${Date.now()}`;
      const createdAt = new Date().toISOString();
      const sql = getSql();
      if (sql) {
        await sql`
          INSERT INTO offers (id, title, slug, is_active, created_at)
          VALUES (${id}, ${offer.title}, ${offer.slug}, ${offer.isActive}, ${createdAt})
        `;
        return { ...offer, id, createdAt };
      }
      const current = readDb();
      const newOffer = { ...offer, id, createdAt };
      current.offers.push(newOffer);
      writeDb(current);
      return newOffer;
    },
    update: async (id: string, updates: Partial<Offer>): Promise<Offer | null> => {
      const sql = getSql();
      if (sql) {
        const existing = await sql`SELECT * FROM offers WHERE id = ${id} LIMIT 1`;
        if (existing.length === 0) return null;
        const merged = { ...mapOffer(existing[0]), ...updates };
        await sql`
          UPDATE offers 
          SET title = ${merged.title}, slug = ${merged.slug}, is_active = ${merged.isActive}
          WHERE id = ${id}
        `;
        return merged;
      }
      const current = readDb();
      const index = current.offers.findIndex(o => o.id === id);
      if (index !== -1) {
        current.offers[index] = { ...current.offers[index], ...updates };
        writeDb(current);
        return current.offers[index];
      }
      return null;
    },
    delete: async (id: string): Promise<void> => {
      const sql = getSql();
      if (sql) {
        await sql`DELETE FROM offers WHERE id = ${id}`;
        return;
      }
      const current = readDb();
      current.offers = current.offers.filter(o => o.id !== id);
      writeDb(current);
    },
    findFeatured: async (): Promise<Offer | null> => {
      const sql = getSql();
      if (sql) {
        try {
          const rows = await sql`SELECT * FROM offers WHERE is_featured = true LIMIT 1`;
          if (rows.length > 0) return mapOffer(rows[0]);
        } catch {
          // is_featured column may not exist yet in Neon — fall through
        }
        // fall back to most recent active offer
        const recent = await sql`SELECT * FROM offers WHERE is_active = true ORDER BY created_at DESC LIMIT 1`;
        return recent.length > 0 ? mapOffer(recent[0]) : null;
      }
      const all = readDb().offers;
      return all.find(o => (o as any).isFeatured) || all.filter(o => o.isActive).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] || null;
    },
    setFeatured: async (id: string): Promise<void> => {
      const sql = getSql();
      if (sql) {
        try {
          await sql`UPDATE offers SET is_featured = false`;
          await sql`UPDATE offers SET is_featured = true WHERE id = ${id}`;
        } catch {
          await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false`;
          await sql`UPDATE offers SET is_featured = false`;
          await sql`UPDATE offers SET is_featured = true WHERE id = ${id}`;
        }
        return;
      }
      const current = readDb();
      current.offers = current.offers.map(o => ({ ...o, isFeatured: o.id === id }));
      writeDb(current);
    },
    updateOrderSettings: async (id: string, orderMode: 'panel' | 'email', orderEmail: string): Promise<void> => {
      const sql = getSql();
      if (sql) {
        try {
          await sql`UPDATE offers SET order_mode = ${orderMode}, order_email = ${orderEmail} WHERE id = ${id}`;
        } catch {
          await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS order_mode VARCHAR(10) DEFAULT 'panel'`;
          await sql`ALTER TABLE offers ADD COLUMN IF NOT EXISTS order_email TEXT DEFAULT ''`;
          await sql`UPDATE offers SET order_mode = ${orderMode}, order_email = ${orderEmail} WHERE id = ${id}`;
        }
        return;
      }
      const current = readDb();
      current.offers = current.offers.map(o => o.id === id ? { ...o, orderMode, orderEmail } : o);
      writeDb(current);
    }
  },
  products: {
    findMany: async (): Promise<Product[]> => {
      const sql = getSql();
      if (sql) {
        const rows = await sql`SELECT * FROM products`;
        return rows.map(mapProduct);
      }
      return readDb().products;
    },
    findByOfferId: async (offerId: string): Promise<Product[]> => {
      const sql = getSql();
      if (sql) {
        const rows = await sql`SELECT * FROM products WHERE offer_id = ${offerId} ORDER BY position ASC, id ASC`;
        return rows.map(mapProduct);
      }
      return readDb().products.filter(p => p.offerId === offerId);
    },
    createMany: async (newProducts: Omit<Product, 'id'>[]): Promise<Product[]> => {
      const sql = getSql();
      const addedProducts: Product[] = [];
      
      if (sql) {
        if (newProducts.length === 0) return [];
        
        const values: any[] = [];
        const placeholders: string[] = [];
        let index = 1;
        
        newProducts.forEach((p, i) => {
          const id = `prod-${Date.now()}-${String(i).padStart(6, '0')}`;
          placeholders.push(`($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4}, $${index + 5}, $${index + 6}, $${index + 7}, $${index + 8}, $${index + 9}, $${index + 10}, $${index + 11}, $${index + 12}, $${index + 13})`);
          values.push(
            id,
            p.offerId,
            p.sku,
            p.ean,
            p.category || 'Zabawki',
            p.name,
            p.price,
            p.imageUrl,
            p.packaging,
            p.stock,
            p.description || null,
            p.age || null,
            p.discountRate || 0,
            p.originalPrice || p.price
          );
          addedProducts.push({ ...p, id, discountRate: p.discountRate || 0, originalPrice: p.originalPrice || p.price });
          index += 14;
        });
        
        const query = `
          INSERT INTO products (id, offer_id, sku, ean, category, name, price, image_url, packaging, stock, description, age, discount_rate, original_price)
          VALUES ${placeholders.join(', ')}
        `;
        
        await sql.query(query, values);
        return addedProducts;
      }
      
      const current = readDb();
      newProducts.forEach((p, index) => {
        const prod = { 
          ...p, 
          id: `prod-${Date.now()}-${String(index).padStart(6, '0')}`,
          discountRate: p.discountRate || 0,
          originalPrice: p.originalPrice || p.price
        };
        current.products.push(prod);
        addedProducts.push(prod);
      });
      writeDb(current);
       return addedProducts;
    },
    updateManyPositionsAndCategories: async (items: Array<{ id: string; category: string; position: number }>): Promise<void> => {
      if (items.length === 0) return;
      const sql = getSql();
      if (sql) {
        const ids = items.map(x => x.id);
        const categories = items.map(x => x.category);
        const positions = items.map(x => x.position);
        await sql`
          UPDATE products AS p
          SET 
            category = u.cat,
            position = u.pos::int
          FROM UNNEST(${ids}::text[], ${categories}::text[], ${positions}::int[]) AS u(id, cat, pos)
          WHERE p.id = u.id
        `;
        return;
      }
      const current = readDb();
      items.forEach(item => {
        const idx = current.products.findIndex(p => p.id === item.id);
        if (idx !== -1) {
          current.products[idx].category = item.category;
          current.products[idx].position = item.position;
        }
      });
      writeDb(current);
    },
    update: async (id: string, updates: Partial<Product>): Promise<Product | null> => {
      const sql = getSql();
      if (sql) {
        const rows = await sql`SELECT * FROM products WHERE id = ${id} LIMIT 1`;
        if (rows.length === 0) return null;
        const merged = { ...mapProduct(rows[0]), ...updates };
        await sql`
          UPDATE products
          SET offer_id = ${merged.offerId}, sku = ${merged.sku}, ean = ${merged.ean},
              category = ${merged.category || 'Zabawki'}, name = ${merged.name},
              price = ${merged.price}, image_url = ${merged.imageUrl},
              packaging = ${merged.packaging}, stock = ${merged.stock},
              description = ${merged.description || null}, age = ${merged.age || null},
              discount_rate = ${merged.discountRate || 0}, original_price = ${merged.originalPrice || merged.price},
              position = ${merged.position || 0}
          WHERE id = ${id}
        `;
        return merged;
      }
      const current = readDb();
      const index = current.products.findIndex(p => p.id === id);
      if (index !== -1) {
        current.products[index] = { ...current.products[index], ...updates };
        writeDb(current);
        return current.products[index];
      }
      return null;
    },
    deleteByOfferId: async (offerId: string): Promise<void> => {
      const sql = getSql();
      if (sql) {
        await sql`DELETE FROM products WHERE offer_id = ${offerId}`;
        return;
      }
      const current = readDb();
      current.products = current.products.filter(p => p.offerId !== offerId);
      writeDb(current);
    }
  },
  orders: {
    findMany: async (): Promise<Order[]> => {
      const sql = getSql();
      if (sql) {
        const rows = await sql`SELECT * FROM orders ORDER BY created_at DESC`;
        return rows.map(mapOrder);
      }
      return readDb().orders;
    },
    findByUserId: async (userId: string): Promise<Order[]> => {
      const sql = getSql();
      if (sql) {
        const rows = await sql`SELECT * FROM orders WHERE user_id = ${userId} ORDER BY created_at DESC`;
        return rows.map(mapOrder);
      }
      return readDb().orders.filter(o => o.userId === userId);
    },
    create: async (order: Omit<Order, 'id' | 'createdAt' | 'status'>): Promise<Order> => {
      const id = `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const createdAt = new Date().toISOString();
      const status: Order['status'] = 'new';
      const sql = getSql();
      
      if (sql) {
        await sql`
          INSERT INTO orders (id, user_id, guest_device_id, client_name, client_nip, client_email, client_phone, comments, total_value, status, items, created_at)
          VALUES (${id}, ${order.userId}, ${order.guestDeviceId}, ${order.clientName}, ${order.clientNip}, ${order.clientEmail}, ${order.clientPhone}, ${order.comments}, ${order.totalValue}, ${status}, ${JSON.stringify(order.items)}, ${createdAt})
        `;
        return { ...order, id, createdAt, status };
      }
      
      const current = readDb();
      const newOrder: Order = {
        ...order,
        id,
        status,
        createdAt
      };
      current.orders.push(newOrder);
      writeDb(current);
      return newOrder;
    },
    updateStatus: async (id: string, status: Order['status']): Promise<Order | null> => {
      const sql = getSql();
      if (sql) {
        const rows = await sql`SELECT * FROM orders WHERE id = ${id} LIMIT 1`;
        if (rows.length === 0) return null;
        const merged = mapOrder(rows[0]);
        merged.status = status;
        await sql`UPDATE orders SET status = ${status} WHERE id = ${id}`;
        return merged;
      }
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
    findMany: async (): Promise<TrackingEvent[]> => {
      const sql = getSql();
      if (sql) {
        const rows = await sql`SELECT * FROM tracking_events ORDER BY created_at DESC`;
        return rows.map(mapTrackingEvent);
      }
      return readDb().trackingEvents;
    },
    create: async (event: Omit<TrackingEvent, 'id' | 'createdAt'>): Promise<TrackingEvent> => {
      const id = `evt-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const createdAt = new Date().toISOString();
      const sql = getSql();
      
      if (sql) {
        await sql`
          INSERT INTO tracking_events (id, device_id, user_id, event_type, offer_slug, payload, created_at)
          VALUES (${id}, ${event.deviceId}, ${event.userId}, ${event.eventType}, ${event.offerSlug}, ${JSON.stringify(event.payload)}, ${createdAt})
        `;
        return { ...event, id, createdAt };
      }
      
      const current = readDb();
      const newEvent: TrackingEvent = {
        ...event,
        id,
        createdAt
      };
      current.trackingEvents.push(newEvent);
      writeDb(current);
      return newEvent;
    }
  }
};
