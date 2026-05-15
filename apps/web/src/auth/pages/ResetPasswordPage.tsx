import { FormEvent, useState } from "react";
import { PasswordField } from "../components/PasswordField";
import { PasswordStrength } from "../components/PasswordStrength";
import { authService } from "../services/authService";
import { validatePasswordRules } from "../utils/passwordRules";
import { AuthLayout } from "./AuthLayout";

export function ResetPasswordPage({ token, onBack }: { token?: string; onBack: () => void }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState(token ? "" : "Le lien de reinitialisation est invalide ou incomplet.");
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;
    if (!validatePasswordRules(password).valid) {
      setError("Le nouveau mot de passe ne respecte pas les regles minimales.");
      return;
    }
    if (password !== confirm) {
      setError("Les deux mots de passe ne correspondent pas.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await authService.resetPassword(token, password);
      setMessage("Votre mot de passe a ete mis a jour. Vous pouvez vous connecter.");
    } catch {
      setError("Le lien est invalide ou expire.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Nouveau mot de passe" description="Definissez un mot de passe conforme aux regles de securite.">
      <form className="space-y-4" onSubmit={submit}>
        <PasswordField id="reset-password" label="Nouveau mot de passe" value={password} autoComplete="new-password" onChange={setPassword} />
        <PasswordStrength password={password} />
        <PasswordField id="reset-confirm" label="Confirmation" value={confirm} autoComplete="new-password" onChange={setConfirm} />
        {error ? <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
        {message ? <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</div> : null}
        <button disabled={loading || !token} className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{loading ? "Mise a jour..." : "Definir le mot de passe"}</button>
        <button type="button" className="w-full rounded-md border border-line px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-surface" onClick={onBack}>Retour a la connexion</button>
      </form>
    </AuthLayout>
  );
}
