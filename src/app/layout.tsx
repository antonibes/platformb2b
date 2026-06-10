import type { Metadata } from "next";
import { Sen } from "next/font/google";
import "./globals.css";

const sen = Sen({
  subsets: ["latin"],
  weight: ["400", "700", "800"],
  variable: "--font-sen",
});

export const metadata: Metadata = {
  title: "Platforma Hurtowa B2B - Askato Sp. z o.o.",
  description: "Nowoczesny panel zakupowy dla partnerów handlowych Askato. Zamawiaj hurtowo, eksportuj do CSV, pobieraj faktury i śledź oferty w jednym miejscu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body
        className={`${sen.className} antialiased bg-slate-50 text-slate-900 min-h-screen`}
      >
        {children}
      </body>
    </html>
  );
}


