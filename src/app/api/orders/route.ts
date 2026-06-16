// Platforma B2B Askato Sp. z o.o. — wykonanie: Beśka (beska.org)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

const ADMIN_EMAIL = 'biuro@askato.pl';

async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: string }[];
}) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) throw new Error('RESEND_API_KEY not set');

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'Askato B2B <b2b@askato.pl>',
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      ...(opts.attachments ? { attachments: opts.attachments } : {})
    })
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Resend error: ${JSON.stringify(err)}`);
  }
}

function buildItemRows(items: { sku: string; name: string; quantity: number; price: number }[]) {
  return items.map(i =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px">${i.sku}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px">${i.name}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:center">${i.quantity} szt.</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right">${i.price.toFixed(2)} zł</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;font-size:13px;text-align:right;font-weight:600">${(i.price * i.quantity).toFixed(2)} zł</td>
    </tr>`
  ).join('');
}

function buildAdminHtml(opts: {
  offerTitle: string; orderId: string; clientName: string; clientNip: string;
  clientEmail: string; clientPhone: string; comments: string; totalValue: number;
  items: { sku: string; name: string; quantity: number; price: number }[];
}) {
  const rows = buildItemRows(opts.items);
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#222">
  <div style="background:#1C60B0;padding:22px 28px;border-radius:12px 12px 0 0">
    <h2 style="margin:0;color:#fff;font-size:20px">Nowe zamówienie B2B</h2>
    <p style="margin:4px 0 0;color:#b8d4f5;font-size:13px">${opts.offerTitle}</p>
  </div>
  <div style="background:#fff;border:1px solid #e2e8f0;border-top:0;padding:24px 28px;border-radius:0 0 12px 12px">
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:13px">
      <tr><td style="padding:4px 0;color:#666;width:140px">Firma:</td><td style="padding:4px 0;font-weight:bold">${opts.clientName}</td></tr>
      ${opts.clientNip ? `<tr><td style="padding:4px 0;color:#666">NIP:</td><td style="padding:4px 0">${opts.clientNip}</td></tr>` : ''}
      <tr><td style="padding:4px 0;color:#666">E-mail:</td><td style="padding:4px 0">${opts.clientEmail}</td></tr>
      ${opts.clientPhone ? `<tr><td style="padding:4px 0;color:#666">Telefon:</td><td style="padding:4px 0">${opts.clientPhone}</td></tr>` : ''}
      ${opts.comments ? `<tr><td style="padding:4px 0;color:#666">Uwagi:</td><td style="padding:4px 0">${opts.comments}</td></tr>` : ''}
      <tr><td style="padding:4px 0;color:#666">Nr zamówienia:</td><td style="padding:4px 0;font-family:monospace;font-size:12px">${opts.orderId}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">SKU</th>
        <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Nazwa</th>
        <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0">Ilość</th>
        <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e2e8f0">Cena jedn.</th>
        <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e2e8f0">Wartość</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:#f0f7ff">
        <td colspan="4" style="padding:10px 12px;font-weight:bold;text-align:right">Razem netto:</td>
        <td style="padding:10px 12px;font-weight:bold;text-align:right;color:#1C60B0;font-size:15px">${opts.totalValue.toFixed(2)} zł</td>
      </tr></tfoot>
    </table>
    <a href="https://askato.vercel.app/admin" style="display:inline-block;background:#1C60B0;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:bold">Otwórz panel admina →</a>
    <p style="margin-top:16px;font-size:11px;color:#999">CSV z zamówieniem jest w załączniku.</p>
  </div>
</div>`;
}

function buildClientHtml(opts: {
  offerTitle: string; orderId: string; clientName: string;
  totalValue: number;
  items: { sku: string; name: string; quantity: number; price: number }[];
}) {
  const rows = buildItemRows(opts.items);
  const shortId = opts.orderId.slice(0, 8).toUpperCase();
  return `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#222">
  <div style="background:#1C60B0;padding:22px 28px;border-radius:12px 12px 0 0">
    <h2 style="margin:0;color:#fff;font-size:20px">Potwierdzenie zamówienia</h2>
    <p style="margin:4px 0 0;color:#b8d4f5;font-size:13px">Nr ref.: ${shortId}</p>
  </div>
  <div style="background:#fff;border:1px solid #e2e8f0;border-top:0;padding:24px 28px;border-radius:0 0 12px 12px">
    <p style="font-size:15px;margin-top:0">Dziękujemy, <strong>${opts.clientName}</strong>!</p>
    <p style="font-size:13px;color:#444;margin-top:0">Twoje zamówienie z oferty <strong>${opts.offerTitle}</strong> zostało przyjęte. Nasz zespół skontaktuje się z Tobą w celu potwierdzenia szczegółów.</p>

    <table style="width:100%;border-collapse:collapse;font-size:13px;margin:20px 0">
      <thead><tr style="background:#f8fafc">
        <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">SKU</th>
        <th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e2e8f0">Nazwa</th>
        <th style="padding:8px 12px;text-align:center;border-bottom:2px solid #e2e8f0">Ilość</th>
        <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e2e8f0">Cena jedn.</th>
        <th style="padding:8px 12px;text-align:right;border-bottom:2px solid #e2e8f0">Wartość</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:#f0f7ff">
        <td colspan="4" style="padding:10px 12px;font-weight:bold;text-align:right">Razem netto:</td>
        <td style="padding:10px 12px;font-weight:bold;text-align:right;color:#1C60B0;font-size:15px">${opts.totalValue.toFixed(2)} zł</td>
      </tr></tfoot>
    </table>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;font-size:12px;color:#555;margin-top:8px">
      <p style="margin:0 0 4px">W razie pytań skontaktuj się z nami:</p>
      <p style="margin:0"><strong>biuro@askato.pl</strong></p>
    </div>

    <p style="margin-top:20px;font-size:11px;color:#aaa">Wiadomość wygenerowana automatycznie przez platformę B2B Askato Sp. z o.o.</p>
    <p style="margin-top:4px;font-size:9px;color:#ccc">Powered by <a href="https://beska.org" style="color:#ccc;text-decoration:none">Beśka</a></p>
  </div>
</div>`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { offerSlug, userId, guestDeviceId, clientName, clientNip, clientEmail, clientPhone, comments, items } = body;

    if (!clientName || !clientEmail || !items || items.length === 0) {
      return NextResponse.json({ error: 'Brakujące wymagane dane zamówienia' }, { status: 400 });
    }

    const totalValue = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

    const order = await db.orders.create({
      userId: userId || null,
      guestDeviceId: guestDeviceId || null,
      clientName,
      clientNip: clientNip || '',
      clientEmail,
      clientPhone: clientPhone || '',
      comments: comments || '',
      totalValue: parseFloat(totalValue.toFixed(2)),
      items: items.map((item: any) => ({
        productId: item.id,
        sku: item.sku,
        ean: item.ean,
        name: item.name,
        quantity: item.quantity,
        price: item.price
      }))
    });

    // Build CSV
    let csvContent = '﻿';
    csvContent += 'EAN;SKU;Nazwa;Cena;Ilosc;Wartosc\n';
    order.items.forEach((item) => {
      const lineVal = (item.price * item.quantity).toFixed(2);
      const nameEscaped = item.name.replace(/"/g, '""');
      csvContent += `"${item.ean}";"${item.sku}";"${nameEscaped}";${item.price.toFixed(2).replace('.', ',')};${item.quantity};${lineVal.replace('.', ',')}\n`;
    });

    // Resolve offer info
    let offerTitle = offerSlug || 'Askato B2B';
    let notifyEmail = process.env.NOTIFY_EMAIL || ADMIN_EMAIL;
    if (offerSlug) {
      const offer = await db.offers.findBySlug(offerSlug).catch(() => null);
      if (offer) {
        offerTitle = offer.title;
        const perOfferEmail = offer.orderEmail?.trim();
        if (perOfferEmail) notifyEmail = perOfferEmail;
      }
    }

    const itemsForEmail = order.items.map(i => ({ sku: i.sku, name: i.name, quantity: i.quantity, price: i.price }));
    const csvBase64 = Buffer.from(csvContent, 'utf-8').toString('base64');

    // Send both emails and wait for them (serverless functions terminate after response)
    await Promise.allSettled([
      sendEmail({
        to: notifyEmail,
        subject: `Nowe zamówienie B2B – ${clientName}`,
        html: buildAdminHtml({ offerTitle, orderId: order.id, clientName, clientNip: clientNip || '', clientEmail, clientPhone: clientPhone || '', comments: comments || '', totalValue: order.totalValue, items: itemsForEmail }),
        attachments: [{ filename: `zamowienie_${order.id}.csv`, content: csvBase64 }]
      }).then(() => console.log(`[Order API] Admin email sent to ${notifyEmail}`))
        .catch((e: any) => console.error('[Order API] Admin email failed:', e?.message)),

      sendEmail({
        to: clientEmail,
        subject: `Potwierdzenie zamówienia – ${offerTitle}`,
        html: buildClientHtml({ offerTitle, orderId: order.id, clientName, totalValue: order.totalValue, items: itemsForEmail })
      }).then(() => console.log(`[Order API] Client confirmation sent to ${clientEmail}`))
        .catch((e: any) => console.error('[Order API] Client email failed:', e?.message))
    ]);

    return NextResponse.json({ success: true, orderId: order.id, totalValue: order.totalValue });
  } catch (error) {
    console.error('Error submitting order:', error);
    return NextResponse.json({ error: 'Błąd serwera podczas składania zamówienia' }, { status: 500 });
  }
}
