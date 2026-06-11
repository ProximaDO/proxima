import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-6 py-16 text-center">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        Proxima
      </h1>
      <p className="mt-4 max-w-2xl text-base text-zinc-600 sm:text-lg">
        Mercado de predicciones en construccion. La base del proyecto ya esta
        inicializada con Next.js, Tailwind y Supabase listo para integracion.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/markets"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
        >
          Ver mercados
        </Link>
        <Link
          href="/auth/register"
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Crear cuenta
        </Link>
        <Link
          href="/auth/login"
          className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100"
        >
          Iniciar sesion
        </Link>
      </div>
    </main>
  );
}
