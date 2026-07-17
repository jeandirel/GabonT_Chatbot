import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moov Assist",
  description: "Assistant financier intelligent de Moov Africa Gabon",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
