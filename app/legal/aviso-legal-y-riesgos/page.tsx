import Link from "next/link";

export const metadata = {
  title: "Aviso legal y riesgos | Proxima",
  description: "Aviso legal y de riesgos de Proxima Financial Technology.",
};

export default function LegalRiskPage() {
  return (
    <main className="min-h-screen bg-[#040b2f] text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <Link href="/" className="text-sm text-white/70 underline">Volver al inicio</Link>
        <h1 className="mt-4 font-(family-name:--font-display) text-4xl font-extrabold">Aviso legal y riesgos</h1>
        <p className="mt-2 text-sm text-white/60">Ultima actualizacion: 22/06/2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/85">
          <section>
            <h2 className="text-lg font-bold text-white">1. Naturaleza del servicio</h2>
            <p className="mt-2">La plataforma ofrece mercados de prediccion y herramientas de participacion asociadas. No constituye asesoria financiera, legal, fiscal ni recomendacion personalizada de inversion.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">2. Riesgo economico</h2>
            <p className="mt-2">Toda participacion en mercados de prediccion implica riesgo de perdida parcial o total del capital comprometido. Solo debes operar con montos que puedas asumir perder.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">3. Disponibilidad y terceros</h2>
            <p className="mt-2">El servicio puede verse afectado por mantenimiento, fallas de red o dependencias de terceros (por ejemplo, pagos o infraestructura). Proxima no garantiza disponibilidad continua e ininterrumpida.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">4. Fuentes de informacion y resolucion</h2>
            <p className="mt-2">Las resoluciones de mercado se basan en reglas y fuentes publicadas para cada evento. Aunque se aplican criterios de verificacion razonables, puede existir incertidumbre, demoras o disputas de interpretacion.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">5. Cumplimiento y monitoreo</h2>
            <p className="mt-2">Proxima puede aplicar controles de cumplimiento, verificacion de identidad y monitoreo de operaciones para prevenir fraude, lavado de activos y uso indebido de la plataforma.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">6. Contacto legal</h2>
            <p className="mt-2">Proxima Financial Technology. Responsable: Manuel Alejandro Yermenos Santos. Direccion: Av. Simon Bolivar #401, local 707, Gazcue. Telefono: (809) 303-4977. Correo: servicios@proxima.do.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
