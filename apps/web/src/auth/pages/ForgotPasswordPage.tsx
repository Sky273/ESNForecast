import { FormEvent, useState } from "react";
import { authService } from "../services/authService";
import { AuthLayout } from "./AuthLayout";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ForgotPasswordPage({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailPattern.test(email.trim())) {
      setError("Saisissez une adresse email validé.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authService.forgotPassword(email.trim());
      setMessage("Si un compte existe avec cette adresse, un email de réinitialisation a été envoyé.");
    } catch {
      setMessage("Si un compte existe avec cette adresse, un email de réinitialisation a été envoyé.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Mot de passe oublié" description="Demandez un lien de réinitialisation de mot de passe.">
      <form className="space-y-4" onSubmit={submit}>
        <label className="block text-sm font-medium text-slate-700" htmlFor="forgot-email">
          Email
          <input id="forgot-email" className="mt-1 w-full rounded-md border border-line px-3 py-2 outline-none focus:border-brand" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div> : null}
        <button disabled={loading} className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Envoi..." : "Envoyer le lien"}</button>
        <button type="button" className="w-full rounded-md border border-line px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-surface" onClick={onBack}>Retour à la connexion</button>
      </form>
    </AuthLayout>
  );
}
