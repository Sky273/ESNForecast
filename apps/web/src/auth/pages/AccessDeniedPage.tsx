import { ShieldAlert } from "lucide-react";
import { AuthLayout } from "./AuthLayout";

export function AccessDeniedPage({ onDashboard }: { onDashboard: () => void }) {
  return (
    <AuthLayout title="Accès refuse" description="Votre role ne permet pas d'acceder ? cette page ou ? cette ressource.">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <ShieldAlert size={18} className="mt-0.5 shrink-0" />
          <p>Contactez un administrateur si cet acces est nécessaire pour votre périmètre.</p>
        </div>
        <button className="w-full rounded-md bg-brand px-4 py-2.5 text-sm font-semibold text-white" onClick={onDashboard}>Retour au tableau de bord</button>
      </div>
    </AuthLayout>
  );
}
