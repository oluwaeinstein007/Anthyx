"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Mail, Pencil, Save, X, Eye, Code2, RotateCcw, CheckCircle2 } from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  htmlBody: string;
  plainText: string | null;
  variables: string[];
  updatedAt: string;
}

function replaceVariables(text: string): string {
  return text
    .replace(/\{\{name\}\}/g, "Alex Johnson")
    .replace(/\{\{verifyUrl\}\}/g, "https://app.anthyx.ai/verify-email?token=abc123")
    .replace(/\{\{resetUrl\}\}/g, "https://app.anthyx.ai/reset-password?token=abc123")
    .replace(/\{\{expiresIn\}\}/g, "24 hours")
    .replace(/\{\{trialEndDate\}\}/g, "May 5, 2026")
    .replace(/\{\{upgradeUrl\}\}/g, "https://app.anthyx.ai/billing/upgrade")
    .replace(/\{\{amount\}\}/g, "$49.00")
    .replace(/\{\{retryDate\}\}/g, "May 10, 2026")
    .replace(/\{\{updatePaymentUrl\}\}/g, "https://app.anthyx.ai/billing")
    .replace(/\{\{platform\}\}/g, "Instagram")
    .replace(/\{\{postId\}\}/g, "abc-123")
    .replace(/\{\{error\}\}/g, "Token expired")
    .replace(/\{\{reviewUrl\}\}/g, "https://app.anthyx.ai/review");
}

export default function EmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [previewMode, setPreviewMode] = useState<"html" | "plain">("html");
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const [editSubject, setEditSubject] = useState("");
  const [editHtml, setEditHtml] = useState("");
  const [editPlain, setEditPlain] = useState("");

  useEffect(() => {
    api.get<EmailTemplate[]>("/admin/email-templates")
      .then(setTemplates)
      .finally(() => setLoading(false));
  }, []);

  const selected = templates.find((t) => t.id === selectedId) ?? null;

  function startEdit(t: EmailTemplate) {
    setEditSubject(t.subject);
    setEditHtml(t.htmlBody);
    setEditPlain(t.plainText ?? "");
    setSaveError("");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveError("");
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setSaveError("");
    try {
      const updated = await api.put<EmailTemplate>(`/admin/email-templates/${selected.id}`, {
        subject: editSubject,
        htmlBody: editHtml,
        plainText: editPlain || null,
      });
      setTemplates((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      setEditing(false);
      setSavedId(updated.id);
      setTimeout(() => setSavedId(null), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex gap-6">
      {/* Template list */}
      <div className="w-72 shrink-0">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white">Email Templates</h1>
          <p className="text-sm text-gray-500 mt-1">Edit transactional email templates</p>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-gray-800 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => { setSelectedId(t.id); setEditing(false); }}
                className={`w-full flex items-start gap-3 px-3 py-3 rounded-lg text-left transition-colors ${
                  selectedId === t.id
                    ? "bg-red-950 border border-red-800"
                    : "hover:bg-gray-900 border border-transparent"
                }`}
              >
                <Mail className={`w-4 h-4 mt-0.5 shrink-0 ${selectedId === t.id ? "text-red-400" : "text-gray-500"}`} />
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-medium truncate ${selectedId === t.id ? "text-red-300" : "text-gray-300"}`}>{t.name}</p>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{t.subject}</p>
                </div>
                {savedId === t.id && <CheckCircle2 className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Detail panel */}
      <div className="flex-1 min-w-0">
        {!selected ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <div className="w-12 h-12 bg-gray-900 rounded-xl flex items-center justify-center mb-3">
              <Mail className="w-6 h-6 text-gray-600" />
            </div>
            <p className="text-sm text-gray-500">Select a template to edit</p>
          </div>
        ) : editing ? (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <h2 className="text-lg font-bold text-white">{selected.name}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => { setEditSubject(selected.subject); setEditHtml(selected.htmlBody); setEditPlain(selected.plainText ?? ""); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Reset
                </button>
                <button
                  onClick={cancelEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 border border-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-3 h-3" /> Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:bg-red-900 text-white rounded-lg transition-colors"
                >
                  <Save className="w-3 h-3" />
                  {saving ? "Saving…" : "Save changes"}
                </button>
              </div>
            </div>

            {saveError && <p className="text-xs text-red-400">{saveError}</p>}

            {/* Variables reference */}
            <div className="flex flex-wrap gap-1.5">
              {selected.variables.map((v) => (
                <code key={v} className="text-xs px-2 py-0.5 bg-gray-800 text-green-400 rounded font-mono">{v}</code>
              ))}
            </div>

            {/* Subject */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Subject line</label>
              <input
                value={editSubject}
                onChange={(e) => setEditSubject(e.target.value)}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* HTML body */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">HTML body</label>
              <textarea
                value={editHtml}
                onChange={(e) => setEditHtml(e.target.value)}
                rows={12}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 font-mono focus:outline-none focus:ring-2 focus:ring-red-500 resize-y"
              />
            </div>

            {/* Plain text */}
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Plain text fallback</label>
              <textarea
                value={editPlain}
                onChange={(e) => setEditPlain(e.target.value)}
                rows={8}
                className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm text-gray-200 font-mono focus:outline-none focus:ring-2 focus:ring-red-500 resize-y"
              />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h2 className="text-lg font-bold text-white">{selected.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Last updated: {new Date(selected.updatedAt).toLocaleString()}
                </p>
              </div>
              <button
                onClick={() => startEdit(selected)}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-gray-800 hover:bg-gray-700 text-white rounded-lg border border-gray-700 transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" /> Edit template
              </button>
            </div>

            {/* Meta */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Subject line</p>
                <p className="text-sm text-white">{selected.subject}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Available variables</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.variables.map((v) => (
                    <code key={v} className="text-xs px-2 py-0.5 bg-gray-800 text-green-400 rounded font-mono">{v}</code>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview with live variable substitution */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
                <p className="text-xs font-medium text-gray-400">Live preview (with sample values)</p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPreviewMode("html")}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                      previewMode === "html" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <Eye className="w-3 h-3" /> HTML
                  </button>
                  <button
                    onClick={() => setPreviewMode("plain")}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs rounded-md transition-colors ${
                      previewMode === "plain" ? "bg-gray-700 text-white" : "text-gray-500 hover:text-gray-300"
                    }`}
                  >
                    <Code2 className="w-3 h-3" /> Plain text
                  </button>
                </div>
              </div>

              {previewMode === "html" ? (
                <div
                  className="px-5 py-4 text-sm text-gray-900 bg-white"
                  dangerouslySetInnerHTML={{ __html: replaceVariables(selected.htmlBody) }}
                />
              ) : (
                <pre className="px-5 py-4 text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                  {replaceVariables(selected.plainText ?? "(no plain text set)")}
                </pre>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
