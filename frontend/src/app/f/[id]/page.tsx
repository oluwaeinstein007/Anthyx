"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertCircle } from "lucide-react";

type FieldType =
  | "short_text" | "long_text" | "multiple_choice" | "single_choice"
  | "rating" | "nps" | "scale" | "date" | "email" | "yes_no";

interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  required: boolean;
  options?: string[];
}

interface PublicForm {
  id: string;
  title: string;
  description: string | null;
  fields: FormField[];
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  if (field.type === "short_text") {
    return (
      <input
        type="text"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? "Your answer…"}
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
      />
    );
  }

  if (field.type === "email") {
    return (
      <input
        type="email"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? "you@example.com"}
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
      />
    );
  }

  if (field.type === "long_text") {
    return (
      <textarea
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder ?? "Your answer…"}
        rows={4}
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400 resize-none"
      />
    );
  }

  if (field.type === "single_choice") {
    return (
      <div className="space-y-2">
        {(field.options ?? []).map((opt) => (
          <label key={opt} className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name={field.id}
              value={opt}
              checked={value === opt}
              onChange={() => onChange(opt)}
              className="w-4 h-4 accent-green-600"
            />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "multiple_choice") {
    const selected = (value as string[]) ?? [];
    function toggle(opt: string) {
      if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
      else onChange([...selected, opt]);
    }
    return (
      <div className="space-y-2">
        {(field.options ?? []).map((opt) => (
          <label key={opt} className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              value={opt}
              checked={selected.includes(opt)}
              onChange={() => toggle(opt)}
              className="w-4 h-4 accent-green-600 rounded"
            />
            <span className="text-sm text-gray-700">{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  if (field.type === "rating") {
    return (
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`text-2xl transition-transform hover:scale-110 ${Number(value) >= n ? "text-amber-400" : "text-gray-200"}`}
          >
            ★
          </button>
        ))}
      </div>
    );
  }

  if (field.type === "nps") {
    return (
      <div>
        <div className="flex gap-1 flex-wrap">
          {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`w-10 h-10 text-sm font-semibold rounded-xl border transition-colors ${
                value === n
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-xs text-gray-400">Not likely</span>
          <span className="text-xs text-gray-400">Extremely likely</span>
        </div>
      </div>
    );
  }

  if (field.type === "scale") {
    return (
      <div>
        <div className="flex gap-1 flex-wrap">
          {[1,2,3,4,5,6,7,8,9,10].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              className={`w-10 h-10 text-sm font-semibold rounded-xl border transition-colors ${
                value === n
                  ? "bg-green-600 text-white border-green-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-green-400"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "yes_no") {
    return (
      <div className="flex gap-3">
        {["Yes", "No"].map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={`px-6 py-2.5 text-sm font-semibold rounded-xl border transition-colors ${
              value === opt
                ? "bg-green-600 text-white border-green-600"
                : "bg-white text-gray-700 border-gray-200 hover:border-green-400"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <input
        type="date"
        value={String(value ?? "")}
        onChange={(e) => onChange(e.target.value)}
        className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
      />
    );
  }

  return null;
}

export default function PublicFormPage() {
  const { id } = useParams<{ id: string }>();
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/v1";

  const { data: form, isLoading, error } = useQuery<PublicForm>({
    queryKey: ["public-form", id],
    queryFn: async () => {
      const res = await fetch(`${apiBase}/forms/${id}/public`);
      if (!res.ok) throw new Error("Form not found");
      return res.json();
    },
  });

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  function setValue(fieldId: string, val: unknown) {
    setValues((prev) => ({ ...prev, [fieldId]: val }));
    if (validationErrors[fieldId]) {
      setValidationErrors((prev) => { const n = { ...prev }; delete n[fieldId]; return n; });
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fields = form?.fields ?? [];

    // Validate required fields
    const errors: Record<string, string> = {};
    for (const f of fields) {
      if (!f.required) continue;
      const v = values[f.id];
      if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
        errors[f.id] = "This field is required.";
      }
    }
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`${apiBase}/forms/${id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: values, respondentEmail: email || undefined }),
      });
      if (!res.ok) throw new Error("Submission failed");
      setSubmitted(true);
    } catch {
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">This form is unavailable or no longer active.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-gray-200 p-10 text-center">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Response submitted!</h2>
          <p className="text-sm text-gray-500">Thank you for taking the time to share your feedback.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-xl mx-auto">
        {/* Form header */}
        <div className="bg-white rounded-2xl border border-gray-200 p-8 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">{form.title}</h1>
          {form.description && (
            <p className="text-sm text-gray-500 mt-2 leading-relaxed">{form.description}</p>
          )}
        </div>

        {/* Fields */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {form.fields.map((field) => (
            <div key={field.id} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
              <label className="block text-sm font-semibold text-gray-800">
                {field.label}
                {field.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              <FieldInput
                field={field}
                value={values[field.id]}
                onChange={(val) => setValue(field.id, val)}
              />
              {validationErrors[field.id] && (
                <p className="text-xs text-red-500">{validationErrors[field.id]}</p>
              )}
            </div>
          ))}

          {/* Optional email capture */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-3">
            <label className="block text-sm font-semibold text-gray-800">
              Your email (optional)
            </label>
            <p className="text-xs text-gray-400">Leave your email if you'd like a follow-up or to receive updates.</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-400"
            />
          </div>

          {submitError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <p className="text-sm text-red-600">{submitError}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-xl transition-colors disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Submit response"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">Powered by Anthyx</p>
      </div>
    </div>
  );
}
