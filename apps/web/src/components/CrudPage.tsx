import { Download, Plus, Save, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { api } from "../api";
import type { Field } from "../types";
import { Badge } from "./Format";
import { useApiList } from "../hooks/useApi";

export function CrudPage<T extends Record<string, any>>({
  title,
  path,
  fields,
  columns,
  initial
}: {
  title: string;
  path: string;
  fields: Field[];
  columns: Array<{ key: string; label: string; render?: (row: T) => React.ReactNode }>;
  initial: Record<string, any>;
}) {
  const { data, loading, error, reload } = useApiList<T>(path);
  const [draft, setDraft] = useState<Record<string, any>>(initial);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const visibleRows = useMemo(() => {
    const needle = query.toLowerCase();
    return data.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
  }, [data, query]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (editingId) await api(`${path}/${editingId}`, { method: "PUT", body: JSON.stringify(draft) });
    else await api(path, { method: "POST", body: JSON.stringify(draft) });
    setDraft(initial);
    setEditingId(null);
    await reload();
  };

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-normal">{title}</h1>
          <p className="text-sm text-muted">{data.length} enregistrement(s)</p>
        </div>
        <a className="inline-flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2 text-sm" href="/api/export/resources.csv">
          <Download size={16} /> CSV
        </a>
      </div>

      <form onSubmit={submit} className="rounded-lg border border-line bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          {fields.map((field) => (
            <label key={field.name} className={field.type === "textarea" ? "md:col-span-3" : ""}>
              <span className="mb-1 block text-xs font-medium text-muted">{field.label}</span>
              {field.type === "select" ? (
                <select className="w-full rounded-md border border-line px-3 py-2" value={String(draft[field.name] ?? "")} onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })}>
                  {field.options?.map((option) => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
                </select>
              ) : field.type === "checkbox" ? (
                <input type="checkbox" checked={Boolean(draft[field.name])} onChange={(event) => setDraft({ ...draft, [field.name]: event.target.checked })} />
              ) : field.type === "textarea" ? (
                <textarea className="min-h-20 w-full rounded-md border border-line px-3 py-2" value={draft[field.name] ?? ""} onChange={(event) => setDraft({ ...draft, [field.name]: event.target.value })} />
              ) : (
                <input className="w-full rounded-md border border-line px-3 py-2" type={field.type ?? "text"} value={draft[field.name] ?? ""} onChange={(event) => setDraft({ ...draft, [field.name]: field.type === "number" ? Number(event.target.value) : event.target.value })} />
              )}
            </label>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <button className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-white" type="submit">
            {editingId ? <Save size={16} /> : <Plus size={16} />} {editingId ? "Enregistrer" : "Créer"}
          </button>
          {editingId ? <button className="rounded-md border border-line px-4 py-2 text-sm" type="button" onClick={() => { setDraft(initial); setEditingId(null); }}>Annuler</button> : null}
        </div>
      </form>

      <div className="rounded-lg border border-line bg-white">
        <div className="border-b border-line p-3">
          <input className="w-full rounded-md border border-line px-3 py-2" placeholder="Filtrer..." value={query} onChange={(event) => setQuery(event.target.value)} />
        </div>
        {error ? <div className="p-4 text-risk">{error}</div> : null}
        {loading ? <div className="p-4 text-muted">Chargement...</div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-surface text-left text-xs uppercase text-muted">
                <tr>
                  {columns.map((column) => <th key={column.key} className="px-3 py-3">{column.label}</th>)}
                  <th className="px-3 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id} className="border-t border-line">
                    {columns.map((column) => <td key={column.key} className="px-3 py-3">{column.render ? column.render(row) : String(row[column.key] ?? "")}</td>)}
                    <td className="flex gap-2 px-3 py-3">
                      <button className="rounded-md border border-line px-2 py-1" onClick={() => { setEditingId(row.id); setDraft(row); }}>Editer</button>
                      <button className="rounded-md border border-line p-1 text-risk" title="Supprimer" onClick={async () => { await api(`${path}/${row.id}`, { method: "DELETE" }); await reload(); }}><Trash2 size={16} /></button>
                    </td>
                  </tr>
                ))}
                {!visibleRows.length ? <tr><td colSpan={columns.length + 1} className="px-3 py-8 text-center text-muted"><Badge>Aucune donnée</Badge></td></tr> : null}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
