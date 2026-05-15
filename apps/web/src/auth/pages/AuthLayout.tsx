import type { ReactNode } from "react";

export function AuthLayout({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 px-4 py-8">
      <section className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="text-2xl font-semibold tracking-normal text-slate-950">ESN Forecast</div>
          <div className="text-sm text-muted">Pilotage financier ESN</div>
        </div>
        <div className="rounded-lg border border-line bg-white p-6 shadow-sm">
          <h1 className="text-xl font-semibold tracking-normal text-slate-950">{title}</h1>
          <p className="mt-1 text-sm text-muted">{description}</p>
          <div className="mt-5">{children}</div>
        </div>
      </section>
    </main>
  );
}
