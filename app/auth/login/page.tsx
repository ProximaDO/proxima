import Image from "next/image";
import Link from "next/link";
import { loginAction } from "@/app/auth/actions";

interface Props {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}

export default async function LoginPage({ searchParams }: Props) {
  const { error, success } = await searchParams;

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#040b2f] text-white">
      <div className="pointer-events-none absolute inset-0 brand-grid-bg opacity-35" />
      <div className="pointer-events-none absolute -left-28 top-20 h-64 w-64 rounded-full bg-[#0d3a8a]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-28 h-72 w-72 rounded-full bg-[#7a31de]/30 blur-3xl" />

      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center px-6 py-12">
        <section className="grid w-full grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="hidden lg:flex lg:flex-col lg:justify-center">
            <Image
              src="/branding/logo_blanco.png"
              alt="Proxima"
              width={170}
              height={46}
              style={{ width: "auto", height: "auto" }}
              priority
            />
            <h1 className="mt-6 font-[family-name:var(--font-display)] text-5xl font-extrabold leading-tight tracking-tight">
              Predice.
              <span className="block bg-gradient-to-r from-[#ff6c3f] via-[#f24a68] to-[#5a2fe4] bg-clip-text text-transparent">
                Gana inteligente.
              </span>
            </h1>
            <p className="mt-4 max-w-md text-base text-white/65">
              Ingresa a tu cuenta para operar mercados, gestionar posiciones y seguir tus resultados en tiempo real.
            </p>
          </div>

          <div className="admin-card mx-auto w-full max-w-md p-6 sm:p-8">
            <h2 className="font-[family-name:var(--font-display)] text-3xl font-extrabold">Iniciar sesion</h2>
            <p className="mt-2 text-sm text-white/65">Accede a tu cuenta para participar en mercados.</p>

            {error && (
              <div className="mt-4 rounded-lg border border-red-300/30 bg-red-500/15 px-4 py-3 text-sm text-red-200">
                {decodeURIComponent(error)}
              </div>
            )}

            {success && (
              <div className="mt-4 rounded-lg border border-emerald-300/25 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-200">
                {decodeURIComponent(success)}
              </div>
            )}

            <form action={loginAction} className="mt-8 space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-white/85" htmlFor="email">
                  Correo
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  className="admin-input"
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-white/85" htmlFor="password">
                  Contrasena
                </label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  className="admin-input"
                />
              </div>

              <button type="submit" className="admin-btn-primary w-full">
                Entrar
              </button>
            </form>

            <p className="mt-6 text-sm text-white/65">
              No tienes cuenta?{" "}
              <Link href="/auth/register" className="font-semibold text-white underline decoration-white/40">
                Registrate
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
