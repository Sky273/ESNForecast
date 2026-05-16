import { Clock } from "lucide-react";
import { AuthLayout } from "./AuthLayout";

export function SessionExpiredPage({ onLogin }: { onLogin: () => void }) {
  return (
    <AuthLayout title="Session expirée" description="Votre session a expiré. Veuillez vous reconnecter.">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-line bg-surface p-3 text-sm text-slate-700">
          <Clock size={18} className="mt-0.5 shrink-0 text-muted" />
          <p>Après reconnexion, vous serez redirigé vers la page demandée lorsque c'est possible.</p>
        </div>
        <button className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white" onClick={onLogin}>Se reconnecter</button>
      </div>
    </AuthLayout>
  );
}
