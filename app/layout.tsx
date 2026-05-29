import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Nav } from "@/components/nav";
import { Toaster } from "@/components/ui/sonner";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Kash DataWorks",
  description: "Invoicing & Time Tracking",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geist.className} bg-background text-foreground min-h-screen`}>
        <Nav />
        <main className="max-w-6xl mx-auto px-4 py-8">{children}</main>
        <Toaster />
      </body>
    </html>
  );
}
