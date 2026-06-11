import Image from "next/image";
import Link from "next/link";
import { logoutAction } from "@/app/auth/actions";
import AdminNav from "@/app/admin/admin-nav";

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

          <AdminNav mode="desktop" />

          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white/85 transition hover:border-white/40 hover:text-white"
            >
              Cerrar sesion
            </button>
          </form>
        </div>
        <AdminNav mode="mobile" />
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">{children}</div>
    </div>
  );
}
