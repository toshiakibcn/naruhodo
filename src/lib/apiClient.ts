/**
 * NEXT_PUBLIC_API_BASE_URLが設定されていればCloudflare Workerを直接叩き、
 * 未設定ならNext.jsの/api/translate（同一オリジン）を使う。
 */
export function translateEndpoint(): string {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  return base ? `${base.replace(/\/$/, "")}/api/translate` : "/api/translate";
}

export function translateHeaders(): HeadersInit {
  const headers: HeadersInit = { "content-type": "application/json" };
  const secret = process.env.NEXT_PUBLIC_WORKER_SECRET;
  if (secret) {
    headers["x-worker-secret"] = secret;
  }
  return headers;
}
