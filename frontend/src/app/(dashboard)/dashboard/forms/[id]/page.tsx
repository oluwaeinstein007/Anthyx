"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Plus, Trash2, GripVertical, Save, ArrowLeft, Download,
  Eye, Sparkles, ChevronDown, ChevronUp, Copy, BarChart2,
  X, Link2,
} from "lucide-react";

type FieldType =
  | "short_text" | "long_text" | "multiple_choice" | "single_choice"
  | "rating" | "nps" | "scale" | "date" | "email" | "yes_no";

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[]; // for choice fields
  min?: number;
  max?: number;
}

interface FormData {
  id: string;
  title: string;
  description: string | null;
  fields: FormField[];
  isActive: boolean;
  responseCount: number;
}

interface ResponseData {
  responses: Array<{ id: string; submittedAt: string; respondentEmail: string | null; data: Record<string, unknown> }>;
}

const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  short_text: "Short text",
  long_text: "Long text",
  multiple_choice: "Multiple choice",
  single_choice: "Single choice",
  rating: "Rating (1–5 ★)",
  nps: "NPS (0–10)",
  scale: "Scale (1–10)",
  date: "Date",
  email: "Email",
  yes_no: "Yes / No",
};

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function FieldEditor({
  field,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  field: FormField;
  onChange: (f: FormField) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [open, setOpen] = useState(true);
  const needsOptions = field.type === "multiple_choice" || field.type === "single_choice";

  function addOption() {
    onChange({ ...field, options: [...(field.options ?? []), ""] });
  }

  function updateOption(i: number, val: string) {
    const opts = [...(field.options ?? [])];
    opts[i] = val;
    onChange({ ...field, options: opts });
  }

  function removeOption(i: number) {
    const opts = (field.options ?? []).filter((_, idx) => idx !== i);
    onChange({ ...field, options: opts });
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100 cursor-pointer" onClick={() => setOpen((v) => !v)}>
        <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
        <span className="text-xs font-medium text-gray-500 bg-white border border-gray-200 px-2 py-0.5 rounded-lg">
          {FIELD_TYPE_LABELS[field.type]}
        </span>
        <p className="flex-1 text-sm font-medium text-gray-800 truncate">{field.label || "Untitled field"}</p>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} className="p-1 hover:bg-gray-200 rounded transition-colors">
            <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} className="p-1 hover:bg-gray-200 rounded transition-colors">
            <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-1 hover:bg-red-100 rounded transition-colors">
            <Trash2 className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
          </button>
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </div>

      {open && (
        <div className="p-4 space-y-3">
          {/* Label */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Question label</label>
            <input
              type="text"
              value={field.label}
              onChange={(e) => onChange({ ...field, label: e.target.value })}
              placeholder="Enter your question…"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {/* Field type */}
          <div>
            <label className="text-xs font-medium text-gray-500 mb-1 block">Field type</label>
            <select
              value={field.type}
              onChange={(e) => onChange({ ...field, type: e.target.value as FieldType, options: undefined })}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 bg-white"
            >
              {Object.entries(FIELD_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>

          {/* Placeholder (text fields) */}
          {(field.type === "short_text" || field.type === "long_text" || field.type === "email") && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Placeholder (optional)</label>
              <input
                type="text"
                value={field.placeholder ?? ""}
                onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
              />
            </div>
          )}

          {/* Options */}
          {needsOptions && (
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Options</label>
              <div className="space-y-2">
                {(field.options ?? []).map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateOption(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
                    />
                    <button onClick={() => removeOption(i)} className="p-1.5 hover:bg-red-50 rounded-lg">
                      <X className="w-3.5 h-3.5 text-gray-400 hover:text-red-500" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={addOption}
                  className="text-xs text-green-600 hover:text-green-700 font-medium flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Add option
                </button>
              </div>
            </div>
          )}

          {/* Required toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={field.required}
              onChange={(e) => onChange({ ...field, required: e.target.checked })}
              className="w-4 h-4 accent-green-600 rounded"
            />
            <span className="text-xs text-gray-600">Required field</span>
          </label>
        </div>
      )}
    </div>
  );
}

function ResponsesTab({ formId, fields }: { formId: string; fields: FormField[] }) {
  const { data, isLoading } = useQuery<ResponseData>({
    queryKey: ["form-responses", formId],
    queryFn: () => api.get<ResponseData>(`/forms/${formId}/responses?limit=100`),
  });

  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [summarising, setSummarising] = useState(false);

  async function getSummary() {
    setSummarising(true);
    try {
      const r = await api.post<{ summary: string }>(`/forms/${formId}/ai-summary`);
      setAiSummary(r.summary);
    } catch {
      setAiSummary("Summary failed. Please try again.");
    } finally {
      setSummarising(false);
    }
  }

  if (isLoading) return <div className="h-24 bg-gray-100 rounded-2xl animate-pulse" />;

  const responses = data?.responses ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{responses.length}</span> response{responses.length !== 1 ? "s" : ""}
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={getSummary}
            disabled={summarising || responses.length === 0}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl transition-colors disabled:opacity-50"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {summarising ? "Analysing…" : "AI Summary"}
          </button>
          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1"}/forms/${formId}/export`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" /> Export CSV
          </a>
        </div>
      </div>

      {aiSummary && (
        <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl">
          <div className="flex items-start gap-2">
            <Sparkles className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
            <p className="text-sm text-purple-900 leading-relaxed">{aiSummary}</p>
          </div>
        </div>
      )}

      {responses.length === 0 ? (
        <div className="text-center py-12 bg-white border border-dashed border-gray-200 rounded-2xl">
          <BarChart2 className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm text-gray-500">No responses yet. Share your form to start collecting data.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">Email</th>
                {fields.slice(0, 5).map((f) => (
                  <th key={f.id} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap max-w-[160px] truncate">
                    {f.label.length > 30 ? f.label.slice(0, 30) + "…" : f.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {responses.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap">
                    {new Date(r.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">
                    {r.respondentEmail ?? <span className="text-gray-300">—</span>}
                  </td>
                  {fields.slice(0, 5).map((f) => {
                    const val = r.data[f.id];
                    const display = Array.isArray(val) ? val.join(", ") : String(val ?? "—");
                    return (
                      <td key={f.id} className="px-4 py-2.5 text-gray-700 max-w-[160px] truncate">
                        {display}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function FormBuilderPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"builder" | "responses">("builder");
  const [copied, setCopied] = useState(false);

  const { data: form, isLoading } = useQuery<FormData>({
    queryKey: ["form", id],
    queryFn: () => api.get<FormData>(`/forms/${id}`),
  });

  const [localTitle, setLocalTitle] = useState("");
  const [localDesc, setLocalDesc] = useState("");
  const [localFields, setLocalFields] = useState<FormField[]>([]);
  const [initialised, setInitialised] = useState(false);

  if (form && !initialised) {
    setLocalTitle(form.title);
    setLocalDesc(form.description ?? "");
    setLocalFields((form.fields as FormField[]) ?? []);
    setInitialised(true);
  }

  const save = useMutation({
    mutationFn: () =>
      api.put(`/forms/${id}`, {
        title: localTitle,
        description: localDesc || null,
        fields: localFields,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["form", id] }),
  });

  function addField(type: FieldType = "short_text") {
    const newField: FormField = {
      id: uid(),
      type,
      label: "",
      required: false,
      options: type === "multiple_choice" || type === "single_choice" ? ["", ""] : undefined,
    };
    setLocalFields((prev) => [...prev, newField]);
  }

  function updateField(idx: number, updated: FormField) {
    setLocalFields((prev) => prev.map((f, i) => (i === idx ? updated : f)));
  }

  function removeField(idx: number) {
    setLocalFields((prev) => prev.filter((_, i) => i !== idx));
  }

  function moveField(idx: number, dir: -1 | 1) {
    const next = idx + dir;
    if (next < 0 || next >= localFields.length) return;
    const copy = [...localFields];
    [copy[idx]!, copy[next]!] = [copy[next]!, copy[idx]!];
    setLocalFields(copy);
  }

  const publicUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/f/${id}`;

  function copyLink() {
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (isLoading) {
    return (
      <div className="space-y-4 animate-pulse max-w-2xl">
        <div className="h-8 bg-gray-200 rounded-lg w-48" />
        <div className="h-40 bg-gray-100 rounded-2xl" />
        <div className="h-32 bg-gray-100 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push("/dashboard/forms")}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Forms
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={copyLink}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Link2 className="w-3.5 h-3.5" />
            {copied ? "Copied!" : "Copy link"}
          </button>
          <a
            href={publicUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            <Eye className="w-3.5 h-3.5" /> Preview
          </a>
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl disabled:opacity-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {/* Title & description */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
        <input
          type="text"
          value={localTitle}
          onChange={(e) => setLocalTitle(e.target.value)}
          placeholder="Form title"
          className="w-full text-xl font-bold text-gray-900 border-0 outline-none focus:ring-0 placeholder-gray-300"
        />
        <textarea
          value={localDesc}
          onChange={(e) => setLocalDesc(e.target.value)}
          placeholder="Add a description (optional) — e.g. 'Help us understand your content preferences so we can create better for you.'"
          rows={2}
          className="w-full text-sm text-gray-600 border-0 outline-none focus:ring-0 resize-none placeholder-gray-300"
        />
        {/* Embed snippet */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
          <p className="text-xs font-medium text-gray-500 mb-1">Embed snippet</p>
          <code className="text-xs text-gray-600 break-all">
            {`<script src="${typeof window !== "undefined" ? window.location.origin : "https://app.anthyx.com"}/embed.js" data-form-id="${id}"></script>`}
          </code>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {(["builder", "responses"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
              tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "builder" ? (
        <div className="space-y-3">
          {localFields.map((field, idx) => (
            <FieldEditor
              key={field.id}
              field={field}
              onChange={(updated) => updateField(idx, updated)}
              onRemove={() => removeField(idx)}
              onMoveUp={() => moveField(idx, -1)}
              onMoveDown={() => moveField(idx, 1)}
            />
          ))}

          {/* Add field */}
          <div className="bg-white border border-dashed border-gray-200 rounded-2xl p-4">
            <p className="text-xs font-medium text-gray-500 mb-3">Add a field</p>
            <div className="flex flex-wrap gap-2">
              {(Object.entries(FIELD_TYPE_LABELS) as [FieldType, string][]).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => addField(type)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  <Plus className="w-3 h-3" /> {label}
                </button>
              ))}
            </div>
          </div>

          {localFields.length > 0 && (
            <div className="flex justify-end">
              <button
                onClick={() => save.mutate()}
                disabled={save.isPending}
                className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl disabled:opacity-50 transition-colors"
              >
                <Save className="w-4 h-4" />
                {save.isPending ? "Saving…" : "Save form"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <ResponsesTab formId={id!} fields={localFields} />
      )}
    </div>
  );
}
