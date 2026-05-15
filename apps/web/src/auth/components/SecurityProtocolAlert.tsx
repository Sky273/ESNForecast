import { AlertTriangle, ShieldCheck } from "lucide-react";
import { getSecurityContext } from "../utils/securityContext";

export function SecurityProtocolAlert() {
  const context = getSecurityContext();
  if (context.secure || !context.message) return null;
  const strong = context.level === "insecure_http";

  return (
    <div className={`flex gap-2 rounded-md border p-3 text-sm ${strong ? "border-amber-300 bg-amber-50 text-amber-900" : "border-line bg-surface text-slate-700"}`}>
      {strong ? <AlertTriangle size={18} className="mt-0.5 shrink-0" /> : <ShieldCheck size={18} className="mt-0.5 shrink-0 text-emerald-600" />}
      <span>{context.message}</span>
    </div>
  );
}
