import type { Metadata, Viewport } from "next";
import { Inter } from 'next/font/google'
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import Script from "next/script";
// import StickyHeader from '@/components/StickyHeader';

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: "PACMC Financial Management System",
  description: "Church Youth Fellowship Financial Management Platform - Income and Expense Records, Chart Analysis, Report Export",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PACMC Finance",
  },
  icons: {
    icon: "/pacmc.jpg",
    apple: "/pacmc.jpg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#3b82f6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh">
      <head>
        <meta name="application-name" content="PACMC Finance" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="PACMC Finance" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="msapplication-TileColor" content="#3b82f6" />
        <meta name="msapplication-tap-highlight" content="no" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          {/* StickyHeader 已移除，保留各页面自有header */}
          <div className="pt-2 sm:pt-4">
            {children}
          </div>
        </AuthProvider>
        
        {/* Service Worker Unregistration */}
        <Script
          id="sw-unregister"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(function(registrations) {
                  for(let registration of registrations) {
                    registration.unregister();
                  }
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
