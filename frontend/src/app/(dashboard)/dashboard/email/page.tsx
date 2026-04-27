"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import { Plus, Send, Trash2, Pencil, X, Mail, Sparkles, Users, ChevronDown } from "lucide-react";

interface MailingList { id: string; name: string; subscriberCount: number; }
interface Subscriber { email: string; status: string; }

interface EmailCampaign {
  id: string;
  subject: string;
  previewText: string | null;
  htmlBody: string;
  plainText: string | null;
  recipientList: string[];
  status: "draft" | "scheduled" | "sent";
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  scheduled: "bg-blue-50 text-blue-600",
  sent: "bg-green-50 text-green-600",
};

function CampaignModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: Partial<EmailCampaign>;
  onClose: () => void;
  onSave: (data: Partial<EmailCampaign>) => void;
  saving: boolean;
}) {
  const [form, setForm] = useState({
    subject: initial?.subject ?? "",
    previewText: initial?.previewText ?? "",
    htmlBody: initial?.htmlBody ?? "",
    plainText: initial?.plainText ?? "",
    recipients: (initial?.recipientList ?? []).join(", "),
    scheduledAt: initial?.scheduledAt ? initial.scheduledAt.slice(0, 16) : "",
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [listLoading, setListLoading] = useState(false);
  const [showListPicker, setShowListPicker] = useState(false);

  const { data: mailingLists = [] } = useQuery<MailingList[]>({
    queryKey: ["mailing-lists"],
    queryFn: () => api.get<MailingList[]>("/mailing-lists"),
  });

  async function importFromList(listId: string, listName: string) {
    setListLoading(true);
    setShowListPicker(false);
    try {
      const subscribers = await api.get<Subscriber[]>(`/mailing-lists/${listId}/subscribers`);
      const active = subscribers.filter((s) => s.status === "active").map((s) => s.email);
      if (active.length === 0) { alert(`"${listName}" has no active subscribers.`); return; }
      const existing = form.recipients.split(",").map((e) => e.trim()).filter(Boolean);
      const merged = [...new Set([...existing, ...active])];
      setForm((f) => ({ ...f, recipients: merged.join(", ") }));
    } catch {
      alert("Failed to load subscribers from that list.");
    } finally {
      setListLoading(false);
    }
  }

  async function generateWithAI() {
    if (!form.subject) { alert("Enter a subject line first"); return; }
    setAiLoading(true);
    try {
      const res = await api.post<{ html: string; plain: string }>("/email-campaigns/generate", {
        subject: form.subject,
        previewText: form.previewText,
      });
      setForm((f) => ({ ...f, htmlBody: res.html, plainText: res.plain }));
    } catch {
      alert("AI generation not yet available — write the body manually.");
    } finally {
      setAiLoading(false);
    }
  }

  function handleSave() {
    const recipientList = form.recipients
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    onSave({
      subject: form.subject,
      previewText: form.previewText || null,
      htmlBody: form.htmlBody,
      plainText: form.plainText || null,
      recipientList,
      scheduledAt: form.scheduledAt || null,
    });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">{initial?.id ? "Edit campaign" : "New campaign"}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Subject line</label>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Your subject line"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Preview text</label>
            <input
              value={form.previewText}
              onChange={(e) => setForm({ ...form, previewText: e.target.value })}
              placeholder="Short preview shown in the inbox…"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Body (HTML)</label>
              <button
                onClick={generateWithAI}
                disabled={aiLoading}
                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium"
              >
                <Sparkles className="w-3 h-3" />
                {aiLoading ? "Generating…" : "Generate with AI"}
              </button>
            </div>
            <textarea
              value={form.htmlBody}
              onChange={(e) => setForm({ ...form, htmlBody: e.target.value })}
              placeholder="<p>Hi {{name}},</p><p>Your email body here…</p>"
              rows={8}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Plain text fallback</label>
            <textarea
              value={form.plainText}
              onChange={(e) => setForm({ ...form, plainText: e.target.value })}
              rows={4}
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-sm font-medium text-gray-700">Recipients</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowListPicker((s) => !s)}
                  disabled={listLoading}
                  className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium border border-green-200 hover:bg-green-50 px-2.5 py-1 rounded-lg transition-colors disabled:opacity-50"
                >
                  <Users className="w-3 h-3" />
                  {listLoading ? "Loading…" : "Add from mailing list"}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showListPicker && (
                  <div className="absolute right-0 top-full mt-1 z-20 w-64 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                    <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                      <span className="text-xs font-medium text-gray-700">Select a list to import</span>
                      <button type="button" onClick={() => setShowListPicker(false)} className="text-gray-400 hover:text-gray-600">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {mailingLists.length === 0 ? (
                      <div className="px-3 py-4 text-center">
                        <p className="text-xs text-gray-400">No mailing lists yet.</p>
                        <Link href="/dashboard/email/lists" className="text-xs text-green-600 hover:underline mt-1 block" onClick={() => setShowListPicker(false)}>
                          Create a list →
                        </Link>
                      </div>
                    ) : (
                      <div className="max-h-48 overflow-y-auto">
                        {mailingLists.map((list) => (
                          <button
                            key={list.id}
                            type="button"
                            onClick={() => importFromList(list.id, list.name)}
                            className="w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors flex items-center justify-between gap-2"
                          >
                            <span className="text-sm text-gray-800 truncate">{list.name}</span>
                            <span className="text-xs text-gray-400 shrink-0">{list.subscriberCount} subscribers</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            <textarea
              value={form.recipients}
              onChange={(e) => setForm({ ...form, recipients: e.target.value })}
              rows={3}
              placeholder="alice@example.com, bob@example.com"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
            {form.recipients && (
              <p className="text-xs text-gray-400 mt-1">
                {form.recipients.split(",").map((e) => e.trim()).filter(Boolean).length} recipient(s)
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Schedule (optional)</label>
            <input
              type="datetime-local"
              value={form.scheduledAt}
              onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })}
              className="px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-6 py-4 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !form.subject || !form.htmlBody}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function EmailCampaignsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<EmailCampaign | null>(null);
  const [sending, setSending] = useState<string | null>(null);

  const { data: campaigns = [], isLoading } = useQuery<EmailCampaign[]>({
    queryKey: ["email-campaigns"],
    queryFn: () => api.get("/email-campaigns"),
  });

  const { mutate: createCampaign, isPending: creating } = useMutation({
    mutationFn: (data: Partial<EmailCampaign>) => api.post("/email-campaigns", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-campaigns"] }); setShowCreate(false); },
  });

  const { mutate: updateCampaign, isPending: updating } = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<EmailCampaign>) =>
      api.patch(`/email-campaigns/${id}`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["email-campaigns"] }); setEditing(null); },
  });

  const { mutate: deleteCampaign } = useMutation({
    mutationFn: (id: string) => api.delete(`/email-campaigns/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["email-campaigns"] }),
  });

  async function handleSend(campaign: EmailCampaign) {
    if (!confirm(`Send "${campaign.subject}" to ${campaign.recipientList.length} recipient(s)?`)) return;
    setSending(campaign.id);
    try {
      const res = await api.post<{ sent: boolean; recipients: number }>(`/email-campaigns/${campaign.id}/send`, {});
      alert(`Sent to ${res.recipients} recipient(s)`);
      qc.invalidateQueries({ queryKey: ["email-campaigns"] });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSending(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Email Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">Create, schedule, and send email campaigns</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-sm font-semibold transition-colors"
        >
          <Plus className="w-4 h-4" /> New campaign
        </button>
      </div>

      {/* Sub-nav */}
      <div className="flex items-center gap-1 border-b border-gray-200 mb-6">
        <span className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-green-600 text-green-700 -mb-px">
          <Mail className="w-4 h-4" /> Campaigns
        </span>
        <Link
          href="/dashboard/email/lists"
          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-700 -mb-px transition-colors"
        >
          <Users className="w-4 h-4" /> Mailing Lists
        </Link>
      </div>

      {(showCreate || editing) && (
        <CampaignModal
          initial={editing ?? undefined}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSave={(data) => {
            if (editing) {
              updateCampaign({ id: editing.id, ...data });
            } else {
              createCampaign(data);
            }
          }}
          saving={creating || updating}
        />
      )}

      {isLoading && <div className="text-sm text-gray-400">Loading…</div>}

      {!isLoading && campaigns.length === 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Mail className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">No campaigns yet</p>
          <p className="text-xs text-gray-400">Create your first email campaign above.</p>
        </div>
      )}

      <div className="space-y-3">
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-semibold text-gray-900 truncate">{campaign.subject}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLORS[campaign.status] ?? ""}`}>
                    {campaign.status}
                  </span>
                </div>
                {campaign.previewText && (
                  <p className="text-xs text-gray-500 truncate mb-2">{campaign.previewText}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span>{campaign.recipientList.length} recipient{campaign.recipientList.length !== 1 ? "s" : ""}</span>
                  {campaign.scheduledAt && <span>Scheduled: {new Date(campaign.scheduledAt).toLocaleString()}</span>}
                  {campaign.sentAt && <span>Sent: {new Date(campaign.sentAt).toLocaleString()}</span>}
                  <span>Created {new Date(campaign.createdAt).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {campaign.status !== "sent" && (
                  <>
                    <button
                      onClick={() => setEditing(campaign)}
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleSend(campaign)}
                      disabled={sending === campaign.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-lg text-xs font-semibold transition-colors"
                    >
                      <Send className="w-3 h-3" />
                      {sending === campaign.id ? "Sending…" : "Send now"}
                    </button>
                    <button
                      onClick={() => { if (confirm("Delete this campaign?")) deleteCampaign(campaign.id); }}
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
