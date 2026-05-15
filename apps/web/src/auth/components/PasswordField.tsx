import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  autoComplete?: string;
  error?: string;
  onChange: (value: string) => void;
};

export function PasswordField({ id, label, value, autoComplete, error, onChange }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block text-sm font-medium text-slate-700" htmlFor={id}>
      {label}
      <div className="relative mt-1">
        <input
          id={id}
          className={`w-full rounded-md border px-3 py-2 pr-10 outline-none focus:border-brand ${error ? "border-red-300" : "border-line"}`}
          type={visible ? "text" : "password"}
          value={value}
          autoComplete={autoComplete}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="absolute right-2 top-2 rounded-md p-1 text-muted hover:bg-surface"
          aria-label={visible ? "Masquer le mot de passe" : "Afficher le mot de passe"}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {error ? <span className="mt-1 block text-xs text-red-600">{error}</span> : null}
    </label>
  );
}
