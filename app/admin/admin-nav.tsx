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
    label: "Panel",
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
    href: "/dashboard",
    label: "Usuario",
    match: (pathname) => pathname.startsWith("/dashboard"),
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
        <div className="overflow-x-auto px-4 pb-3 sm:px-6 md:hidden">
          <div className="flex min-w-max items-center gap-2">
            {NAV_ITEMS.map((item) => {
              const active = item.match(pathname);
              return (
                <Link key={item.href} href={item.href} className={`admin-mobile-chip ${active ? "active" : ""}`}>
                  {item.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
