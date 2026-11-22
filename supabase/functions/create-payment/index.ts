import {
  callRpc,
  checkOrigin,
  jsonResponse,
  randomToken,
  requiredEnv,
  sha256,
} from "../_shared/http.ts";

type CheckoutPayload = {
  customer?: { name?: string; email?: string; phone?: string };
  address?: { address?: string; city?: string; state?: string; postalCode?: string; country?: string };
  shippingMethod?: string;
  items?: Array<{ variantSku?: string; quantity?: number }>;
};

type CreatedOrder = {
  order_number: string;
  paystack_reference: string;
  amount_minor: number;
  currency: string;
};

Deno.serve(async (request: Request) => {
  const rejected = checkOrigin(request);
  if (rejected) return rejected;
  const origin = request.headers.get("origin")!;
  let referenceToRelease = "";

  try {
    const payload = await request.json() as CheckoutPayload;
    const name = String(payload.customer?.name || "").trim();
    const email = String(payload.customer?.email || "").trim().toLowerCase();
    const phone = String(payload.customer?.phone || "").trim();
    const address = payload.address || {};
    const items = payload.items || [];

    if (name.length < 2 || name.length > 200 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 ||
        phone.length < 5 || phone.length > 40) {
      return jsonResponse({ error: "Enter a valid name, email, and phone number." }, 400, origin);
    }
    if (items.length < 1 || items.length > 20 ||
        items.some((item) => !item.variantSku || !Number.isInteger(item.quantity) ||
          Number(item.quantity) < 1 || Number(item.quantity) > 20)) {
      return jsonResponse({ error: "Your cart contains an invalid item or quantity." }, 400, origin);
    }
    if (!payload.shippingMethod ||
        !address.address || !address.city || !address.country ||
        String(address.address).length > 300 || String(address.city).length > 100) {
      return jsonResponse({ error: "Complete your shipping address and choose a delivery method." }, 400, origin);
    }

    const forwardedFor = request.headers.get("x-forwarded-for") || "";
    const clientIp = forwardedFor.split(",")[0].trim();
    const rateKey = await sha256(`${email}|${clientIp}`);
    const allowed = await callRpc<boolean>("consume_checkout_attempt", {
      p_key_hash: rateKey,
    });
    if (!allowed) {
      return jsonResponse({ error: "Too many checkout attempts. Please wait a few minutes and try again." }, 429, origin);
    }

    const token = randomToken();
    const tokenHash = await sha256(token);
    const created = await callRpc<CreatedOrder[]>("create_store_order", {
      p_customer: { name, email, phone },
      p_shipping_address: {
        address: String(address.address).trim(),
        city: String(address.city).trim(),
        state: String(address.state || "").trim(),
        postalCode: String(address.postalCode || "").trim(),
        country: String(address.country).trim(),
      },
      p_shipping_method: payload.shippingMethod,
      p_items: items.map((item) => ({
        variantSku: String(item.variantSku),
        quantity: Number(item.quantity),
      })),
      p_access_token_hash: tokenHash,
    });
    const order = Array.isArray(created) ? created[0] : null;
    if (!order) throw new Error("Order creation returned no order.");
    referenceToRelease = order.paystack_reference;

    const storefrontUrl = requiredEnv("STOREFRONT_URL").replace(/\/+$/, "");
    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${requiredEnv("PAYSTACK_SECRET_KEY")}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        email,
        amount: Number(order.amount_minor),
        currency: order.currency,
        reference: order.paystack_reference,
        callback_url: `${storefrontUrl}/checkout.html?payment=return`,
        metadata: { order_number: order.order_number },
      }),
    });
    const payment = await paystackResponse.json();
    if (!paystackResponse.ok || payment.status !== true ||
        !payment.data?.authorization_url) {
      console.error("Paystack initialization failed:", paystackResponse.status, payment.message);
      throw new Error("Payment could not be initialized. Please try again.");
    }

    return jsonResponse({
      authorizationUrl: payment.data.authorization_url,
      reference: order.paystack_reference,
      orderNumber: order.order_number,
      accessToken: token,
    }, 200, origin);
  } catch (error) {
    console.error("create-payment failed:", error);
    if (referenceToRelease) {
      try {
        await callRpc("fail_store_order", {
          p_paystack_reference: referenceToRelease,
        });
      } catch (releaseError) {
        console.error("Could not release stock after payment initialization failed:", releaseError);
      }
    }
    return jsonResponse({ error: "Checkout could not be started. Please try again later." }, 502, origin);
  }
});
