import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "Clinic OS",
  description:
    "Plateforme d'enablement du réseau d'audioprothèse — couche de renseignement ambiant pour audioprothésistes et assistants accueil.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full bg-surface text-ink">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
