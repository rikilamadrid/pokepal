import type { Metadata, Viewport } from "next";
import { Lilita_One, Space_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { CollectionProvider } from "@/hooks/useCollection";
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
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <CollectionProvider>{children}</CollectionProvider>
        <Toaster position="top-center" />
      </body>
    </html>
  );
}
