import { Manrope, Inter } from "next/font/google";
import "./globals.css";
import { Metadata } from "next";
import { LocationProvider } from "@/context/LocationContext";
import { StickyBanner } from "@/components/sticky-banner";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Lineo - Queue & Insights Hub",
  description: "Performance-driven queue management SaaS for elite service centers.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${inter.variable} h-full antialiased scroll-smooth`}>
      <body className="min-h-full flex flex-col font-body bg-surface text-on-surface">
        <script src="https://checkout.razorpay.com/v1/checkout.js" async></script>
        <LocationProvider>
          <StickyBanner />
          {children}
        </LocationProvider>
      </body>
    </html>
  );
}
