import { Download, Plus, Save, Trash2 } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { API_URL, api } from "../api";
import type { Field } from "../types";
import { Badge } from "./Format";
import { DataOriginBadge, inferOriginFromRow } from "./DataOriginBadge";
import { useApiList } from "../hooks/useApi";
import { useI18n } from "../i18n";

export function CrudPage<T extends Record<string, any>>({
  title,
  path,
  fields,
  columns,
  initial,
  description
}: {
  title: string;
  path: string;
  fields: Field[];
  columns: Array<{ key: string; label: string; render?: (row: T) => React.ReactNode }>;
  initial: Record<string, any>;
  description?: string;
}) {
  const { t } = useI18n();
  const { data, loading, error, reload } = useApiList<T>(path);
  const [draft, setDraft] = useState<Record<string, any>>(initial);
  const initialKey = useMemo(() => JSON.stringify(initial), [initial]);
  const mutationPath = useMemo(() => path.split("?")[0], [path]);
  const optionSources = useCrudOptionSources(fields, draft);
  const optionLabelsByField = useMemo(() => {
    return Object.fromEntries(
      fields.map((field) => [
        field.name,
        new Map((field.options ?? optionSources[field.name] ?? []).map((option) => [String(option.value), option.label]))
      ])
    ) as Record<string, Map<string, string>>;
  }, [fields, optionSources]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!editingId) setDraft(initial);
  }, [initialKey, editingId]);

  const visibleRows = useMemo(() => {
    const needle = query.toLowerCase();
    return data.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [data, query]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = pickEditableFields(fields, draft);
    if (editingId) await api(`${mutationPath}/${editingId}`, { method: "PUT", body: JSON.stringify(payload) });
    else await api(mutationPath, { method: "POST", body: JSON.stringify(payload) });
    setDraft(initial);
    setEditingId(null);
    await reload();
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
          <p className="text-sm text-muted">{description ?? `${data.length} ${t("common.records")}`}</p>
        </div>
        <a className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm" href={`${API_URL}/export/resources.csv`}>
          <Download size={16} /> CSV
        </a>
      </div>

      <form onSubmit={submit} className="rounded-lg border border-line bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {fields.map((field) => (
            <label key={field.name} className={field.type === "textarea" ? "md:col-span-3" : ""}>
              <span className="mb-1 block text-xs font-medium text-muted">{field.label}</span>
              {field.type === "select" ? (
                <select className="w-full rounded-md border border-line px-3 py-2" value={String(draft[field.name] ?? "")} onChange={(event) => setDraft(updateDraftSelectValue(fields, draft, field.name, event.target.value))}>
                  {field.placeholder ? <option value="">{field.placeholder}</option> : null}
                  {(field.options ?? optionSources[field.name] ?? []).map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
                </select>
              ) : field.type === "checkbox" ? (
                <input type="checkbox" checked={Boolean(draft[field.name])} onChange={(event) => setDraft({ ...draft, [field.name]: event.target.checked })} />
              ) : field.type === "textarea" ? (
                <textarea className="min-h-20 w-full rounded-md border border-line px-3 py-2" value={draft[field.name] ?? ""} onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })} />
              ) : (
                <input className="w-full rounded-md border border-line px-3 py-2" type={field.type ?? "text"} value={formatInputValue(draft[field.name], field.type)} onChange={(event) => setDraft({ ...draft, [field.name]: field.type === "number" ? Number(event.target.value) : event.target.value })} />
              )}
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white" type="submit">
            {editingId ? <Save size={16} /> : <Plus size={16} />} {editingId ? t("common.save") : t("common.create")}
          </button>
          {editingId ? <button className="rounded-md border border-line px-4 py-2 text-sm" type="button" onClick={() => { setDraft(initial); setEditingId(null); }}>{t("common.cancel")}</button> : null}
        </div>
      </form>

      <div className="rounded-lg border border-line bg-white">
        <div className="border-b border-line p-3">
          <input className="w-full rounded-md border border-line px-3 py-2" placeholder={t("common.filter", "Filtrer...")} value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        {error ? <div className="p-4 text-risk">{error}</div> : null}
        {loading ? <div className="p-4 text-muted">{t("common.loading")}</div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface text-left text-xs uppercase text-muted">
                <tr>
                  {columns.map((column) => <th key={column.key} className="px-3 py-3">{column.label}</th>)}
                  <th className="px-3 py-3">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    {columns.map((column) => <td key={column.key} className="px-3 py-3">{column.render ? column.render(row) : formatCrudCellValue(row, column.key, optionLabelsByField[column.key])}</td>)}
                    <td className="flex gap-2 px-3 py-3">
                      <button className="rounded-md border border-line px-2 py-1" onClick={() => { setEditingId(row.id); setDraft({ ...initial, ...pickEditableFields(fields, row) }); }}>{t("common.edit")}</button>
                      <button className="rounded-md border border-line p-1 text-risk" title={t("common.delete")} onClick={async () => { await api(`${mutationPath}/${row.id}`, { method: "DELETE" }); await reload(); }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {!visibleRows.length ? <tr><td colSpan={columns.length + 1} className="px-3 py-8 text-center text-muted"><Badge>{t("common.noData")}</Badge></td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export function pickEditableFields(fields: Field[], source: Record<string, any>) {
  return Object.fromEntries(fields.map((field) => [field.name, source[field.name]]));
}

function useCrudOptionSources(fields: Field[], draft: Record<string, any>) {
  const [options, setOptions] = useState<Record<string, Array<{ label: string; value: string | number | boolean }>>>({});
  const dynamicSources = fields
    .filter((field) => field.type === "select" && (field.optionsPath || field.optionSourcesByValue))
    .map((field) => {
      const dependentValue = field.optionDependsOn ? String(draft[field.optionDependsOn] ?? "") : "";
      const dependentSource = field.optionDependsOn ? field.optionSourcesByValue?.[dependentValue] : undefined;
      return {
        fieldName: field.name,
        path: dependentSource?.path ?? field.optionsPath,
        labelKey: dependentSource?.optionLabelKey ?? field.optionLabelKey ?? "name",
        labelFields: dependentSource?.optionLabelFields ?? field.optionLabelFields,
        valueKey: dependentSource?.optionValueKey ?? field.optionValueKey ?? "id"
      };
    });
  const dynamicSourcesKey = JSON.stringify(dynamicSources);

  useEffect(() => {
    dynamicSources.forEach((source) => {
      if (!source.path) {
        setOptions((current) => ({ ...current, [source.fieldName]: [] }));
        return;
      }
      api<unknown>(source.path)
        .then((payload) => {
          const rows = normalizeListResponse(payload);
          setOptions((current) => ({
            ...current,
            [source.fieldName]: rows.map((row) => ({
              label: formatOptionLabel(row, source.labelKey, source.valueKey, source.labelFields),
              value: row[source.valueKey]
            }))
          }));
        })
        .catch(() => {
          setOptions((current) => ({ ...current, [source.fieldName]: [] }));
        });
    });
  }, [dynamicSourcesKey]);

  return options;
}

export function normalizeListResponse(payload: unknown): Record<string, any>[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of ["rows", "data", "items", "resources", "connectors"]) {
      if (Array.isArray(record[key])) return record[key] as Record<string, any>[];
    }
  }
  return [];
}

export function updateDraftSelectValue(fields: Field[], draft: Record<string, any>, fieldName: string, value: string) {
  const next = { ...draft, [fieldName]: value };
  fields.forEach((field) => {
    if (field.optionDependsOn === fieldName) next[field.name] = "";
  });
  return next;
}

function formatOptionLabel(row: Record<string, any>, labelKey: string, valueKey: string, labelFields?: string[]) {
  if (labelFields?.length) {
    const label = labelFields.map((field) => row[field]).filter(Boolean).join(" ");
    if (label) return label;
  }
  return String(row[labelKey] ?? row.name ?? row.title ?? row.email ?? row[valueKey]);
}

export function formatCrudCellValue(row: Record<string, any>, key: string, labels?: Map<string, string>) {
  const value = row[key];
  if (["source", "sourceType", "origin", "provider", "primarySource", "sourceAType", "sourceBType"].includes(key)) {
    const origin = inferOriginFromRow(row);
    return <DataOriginBadge kind={value ?? origin.kind} provider={origin.provider} details={origin.details} />;
  }
  if (value === null || value === undefined) return "";
  const optionLabel = labels?.get(String(value));
  if (optionLabel) return optionLabel;

  const relationKey = key.endsWith("Id") ? key.slice(0, -2) : "";
  const relation = relationKey ? row[relationKey] : undefined;
  if (relation && typeof relation === "object") {
    const label = relation.name ?? relation.title ?? relation.label ?? relation.email;
    if (label) return String(label);
    const fullName = [relation.firstName, relation.lastName].filter(Boolean).join(" ");
    if (fullName) return fullName;
  }

  if (key === "ownerUserId" || key === "createdBy" || key === "updatedBy") {
    const user = row.ownerUser ?? row.user ?? row.createdByUser ?? row.updatedByUser;
    const label = user?.name ?? user?.email;
    if (label) return String(label);
  }

  return String(value);
}

function formatInputValue(value: unknown, type?: Field["type"]) {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.join(", ");
  if (type === "date" && typeof value === "string") return value.slice(0, 10);
  return value as string | number;
}
