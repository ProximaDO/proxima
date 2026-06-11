import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/auth/actions";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#040b2f] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(255,106,65,0.22),transparent_38%),radial-gradient(circle_at_top_right,rgba(112,49,229,0.24),transparent_36%),radial-gradient(circle_at_bottom,rgba(29,64,164,0.32),transparent_40%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 brand-grid-bg opacity-35" />

      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#07123b]/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/admin" className="inline-flex items-center gap-3">
            <Image
              src="/branding/logo_blanco.png"
              alt="Proxima Admin"
              width={132}
              height={34}
              className="h-auto w-auto"
              style={{ width: "auto", height: "auto" }}
              priority
            />
            <span className="rounded-full border border-[#ff6a41]/45 bg-[#ff6a41]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.18em] text-[#ff8f71]">
              Admin
            </span>
          </Link>

          <nav className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1 text-sm md:flex">
            <Link href="/admin" className="rounded-xl px-4 py-2 text-white/80 transition hover:bg-white/10 hover:text-white">
              Panel
            </Link>
            <Link href="/admin/markets" className="rounded-xl px-4 py-2 text-white/80 transition hover:bg-white/10 hover:text-white">
              Mercados
            </Link>
            <Link href="/admin/withdrawals" className="rounded-xl px-4 py-2 text-white/80 transition hover:bg-white/10 hover:text-white">
              Retiros
            </Link>
            <Link href="/dashboard" className="rounded-xl px-4 py-2 text-white/80 transition hover:bg-white/10 hover:text-white">
              Vista usuario
            </Link>
          </nav>

          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/40 hover:text-white"
            >
              Cerrar sesion
            </button>
          </form>
        </div>

        <div className="overflow-x-auto px-4 pb-3 sm:px-6 md:hidden">
          <div className="flex min-w-max items-center gap-2">
            <Link href="/admin" className="admin-mobile-chip active">
              Panel
            </Link>
            <Link href="/admin/markets" className="admin-mobile-chip">
              Mercados
            </Link>
            <Link href="/admin/withdrawals" className="admin-mobile-chip">
              Retiros
            </Link>
            <Link href="/dashboard" className="admin-mobile-chip">
              Usuario
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
