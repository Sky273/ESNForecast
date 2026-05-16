import { LogIn } from "lucide-react";
import { FormEvent, useState } from "react";
import type { LoginCredentials } from "../types/auth.types";
import { PasswordField } from "./PasswordField";

type LoginFormProps = {
  initialEmail?: string;
  error?: string;
  loading?: boolean;
  onSubmit: (credentials: LoginCredentials) => Promise<void>;
  onForgotPassword: () => void;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function LoginForm({ initialEmail = "", error, loading, onSubmit, onForgotPassword }: LoginFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [fieldError, setFieldError] = useState("");

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password) {
      setFieldError("Email et mot de passe sont obligatoires.");
      return;
    }
    if (!emailPattern.test(email.trim())) {
      setFieldError("Saisissez une adresse email validé.");
      return;
    }
    setFieldError("");
    await onSubmit({ email: email.trim(), password, remember });
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <label className="block text-sm font-medium text-slate-700" htmlFor="email">
        Email
        <input
          id="email"
          className={`mt-1 w-full rounded-md border px-3 py-2 outline-none focus:border-brand ${fieldError && !email ? "border-red-300" : "border-line"}`}
          type="email"
          value={email}
          autoComplete="email"
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <PasswordField id="password" label="Mot de passe" value={password} autoComplete="current-password" onChange={setPassword} />
      <div className="flex items-center justify-between gap-3 text-sm">
        <label className="flex items-center gap-2 text-slate-700">
          <input className="rounded border-line" type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
          Se souvenir de moi
        </label>
        <button type="button" className="font-medium text-brand hover:underline" onClick={onForgotPassword}>
          Mot de passe oublie ?
        </button>
      </div>
      {fieldError || error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{fieldError || error}</div> : null}
      <button disabled={loading} className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
        <LogIn size={17} />
        {loading ? "Connexion..." : "Se connecter"}
      </button>
    </form>
  );
}
