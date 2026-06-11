import Link from "next/link";
import { registerAction } from "@/app/auth/actions";

interface Props {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
}

export default async function RegisterPage({ searchParams }: Props) {
  const { error, success } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-semibold">Crear cuenta</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Registrate para recargar tu wallet y participar en mercados.
      </p>

      {error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {decodeURIComponent(error)}
        </div>
      )}

      {success && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {decodeURIComponent(success)}
        </div>
      )}

      <form action={registerAction} className="mt-8 space-y-4">
        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="email">
            Correo
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium" htmlFor="password">
            Contrasena
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-zinc-500"
          />
        </div>

        <button
          type="submit"
          className="w-full rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Crear cuenta
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-600">
        Ya tienes cuenta?{" "}
        <Link href="/auth/login" className="font-medium text-zinc-900 underline">
          Inicia sesion
        </Link>
      </p>
    </main>
  );
}
