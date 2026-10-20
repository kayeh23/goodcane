import type { Metadata, Viewport } from "next";
import { Fredoka, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fredoka = Fredoka({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-fredoka" });

export const metadata: Metadata = {
  title: "GoodCane · Weekly pre-order (prototype)",
  description: "Pre-order GoodCane's fresh weekly batch of sugarcane and tigernut-coconut juice. Prototype with sample data.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fbf6ea" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GH" className={`${inter.variable} ${fredoka.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
