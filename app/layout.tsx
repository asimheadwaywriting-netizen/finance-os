import type { Metadata } from "next";
import localFont from "next/font/local";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

// Main UI typeface — geometric sans matching the dashboard reference.
// Keeps the --font-geist-sans variable name so globals.css/tailwind need no change.
const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  weight: ["400", "500", "600", "700", "800"],
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Finance OS",
  description: "Personal finance dashboard for Asim",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark", sans.variable, geistMono.variable)}>
      <body
        className="antialiased min-h-screen bg-brand-bg"
      >
        {children}
      </body>
    </html>
  );
}
