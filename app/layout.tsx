import type { Metadata } from "next";
import { Oxanium, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const fontDisplay = Oxanium({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800"],
});

const fontUi = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-ui",
  weight: ["400", "500", "600", "700", "800"],
});

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
      <body className={`${fontDisplay.variable} ${fontUi.variable} font-[family-name:var(--font-ui)]`}>
        {children}
      </body>
    </html>
  );
}
