import Link from "next/link";

export const metadata = {
  title: "Legal | Proxima",
  description: "Documentos legales de Proxima Financial Technology.",
};

export default function LegalIndexPage() {
  return (
    <main className="min-h-screen bg-[#040b2f] text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <h1 className="font-(family-name:--font-display) text-4xl font-extrabold">Legal</h1>
        <p className="mt-3 text-white/75">Consulta nuestros documentos legales y politicas vigentes.</p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Link href="/legal/terminos-y-condiciones" className="rounded-xl border border-white/15 bg-white/4 px-4 py-3 transition hover:bg-white/8">
            Terminos y condiciones
          </Link>
          <Link href="/legal/politica-de-privacidad" className="rounded-xl border border-white/15 bg-white/4 px-4 py-3 transition hover:bg-white/8">
            Politica de privacidad
          </Link>
          <Link href="/legal/politica-de-cookies" className="rounded-xl border border-white/15 bg-white/4 px-4 py-3 transition hover:bg-white/8">
            Politica de cookies
          </Link>
          <Link href="/legal/aviso-legal-y-riesgos" className="rounded-xl border border-white/15 bg-white/4 px-4 py-3 transition hover:bg-white/8">
            Aviso legal y riesgos
          </Link>
        </div>
      </div>
    </main>
  );
}
