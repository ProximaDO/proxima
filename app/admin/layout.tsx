import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/auth/actions";
import AdminNav from "@/app/admin/admin-nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#040b2f] text-white">
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(255,106,65,0.22),transparent_38%),radial-gradient(circle_at_top_right,rgba(112,49,229,0.24),transparent_36%),radial-gradient(circle_at_bottom,rgba(29,64,164,0.32),transparent_40%)]" />
      <div className="pointer-events-none fixed inset-0 -z-10 brand-grid-bg opacity-35" />

      <header className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[#07123b] sm:sticky sm:bg-[#07123b]/85 sm:backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-2 px-3 py-2.5 sm:gap-4 sm:px-6 sm:py-3">
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

          <AdminNav mode="desktop" />

          <div className="flex items-center gap-1.5 sm:gap-2">
            <AdminNav mode="mobile" />
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Cerrar sesion"
                title="Cerrar sesion"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/20 text-white/85 transition hover:bg-white/10 sm:h-auto sm:w-auto sm:px-4 sm:py-2 sm:text-sm sm:font-bold"
              >
                <span className="sm:hidden" aria-hidden="true">↪</span>
                <span className="hidden sm:inline">Salir</span>
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-20 sm:px-6 sm:pt-8">{children}</div>
    </div>
  );
}
