import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Proxima | Mercado de Predicciones",
  description: "Plataforma de mercado de predicciones para Republica Dominicana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
