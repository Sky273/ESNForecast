import { CheckCircle2, Circle } from "lucide-react";
import { validatePasswordRules } from "../utils/passwordRules";

export function PasswordStrength({ password }: { password: string }) {
  const result = validatePasswordRules(password);
  const validCount = result.rules.filter((rule) => rule.valid).length;

  return (
    <div className="rounded-md border border-line bg-surface p-3">
      <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-brand transition-all" style={{ width: `${(validCount / result.rules.length) * 100}%` }} />
      </div>
      <ul className="grid gap-1 text-xs text-slate-600 sm:grid-cols-2">
        {result.rules.map((rule) => (
          <li key={rule.key} className="flex items-center gap-1.5">
            {rule.valid ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Circle size={14} className="text-muted" />}
            <span>{rule.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
