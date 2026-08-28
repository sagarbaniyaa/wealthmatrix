'use client';

/**
 * Client-component fetch helper. All calls go through the Next.js proxy
 * route (/api/proxy/*), which attaches the httpOnly token server-side —
 * the token itself never reaches browser JS. See app/api/proxy/[...path]/route.ts.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

/** Upload a file (multipart/form-data) — no Content-Type header here, the browser sets the correct boundary itself. */
async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`/api/proxy/${path}`, { method: 'POST', body: form });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res.json();
}

/** Download a binary response (zip/pdf) as a Blob, for triggering a browser save. */
async function getBlob(path: string): Promise<Blob> {
  const res = await fetch(`/api/proxy/${path}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed: ${res.status}`);
  }
  return res.blob();
}

/** Same as getBlob but POST — for endpoints that generate a file from a request body (e.g. the provider pack zip). */
async function postBlob(path: string, body?: unknown): Promise<Blob> {
  const res = await fetch(`/api/proxy/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const errBody = await res.json().catch(() => ({}));
    throw new Error(errBody.message ?? `Request failed: ${res.status}`);
  }
  return res.blob();
}

export const api = {
  get: <T,>(path: string) => request<T>(path),
  post: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T,>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  delete: <T,>(path: string) => request<T>(path, { method: 'DELETE' }),
  postForm,
  getBlob,
  postBlob,
};
