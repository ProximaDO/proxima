"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface ModalEscapeCloseProps {
  closeHref: string;
}

export function ModalEscapeClose({ closeHref }: ModalEscapeCloseProps) {
  const router = useRouter();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      event.preventDefault();
      router.replace(closeHref, { scroll: false });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeHref, router]);

  return null;
}
