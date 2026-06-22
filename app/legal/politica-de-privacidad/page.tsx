import Link from "next/link";

export const metadata = {
  title: "Politica de privacidad | Proxima",
  description: "Politica de privacidad de Proxima Financial Technology.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#040b2f] text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <Link href="/" className="text-sm text-white/70 underline">Volver al inicio</Link>
        <h1 className="mt-4 font-(family-name:--font-display) text-4xl font-extrabold">Politica de privacidad</h1>
        <p className="mt-2 text-sm text-white/60">Ultima actualizacion: 22/06/2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/85">
          <section>
            <h2 className="text-lg font-bold text-white">1. Responsable del tratamiento</h2>
            <p className="mt-2">Proxima Financial Technology, representada por Manuel Alejandro Yermenos Santos, identificacion 402-2493556-5. Direccion: Av. Simon Bolivar #401, local 707, Gazcue. Contacto: servicios@proxima.do y (809) 303-4977.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">2. Datos que recopilamos</h2>
            <p className="mt-2">Podemos recopilar datos de identificacion, contacto, autenticacion, actividad dentro de la plataforma, informacion de transacciones y datos necesarios para cumplimiento normativo y prevencion de fraude.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">3. Finalidades del tratamiento</h2>
            <p className="mt-2">Tratamos datos para crear y administrar cuentas, procesar depositos y retiros, ejecutar operaciones, enviar notificaciones, cumplir obligaciones legales, prevenir fraude y mejorar la seguridad y calidad del servicio.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">4. Base legal</h2>
            <p className="mt-2">El tratamiento se fundamenta en la ejecucion de la relacion contractual contigo, el cumplimiento de obligaciones legales y, cuando corresponda, tu consentimiento.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">5. Comparticion con terceros</h2>
            <p className="mt-2">Podemos compartir datos con proveedores que soportan la operacion de la plataforma (infraestructura, pagos, mensajeria, analitica y seguridad), bajo medidas de confidencialidad y solo para finalidades legitimas del servicio.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">6. Conservacion y seguridad</h2>
            <p className="mt-2">Conservamos datos por el tiempo necesario para las finalidades descritas y segun exigencias legales. Aplicamos medidas tecnicas y organizativas razonables para proteger la informacion frente a acceso no autorizado, perdida o alteracion.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">7. Tus derechos</h2>
            <p className="mt-2">Puedes solicitar acceso, correccion o actualizacion de tus datos, y ejercer otros derechos aplicables conforme a la ley. Para gestionar solicitudes: servicios@proxima.do.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">8. Cambios a esta politica</h2>
            <p className="mt-2">Podemos modificar esta politica para reflejar cambios legales, operativos o tecnicos. La version vigente estara siempre publicada en el sitio.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
