import { FormEvent, useState } from "react";
import { PasswordField } from "../components/PasswordField";
import { PasswordStrength } from "../components/PasswordStrength";
import { authService } from "../services/authService";
import { validatePasswordRules } from "../utils/passwordRules";
import { AuthLayout } from "./AuthLayout";

export function ChangePasswordPage({ onDone }: { onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!current || !password) {
      setError("Tous les champs sont obligatoires.");
      return;
    }
    if (!validatePasswordRules(password).valid) {
      setError("Le nouveau mot de passe ne respecte pas les règles minimales.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authService.changePassword(current, password);
      setMessage("Votre mot de passe ? ete modifie.");
      setCurrent("");
      setPassword("");
      setConfirm("");
    } catch {
      setError("Changement impossible. Verifiez le mot de passe actuel et reessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Changer mon mot de passe" description="Mettez ? jour votre mot de passe de connexion.">
      <form className="space-y-4" onSubmit={submit}>
        <PasswordField id="current-password" label="Mot de passe actuel" value={current} autoComplete="current-password" onChange={setCurrent} />
        <PasswordField id="new-password" label="Nouveau mot de passe" value={password} autoComplete="new-password" onChange={setPassword} />
        <PasswordStrength password={password} />
        <PasswordField id="confirm-password" label="Confirmation" value={confirm} autoComplete="new-password" onChange={setConfirm} />
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div> : null}
        <button disabled={loading} className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Modification..." : "Changer le mot de passe"}</button>
        <button type="button" className="w-full rounded-md border border-line px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-surface" onClick={onDone}>Retour ? l'application</button>
      </form>
    </AuthLayout>
  );
}
