import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "会計 - kaikei",
  description: "社内用会計管理システム",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
