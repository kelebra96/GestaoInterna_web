import type { Metadata, Viewport } from "next";
import { Inter, Roboto_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { LayoutWrapper } from "@/components/LayoutWrapper";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MyInventory - Dashboard",
  description: "Sistema de Gestão de Inventário",
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: '/icons/GestaoInternaIcon.png' },
      { url: '/icons/GestaoInternaIcon.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/GestaoInternaIcon.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/GestaoInternaIcon.png' },
      { url: '/icons/GestaoInternaIcon.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcut: '/icons/GestaoInternaIcon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MyInventory",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(() => { try { var t = localStorage.getItem('pref.theme') || 'system'; var el = document.documentElement; el.setAttribute('data-theme', t); } catch(e){} })();`,
          }}
        />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MyInventory" />
        <link rel="apple-touch-icon" href="/icons/GestaoInternaIcon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/icons/GestaoInternaIcon.png" />
        <link rel="apple-touch-startup-image" href="/icons/GestaoInternaIcon.png" />
      </head>
      <body className={`${inter.variable} ${robotoMono.variable} antialiased`}>
        <AuthProvider>
          <LayoutWrapper>
            {children}
          </LayoutWrapper>
        </AuthProvider>
      </body>
    </html>
  );
}
