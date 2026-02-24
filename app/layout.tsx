import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../styles/globals.css";
import Sidebar from "@/components/Sidebar";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Doldadress - Ticket Management",
  description: "AI-powered customer support",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>
          <div className="min-h-screen bg-zinc-50 dark:bg-slate-900 text-zinc-900 dark:text-slate-100 flex">
            <Sidebar />
            <div className="lg:ml-64 flex flex-1 flex-col">
              <main className="px-4 py-4 pt-16 lg:pt-6 sm:px-6 lg:px-8 flex-1 page-transition">
                {children}
              </main>
            </div>
          </div>
        </Providers>
      </body>
    </html>
  );
}
