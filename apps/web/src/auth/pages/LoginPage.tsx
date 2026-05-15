import { useState } from "react";
import { LoginForm } from "../components/LoginForm";
import { SecurityProtocolAlert } from "../components/SecurityProtocolAlert";
import { useAuth } from "../hooks/useAuth";
import type { LoginCredentials } from "../types/auth.types";
import { AuthLayout } from "./AuthLayout";

export function LoginPage({ onAuthenticated, onForgotPassword }: { onAuthenticated: () => void; onForgotPassword: () => void }) {
  const { login } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (credentials: LoginCredentials) => {
    setLoading(true);
    setError("");
    try {
      await login(credentials);
      onAuthenticated();
    } catch {
      setError("Connexion impossible. Verifiez vos identifiants et reessayez.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Connexion" description="Accédez ? votre cockpit financier et prévisionnel.">
      <div className="mb-4">
        <SecurityProtocolAlert />
      </div>
      <LoginForm error={error} loading={loading} onSubmit={submit} onForgotPassword={onForgotPassword} />
    </AuthLayout>
  );
}
