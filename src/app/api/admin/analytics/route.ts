import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  try {
    const events = await db.tracking.findMany();
    const orders = await db.orders.findMany();

    // 1. Basic counts
    const totalViews = events.filter(e => e.eventType === 'page_view').length;
    const uniqueDevicesSet = new Set(events.map(e => e.deviceId));
    const uniqueDevicesCount = uniqueDevicesSet.size;

    // 2. Revenue calculation
    const totalOrdersCount = orders.length;
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalValue, 0);

    // 3. Conversion rate
    const conversionRate = uniqueDevicesCount > 0 
      ? parseFloat(((totalOrdersCount / uniqueDevicesCount) * 100).toFixed(2)) 
      : 0;

    // 4. Popular products (by add_to_cart events)
    const productAddCounts: Record<string, { name: string; sku: string; count: number }> = {};
    events
      .filter(e => e.eventType === 'add_to_cart')
      .forEach(e => {
        const payload = e.payload || {};
        const productId = payload.productId;
        const name = payload.productName || 'Nieznany produkt';
        const sku = payload.productSku || '';
        
        if (productId) {
          if (!productAddCounts[productId]) {
            productAddCounts[productId] = { name, sku, count: 0 };
          }
          productAddCounts[productId].count += 1;
        }
      });

    const popularProducts = Object.values(productAddCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // 5. Abandoned carts analysis
    // Find devices that added to cart
    const addedToCartDevices = new Set(
      events.filter(e => e.eventType === 'add_to_cart').map(e => e.deviceId)
    );
    // Find devices that successfully checked out
    const checkedOutDevices = new Set(
      events.filter(e => e.eventType === 'csv_export' || e.eventType === 'email_order').map(e => e.deviceId)
    );
    
    // Devices with additions but no checkout
    const abandonedDevices = Array.from(addedToCartDevices).filter(d => !checkedOutDevices.has(d));
    
    const abandonedCarts = abandonedDevices.map(deviceId => {
      // Find latest add_to_cart events for this device to see what they left
      const deviceEvents = events
        .filter(e => e.deviceId === deviceId && e.eventType === 'add_to_cart')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Get last active timestamp
      const lastActive = deviceEvents[0]?.createdAt || new Date().toISOString();
      const offerSlug = deviceEvents[0]?.offerSlug || '';

      // Collect items (simplistic representation - items that were added)
      const itemsLeft = deviceEvents.map(e => ({
        name: e.payload?.productName || 'Produkt',
        sku: e.payload?.productSku || '',
        price: e.payload?.price || 0,
        quantity: e.payload?.quantity || 1
      }));

      return {
        deviceId,
        offerSlug,
        lastActive,
        itemsCount: itemsLeft.length,
        items: itemsLeft.slice(0, 3) // show first 3 items left
      };
    }).sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()).slice(0, 10);

    // 6. Recent activity timeline (last 20 events)
    const usersList = await db.users.findMany();
    const userMap = new Map(usersList.map(u => [u.id, u]));
    const recentEvents = [...events]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20)
      .map(e => {
        // Resolve user email if logged in
        let userIdentity = 'Niezalogowany';
        if (e.userId) {
          const user = userMap.get(e.userId);
          if (user) userIdentity = `${user.companyName} (${user.email})`;
        }
        return {
          ...e,
          userIdentity
        };
      });

    return NextResponse.json({
      summary: {
        totalViews,
        uniqueDevices: uniqueDevicesCount,
        totalOrders: totalOrdersCount,
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        conversionRate,
        abandonedCartsCount: abandonedCarts.length
      },
      popularProducts,
      abandonedCarts,
      recentEvents
    });
  } catch (error) {
    console.error('Error generating analytics:', error);
    return NextResponse.json({ error: 'Błąd serwera podczas ładowania analityki' }, { status: 500 });
  }
}
