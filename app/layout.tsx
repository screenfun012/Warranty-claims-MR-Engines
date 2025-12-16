import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

import { MainLayout } from "@/components/layout/MainLayout";
import { IdleSyncStarter } from "@/components/IdleSyncStarter";

export const metadata: Metadata = {
  title: "MR Engines – Warranty Claims",
  description: "Warranty claims management system for MR Engines",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <IdleSyncStarter />
        <MainLayout>{children}</MainLayout>
      </body>
    </html>
  );
}
