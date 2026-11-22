import { callRpc, jsonResponse, paystackVerify, requiredEnv } from "../_shared/http.ts";

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let result = 0;
  for (let i = 0; i < left.length; i++) result |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return result === 0;
}

async function expectedSignature(rawBody: string): Promise<string> {
  const secret = requiredEnv("PAYSTACK_SECRET_KEY");
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  try {
    const rawBody = await request.text();
    const suppliedSignature = request.headers.get("x-paystack-signature") || "";
    if (!constantTimeEqual(await expectedSignature(rawBody), suppliedSignature)) {
      return jsonResponse({ error: "Invalid webhook signature." }, 401);
    }

    const event = JSON.parse(rawBody);
    if (event.event !== "charge.success" || !event.data?.reference) {
      return jsonResponse({ received: true }, 200);
    }

    const reference = String(event.data.reference);
    const payment = await paystackVerify(reference);
    if (payment.status !== "success" || payment.reference !== reference) {
      return jsonResponse({ error: "Payment is not successful." }, 409);
    }

    await callRpc("mark_order_paid", {
      p_paystack_reference: reference,
      p_amount_minor: Number(payment.amount),
      p_currency: String(payment.currency),
    });
    return jsonResponse({ received: true }, 200);
  } catch (error) {
    console.error("paystack-webhook failed:", error);
    return jsonResponse({ error: "Webhook processing failed." }, 500);
  }
});
