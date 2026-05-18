# Functional Screen Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make ESN Forecast screens more functionally clear by replacing remaining technical CRUD surfaces with business workflows, adding explanations where data provenance is ambiguous, and removing confusing labels/ids.

**Architecture:** Keep the current feature-based frontend split. Prefer targeted screen-level improvements in `apps/web/src/features/*` and only touch backend routes when an existing endpoint lacks the data needed to display meaningful labels or perform a business action.

**Tech Stack:** React, TypeScript, Vite, Tailwind CSS, Express, Prisma, Vitest.

---

## Functional Audit Summary

### Highest Priority Findings

1. **Some business workflows still look like generic CRUD.**
   - `MonthlyClosePage`, `FinancialRulesPage`, `DataSourcePoliciesPage`, `ReforecastSuggestions`, `Notifications`, and `Workflows` are technically usable but do not explain the expected business process.
   - Users can create/edit rows, but they are not guided through "what to do next".

2. **Calculated screens are not always explicit about source, date, scenario, and recalculation.**
   - `AnnualLandingPage`, `ForecastReliabilityPage`, `RealTreasuryPage`, `RunwayPage`, `PricingDashboardPage`, `UnderpricedMissionsPage`, and `RenegotiationCandidatesPage` need visible source notes.
   - Users need to know whether they are looking at manual inputs, imports, provider data, or a computed result.

3. **Several screens still expose technical labels or raw identifiers.**
   - `AuditPage`, `FinancialAuditPage`, `ActionPlansPage`, `VarianceAnalysesPage`, `Workflows`, `Documents`, and some shared CRUD columns can still show `entityId`, `ownerUserId`, `createdBy`, or enum values directly.
   - Existing `CrudPage.formatCrudCellValue` helps, but custom tables bypass it.

4. **Imports and connector-originated data are not clearly separated from manual data.**
   - `ImportedAccountingPage`, `BankAccountsPage`, `BankTransactionsPage`, `ConnectorSupervisionPage`, and `ProviderConnectionPage` need consistent labels: provider-owned, synced, import CSV, manual correction.
   - Bridge must remain stable. Do not change the Bridge OAuth/sync flow unless the change is purely display-level.

5. **Reporting and operations screens need clearer action outcomes.**
   - `JobsPage`, `ReportsPage`, `CodirReportPage`, `BackupsPage`, and `PerformancePage` need consistent "generated at", "source scenario", "open/download", and "what this action did" feedback.

6. **French copy and enum labels remain inconsistent in some places.**
   - Examples found: `Observabilite`, `Statut systeme`, `Metrique`, `Unite`, `Cle`, `Generer`, `Ecart`, `Severite`, `Prenom`, `Specialite`, `Disponibilité`.
   - Some labels use English enums without user-facing translations.

---

## Task 1: Add A Shared Screen Explanation Component

**Files:**
- Create: `apps/web/src/components/InfoPanel.tsx`
- Modify: screens listed in following tasks
- Test: `apps/web/src/components/InfoPanel.test.tsx`

- [ ] **Step 1: Add a reusable `InfoPanel` component**

```tsx
import type { ReactNode } from "react";

export function InfoPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
      <div className="font-semibold">{title}</div>
      <div className="mt-1 text-sky-900">{children}</div>
    </div>
  );
}
```

- [ ] **Step 2: Add a rendering test**

```tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { InfoPanel } from "./InfoPanel";

describe("InfoPanel", () => {
  it("renders a title and explanation", () => {
    const html = renderToStaticMarkup(<InfoPanel title="Source">Données calculées.</InfoPanel>);
    expect(html).toContain("Source");
    expect(html).toContain("Données calculées.");
  });
});
```

- [ ] **Step 3: Run targeted test**

Run: `npm run test -w @esn-forecast/web -- InfoPanel.test.tsx`

Expected: PASS.

---

## Task 2: Clarify Calculated Budget And Forecast Screens

**Files:**
- Modify: `apps/web/src/features/budget/pages.tsx`

- [ ] **Step 1: Import the shared `InfoPanel`**

Replace local `InfoPanel` definition with:

```tsx
import { InfoPanel } from "../../components/InfoPanel";
```

- [ ] **Step 2: Add source explanations**

Add concise panels:

```tsx
<InfoPanel title="Données calculées">
  Cet écran est calculé à partir du budget actif, du réel mensuel, du rolling forecast et du scénario actif. Il ne remplace pas les écrans de saisie.
</InfoPanel>
```

Apply to:
- `TrajectoryDashboardPage`
- `AnnualLandingPage`
- `BudgetForecastActualPage`
- `RequiredPipelinePage`
- `BudgetStaffingPage`
- `WhatMustBeTruePage`

- [ ] **Step 3: Make labels user-facing**

Replace visible labels:
- `Generation` -> `Génération`
- `Generer` -> `Générer`
- `Annee` -> `Année`
- `Ecart` -> `Écart`
- `Severite` -> `Sévérité`
- `Unite` -> `Unité`

- [ ] **Step 4: Run validation**

Run:

```powershell
npm run build -w @esn-forecast/web
npm run check:text
```

Expected: both pass.

---

## Task 3: Replace Remaining Technical IDs In Custom Tables

**Files:**
- Modify: `apps/web/src/features/budget/pages.tsx`
- Modify: `apps/web/src/features/connected-finance/pages.tsx`
- Modify: `apps/web/src/features/forecasting/pages.tsx`
- Modify: `apps/web/src/features/delivery/pages.tsx`

- [ ] **Step 1: Add label maps where custom tables show users or entities**

For `ActionPlansPage`, load users:

```tsx
const { data: users } = useApi<any[]>("/users");
const userLabels = useMemo(() => new Map((users ?? []).map((user) => [user.id, user.name || user.email || user.id])), [users]);
```

Render:

```tsx
{ key: "ownerUserId", label: "Responsable", render: (row) => userLabels.get(row.ownerUserId) ?? row.ownerUserId ?? "-" }
```

- [ ] **Step 2: Improve audit entity labels**

In `FinancialAuditPage` and `AuditPage`, replace `ID` column with `Objet`.

Display:

```tsx
["entityId", "Objet", (value: string, row: any) => row.entityLabel ?? value]
```

If backend lacks `entityLabel`, keep the fallback but rename the column away from `ID`.

- [ ] **Step 3: Improve workflows linked object display**

In `DeliveryCrudPage(kind === "workflows")`, replace raw `entityId` text field with dependent select like documents:

```tsx
{
  name: "entityId",
  label: "Objet lié",
  type: "select",
  optionDependsOn: "entityType",
  optionSourcesByValue: {
    invoice: { path: "/invoices", optionLabelKey: "invoiceNumber" },
    payment: { path: "/payments", optionLabelFields: ["paymentDate", "amount"] },
    mission: { path: "/missions", optionLabelKey: "title" }
  },
  placeholder: "Sélectionner un objet"
}
```

- [ ] **Step 4: Run validation**

Run:

```powershell
npm run build -w @esn-forecast/web
npm run check:text
```

Expected: both pass.

---

## Task 4: Turn Monthly Close Into A Business Checklist

**Files:**
- Modify: `apps/web/src/features/delivery/pages.tsx`
- Backend already available: `/monthly-closes/:month/close`, `/monthly-closes/:month/reopen`

- [ ] **Step 1: Replace `MonthlyClosePage` generic CRUD with a checklist UI**

Screen sections:
- month selector
- current status
- checklist items:
  - actuals entered
  - invoices reviewed
  - payments reconciled
  - bank transactions reconciled
  - anomalies reviewed
- actions:
  - `Clôturer le mois`
  - `Rouvrir le mois`

- [ ] **Step 2: Keep manual notes**

Allow editing `notes` through the existing `/monthly-closes` CRUD endpoint, but do not expose raw IDs.

- [ ] **Step 3: Add status feedback**

After close/reopen, show:

```tsx
setMessage("Mois clôturé. Les rapports utilisent maintenant ce réel comme référence.");
```

- [ ] **Step 4: Run validation**

Run:

```powershell
npm run build -w @esn-forecast/web
npm test
```

Expected: both pass.

---

## Task 5: Clarify Imported Data And Provider-Owned Screens

**Files:**
- Modify: `apps/web/src/features/connected-finance/pages.tsx`
- Modify: `apps/web/src/features/providers/pages.tsx`

- [ ] **Step 1: Add consistent data ownership panels**

For `BankAccountsPage`:

```tsx
<InfoPanel title="Données provider">
  Les comptes bancaires viennent du connecteur bancaire. Ils ne doivent pas être modifiés manuellement dans ESN Forecast.
</InfoPanel>
```

For `ImportedAccountingPage`:

```tsx
<InfoPanel title="Données comptables importées">
  Ces lignes proviennent d'un connecteur comptable ou d'un import CSV. Les corrections métier se font dans les écrans Factures, Paiements ou Rapprochement facturation.
</InfoPanel>
```

- [ ] **Step 2: Explain Bridge stability**

In `ProviderConnectionPage`, add:

```tsx
<InfoPanel title="Connexion Bridge">
  Bridge utilise une redirection OAuth. L'URL publique configurée doit rester stable pour les callbacks et webhooks.
</InfoPanel>
```

Do not modify Bridge OAuth route behavior.

- [ ] **Step 3: Run validation**

Run:

```powershell
npm run build -w @esn-forecast/web
```

Expected: PASS.

---

## Task 6: Improve Reports And Jobs Action Feedback

**Files:**
- Modify: `apps/web/src/features/forecasting/pages.tsx`
- Modify: `apps/web/src/features/platform/pages.tsx`

- [ ] **Step 1: Add report metadata on the report center**

For each `ReportLink`, display:
- scenario active
- horizon active
- format
- target user

Implementation pattern:

```tsx
<ReportLink
  title="Rapport direction"
  description={`PDF direction basé sur le scénario actif et ${horizon} mois.`}
  href={`${API_URL}/reports/executive.pdf?scenarioId=${scenarioId}&horizon=${horizon}`}
/>
```

- [ ] **Step 2: Add action result feedback in `JobsPage`**

After launching jobs, set a message:

```tsx
setActionMessage("Job lancé. La ligne sera mise à jour lorsque l'exécution sera terminée.");
```

Display it as an info alert.

- [ ] **Step 3: Translate operational labels**

Replace:
- `Observabilite` -> `Observabilité`
- `Logs collectes` -> `Logs collectés`
- `Logs recents` -> `Logs récents`
- `Requetes lentes` -> `Requêtes lentes`
- `Duree ms` -> `Durée ms`
- `Statut systeme` -> `Statut système`
- `Metrique` -> `Métrique`
- `Unite` -> `Unité`
- `Cle` -> `Clé`

- [ ] **Step 4: Run validation**

Run:

```powershell
npm run check:text
npm run build -w @esn-forecast/web
```

Expected: both pass.

---

## Task 7: Make Pricing Screens More Self-Explanatory

**Files:**
- Modify: `apps/web/src/features/pricing/pages.tsx`

- [ ] **Step 1: Add explanation panels**

In `PricingDashboardPage`:

```tsx
<InfoPanel title="Méthode pricing">
  Les scores sont calculés à partir du TJM actuel, du coût complet journalier, de la marge minimum, de la marge cible et des paramètres pricing.
</InfoPanel>
```

In `PricingSimulatorPage`:

```tsx
<InfoPanel title="Simulation sans création">
  Le bouton Simuler recalcule uniquement le résultat affiché. Le bouton Créer la simulation enregistre une nouvelle simulation.
</InfoPanel>
```

In `MissionPricingProfilePage`:

```tsx
<InfoPanel title="Données nécessaires">
  Pour obtenir un TJM plancher fiable, la mission doit avoir des affectations avec TJM vente, jours facturables et coûts ressource.
</InfoPanel>
```

- [ ] **Step 2: Translate table labels**

Replace:
- `Top priorites` -> `Top priorités`
- `Repartition pricing` -> `Répartition pricing`
- `TJM simule` -> `TJM simulé`
- `CA simule` -> `CA simulé`
- `Simulations enregistrees` -> `Simulations enregistrées`
- `Creee le` -> `Créée le`
- `Severite` -> `Sévérité`

- [ ] **Step 3: Run validation**

Run:

```powershell
npm run build -w @esn-forecast/web
npm run check:text
```

Expected: both pass.

---

## Task 8: Improve Shared CRUD Labels And Empty States

**Files:**
- Modify: `apps/web/src/features/shared-crud/crudConfigs.tsx`
- Modify: `apps/web/src/components/CrudPage.tsx`

- [ ] **Step 1: Fix visible French labels**

Replace:
- `Prenom` -> `Prénom`
- `Date entree` -> `Date d'entrée`
- `Placable` -> `Plaçable`
- `Coût estime` -> `Coût estimé`
- `Delai paiement` -> `Délai paiement`
- `Date debut` -> `Date début`
- `Date fin estimee` -> `Date fin estimée`
- `Role` -> `Rôle`
- `Specialite` -> `Spécialité`
- `Disponibilité` -> `Disponibilité`
- `Annuel projete` -> `Annuel projeté`

- [ ] **Step 2: Add `description` support to `CrudPage`**

Extend props:

```tsx
description?: string;
```

Render under title:

```tsx
<p className="text-sm text-muted">{description ?? `${data.length} ${t("common.records")}`}</p>
```

- [ ] **Step 3: Add descriptions to shared configs**

Example:

```tsx
employees: {
  title: "Ressources internes",
  description: "Collaborateurs internes utilisés pour le staffing, la capacité et les coûts prévisionnels.",
  ...
}
```

- [ ] **Step 4: Run validation**

Run:

```powershell
npm run build -w @esn-forecast/web
npm run check:text
```

Expected: both pass.

---

## Task 9: Clarify AI And Demo/Mock Boundaries

**Files:**
- Modify: `apps/web/src/features/delivery/pages.tsx`
- Modify: `apps/web/src/features/providers/pages.tsx`
- Modify: `apps/api/src/features/budget/routes.ts`
- Modify: `apps/api/src/features/connected-finance/routes.ts`

- [ ] **Step 1: Add visible AI guardrail text**

In `AiAnalysisPage`:

```tsx
<InfoPanel title="Analyse encadrée">
  L'analyse ne doit pas inventer de chiffres. Elle résume uniquement les données calculées ou importées par ESN Forecast.
</InfoPanel>
```

- [ ] **Step 2: Label mock/sandbox behavior explicitly**

In `RealConnectorsPage`, replace `mock/sandbox` with:

```tsx
{row.configStatus?.ok ? "Configuré" : "Sandbox ou mock"}
```

- [ ] **Step 3: Separate demo routes from user-facing wording**

Keep backend demo endpoints for tests, but avoid linking to `.demo` routes in UI unless the screen is explicitly a demo/admin tool.

- [ ] **Step 4: Run validation**

Run:

```powershell
npm run build -w @esn-forecast/web
npm test
```

Expected: both pass.

---

## Task 10: Final Quality Pass

**Files:**
- All changed files

- [ ] **Step 1: Search for remaining mojibake and missing accents**

Run:

```powershell
rg -n "mojibake|Disponibilit\\?|Observabilite|systeme|Metrique|Unite|Severite|Ecart|Generer|Prenom|Specialite|Cle" apps/web/src apps/api/src
```

Expected: no user-facing occurrences remain.

- [ ] **Step 2: Run full validation**

Run:

```powershell
npm run build -w @esn-forecast/api
npm run build -w @esn-forecast/web
npm run check:text
npm test
```

Expected: all commands pass.

- [ ] **Step 3: Manual smoke test**

Start app:

```powershell
npm run start:https
```

Check screens:
- Budgets
- Rolling Forecast
- Rapprochement bancaire
- Rapprochement facturation
- Supervision connecteurs
- Profil pricing mission
- Simulateur pricing
- Jobs
- Rapports
- Paramètres

Expected: no blank page, no raw IDs where labels exist, explanatory panels visible.

---

## Suggested Execution Order

1. Task 8: shared labels and generic CRUD descriptions.
2. Task 6: reports/jobs/operations clarity.
3. Task 2: calculated budget and forecast explanations.
4. Task 7: pricing explanations.
5. Task 3: remaining raw IDs in custom tables.
6. Task 4: monthly close workflow.
7. Task 5: imported/provider-owned data clarity.
8. Task 9: AI and demo/mock boundaries.
9. Task 10: final quality pass.

This order removes broad UX friction first, then tackles deeper workflow screens.
