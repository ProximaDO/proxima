import Image from "next/image";
import Link from "next/link";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#040b2f] text-white">
      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[#07123b]/85 backdrop-blur sm:sticky">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
          <Link href="/" className="inline-flex items-center gap-3">
            <Image
              src="/branding/logo_blanco.png"
              alt="Proxima"
              width={164}
              height={42}
              className="h-auto w-32 sm:w-41"
              style={{ width: "auto", height: "auto" }}
              priority
            />
          </Link>

          <div className="flex items-center gap-1.5 sm:gap-2">
            <Link
              href="/"
              aria-label="Ir al inicio"
              title="Inicio"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/85 transition hover:bg-white/10 sm:h-auto sm:w-auto sm:px-4 sm:py-2 sm:text-sm sm:font-bold"
            >
              <span className="sm:hidden" aria-hidden="true">🏠</span>
              <span className="hidden sm:inline">Inicio</span>
            </Link>
            <Link
              href="/admin"
              aria-label="Ir al panel admin"
              title="Admin"
              className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/85 transition hover:bg-white/10 sm:h-auto sm:w-auto sm:px-4 sm:py-2 sm:text-sm sm:font-bold"
            >
              <span className="sm:hidden" aria-hidden="true">🛠️</span>
              <span className="hidden sm:inline">Admin</span>
            </Link>
          </div>
        </div>
      </header>

      <div className="mt-24 sm:mt-0">{children}</div>
    </div>
  );
}
