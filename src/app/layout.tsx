import type { Metadata, Viewport } from "next";
import { Lilita_One, Space_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { CollectionProvider } from "@/hooks/useCollection";
import { AuthProvider } from "@/hooks/useAuth";
import { SyncProvider } from "@/hooks/useSync";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const lilita = Lilita_One({
  variable: "--font-display-lilita",
  weight: "400",
  subsets: ["latin"],
});

const spaceMono = Space_Mono({
  variable: "--font-mono-space",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PokéPal",
  description:
    "Scan your Pokémon cards, explore creatures, and keep track of your collection.",
  applicationName: "PokéPal",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "48x48", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
  },
  appleWebApp: {
    capable: true,
    title: "PokéPal",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#14151a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${lilita.variable} ${spaceMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Legacy iOS standalone flag — Next emits only the modern
            `mobile-web-app-capable`, but iOS still reads this one. */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ServiceWorkerRegistrar />
        <AuthProvider>
          <CollectionProvider>
            <SyncProvider>{children}</SyncProvider>
          </CollectionProvider>
        </AuthProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
