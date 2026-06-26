import Link from "next/link";
import { requireNonAdmin } from "@/lib/auth/server";
import { createClient } from "@/lib/supabase/server";
import { submitKycDocumentAction } from "@/app/dashboard/actions";

interface Props {
  searchParams: Promise<{ error?: string; success?: string }>;
}

type KycRow = {
  status: "pending" | "submitted" | "verified" | "rejected" | "requires_input";
  verified_at: string | null;
  rejection_reason: string | null;
  id_document_path: string | null;
  id_document_uploaded_at: string | null;
};

const statusConfig = {
  pending: {
    label: "Pendiente de revisión",
    description: "Tu solicitud está pendiente de revisión manual por nuestro equipo. Recibirás un correo cuando sea aprobada.",
    color: "border-amber-300/30 bg-amber-400/10 text-amber-100",
    dot: "bg-amber-400",
  },
  submitted: {
    label: "En revisión",
    description: "Estamos revisando tu información. Recibirás una notificación cuando esté lista.",
    color: "border-blue-300/30 bg-blue-400/10 text-blue-100",
    dot: "bg-blue-400",
  },
  verified: {
    label: "Verificado",
    description: "Tu identidad ha sido verificada exitosamente. Ya puedes solicitar retiros.",
    color: "border-emerald-300/30 bg-emerald-400/10 text-emerald-100",
    dot: "bg-emerald-400",
  },
  rejected: {
    label: "Rechazado",
    description: "Tu verificación fue rechazada. Comunícate con soporte para más información.",
    color: "border-red-300/30 bg-red-400/10 text-red-100",
    dot: "bg-red-400",
  },
  requires_input: {
    label: "Requiere atención",
    description: "Necesitamos información adicional. Por favor comunícate con soporte.",
    color: "border-orange-300/30 bg-orange-400/10 text-orange-100",
    dot: "bg-orange-400",
  },
};

export default async function VerificacionPage({ searchParams }: Props) {
  await requireNonAdmin();
  const { error: errorRaw, success: successRaw } = await searchParams;
  const supabase = await createClient();

  const { data: { session } } = await supabase.auth.getSession();
  const userId = session!.user.id;

  const { data: kycData } = await supabase
    .from("kyc_verifications")
    .select("status, verified_at, rejection_reason, id_document_path, id_document_uploaded_at")
    .eq("user_id", userId)
    .maybeSingle();

  const kyc = kycData as KycRow | null;
  const currentStatus = kyc?.status ?? "pending";
  const config = statusConfig[currentStatus];

  const errorMessage = errorRaw ? decodeURIComponent(errorRaw) : null;
  const successMessage = successRaw ? decodeURIComponent(successRaw) : null;

  let documentPreviewUrl: string | null = null;
  if (kyc?.id_document_path) {
    const { data } = await supabase
      .storage
      .from("kyc-documents")
      .createSignedUrl(kyc.id_document_path, 600);

    documentPreviewUrl = data?.signedUrl ?? null;
  }

  return (
    <main className="relative min-h-screen bg-[#040b2f] text-white">
      <div className="mx-auto w-full max-w-lg px-4 py-14 sm:px-6">
        <Link
          href="/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-sm text-white/60 hover:text-white"
        >
          ← Volver al panel
        </Link>

        <h1 className="font-(family-name:--font-display) text-3xl font-extrabold">
          Verificación de identidad
        </h1>
        <p className="mt-2 text-sm text-white/60">
          Requerida para solicitar retiros. Nuestro equipo revisa tu cuenta manualmente.
        </p>

        {errorMessage ? (
          <div className="mt-5 rounded-xl border border-red-400/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {errorMessage}
          </div>
        ) : null}
        {successMessage ? (
          <div className="mt-5 rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {successMessage}
          </div>
        ) : null}

        {/* Estado actual */}
        <div className={`mt-8 rounded-xl border px-5 py-4 ${config.color}`}>
          <div className="flex items-center gap-2.5">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${config.dot}`} />
            <p className="font-bold">{config.label}</p>
          </div>
          <p className="mt-1.5 text-sm opacity-90">{config.description}</p>
          {kyc?.rejection_reason ? (
            <p className="mt-2 text-xs opacity-75">Motivo: {kyc.rejection_reason}</p>
          ) : null}
          {kyc?.verified_at ? (
            <p className="mt-2 text-xs opacity-75">
              Verificado el {new Date(kyc.verified_at).toLocaleDateString("es-DO", { dateStyle: "long" })}
            </p>
          ) : null}
        </div>

        {/* Info del proceso */}
        <div className="mt-6 rounded-xl border border-white/10 bg-white/4 p-4 text-sm text-white/65 space-y-1.5">
          <p className="font-semibold text-white/80">¿Cómo funciona?</p>
          <p>· Sube una foto clara de tu documento de identidad.</p>
          <p>· Enviaremos tu solicitud al equipo de validación.</p>
          <p>· Nuestro equipo la revisa en un plazo de 1–2 días hábiles.</p>
          <p>· Recibirás una notificación cuando tu cuenta sea aprobada.</p>
          <p className="pt-1 text-white/45 text-xs">
            Para consultas escríbenos a soporte@proxima.do
          </p>
        </div>

        {currentStatus !== "verified" ? (
          <section className="mt-6 rounded-xl border border-white/12 bg-white/4 p-4">
            <p className="text-sm font-semibold text-white/85">Subir documento de identidad</p>
            <p className="mt-1 text-xs text-white/55">
              Formatos permitidos: JPG, PNG, WEBP o PDF. Tamaño máximo: 10MB.
            </p>

            <form action={submitKycDocumentAction} className="mt-3 space-y-3">
              <input
                type="file"
                name="identity_document"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                required
                className="block w-full rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white file:mr-3 file:rounded-md file:border-0 file:bg-white/15 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-white hover:file:bg-white/25"
              />
              <button
                type="submit"
                className="w-full rounded-xl bg-linear-to-r from-[#ff6a41] to-[#7a31de] px-4 py-2.5 text-sm font-extrabold uppercase tracking-[0.12em] text-white"
              >
                Enviar documento para validación
              </button>
            </form>

            {kyc?.id_document_uploaded_at ? (
              <p className="mt-3 text-xs text-white/55">
                Último documento enviado: {new Date(kyc.id_document_uploaded_at).toLocaleDateString("es-DO", { dateStyle: "long" })}
              </p>
            ) : null}

            {documentPreviewUrl ? (
              <a
                href={documentPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex text-xs font-semibold text-[#83c9ff] underline"
              >
                Ver último documento cargado
              </a>
            ) : null}
          </section>
        ) : null}

        {currentStatus === "verified" ? (
          <div className="mt-6 flex gap-3">
            <Link
              href="/dashboard/cuenta-bancaria"
              className="flex-1 rounded-xl border border-[#65bfff]/50 bg-[#65bfff]/10 px-4 py-3 text-center text-sm font-bold text-[#83c9ff]"
            >
              Gestionar cuenta bancaria
            </Link>
            <Link
              href="/dashboard"
              className="flex-1 rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white/80"
            >
              Volver al panel
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  );
}
