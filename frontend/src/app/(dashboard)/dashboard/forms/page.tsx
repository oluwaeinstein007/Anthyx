"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import {
  ClipboardList, Plus, Trash2, Eye, BarChart2, Download,
  ChevronRight, ToggleLeft, ToggleRight, Search,
} from "lucide-react";

interface FormSummary {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  responseCount: number;
  lastSubmittedAt: string | null;
  createdAt: string;
}

const TEMPLATE_FORMS = [
  {
    id: "brand-awareness",
    title: "Brand Awareness Survey",
    description: "Measure how well your target audience recognises and recalls your brand.",
    fields: [
      { id: "f1", type: "single_choice", label: "How did you first hear about us?", required: true, options: ["Social media", "Word of mouth", "Search engine", "Advertisement", "Other"] },
      { id: "f2", type: "scale", label: "How familiar are you with our brand? (1 = Not at all, 10 = Very familiar)", required: true },
      { id: "f3", type: "multiple_choice", label: "Which words best describe our brand? (Select all that apply)", required: false, options: ["Innovative", "Trustworthy", "Affordable", "Premium", "Fun", "Professional", "Relatable"] },
      { id: "f4", type: "short_text", label: "In one sentence, what do we do?", required: false },
    ],
  },
  {
    id: "customer-research",
    title: "Customer Research Survey",
    description: "Understand your customers' needs, pain points, and buying behaviour.",
    fields: [
      { id: "f1", type: "single_choice", label: "What is your primary role?", required: true, options: ["Founder / CEO", "Marketing Manager", "Sales", "Developer", "Designer", "Other"] },
      { id: "f2", type: "multiple_choice", label: "What are your biggest challenges with social media marketing?", required: true, options: ["Consistent posting", "Content ideas", "Measuring ROI", "Audience growth", "Team collaboration", "Budget constraints"] },
      { id: "f3", type: "nps", label: "How likely are you to recommend a solution like ours to a colleague? (0–10)", required: true },
      { id: "f4", type: "long_text", label: "What would the ideal social media tool do for you?", required: false },
      { id: "f5", type: "single_choice", label: "What is your monthly marketing budget?", required: false, options: ["Under $500", "$500–$2,000", "$2,000–$10,000", "$10,000+"] },
    ],
  },
  {
    id: "content-feedback",
    title: "Content Feedback Form",
    description: "Collect audience feedback on your content quality and relevance.",
    fields: [
      { id: "f1", type: "rating", label: "How would you rate the quality of our content overall?", required: true },
      { id: "f2", type: "multiple_choice", label: "What type of content do you find most valuable?", required: true, options: ["Educational tips", "Case studies", "Industry news", "Behind-the-scenes", "Product updates", "Promotional offers"] },
      { id: "f3", type: "single_choice", label: "How often do you engage with our posts?", required: false, options: ["Daily", "A few times a week", "Weekly", "Rarely"] },
      { id: "f4", type: "long_text", label: "What topics would you like to see more of?", required: false },
      { id: "f5", type: "email", label: "Drop your email for exclusive content updates (optional)", required: false },
    ],
  },
  {
    id: "nps-survey",
    title: "Net Promoter Score (NPS)",
    description: "Quick NPS pulse check — how likely are customers to recommend you.",
    fields: [
      { id: "f1", type: "nps", label: "How likely are you to recommend us to a friend or colleague? (0 = Not at all, 10 = Extremely likely)", required: true },
      { id: "f2", type: "long_text", label: "What is the main reason for your score?", required: false },
      { id: "f3", type: "short_text", label: "What could we do better?", required: false },
    ],
  },
];

export default function FormsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);

  const { data: formList, isLoading } = useQuery<FormSummary[]>({
    queryKey: ["forms"],
    queryFn: () => api.get<FormSummary[]>("/forms"),
  });

  const createForm = useMutation({
    mutationFn: (body: { title: string; description?: string; fields?: unknown[] }) =>
      api.post<{ id: string }>("/forms", body),
    onSuccess: (form) => {
      qc.invalidateQueries({ queryKey: ["forms"] });
      router.push(`/dashboard/forms/${form.id}`);
    },
  });

  const deleteForm = useMutation({
    mutationFn: (id: string) => api.delete(`/forms/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forms"] }),
  });

  const toggleActive = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      api.put(`/forms/${id}`, { isActive }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["forms"] }),
  });

  const filtered = (formList ?? []).filter((f) =>
    f.title.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Forms</h1>
          <p className="text-sm text-gray-500 mt-1">
            Build surveys for market research, brand feedback, and audience insights.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTemplates((v) => !v)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
          >
            Start from template
          </button>
          <button
            onClick={() => createForm.mutate({ title: "Untitled form", fields: [] })}
            disabled={createForm.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
            New form
          </button>
        </div>
      </div>

      {/* Templates */}
      {showTemplates && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-2">
          <p className="col-span-full text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Templates — click to create
          </p>
          {TEMPLATE_FORMS.map((tmpl) => (
            <button
              key={tmpl.id}
              onClick={() =>
                createForm.mutate({
                  title: tmpl.title,
                  description: tmpl.description,
                  fields: tmpl.fields,
                })
              }
              className="text-left p-4 bg-white border border-gray-200 rounded-2xl hover:border-green-300 hover:shadow-sm transition-all"
            >
              <p className="text-sm font-semibold text-gray-900">{tmpl.title}</p>
              <p className="text-xs text-gray-500 mt-1">{tmpl.description}</p>
              <p className="text-xs text-green-600 font-medium mt-2">{tmpl.fields.length} fields →</p>
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      {(formList?.length ?? 0) > 0 && (
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search forms…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
          />
        </div>
      )}

      {isLoading ? (
        <div className="space-y-3 animate-pulse">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-100 rounded-2xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-dashed border-gray-200 rounded-2xl">
          <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-4">
            <ClipboardList className="w-7 h-7 text-gray-400" />
          </div>
          <h3 className="text-base font-semibold text-gray-900 mb-1">No forms yet</h3>
          <p className="text-sm text-gray-500 mb-4">
            Create your first survey to start collecting market research and feedback.
          </p>
          <button
            onClick={() => createForm.mutate({ title: "Untitled form", fields: [] })}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl"
          >
            <Plus className="w-4 h-4" /> Create form
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((form) => (
            <div
              key={form.id}
              className="flex items-center gap-4 bg-white border border-gray-200 rounded-2xl px-5 py-4 hover:border-gray-300 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{form.title}</p>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs text-gray-500">
                    <span className="font-medium text-gray-700">{form.responseCount.toLocaleString()}</span> response{form.responseCount !== 1 ? "s" : ""}
                  </span>
                  {form.lastSubmittedAt && (
                    <span className="text-xs text-gray-400">
                      Last: {new Date(form.lastSubmittedAt).toLocaleDateString()}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${form.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {form.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => toggleActive.mutate({ id: form.id, isActive: !form.isActive })}
                  title={form.isActive ? "Deactivate" : "Activate"}
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {form.isActive
                    ? <ToggleRight className="w-5 h-5 text-green-500" />
                    : <ToggleLeft className="w-5 h-5" />}
                </button>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL?.replace("/v1", "") ?? "http://localhost:4000"}/f/${form.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Preview form"
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Eye className="w-4 h-4" />
                </a>
                <a
                  href={`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1"}/forms/${form.id}/export`}
                  title="Download CSV"
                  className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() =>
                    window.confirm("Delete this form? This will also delete all responses.") &&
                    deleteForm.mutate(form.id)
                  }
                  title="Delete form"
                  className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  onClick={() => router.push(`/dashboard/forms/${form.id}`)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  Edit <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
