"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import {
  Plus, Users, Pencil, Trash2, X, Archive, ArchiveRestore,
  Upload, Search, UserMinus, UserCheck, ChevronRight, Mail,
} from "lucide-react";

interface MailingList {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  archivedAt: string | null;
  subscriberCount: number;
  createdAt: string;
}

interface Subscriber {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  tags: string[];
  status: "active" | "unsubscribed";
  addedAt: string;
}

// ── List form modal ───────────────────────────────────────────────────────────

function ListModal({
  initial,
  onClose,
  onSave,
  saving,
}: {
  initial?: Partial<MailingList>;
  onClose: () => void;
  onSave: (data: { name: string; description?: string; tags: string[] }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);

  function addTag() {
    const t = tagInput.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {initial?.id ? "Edit list" : "New mailing list"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Newsletter subscribers"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="What is this list for?"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tags</label>
            <div className="flex gap-2">
              <input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                placeholder="Type and press Enter"
                className="flex-1 px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              <button onClick={addTag} className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700">Add</button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {tags.map((t) => (
                  <span key={t} className="flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 rounded-full text-xs font-medium">
                    {t}
                    <button onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="text-green-500 hover:text-green-700"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={() => onSave({ name, description: description || undefined, tags })}
            disabled={saving || !name.trim()}
            className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Add subscriber modal ──────────────────────────────────────────────────────

function AddSubscriberModal({
  onClose,
  onAdd,
  adding,
}: {
  onClose: () => void;
  onAdd: (data: { email: string; firstName?: string; lastName?: string }) => void;
  adding: boolean;
}) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Add subscriber</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="subscriber@example.com"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">First name</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Last name</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Doe"
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={() => onAdd({ email, firstName: firstName || undefined, lastName: lastName || undefined })}
            disabled={adding || !email.includes("@")}
            className="px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            {adding ? "Adding…" : "Add subscriber"}
          </button>
          <button onClick={onClose} className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Subscribers panel ─────────────────────────────────────────────────────────

function SubscribersPanel({
  list,
  onBack,
}: {
  list: MailingList;
  onBack: () => void;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: subscribers = [], isLoading } = useQuery<Subscriber[]>({
    queryKey: ["subscribers", list.id, search],
    queryFn: () =>
      api.get<Subscriber[]>(`/mailing-lists/${list.id}/subscribers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  });

  const addSubscriber = useMutation({
    mutationFn: (data: { email: string; firstName?: string; lastName?: string }) =>
      api.post(`/mailing-lists/${list.id}/subscribers`, data),
    onSuccess: () => { setShowAdd(false); qc.invalidateQueries({ queryKey: ["subscribers", list.id] }); qc.invalidateQueries({ queryKey: ["mailing-lists"] }); },
  });

  const removeSubscriber = useMutation({
    mutationFn: (id: string) => api.delete(`/mailing-lists/${list.id}/subscribers/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subscribers", list.id] }); qc.invalidateQueries({ queryKey: ["mailing-lists"] }); },
  });

  const toggleStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: "active" | "unsubscribed" }) =>
      api.patch(`/mailing-lists/${list.id}/subscribers/${id}`, { status }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscribers", list.id] }),
  });

  async function importCsv(file: File) {
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").filter(Boolean);
      const subscribers = lines.slice(1).map((line) => {
        const [email, firstName, lastName] = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
        return { email, firstName: firstName || undefined, lastName: lastName || undefined };
      }).filter((s) => s.email?.includes("@"));
      if (subscribers.length > 0) {
        await api.post(`/mailing-lists/${list.id}/subscribers`, { subscribers });
        qc.invalidateQueries({ queryKey: ["subscribers", list.id] });
        qc.invalidateQueries({ queryKey: ["mailing-lists"] });
      }
    } finally {
      setImporting(false);
    }
  }

  const active = subscribers.filter((s) => s.status === "active").length;

  return (
    <div>
      {showAdd && (
        <AddSubscriberModal
          onClose={() => setShowAdd(false)}
          onAdd={(data) => addSubscriber.mutate(data)}
          adding={addSubscriber.isPending}
        />
      )}

      {/* Header */}
      <div className="mb-6">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
          <ChevronRight className="w-4 h-4 rotate-180" /> All lists
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-bold text-gray-900">{list.name}</h2>
            {list.description && <p className="text-sm text-gray-500 mt-0.5">{list.description}</p>}
            <p className="text-xs text-gray-400 mt-1">{active} active subscriber{active !== 1 ? "s" : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ""; }}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              {importing ? "Importing…" : "Import CSV"}
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" /> Add subscriber
            </button>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email…"
          className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
      </div>

      {/* CSV hint */}
      <p className="text-xs text-gray-400 mb-4">
        CSV format: <span className="font-mono">email, first_name, last_name</span> (header row skipped)
      </p>

      {isLoading ? (
        <div className="space-y-2 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-gray-100 rounded-xl" />)}
        </div>
      ) : subscribers.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
          <Users className="w-8 h-8 text-gray-300 mx-auto mb-3" />
          <p className="text-sm font-medium text-gray-600">No subscribers yet</p>
          <p className="text-xs text-gray-400 mt-1">Add individually or import a CSV file.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {subscribers.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 truncate max-w-[200px]">{sub.email}</td>
                  <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                    {sub.firstName || sub.lastName
                      ? [sub.firstName, sub.lastName].filter(Boolean).join(" ")
                      : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      sub.status === "active" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"
                    }`}>
                      {sub.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs hidden md:table-cell">
                    {new Date(sub.addedAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => toggleStatus.mutate({ id: sub.id, status: sub.status === "active" ? "unsubscribed" : "active" })}
                        className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                        title={sub.status === "active" ? "Unsubscribe" : "Re-subscribe"}
                      >
                        {sub.status === "active" ? <UserMinus className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => { if (confirm(`Remove ${sub.email} from this list?`)) removeSubscriber.mutate(sub.id); }}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MailingListsPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<MailingList | null>(null);
  const [activeList, setActiveList] = useState<MailingList | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const { data: allLists = [], isLoading } = useQuery<MailingList[]>({
    queryKey: ["mailing-lists"],
    queryFn: () => api.get<MailingList[]>("/mailing-lists"),
  });

  const lists = allLists.filter((l) => showArchived ? !!l.archivedAt : !l.archivedAt);

  const createList = useMutation({
    mutationFn: (data: { name: string; description?: string; tags: string[] }) =>
      api.post("/mailing-lists", data),
    onSuccess: () => { setShowCreate(false); qc.invalidateQueries({ queryKey: ["mailing-lists"] }); },
  });

  const updateList = useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; tags?: string[] }) =>
      api.patch(`/mailing-lists/${id}`, data),
    onSuccess: () => { setEditing(null); qc.invalidateQueries({ queryKey: ["mailing-lists"] }); },
  });

  const archiveList = useMutation({
    mutationFn: ({ id, archived }: { id: string; archived: boolean }) =>
      api.patch(`/mailing-lists/${id}`, { archived }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mailing-lists"] }),
  });

  const deleteList = useMutation({
    mutationFn: (id: string) => api.delete(`/mailing-lists/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mailing-lists"] }),
  });

  if (activeList) {
    return <SubscribersPanel list={activeList} onBack={() => setActiveList(null)} />;
  }

  return (
    <div>
      {showCreate && (
        <ListModal
          onClose={() => setShowCreate(false)}
          onSave={(data) => createList.mutate(data)}
          saving={createList.isPending}
        />
      )}
      {editing && (
        <ListModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={(data) => updateList.mutate({ id: editing.id, ...data })}
          saving={updateList.isPending}
        />
      )}

      <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mailing Lists</h1>
          <p className="text-sm text-gray-500 mt-1">Manage subscriber lists for your email campaigns</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowArchived((s) => !s)}
            className={`flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium border rounded-xl transition-colors ${
              showArchived ? "bg-amber-50 border-amber-200 text-amber-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <Archive className="w-4 h-4" />
            {showArchived ? "Showing archived" : "Show archived"}
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> New list
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
          {[...Array(3)].map((_, i) => <div key={i} className="h-32 bg-gray-100 rounded-2xl" />)}
        </div>
      ) : lists.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-14 text-center">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Mail className="w-7 h-7 text-gray-400" />
          </div>
          <p className="text-sm font-semibold text-gray-700 mb-1">
            {showArchived ? "No archived lists" : "No mailing lists yet"}
          </p>
          <p className="text-xs text-gray-400">
            {showArchived ? "Archived lists will appear here." : "Create a list to start collecting subscribers."}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map((list) => (
            <div
              key={list.id}
              className={`bg-white border rounded-2xl p-5 flex flex-col gap-3 transition-shadow hover:shadow-md ${
                list.archivedAt ? "border-gray-200 opacity-70" : "border-gray-200"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{list.name}</h3>
                  {list.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{list.description}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => setEditing(list)}
                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => archiveList.mutate({ id: list.id, archived: !list.archivedAt })}
                    className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    title={list.archivedAt ? "Unarchive" : "Archive"}
                  >
                    {list.archivedAt ? <ArchiveRestore className="w-3.5 h-3.5" /> : <Archive className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    onClick={() => { if (confirm(`Delete "${list.name}"? This cannot be undone.`)) deleteList.mutate(list.id); }}
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <Users className="w-3.5 h-3.5" />
                  <span>{list.subscriberCount} subscriber{list.subscriberCount !== 1 ? "s" : ""}</span>
                </div>
                {list.archivedAt && (
                  <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full font-medium">Archived</span>
                )}
              </div>

              {list.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {list.tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">{t}</span>
                  ))}
                </div>
              )}

              <button
                onClick={() => setActiveList(list)}
                className="mt-auto flex items-center justify-between w-full px-3.5 py-2.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-xl transition-colors"
              >
                View subscribers
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
