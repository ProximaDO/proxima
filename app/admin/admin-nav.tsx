"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  match: (pathname: string) => boolean;
};

type AdminNavProps = {
  mode?: "desktop" | "mobile" | "both";
};

const NAV_ITEMS: NavItem[] = [
  {
    href: "/admin",
    label: "Inicio",
    match: (pathname) => pathname === "/admin",
  },
  {
    href: "/admin/markets",
    label: "Mercados",
    match: (pathname) => pathname.startsWith("/admin/markets"),
  },
  {
    href: "/admin/withdrawals",
    label: "Retiros",
    match: (pathname) => pathname.startsWith("/admin/withdrawals"),
  },
  {
    href: "/admin/users",
    label: "Usuarios",
    match: (pathname) => pathname.startsWith("/admin/users"),
  },
  {
    href: "/admin/site",
    label: "Configuracion",
    match: (pathname) => pathname.startsWith("/admin/site"),
  },
];

export default function AdminNav({ mode = "both" }: AdminNavProps) {
  const pathname = usePathname();
  const showDesktop = mode === "desktop" || mode === "both";
  const showMobile = mode === "mobile" || mode === "both";

  return (
    <>
      {showDesktop && (
        <nav className="hidden items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-1 text-sm md:flex">
          {NAV_ITEMS.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-xl px-4 py-2 transition ${
                  active
                    ? "bg-white/15 font-semibold text-white"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      )}

      {showMobile && (
        <details className="relative md:hidden">
          <summary className="inline-flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-white/20 text-white/85 transition hover:bg-white/10">
            <span aria-hidden="true">☰</span>
          </summary>
          <div className="absolute right-0 top-11 z-40 w-64 rounded-2xl border border-white/15 bg-[#0a1a55]/95 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.4)] backdrop-blur">
            <div className="grid grid-cols-1 gap-2">
              {NAV_ITEMS.map((item) => {
                const active = item.match(pathname);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`inline-flex items-center justify-center rounded-xl border px-3 py-2.5 text-xs font-semibold leading-tight transition ${
                      active
                        ? "border-transparent bg-linear-to-r from-[#ff6a41] to-[#7f30de] text-white shadow-[0_6px_16px_rgba(122,39,224,0.35)]"
                        : "border-white/20 bg-white/5 text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </details>
      )}
    </>
  );
}
