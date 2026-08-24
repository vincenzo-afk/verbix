import type { ReactNode } from "react";

export function IsometricBackdrop({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fbfcff] text-slate-950">
      <div className="pointer-events-none absolute inset-0 grid-texture opacity-70" aria-hidden="true" />
      <div className="pointer-events-none absolute -right-44 -top-28 h-[34rem] w-[34rem] rotate-[27deg] rounded-[5rem] border border-cyan-300/50 bg-gradient-to-br from-cyan-300/55 via-blue-300/30 to-transparent shadow-[0_32px_90px_rgba(14,165,233,0.18)] backdrop-blur-sm" aria-hidden="true" />
      <div className="pointer-events-none absolute -left-36 top-[31rem] h-80 w-[34rem] -rotate-[20deg] rounded-[4rem] border border-rose-300/45 bg-gradient-to-br from-rose-300/40 via-orange-200/25 to-transparent shadow-[0_30px_80px_rgba(251,113,133,0.16)]" aria-hidden="true" />
      <div className="pointer-events-none absolute right-[18%] top-[20rem] h-44 w-44 rotate-45 rounded-[2.1rem] border border-teal-300/45 bg-teal-300/25 shadow-[0_24px_52px_rgba(20,184,166,0.18)]" aria-hidden="true" />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
