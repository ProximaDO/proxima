import Link from "next/link";
import { registerAction } from "@/app/auth/actions";

export default function RegisterPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
      <h1 className="text-3xl font-semibold">Crear cuenta</h1>
      <p className="mt-2 text-sm text-zinc-600">
        Registrate para recargar tu wallet y participar en mercados.
      </p>

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
