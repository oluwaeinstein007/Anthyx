"use client";

import { useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type IngestMode = "pdf" | "url" | "text";

export default function IngestPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<IngestMode>("pdf");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [done, setDone] = useState(false);

  const ingest = useMutation({
    mutationFn: async () => {
      const formData = new FormData();

      if (mode === "pdf" && file) {
        formData.append("file", file);
      } else if (mode === "url") {
        formData.append("url", url);
      } else if (mode === "text") {
        formData.append("text", text);
      }

      const res = await fetch(`${API_BASE}/v1/brands/${id}/ingest`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errBody = err as { message?: string; error?: string };
        throw new Error(errBody.message ?? errBody.error ?? "Ingestion failed");
      }

      return res.json();
    },
    onSuccess: () => {
      setDone(true);
    },
  });

  const canSubmit =
    (mode === "pdf" && !!file) ||
    (mode === "url" && url.trim().length > 0) ||
    (mode === "text" && text.trim().length > 0);

  if (done) {
    return (
      <div className="max-w-xl space-y-6">
        <div className="p-6 bg-white border border-green-200 rounded-xl text-center space-y-3">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-green-600 text-xl">✓</span>
          </div>
          <h2 className="text-lg font-semibold text-gray-900">Ingestion complete</h2>
          <p className="text-sm text-gray-500">
            Brand identity has been extracted and embedded. Your agents will use this
            context to generate on-brand content.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href={`/dashboard/brands/${id}`}
              className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
            >
              View brand profile
            </Link>
            <button
              onClick={() => {
                setDone(false);
                setFile(null);
                setUrl("");
                setText("");
              }}
              className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50"
            >
              Ingest another
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <Link
          href={`/dashboard/brands/${id}`}
          className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
        >
          ← Back to brand
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Ingest brand document</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a PDF, paste a URL, or enter text. The AI will extract voice, tone, values,
          color palette, and target audience.
        </p>
      </div>

      {/* Mode tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        {(["pdf", "url", "text"] as IngestMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`px-4 py-1.5 text-sm rounded-md font-medium transition-colors uppercase tracking-wide ${
              mode === m
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="p-5 bg-white border border-gray-200 rounded-xl space-y-4">
        {mode === "pdf" && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              PDF file
            </label>
            <div
              onClick={() => fileRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                file
                  ? "border-green-300 bg-green-50"
                  : "border-gray-200 hover:border-green-300"
              }`}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              {file ? (
                <div>
                  <p className="text-sm font-medium text-green-700">{file.name}</p>
                  <p className="text-xs text-green-500 mt-1">
                    {(file.size / 1024).toFixed(0)} KB
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-gray-500">
                    Click to select a PDF file
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Brand guidelines, media kits, decks, case studies
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === "url" && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Website URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourcompany.com/about"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              The page will be scraped and its text content extracted.
            </p>
          </div>
        )}

        {mode === "text" && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Raw text
            </label>
            <textarea
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your brand guidelines, mission statement, tone of voice document, or any brand copy here..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-400"
            />
            <p className="text-xs text-gray-400 mt-1">
              {text.length} characters · {Math.ceil(text.split(/\s+/).length / 500)} estimated chunks
            </p>
          </div>
        )}

        {ingest.isError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">
              {(ingest.error as Error).message}
            </p>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={() => ingest.mutate()}
            disabled={!canSubmit || ingest.isPending}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {ingest.isPending ? "Processing..." : "Extract & embed"}
          </button>
          <Link
            href={`/dashboard/brands/${id}`}
            className="px-4 py-2 border border-gray-200 text-sm rounded-lg hover:bg-gray-50 inline-flex items-center"
          >
            Cancel
          </Link>
        </div>

        {ingest.isPending && (
          <div className="text-xs text-gray-500 space-y-1 pt-1">
            <p className="animate-pulse">Extracting brand identity via AI...</p>
            <p className="text-gray-400">
              This typically takes 10–30 seconds depending on document length.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
