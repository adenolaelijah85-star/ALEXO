import {
  callRpc,
  checkOrigin,
  jsonResponse,
  requiredEnv,
  sha256,
  paystackVerify,
} from "../_shared/http.ts";

type OrderAccess = {
  id: string;
  order_number: string;
  amount_minor: number;
  currency: string;
  status: string;
};

Deno.serve(async (request: Request) => {
  const rejected = checkOrigin(request);
  if (rejected) return rejected;
  const origin = request.headers.get("origin")!;

  try {
    const body = await request.json() as { reference?: string; accessToken?: string };
    const reference = String(body.reference || "");
    const accessToken = String(body.accessToken || "");
    if (!/^adelix-[a-f0-9]{32}$/.test(reference) || !/^[a-f0-9]{64}$/.test(accessToken)) {
      return jsonResponse({ error: "Invalid payment reference." }, 400, origin);
    }

    const orders = await callRpc<OrderAccess[]>("get_order_for_payment", {
      p_paystack_reference: reference,
      p_access_token_hash: await sha256(accessToken),
    });
    const order = Array.isArray(orders) ? orders[0] : null;
    if (!order) return jsonResponse({ error: "Order could not be found." }, 404, origin);

    const payment = await paystackVerify(reference);
    if (payment.reference !== reference ||
        Number(payment.amount) !== Number(order.amount_minor) ||
        String(payment.currency) !== order.currency) {
      return jsonResponse({ error: "Payment details do not match this order." }, 409, origin);
    }
    if (payment.status !== "success") {
      return jsonResponse({
        status: "pending",
        message: "Payment has not been confirmed yet.",
      }, 202, origin);
    }

    const updated = await callRpc<Array<{ order_number: string; status: string }>>(
      "mark_order_paid",
      {
        p_paystack_reference: reference,
        p_amount_minor: Number(payment.amount),
        p_currency: String(payment.currency),
      },
    );
    const result = Array.isArray(updated) ? updated[0] : null;
    if (!result) throw new Error("Payment confirmation did not update an order.");

    return jsonResponse({
      status: result.status,
      orderNumber: result.order_number,
    }, 200, origin);
  } catch (error) {
    console.error("verify-payment failed:", error);
    const message = error instanceof Error ? error.message : "Payment could not be verified.";
    return jsonResponse({ error: message }, 400, origin);
  }
});
