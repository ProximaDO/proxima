"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CategoryOption = {
  id: string;
  name: string;
};

type CategorySelectProps = {
  name: string;
  options: CategoryOption[];
  defaultValue?: string | null;
  placeholder?: string;
};

export default function CategorySelect({
  name,
  options,
  defaultValue,
  placeholder = "Selecciona una categoria",
}: CategorySelectProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const normalizedDefault = (defaultValue ?? "").trim();
  const defaultOption =
    normalizedDefault.length > 0
      ? options.find((option) => option.name === normalizedDefault)
      : undefined;

  const [selectedName, setSelectedName] = useState(defaultOption?.name ?? "");

  const selectedLabel = useMemo(() => {
    if (!selectedName) return placeholder;
    return selectedName;
  }, [placeholder, selectedName]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <input type="hidden" name={name} value={selectedName} />

      <button
        type="button"
        className="admin-input flex w-full items-center justify-between text-left"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span className={selectedName ? "text-white" : "text-white/60"}>{selectedLabel}</span>
        <span className="text-white/70" aria-hidden="true">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute z-40 mt-2 max-h-64 w-full overflow-auto rounded-xl border border-white/15 bg-[#13245b] p-1 shadow-[0_14px_34px_rgba(0,0,0,0.35)]">
          <button
            type="button"
            className="block w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 transition hover:bg-white/10 hover:text-white"
            role="option"
            aria-selected={selectedName.length === 0}
            onClick={() => {
              setSelectedName("");
              setOpen(false);
            }}
          >
            {placeholder}
          </button>

          {options.map((option) => {
            const active = option.name === selectedName;
            return (
              <button
                key={option.id}
                type="button"
                className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition ${
                  active ? "bg-white/15 text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
                role="option"
                aria-selected={active}
                onClick={() => {
                  setSelectedName(option.name);
                  setOpen(false);
                }}
              >
                {option.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
