import { createHmac, timingSafeEqual } from "crypto";

// A small, dependency-free client for the parts of Stripe's API we use.
// SERVER ONLY: it reads the secret key.

const API = "https://api.stripe.com/v1";

export class StripeError extends Error {}

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY));
}

export function stripeTestMode() {
  return (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");
}

type Param = string | number | boolean | null | undefined | Param[] | { [key: string]: Param };

// Stripe wants nested form fields like line_items[0][price_data][currency]
function flatten(value: Param, prefix: string, out: [string, string][]) {
  if (value === undefined || value === null) return;
  if (Array.isArray(value)) {
    value.forEach((v, i) => flatten(v, `${prefix}[${i}]`, out));
  } else if (typeof value === "object") {
    for (const [k, v] of Object.entries(value)) flatten(v, prefix ? `${prefix}[${k}]` : k, out);
  } else {
    out.push([prefix, String(value)]);
  }
}

async function request<T>(
  method: "GET" | "POST",
  path: string,
  params?: Record<string, Param>,
  idempotencyKey?: string
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Stripe is not set up.");

  const pairs: [string, string][] = [];
  if (params) flatten(params, "", pairs);
  const body = new URLSearchParams(pairs);
  const url = method === "GET" && pairs.length > 0 ? `${API}${path}?${body}` : `${API}${path}`;

  const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
  if (method === "POST") headers["Content-Type"] = "application/x-www-form-urlencoded";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(url, {
    method,
    headers,
    body: method === "POST" ? body : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new StripeError(json?.error?.message ?? `Stripe returned an error (${res.status}).`);
  return json as T;
}

// Connected accounts use Stripe's newer "v2" API: JSON bodies and a version header.
// Override the version with STRIPE_V2_API_VERSION in .env.local if Stripe ever asks for a newer one.
const V2_VERSION = process.env.STRIPE_V2_API_VERSION ?? "2026-11-18.endive";

async function requestV2<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  idempotencyKey?: string,
  query?: Record<string, string>
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Stripe is not set up.");

  const qs = query ? `?${new URLSearchParams(query)}` : "";
  const headers: Record<string, string> = { Authorization: `Bearer ${key}`, "Stripe-Version": V2_VERSION };
  if (method === "POST") headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

  const res = await fetch(`https://api.stripe.com/v2${path}${qs}`, {
    method,
    headers,
    body: method === "POST" ? JSON.stringify(body ?? {}) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new StripeError(json?.error?.message ?? `Stripe returned an error (${res.status}).`);
  return json as T;
}

type RecipientAccount = {
  configuration?: { recipient?: { capabilities?: { stripe_balance?: { stripe_transfers?: { status?: string } } } } };
};

export type StripeSession = {
  id: string;
  url: string | null;
  payment_status: string;
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
  payment_intent: string | { id: string; latest_charge: string | null } | null;
};

export const stripe = {
  // A seller's connected account: they can receive transfers, use the Express dashboard,
  // and we (the platform) carry the fees and any negative balance.
  createAccount: (input: { email?: string; name: string; shopId: string }, idempotencyKey: string) =>
    requestV2<{ id: string }>(
      "POST",
      "/core/accounts",
      {
        contact_email: input.email,
        display_name: input.name,
        dashboard: "express",
        defaults: { responsibilities: { fees_collector: "application", losses_collector: "application" } },
        identity: { country: "gb" },
        configuration: { recipient: { capabilities: { stripe_balance: { stripe_transfers: { requested: true } } } } },
        metadata: { shop_id: input.shopId },
        include: ["configuration.recipient", "identity", "requirements"],
      },
      idempotencyKey
    ),

  // "active" once the seller has finished onboarding and can be paid
  getTransfersStatus: async (id: string) => {
    const account = await requestV2<RecipientAccount>("GET", `/core/accounts/${id}`, undefined, undefined, {
      "include[0]": "configuration.recipient",
    });
    return account.configuration?.recipient?.capabilities?.stripe_balance?.stripe_transfers?.status;
  },

  // Stripe requires https URLs here, even when testing on localhost
  createAccountLink: (account: string, refreshUrl: string, returnUrl: string) =>
    requestV2<{ url: string }>("POST", "/core/account_links", {
      account,
      use_case: {
        type: "account_onboarding",
        account_onboarding: { refresh_url: refreshUrl, return_url: returnUrl },
      },
    }),

  createDashboardLink: (account: string, refreshUrl: string) =>
    requestV2<{ url: string }>("POST", "/core/account_links", {
      account,
      use_case: { type: "account_dashboard", account_dashboard: { refresh_url: refreshUrl } },
    }),

  createCheckoutSession: (params: Record<string, Param>) => request<StripeSession>("POST", "/checkout/sessions", params),

  getCheckoutSession: (id: string) =>
    request<StripeSession>("GET", `/checkout/sessions/${id}`, { expand: ["payment_intent"] }),

  createTransfer: (params: Record<string, Param>, idempotencyKey: string) =>
    request<{ id: string }>("POST", "/transfers", params, idempotencyKey),

  createRefund: (params: Record<string, Param>, idempotencyKey: string) =>
    request<{ id: string }>("POST", "/refunds", params, idempotencyKey),
};

// Checks that a webhook really came from Stripe (signature header + 5 minute window)
export function verifyWebhook(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  let timestamp = "";
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=");
    if (k === "t") timestamp = v;
    if (k === "v1" && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
  const expectedBuf = Buffer.from(expected);
  return signatures.some((s) => {
    const buf = Buffer.from(s);
    return buf.length === expectedBuf.length && timingSafeEqual(buf, expectedBuf);
  });
}
