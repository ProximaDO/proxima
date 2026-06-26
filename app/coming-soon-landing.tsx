"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";

type Countdown = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
};

type ComingSoonLandingProps = {
  targetAt: string;
  title: string;
  message: string;
};

function getCountdown(targetAt: string): Countdown {
  const target = new Date(targetAt).getTime();
  if (Number.isNaN(target)) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: false };
  }

  const now = Date.now();
  const diff = target - now;

  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }

  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return { days, hours, minutes, seconds, isExpired: false };
}

function CountdownUnit({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-center">
      <p className="text-3xl font-extrabold text-white sm:text-4xl">{String(value).padStart(2, "0")}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/50">{label}</p>
    </div>
  );
}

export function ComingSoonLanding({ targetAt, title, message }: ComingSoonLandingProps) {
  const [countdown, setCountdown] = useState<Countdown>(() => getCountdown(targetAt));

  useEffect(() => {
    setCountdown(getCountdown(targetAt));
    const timer = setInterval(() => {
      setCountdown(getCountdown(targetAt));
    }, 1000);

    return () => clearInterval(timer);
  }, [targetAt]);

  const targetLabel = useMemo(() => {
    const date = new Date(targetAt);
    if (Number.isNaN(date.getTime())) return "Fecha por confirmar";
    return date.toLocaleString("es-DO", {
      dateStyle: "full",
      timeStyle: "short",
    });
  }, [targetAt]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#040b2f] text-white">
      <div className="pointer-events-none absolute inset-0 brand-grid-bg opacity-40" />
      <div className="pointer-events-none absolute -left-32 top-10 h-80 w-80 rounded-full bg-[#0d3a8a]/35 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-20 h-80 w-80 rounded-full bg-[#ff623f]/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#7a31de]/25 blur-3xl" />

      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl items-center px-4 py-10 sm:px-6">
        <section className="w-full rounded-3xl border border-white/12 bg-[#09154a]/75 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.35)] backdrop-blur md:p-10">
          <div className="flex flex-col items-center text-center">
            <Image
              src="/branding/logo_blanco.png"
              alt="Proxima"
              width={260}
              height={66}
              priority
              className="h-auto w-45 sm:w-60"
            />

            <p className="mt-5 rounded-full border border-[#f7a93b]/50 bg-[#f7a93b]/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#ffd69a]">
              Lanzamiento Proximo
            </p>

            <h1 className="mt-5 text-3xl font-extrabold leading-tight text-white sm:text-5xl">{title}</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/75 sm:text-base">{message}</p>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">Estaremos al aire en:</p>
            <div className="mt-3 grid w-full grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-4">
              <CountdownUnit label="Dias" value={countdown.days} />
              <CountdownUnit label="Horas" value={countdown.hours} />
              <CountdownUnit label="Minutos" value={countdown.minutes} />
              <CountdownUnit label="Segundos" value={countdown.seconds} />
            </div>

            {countdown.isExpired ? (
              <p className="mt-5 rounded-xl border border-emerald-300/35 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-200">
                La fecha objetivo ya fue alcanzada. Actualiza la configuracion desde el panel admin.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
