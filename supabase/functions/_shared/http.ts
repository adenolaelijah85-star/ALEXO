export function corsHeaders(origin: string): HeadersInit {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

export function jsonResponse(
  body: Record<string, unknown>,
  status: number,
  origin?: string,
): Response {
  const headers = new Headers({ "Content-Type": "application/json; charset=utf-8" });
  if (origin) {
    new Headers(corsHeaders(origin)).forEach((value, key) => headers.set(key, value));
  }
  return new Response(JSON.stringify(body), { status, headers });
}

export function checkOrigin(request: Request): Response | null {
  const allowedOrigin = Deno.env.get("STOREFRONT_ORIGIN");
  const requestOrigin = request.headers.get("origin");

  if (!allowedOrigin || !requestOrigin || requestOrigin !== allowedOrigin) {
    return jsonResponse({ error: "Request origin is not allowed." }, 403);
  }
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(requestOrigin) });
  }
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed." }, 405, requestOrigin);
  }
  return null;
}

export function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function adminHeaders(url: string, key: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Accept-Profile": "public",
    "Content-Profile": "public",
  };
}

export async function callRpc<T>(
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const url = requiredEnv("SUPABASE_URL").replace(/\/+$/, "");
  const key = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: adminHeaders(url, key),
    body: JSON.stringify(args),
  });
  const result = await response.text();
  if (!response.ok) {
    console.error(`Supabase RPC ${name} failed:`, response.status, result);
    throw new Error("The store could not complete this request.");
  }
  return result ? JSON.parse(result) as T : null as T;
}

export async function paystackVerify(reference: string): Promise<Record<string, unknown>> {
  const secret = requiredEnv("PAYSTACK_SECRET_KEY");
  const response = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" } },
  );
  const result = await response.json();
  if (!response.ok || result.status !== true || !result.data) {
    console.error("Paystack verification failed:", response.status, result.message);
    throw new Error("Payment verification is unavailable.");
  }
  return result.data as Record<string, unknown>;
}
