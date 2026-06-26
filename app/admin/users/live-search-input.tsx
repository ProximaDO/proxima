"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export default function LiveSearchInput() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    setValue(searchParams.get("q") ?? "");
  }, [searchParams]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());

      if (value.trim()) {
        params.set("q", value);
      } else {
        params.delete("q");
      }

      const nextQuery = params.toString();
      const nextUrl = nextQuery ? `${pathname}?${nextQuery}` : pathname;
      const currentQuery = searchParams.toString();
      const currentUrl = currentQuery ? `${pathname}?${currentQuery}` : pathname;

      if (nextUrl === currentUrl) return;
      router.replace(nextUrl, { scroll: false });
    }, 180);

    return () => clearTimeout(timeoutId);
  }, [pathname, router, searchParams, value]);

  return (
    <input
      name="q"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      className="admin-input min-w-55"
      placeholder="Buscar por email, nombre o id"
      autoComplete="off"
    />
  );
}
