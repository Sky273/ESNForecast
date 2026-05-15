import { FormEvent, useState } from "react";
import { PasswordField } from "../components/PasswordField";
import { PasswordStrength } from "../components/PasswordStrength";
import { authService } from "../services/authService";
import { validatePasswordRules } from "../utils/passwordRules";
import { AuthLayout } from "./AuthLayout";

export function FirstLoginPage({ token, onDone }: { token?: string; onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState(token ? "" : "Invitation invalide ou expirée.");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (!accepted) {
      setError("Vous devez accepter les conditions internes pour activer le compte.");
      return;
    }
    if (!validatePasswordRules(password).valid || password !== confirm) {
      setError(password !== confirm ? "Les deux mots de passe ne correspondent pas." : "Le mot de passe ne respecte pas les règles minimales.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authService.activateAccount(token, password);
      setMessage("Votre compte est active. Vous pouvez vous connectér.");
    } catch {
      setError("Invitation invalide, expirée ou déjà utilisée.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Activation de votre compte" description="Définissez votre mot de passe pour finaliser la première connexion.">
      <form className="space-y-4" onSubmit={submit}>
        <PasswordField id="first-password" label="Nouveau mot de passe" value={password} autoComplete="new-password" onChange={setPassword} />
        <PasswordStrength password={password} />
        <PasswordField id="first-confirm" label="Confirmation" value={confirm} autoComplete="new-password" onChange={setConfirm} />
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input className="mt-1 rounded border-line" type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>J'accepte les conditions internes d'utilisation de l'application.</span>
        </label>
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div> : null}
        <button disabled={loading || !token} className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Activation..." : "Activer mon compte"}</button>
        <button type="button" className="w-full rounded-md border border-line px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-surface" onClick={onDone}>Retour ? la connexion</button>
      </form>
    </AuthLayout>
  );
}
