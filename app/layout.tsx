import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
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
      <body className={`${fontDisplay.variable} ${fontUi.variable} font-(family-name:--font-ui)`}>
        {children}
        <footer className="border-t border-white/10 bg-[#050d34] text-white/75">
          <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="inline-flex items-center">
                <Image
                  src="/branding/logo_blanco.png"
                  alt="Proxima"
                  width={196}
                  height={50}
                  className="h-auto w-37.5 sm:w-49"
                  style={{ width: "auto", height: "auto" }}
                />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Legal</p>
                <div className="mt-2 flex flex-col gap-1 text-sm">
                  <Link href="/legal/terminos-y-condiciones" className="text-white/80 transition hover:text-white">
                    Terminos y condiciones
                  </Link>
                  <Link href="/legal/politica-de-privacidad" className="text-white/80 transition hover:text-white">
                    Politica de privacidad
                  </Link>
                  <Link href="/legal/politica-de-cookies" className="text-white/80 transition hover:text-white">
                    Politica de cookies
                  </Link>
                  <Link href="/legal/aviso-legal-y-riesgos" className="text-white/80 transition hover:text-white">
                    Aviso legal y riesgos
                  </Link>
                </div>
              </div>
            </div>

            <p className="mt-6 text-xs text-white/45">
              © {new Date().getFullYear()} Proxima Financial Technology. Todos los derechos reservados.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
