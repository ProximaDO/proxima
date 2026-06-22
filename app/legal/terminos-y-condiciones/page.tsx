import Link from "next/link";

export const metadata = {
  title: "Terminos y condiciones | Proxima",
  description: "Terminos y condiciones de uso de Proxima Financial Technology.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#040b2f] text-white">
      <div className="mx-auto w-full max-w-4xl px-4 py-12 sm:px-6">
        <Link href="/" className="text-sm text-white/70 underline">Volver al inicio</Link>
        <h1 className="mt-4 font-(family-name:--font-display) text-4xl font-extrabold">Terminos y condiciones</h1>
        <p className="mt-2 text-sm text-white/60">Ultima actualizacion: 22/06/2026</p>

        <div className="mt-8 space-y-6 text-sm leading-relaxed text-white/85">
          <section>
            <h2 className="text-lg font-bold text-white">1. Identificacion del proveedor</h2>
            <p className="mt-2">Proxima Financial Technology, representada por Manuel Alejandro Yermenos Santos, identificacion 402-2493556-5, con domicilio en Av. Simon Bolivar #401, local 707, Gazcue. Contacto: (809) 303-4977 y servicios@proxima.do.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">2. Objeto</h2>
            <p className="mt-2">Estos terminos regulan el acceso y uso de la plataforma de mercado de predicciones operada por Proxima Financial Technology, incluyendo registro, uso de saldo, participacion en mercados y funcionalidades relacionadas.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">3. Elegibilidad y cuenta</h2>
            <p className="mt-2">Para usar la plataforma debes cumplir los requisitos legales aplicables y proporcionar informacion verdadera y actualizada. Eres responsable de la confidencialidad de tus credenciales y de toda actividad realizada desde tu cuenta.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">4. Depositos, retiros y balance</h2>
            <p className="mt-2">Los depositos y retiros estan sujetos a verificacion operativa, controles de cumplimiento y disponibilidad de servicios de terceros. Proxima puede retener o rechazar operaciones cuando exista riesgo operativo, fraude o incumplimiento normativo.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">5. Reglas de mercado</h2>
            <p className="mt-2">Cada mercado define sus condiciones de cierre y resolucion. La resolucion se realiza conforme a las reglas publicadas para cada evento y puede apoyarse en fuentes verificables. Las decisiones de resolucion se aplican de forma uniforme a todos los participantes.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">6. Conductas prohibidas</h2>
            <p className="mt-2">Se prohibe el uso abusivo de la plataforma, manipulacion de mercado, suplantacion, uso de datos falsos, intento de acceso no autorizado o cualquier conducta ilicita. Proxima puede suspender o cerrar cuentas por incumplimiento.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">7. Limitacion de responsabilidad</h2>
            <p className="mt-2">El uso de la plataforma implica riesgo economico. Proxima no garantiza resultados, rentabilidad ni continuidad ininterrumpida del servicio. En la medida permitida por ley, Proxima no sera responsable por danos indirectos o lucro cesante.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">8. Modificaciones</h2>
            <p className="mt-2">Proxima puede actualizar estos terminos en cualquier momento. Las nuevas versiones entran en vigor desde su publicacion en el sitio.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white">9. Ley aplicable y contacto</h2>
            <p className="mt-2">Estos terminos se interpretan conforme a la normativa aplicable en Republica Dominicana. Para consultas legales: servicios@proxima.do.</p>
          </section>
        </div>
      </div>
    </main>
  );
}
