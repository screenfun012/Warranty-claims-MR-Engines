import type { Metadata } from "next";
import { Public_Sans } from "next/font/google";
import "./globals.css";
import { cookies } from "next/headers";

const publicSans = Public_Sans({
  variable: "--font-public-sans",
  subsets: ["latin"],
  display: "swap",
});

import { MainLayout } from "@/components/layout/MainLayout";
import { IdleSyncStarter } from "@/components/IdleSyncStarter";
import { QueryProvider } from "@/lib/providers/query-provider";
import { SessionProvider } from "@/lib/providers/session-provider";
import { IntlProvider } from "@/lib/providers/intl-provider";
import { defaultLocale, locales, type Locale } from "@/i18n/config";

export const metadata: Metadata = {
  title: "MR Engines – Warranty Claims",
  description: "Warranty claims management system for MR Engines",
};

async function getMessages(locale: Locale) {
  try {
    return (await import(`../messages/${locale}.json`)).default;
  } catch {
    return (await import(`../messages/${defaultLocale}.json`)).default;
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const localeCookie = cookieStore.get('locale')?.value;
  const locale: Locale = locales.includes(localeCookie as Locale) 
    ? (localeCookie as Locale) 
    : defaultLocale;
  
  const messages = await getMessages(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                  const initialTheme = theme || systemTheme;
                  if (initialTheme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${publicSans.variable} antialiased`}
      >
        <SessionProvider>
          <QueryProvider>
            <IntlProvider locale={locale} messages={messages}>
              <IdleSyncStarter />
              <MainLayout>{children}</MainLayout>
            </IntlProvider>
          </QueryProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
