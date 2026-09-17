"use client";

import { useState } from "react";

const SHARE_TEXT = "Predice ahora en este mercado";

interface Props {
  marketId: string;
  marketTitle: string;
  /** Ruta relativa del mercado; se convierte a URL absoluta en el cliente. */
  sharePath: string;
  size?: "sm" | "md";
}

function slugifyFileName(value: string) {
  return (
    value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 60) || "mercado"
  );
}

export function ShareMarketButtons({ marketId, marketTitle, sharePath, size = "sm" }: Props) {
  const [isSharing, setIsSharing] = useState(false);

  const iconSize = size === "md" ? 20 : 16;
  const buttonClass =
    size === "md"
      ? "inline-flex h-10 w-10 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 text-emerald-200 transition hover:border-emerald-300/70 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50"
      : "inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-300/40 bg-emerald-400/10 text-emerald-200 transition hover:border-emerald-300/70 hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-50";

  async function fetchShareImage() {
    const response = await fetch(`/api/markets/${marketId}/share-image`, { cache: "no-store" });
    if (!response.ok) return null;

    const blob = await response.blob();
    const type = blob.type || "image/png";
    return new File([blob], `proxima-${slugifyFileName(marketTitle)}.png`, { type });
  }

  async function handleWhatsAppShare() {
    if (isSharing) return;

    const shareUrl = new URL(sharePath, window.location.origin).toString();
    const message = `${SHARE_TEXT}\n${shareUrl}`;

    setIsSharing(true);
    try {
      const file = await fetchShareImage();

      if (file && typeof navigator.canShare === "function" && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: message, title: marketTitle });
        return;
      }
    } catch (error) {
      // El usuario cancelo la hoja de compartir: no abrimos el fallback.
      if (error instanceof DOMException && error.name === "AbortError") return;
    } finally {
      setIsSharing(false);
    }

    window.open(
      `https://wa.me/?text=${encodeURIComponent(message)}`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    // Compartir solo se ofrece en mobile: depende de la app nativa de WhatsApp.
    <div className="flex shrink-0 items-center gap-2 md:hidden">
      <button
        type="button"
        onClick={handleWhatsAppShare}
        disabled={isSharing}
        aria-label={`Compartir "${marketTitle}" por WhatsApp`}
        title="Compartir por WhatsApp"
        className={buttonClass}
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12.04 2c-5.46 0-9.9 4.44-9.9 9.9 0 1.75.46 3.45 1.33 4.95L2 22l5.3-1.39a9.87 9.87 0 0 0 4.74 1.21h.01c5.45 0 9.9-4.44 9.9-9.9 0-2.65-1.03-5.13-2.9-7A9.82 9.82 0 0 0 12.04 2Zm0 18.02h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.14.83.84-3.07-.2-.31a8.17 8.17 0 0 1-1.26-4.37c0-4.54 3.7-8.23 8.25-8.23 2.2 0 4.27.86 5.83 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.7 8.24-8.24 8.24Zm4.52-6.17c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.24-.64.8-.78.97-.15.16-.29.18-.53.06-.25-.13-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.71-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.12-.15.16-.25.25-.41.08-.17.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.22.24-.86.84-.86 2.05s.88 2.38 1 2.54c.12.17 1.73 2.64 4.19 3.7.59.26 1.04.41 1.4.52.59.19 1.12.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.22-.17-.47-.29Z" />
        </svg>
      </button>
    </div>
  );
}
