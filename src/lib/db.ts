import fs from 'fs';
import path from 'path';
import { neon } from '@neondatabase/serverless';

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
  age?: string;
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
function mapUser(row: any): B2BUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    companyName: row.company_name,
    nip: row.nip,
    discountRate: parseFloat(row.discount_rate),
    role: row.role as 'admin' | 'client'
  };
}

function mapOffer(row: any): Offer {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    isActive: !!row.is_active,
    createdAt: new Date(row.created_at).toISOString()
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
    age: row.age || undefined
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
    createdAt: new Date(row.created_at).toISOString()
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
    createdAt: new Date(row.created_at).toISOString()
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
      return readDb().users.find(u => u.email.toLowerCase() === email.toLowerCase()) || null;
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
              discount_rate = ${merged.discountRate}, role = ${merged.role}
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
          VALUES (${id}, ${offer.title}, ${offer.slug}, ${offer.isActive}, ${new Date(createdAt)})
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
        const rows = await sql`SELECT * FROM products WHERE offer_id = ${offerId} ORDER BY name ASC`;
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
          const id = `prod-${Date.now()}-${i}`;
          placeholders.push(`($${index}, $${index + 1}, $${index + 2}, $${index + 3}, $${index + 4}, $${index + 5}, $${index + 6}, $${index + 7}, $${index + 8}, $${index + 9}, $${index + 10}, $${index + 11})`);
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
            p.age || null
          );
          addedProducts.push({ ...p, id });
          index += 12;
        });
        
        const query = `
          INSERT INTO products (id, offer_id, sku, ean, category, name, price, image_url, packaging, stock, description, age)
          VALUES ${placeholders.join(', ')}
        `;
        
        await sql.query(query, values);
        return addedProducts;
      }
      
      const current = readDb();
      newProducts.forEach((p, index) => {
        const prod = { ...p, id: `prod-${Date.now()}-${index}` };
        current.products.push(prod);
        addedProducts.push(prod);
      });
      writeDb(current);
      return addedProducts;
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
              description = ${merged.description || null}, age = ${merged.age || null}
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
          VALUES (${id}, ${order.userId}, ${order.guestDeviceId}, ${order.clientName}, ${order.clientNip}, ${order.clientEmail}, ${order.clientPhone}, ${order.comments}, ${order.totalValue}, ${status}, ${JSON.stringify(order.items)}, ${new Date(createdAt)})
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
          VALUES (${id}, ${event.deviceId}, ${event.userId}, ${event.eventType}, ${event.offerSlug}, ${JSON.stringify(event.payload)}, ${new Date(createdAt)})
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
