/**
 * API client — thin wrapper around fetch with org-scoped requests.
 * All methods throw on non-2xx responses.
 */

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:4000";

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${API_URL}/v1${path}`, {
    ...options,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !path.includes("/auth/")) {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      return new Promise(() => {});
    }
    const error = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(error.error ?? `Request failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

async function upload<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`${API_URL}/v1${path}`, {
    method: "POST",
    credentials: "include",
    body,
    // No Content-Type header — browser sets it automatically with multipart boundary
  });

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
      return new Promise(() => {});
    }
    const error = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(error.error ?? `Upload failed: ${res.status}`);
  }

  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  upload: <T>(path: string, body: FormData) => upload<T>(path, body),
};
