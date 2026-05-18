import type { ReactNode } from "react";

export function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-sky-900">{children}</div>
    </div>
  );
}
