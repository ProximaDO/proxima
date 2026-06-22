import Link from "next/link";

export const metadata = {
  title: "Politica de cookies | Proxima",
  description: "Politica de cookies de Proxima Financial Technology.",
};

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-[#040b2f] text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <Link href="/" className="text-sm text-white/70 underline">Volver al inicio</Link>
        <h1 className="mt-4 font-(family-name:--font-display) text-4xl font-extrabold">Politica de cookies</h1>
        <p className="mt-2 text-sm text-white/60">Ultima actualizacion: 22/06/2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/85">
          <section>
            <h2 className="text-lg font-bold text-white">1. Que son las cookies</h2>
            <p className="mt-2">Las cookies son pequenos archivos que se almacenan en tu dispositivo para recordar informacion de navegacion y mejorar la experiencia del usuario.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">2. Tipos de cookies que usamos</h2>
            <p className="mt-2">Podemos usar cookies esenciales para funcionamiento y seguridad, cookies funcionales para preferencias de usuario y, cuando aplique, cookies de analitica para medir uso del servicio.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">3. Finalidad</h2>
            <p className="mt-2">Usamos cookies para mantener sesiones activas, proteger accesos, recordar configuraciones y entender de forma agregada como se usa la plataforma para mejorarla.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">4. Gestion de cookies</h2>
            <p className="mt-2">Puedes configurar tu navegador para bloquear o eliminar cookies. Ten en cuenta que ciertas funciones del sitio podrian dejar de operar correctamente.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">5. Contacto</h2>
            <p className="mt-2">Para consultas sobre esta politica: servicios@proxima.do o (809) 303-4977.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
