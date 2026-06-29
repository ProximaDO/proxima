"use client";

import { useState } from "react";

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 8;

interface Props {
  defaultValues?: string[];
}

export default function OptionsFieldset({ defaultValues }: Props) {
  const [count, setCount] = useState(() =>
    Math.max(MIN_OPTIONS, Math.min(defaultValues?.length ?? MIN_OPTIONS, MAX_OPTIONS))
  );

  return (
    <fieldset className="space-y-3">
      <legend className="text-sm font-medium text-white/85">
        Opciones * (min {MIN_OPTIONS}, max {MAX_OPTIONS})
      </legend>

      {Array.from({ length: count }, (_, i) => (
        <input
          key={i}
          name={`option_${i}`}
          type="text"
          defaultValue={defaultValues?.[i] ?? ""}
          placeholder={i < MIN_OPTIONS ? `Opcion ${i + 1} *` : `Opcion ${i + 1}`}
          required={i < MIN_OPTIONS}
          className="admin-input"
        />
      ))}

      <div className="flex gap-2 pt-1">
        {count < MAX_OPTIONS && (
          <button
            type="button"
            onClick={() => setCount((c) => Math.min(c + 1, MAX_OPTIONS))}
            className="admin-btn-muted text-sm"
          >
            + Agregar opcion
          </button>
        )}
        {count > MIN_OPTIONS && (
          <button
            type="button"
            onClick={() => setCount((c) => Math.max(c - 1, MIN_OPTIONS))}
            className="text-sm text-red-400/80 hover:text-red-300"
          >
            − Eliminar ultima
          </button>
        )}
      </div>
    </fieldset>
  );
}
