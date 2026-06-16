import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function sendAdminNotification(opts: {
  toEmail: string;
  offerTitle: string;
  orderId: string;
  clientName: string;
  clientNip: string;
  clientEmail: string;
  clientPhone: string;
  comments: string;
  totalValue: number;
  items: { sku: string; name: string; quantity: number; price: number }[];
  csvContent: string;
}) {
  const resendKey = process.env.RESEND_API_KEY;
  const smtpHost = process.env.SMTP_HOST;

  const rows = opts.items.map(i =>
    `<tr><td style="padding:6px 10px;border-bottom:1px solid #eee">${i.sku}</td><td style="padding:6px 10px;border-bottom:1px solid #eee">${i.name}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${i.quantity}</td><td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right">${(i.price * i.quantity).toFixed(2)} zł</td></tr>`
  ).join('');

  const html = `
<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#222">
  <div style="background:#1C60B0;padding:20px 28px;border-radius:12px 12px 0 0">
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
        <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0">SKU</th>
        <th style="padding:8px 10px;text-align:left;border-bottom:2px solid #e2e8f0">Nazwa</th>
        <th style="padding:8px 10px;text-align:center;border-bottom:2px solid #e2e8f0">Ilość</th>
        <th style="padding:8px 10px;text-align:right;border-bottom:2px solid #e2e8f0">Wartość</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr style="background:#f0f7ff">
        <td colspan="3" style="padding:10px;font-weight:bold;text-align:right">Razem netto:</td>
        <td style="padding:10px;font-weight:bold;text-align:right;color:#1C60B0">${opts.totalValue.toFixed(2)} zł</td>
      </tr></tfoot>
    </table>
    <a href="https://askato.vercel.app/admin" style="display:inline-block;background:#1C60B0;color:#fff;text-decoration:none;padding:10px 20px;border-radius:8px;font-size:13px;font-weight:bold">Otwórz panel admina →</a>
    <p style="margin-top:16px;font-size:11px;color:#999">CSV z zamówieniem jest w załączniku.</p>
  </div>
</div>`;

  const csvBase64 = Buffer.from(opts.csvContent, 'utf-8').toString('base64');

  // Try Resend first (no package needed — just fetch)
  if (resendKey) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Askato B2B <b2b@askato.pl>',
        to: [opts.toEmail],
        subject: `Nowe zamówienie B2B – ${opts.clientName}`,
        html,
        attachments: [{ filename: `zamowienie_${opts.orderId}.csv`, content: csvBase64 }]
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Resend error: ${JSON.stringify(err)}`);
    }
    return;
  }

  // Fallback: SMTP via nodemailer (if configured)
  if (smtpHost && process.env.SMTP_USER) {
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: smtpHost,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: parseInt(process.env.SMTP_PORT || '587') === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: opts.toEmail,
      subject: `Nowe zamówienie B2B – ${opts.clientName}`,
      html,
      attachments: [{ filename: `zamowienie_${opts.orderId}.csv`, content: opts.csvContent, contentType: 'text/csv; charset=utf-8' }]
    });
  }
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

    // Send admin notification email
    let emailSent = false;
    try {
      // Priority: 1. per-offer email  2. NOTIFY_EMAIL env  3. SMTP_TO env
      let notifyEmail = process.env.NOTIFY_EMAIL || process.env.SMTP_TO || '';
      let offerTitle = offerSlug || 'Askato B2B';

      if (offerSlug) {
        const offer = await db.offers.findBySlug(offerSlug).catch(() => null);
        if (offer) {
          offerTitle = offer.title;
          const perOfferEmail = offer.orderEmail?.trim();
          if (perOfferEmail) notifyEmail = perOfferEmail;
        }
      }

      console.log(`[Order API] Sending notification to="${notifyEmail}" offer="${offerTitle}" resend=${!!process.env.RESEND_API_KEY}`);

      if (notifyEmail) {
        await sendAdminNotification({
          toEmail: notifyEmail,
          offerTitle,
          orderId: order.id,
          clientName,
          clientNip: clientNip || '',
          clientEmail,
          clientPhone: clientPhone || '',
          comments: comments || '',
          totalValue: order.totalValue,
          items: order.items.map(i => ({ sku: i.sku, name: i.name, quantity: i.quantity, price: i.price })),
          csvContent
        });
        emailSent = true;
        console.log(`[Order API] Email sent OK to ${notifyEmail}`);
      } else {
        console.log('[Order API] No notification email configured — skipping');
      }
    } catch (emailErr: any) {
      console.error('[Order API] Email notification failed:', emailErr?.message || emailErr);
    }

    return NextResponse.json({ success: true, orderId: order.id, emailSent, totalValue: order.totalValue });
  } catch (error) {
    console.error('Error submitting order:', error);
    return NextResponse.json({ error: 'Błąd serwera podczas składania zamówienia' }, { status: 500 });
  }
}
