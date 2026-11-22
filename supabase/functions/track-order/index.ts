import { callRpc, checkOrigin, jsonResponse } from "../_shared/http.ts";

Deno.serve(async (request: Request) => {
  const rejected = checkOrigin(request);
  if (rejected) return rejected;
  const origin = request.headers.get("origin")!;

  try {
    const body = await request.json() as { orderNumber?: string; email?: string };
    const orderNumber = String(body.orderNumber || "").trim().toUpperCase();
    const email = String(body.email || "").trim().toLowerCase();
    if (!/^AD-[A-F0-9]{20}$/.test(orderNumber) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
      return jsonResponse({ error: "Enter a valid order number and email address." }, 400, origin);
    }

    const result = await callRpc<Record<string, unknown> | null>("track_store_order", {
      p_order_number: orderNumber,
      p_customer_email: email,
    });
    if (!result) return jsonResponse({ error: "No order matched those details." }, 404, origin);
    return jsonResponse({ order: result }, 200, origin);
  } catch (error) {
    console.error("track-order failed:", error);
    return jsonResponse({ error: "Order tracking is temporarily unavailable." }, 500, origin);
  }
});
