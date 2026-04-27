"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import {
  Upload, X, FileText, Globe, AlignLeft, CheckCircle2,
  AlertCircle, Loader2, Clock, ChevronDown, ChevronUp,
} from "lucide-react";
import { api } from "@/lib/api";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type IngestMode = "pdf" | "url" | "text";

type JobState = "waiting" | "active" | "completed" | "failed" | "delayed" | "unknown";

interface JobProgress {
  step: "parsing" | "extracting" | "embedding" | "done" | "failed";
  message: string;
}

interface TrackedJob {
  jobId: string;
  fileName: string;
  state: JobState;
  progress: JobProgress | null;
  failedReason: string | null;
}

interface HistoryEntry {
  sourceType: string;
  sourceName: string;
  ingestedAt: string;
  summary: string | null;
}

interface BrandForIngest {
  id: string;
  name: string;
  ingestStatus: string | null;
  ingestHistory: HistoryEntry[] | null;
}

const STEP_ORDER = ["parsing", "extracting", "embedding", "done"] as const;

function stepIndex(step: string | undefined) {
  if (!step) return -1;
  return STEP_ORDER.indexOf(step as typeof STEP_ORDER[number]);
}

function JobProgressRow({ job, onDone }: { job: TrackedJob; onDone: () => void }) {
  const isDone = job.state === "completed";
  const isFailed = job.state === "failed";
  const isActive = job.state === "active" || job.state === "waiting" || job.state === "delayed";

  useEffect(() => {
    if (isDone) onDone();
  }, [isDone, onDone]);

  return (
    <div className={`p-4 rounded-xl border text-sm ${isFailed ? "border-red-200 bg-red-50" : isDone ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-gray-400 shrink-0" />
          <span className="font-medium text-gray-800 truncate">{job.fileName}</span>
        </div>
        {isDone && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
        {isFailed && <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />}
        {isActive && <Loader2 className="w-4 h-4 text-green-600 animate-spin shrink-0" />}
      </div>

      {/* Step progress bar */}
      <div className="flex items-center gap-1">
        {STEP_ORDER.map((s, i) => {
          const current = stepIndex(job.progress?.step);
          const active = i === current;
          const done = i < current || isDone;
          return (
            <div key={s} className="flex items-center gap-1 flex-1">
              <div className={`h-1.5 flex-1 rounded-full transition-all ${done || isDone ? "bg-green-500" : active ? "bg-green-400 animate-pulse" : "bg-gray-200"}`} />
              {i < STEP_ORDER.length - 1 && <div className="w-0" />}
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-1">
        <span>Parse</span><span>Extract</span><span>Embed</span><span>Done</span>
      </div>

      {job.progress?.message && !isDone && (
        <p className="text-xs text-gray-500 mt-1.5 italic">{job.progress.message}</p>
      )}
      {isFailed && (
        <p className="text-xs text-red-600 mt-1">{job.failedReason ?? "Processing failed"}</p>
      )}
    </div>
  );
}

function useJobPoller(jobs: TrackedJob[], setJobs: React.Dispatch<React.SetStateAction<TrackedJob[]>>, brandId: string) {
  useEffect(() => {
    const pending = jobs.filter((j) => j.state !== "completed" && j.state !== "failed");
    if (pending.length === 0) return;

    const timer = setInterval(async () => {
      const updates = await Promise.allSettled(
        pending.map((j) =>
          fetch(`${API_BASE}/v1/brands/${brandId}/ingest-job/${j.jobId}`, { credentials: "include" })
            .then((r) => r.json())
            .then((data: { jobId: string; state: JobState; progress: JobProgress | null; failedReason: string | null }) => data),
        ),
      );

      setJobs((prev) =>
        prev.map((j) => {
          const idx = pending.findIndex((p) => p.jobId === j.jobId);
          if (idx === -1) return j;
          const result = updates[idx];
          if (result?.status === "fulfilled") {
            return { ...j, state: result.value.state, progress: result.value.progress, failedReason: result.value.failedReason };
          }
          return j;
        }),
      );
    }, 2000);

    return () => clearInterval(timer);
  }, [jobs, brandId, setJobs]);
}

export default function IngestPage() {
  const { id } = useParams<{ id: string }>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<IngestMode>("pdf");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [jobs, setJobs] = useState<TrackedJob[]>([]);
  const [allDone, setAllDone] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: brand, refetch: refetchBrand } = useQuery<BrandForIngest>({
    queryKey: ["brand-ingest", id],
    queryFn: () => api.get<BrandForIngest>(`/brands/${id}`),
  });

  const history = brand?.ingestHistory ?? [];

  useJobPoller(jobs, setJobs, id);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = Array.from(e.dataTransfer.files).filter(
      (f) => f.name.endsWith(".pdf") || f.name.endsWith(".md"),
    );
    setFiles((prev) => [...prev, ...dropped].slice(0, 10));
  }, []);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setFiles((prev) => [...prev, ...Array.from(list)].slice(0, 10));
  };

  const removeFile = (i: number) => setFiles((prev) => prev.filter((_, idx) => idx !== i));

  const canSubmit =
    (mode === "pdf" && files.length > 0) ||
    (mode === "url" && url.trim().length > 0) ||
    (mode === "text" && text.trim().length > 0);

  const submit = async () => {
    setSubmitError("");
    setSubmitting(true);

    try {
      const formData = new FormData();

      if (mode === "pdf") {
        files.forEach((f) => formData.append("files", f));
      } else if (mode === "url") {
        formData.append("url", url);
      } else {
        formData.append("text", text);
      }

      const res = await fetch(`${API_BASE}/v1/brands/${id}/ingest`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const b = err as { error?: string; message?: string };
        throw new Error(b.error ?? b.message ?? "Submission failed");
      }

      const data = await res.json() as { jobs: { jobId: string; status: string }[] };

      const fileNames = mode === "pdf"
        ? files.map((f) => f.name)
        : mode === "url"
        ? [url]
        : ["pasted text"];

      setJobs(
        data.jobs.map((j, i) => ({
          jobId: j.jobId,
          fileName: fileNames[i] ?? `Source ${i + 1}`,
          state: "waiting",
          progress: null,
          failedReason: null,
        })),
      );

      if (mode === "pdf") setFiles([]);
      if (mode === "url") setUrl("");
      if (mode === "text") setText("");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  };

  const doneCount = jobs.filter((j) => j.state === "completed").length;
  const failedCount = jobs.filter((j) => j.state === "failed").length;

  useEffect(() => {
    if (jobs.length > 0 && jobs.every((j) => j.state === "completed" || j.state === "failed")) {
      setAllDone(true);
      refetchBrand();
    }
  }, [jobs, refetchBrand]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href={`/dashboard/brands/${id}`} className="text-sm text-gray-400 hover:text-gray-600 transition-colors">
          ← Back to brand
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Ingest brand document</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload PDFs, paste a URL, or enter text. The AI extracts voice, tone, values, colors, and audience signals.
        </p>
      </div>

      {/* Mode selector */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: "pdf", label: "PDF / Markdown", Icon: FileText },
          { key: "url", label: "URL", Icon: Globe },
          { key: "text", label: "Text", Icon: AlignLeft },
        ] as { key: IngestMode; label: string; Icon: React.ElementType }[]).map(({ key, label, Icon }) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm rounded-lg font-medium transition-colors ${
              mode === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
        {/* PDF multi-file drop zone */}
        {mode === "pdf" && (
          <div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
                dragging ? "border-green-400 bg-green-50" : "border-gray-200 hover:border-green-300 hover:bg-gray-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.md"
                multiple
                className="hidden"
                onChange={(e) => addFiles(e.target.files)}
              />
              <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-600 font-medium">
                {dragging ? "Drop files here" : "Click or drag to upload"}
              </p>
              <p className="text-xs text-gray-400 mt-1">PDF or Markdown · up to 10 files · max 50 MB each</p>
            </div>

            {files.length > 0 && (
              <ul className="mt-3 space-y-2">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100">
                    <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 truncate">{f.name}</p>
                      <p className="text-xs text-gray-400">{(f.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button onClick={() => removeFile(i)} className="p-1 text-gray-400 hover:text-red-500 transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* URL */}
        {mode === "url" && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Website URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://yourcompany.com/about"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-400 mt-1">The page will be scraped and its text content extracted.</p>
          </div>
        )}

        {/* Text */}
        {mode === "text" && (
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Raw text</label>
            <textarea
              rows={8}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste your brand guidelines, mission statement, tone of voice doc, or any brand copy here…"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-400 mt-1">
              {text.length} characters · ~{Math.ceil(text.split(/\s+/).filter(Boolean).length / 500)} chunks
            </p>
          </div>
        )}

        {submitError && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {submitError}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            onClick={submit}
            disabled={!canSubmit || submitting}
            className="px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? (
              <span className="flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Queuing…</span>
            ) : (
              `Extract & embed${mode === "pdf" && files.length > 1 ? ` (${files.length} files)` : ""}`
            )}
          </button>
          <Link
            href={`/dashboard/brands/${id}`}
            className="px-5 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors inline-flex items-center"
          >
            Cancel
          </Link>
        </div>
      </div>

      {/* Active job progress */}
      {jobs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">
              Processing {jobs.length} source{jobs.length !== 1 ? "s" : ""}
            </h2>
            {allDone && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${failedCount > 0 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                {doneCount}/{jobs.length} complete{failedCount > 0 ? ` · ${failedCount} failed` : ""}
              </span>
            )}
          </div>

          {jobs.map((job) => (
            <JobProgressRow
              key={job.jobId}
              job={job}
              onDone={() => {}}
            />
          ))}

          {allDone && (
            <div className="flex gap-3 pt-1">
              <Link
                href={`/dashboard/brands/${id}`}
                className="px-5 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition-colors"
              >
                View brand profile
              </Link>
              <button
                onClick={() => { setJobs([]); setAllDone(false); }}
                className="px-5 py-2.5 border border-gray-200 text-sm text-gray-600 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Ingest more
              </button>
            </div>
          )}
        </div>
      )}

      {/* Ingestion history */}
      {history.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setShowHistory((s) => !s)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              Ingestion history ({history.length})
            </span>
            {showHistory ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </button>

          {showHistory && (
            <div className="border-t border-gray-100 divide-y divide-gray-100">
              {[...history].reverse().map((entry, i) => (
                <div key={i} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {entry.sourceType === "url" ? (
                        <Globe className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                      )}
                      <span className="text-sm text-gray-800 truncate">{entry.sourceName}</span>
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {new Date(entry.ingestedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                  {entry.summary && (
                    <p className="text-xs text-gray-500 mt-1 ml-5.5 line-clamp-2">{entry.summary}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
