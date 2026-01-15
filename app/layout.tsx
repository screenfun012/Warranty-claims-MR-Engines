import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

import { MainLayout } from "@/components/layout/MainLayout";
import { IdleSyncStarter } from "@/components/IdleSyncStarter";
import { QueryProvider } from "@/lib/providers/query-provider";
import { SessionProvider } from "@/lib/providers/session-provider";

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
        className={`${publicSans.variable} antialiased`}
      >
        <SessionProvider>
          <QueryProvider>
            <IdleSyncStarter />
            <MainLayout>{children}</MainLayout>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
