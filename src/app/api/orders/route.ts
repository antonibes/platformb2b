import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

import os from 'os';

export const dynamic = 'force-dynamic';

// Local backup path for generated CSV files
const EXPORT_DIR = path.join(os.tmpdir(), 'orders_export');

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      userId,
      guestDeviceId,
      clientName,
      clientNip,
      clientEmail,
      clientPhone,
      comments,
      items
    } = body;

    if (!clientName || !clientEmail || !items || items.length === 0) {
      return NextResponse.json({ error: 'Brakujące wymagane dane zamówienia' }, { status: 400 });
    }

    // Calculate total value
    const totalValue = items.reduce((sum: number, item: any) => sum + (item.price * item.quantity), 0);

    // Save order in database
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

    // Generate B2B CSV content (Semicolon-separated values, standard for Polish Excel)
    let csvContent = '\uFEFF'; // Add BOM for Excel UTF-8 support
    csvContent += 'EAN;SKU;Nazwa;Cena;Ilosc;Wartosc\n';
    
    order.items.forEach((item) => {
      const lineVal = parseFloat((item.price * item.quantity).toFixed(2));
      // Escape semicolons and quotes in name
      const nameEscaped = item.name.replace(/"/g, '""');
      csvContent += `"${item.ean}";"${item.sku}";"${nameEscaped}";${item.price.toFixed(2).replace('.', ',')};${item.quantity};${lineVal.toFixed(2).replace('.', ',')}\n`;
    });

    // Ensure export directory exists
    if (!fs.existsSync(EXPORT_DIR)) {
      fs.mkdirSync(EXPORT_DIR, { recursive: true });
    }

    // Write CSV locally for record keeping
    const csvFilename = `${order.id}.csv`;
    const csvFilePath = path.join(EXPORT_DIR, csvFilename);
    fs.writeFileSync(csvFilePath, csvContent, 'utf-8');

    console.log(`[Order API] Order CSV created at: ${csvFilePath}`);

    // Try sending email
    let emailSent = false;
    let emailError = '';

    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpTo = process.env.SMTP_TO || 'zamowienia@askato.pl';

    if (smtpHost && smtpUser) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: parseInt(smtpPort || '587'),
          secure: parseInt(smtpPort || '587') === 465,
          auth: {
            user: smtpUser,
            pass: smtpPass
          }
        });

        const mailSubject = `[B2B ASKATO] Nowe zamówienie - ${order.clientName} (${order.id})`;
        const mailText = `
Wpłynęło nowe zamówienie z platformy B2B Askato.

Szczegóły Zamówienia:
ID Zamówienia: ${order.id}
Klient: ${order.clientName}
NIP: ${order.clientNip || 'Brak (Gość)'}
E-mail: ${order.clientEmail}
Telefon: ${order.clientPhone || 'Brak'}
Komentarz: ${order.comments || 'Brak'}
Wartość netto: ${order.totalValue.toFixed(2)} PLN
Data złożenia: ${new Date(order.createdAt).toLocaleString('pl-PL')}

W załączniku znajduje się plik CSV do zaczytania w systemie ERP.
        `;

        await transporter.sendMail({
          from: process.env.SMTP_FROM || smtpUser,
          to: [smtpTo, order.clientEmail], // Send to Askato orders inbox and copy the client
          subject: mailSubject,
          text: mailText,
          attachments: [
            {
              filename: `zamowienie_${order.id}.csv`,
              content: csvContent,
              contentType: 'text/csv; charset=utf-8'
            }
          ]
        });

        emailSent = true;
        console.log(`[Order API] Confirmation email sent successfully for ${order.id}`);
      } catch (err: any) {
        console.error('[Order API] Nodemailer failed to send email:', err);
        emailError = err.message || 'Error occurred in Nodemailer';
      }
    } else {
      console.log('[Order API] SMTP settings missing. Skipping email sending. CSV saved to disk.');
      emailError = 'SMTP credentials not configured. Order saved locally.';
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      csvFilename,
      emailSent,
      emailError: emailSent ? null : emailError,
      totalValue: order.totalValue
    });
  } catch (error) {
    console.error('Error submitting order:', error);
    return NextResponse.json({ error: 'Błąd serwera podczas składania zamówienia' }, { status: 500 });
  }
}
