import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;
const MP_WEBHOOK_SECRET = Deno.env.get("MP_WEBHOOK_SECRET");

const STATUS_MAP: Record<string, string> = {
  authorized: "active",
  paused: "inactive",
  cancelled: "canceled",
  pending: "pending",
};

// Valida o header x-signature do Mercado Pago (formato "ts=...,v1=...") usando
// HMAC-SHA256 sobre "id:{data.id};request-id:{x-request-id};ts:{ts};".
async function verifySignature(req: Request, dataId: string): Promise<boolean> {
  if (!MP_WEBHOOK_SECRET) return false;

  const signatureHeader = req.headers.get("x-signature");
  const requestId = req.headers.get("x-request-id");
  if (!signatureHeader || !requestId || !dataId) return false;

  const parts: Record<string, string> = {};
  for (const part of signatureHeader.split(",")) {
    const [k, v] = part.split("=");
    if (k && v) parts[k.trim()] = v.trim();
  }
  const ts = parts["ts"];
  const v1 = parts["v1"];
  if (!ts || !v1) return false;

  const manifest = `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(MP_WEBHOOK_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(manifest));
  const computedHex = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return computedHex === v1;
}

// Confere um pagamento Pix na API do MP e, se aprovado, credita o PRO.
// Só processa cobranças criadas pela mp-create-pix-payment (existem em
// pix_payments) — pagamentos das assinaturas no cartão passam direto.
// Mantenha igual à cópia em mp-sync-subscription.
async function processPixPayment(admin: SupabaseClient, paymentId: string): Promise<string> {
  const { data: row } = await admin
    .from("pix_payments")
    .select("user_id, amount, credited_at")
    .eq("mp_payment_id", paymentId)
    .maybeSingle();
  if (!row) return "unknown_payment";

  const mpRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
    headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
  });
  if (!mpRes.ok) {
    console.error("Failed to fetch payment from Mercado Pago", paymentId, await mpRes.text());
    return "mp_fetch_failed";
  }
  const payment = await mpRes.json();

  if (
    payment.payment_method_id !== "pix" ||
    payment.external_reference !== row.user_id ||
    Number(payment.transaction_amount) < Number(row.amount)
  ) {
    console.error("Pix payment does not match our record", paymentId);
    return "mismatch";
  }

  if (payment.status === "approved") {
    const { error } = await admin.rpc("credit_pix_payment", { p_payment_id: paymentId });
    if (error) {
      console.error("credit_pix_payment error:", error);
      return "credit_failed";
    }
    return "approved";
  }

  if (row.credited_at && (payment.status === "refunded" || payment.status === "charged_back")) {
    // O PRO não é removido automaticamente; fica registrado para tratar no painel.
    console.warn("Credited pix payment was reversed", paymentId, payment.status);
  }

  await admin
    .from("pix_payments")
    .update({ status: payment.status, updated_at: new Date().toISOString() })
    .eq("mp_payment_id", paymentId);

  return payment.status;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("ok", { status: 200 });
  }

  try {
    const url = new URL(req.url);
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // alguns eventos chegam so via query string
    }

    const eventType = body?.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");
    const preapprovalId = body?.data?.id ?? url.searchParams.get("data.id") ?? url.searchParams.get("id");

    if (eventType === "payment") {
      if (!preapprovalId) return new Response("missing payment id", { status: 200 });

      // Não rejeita por assinatura: o payload nunca é usado, o pagamento é
      // buscado na API do MP e precisa existir em pix_payments com o mesmo
      // usuário e valor. Um evento forjado só dispara uma nova conferência.
      if (MP_WEBHOOK_SECRET && !(await verifySignature(req, String(preapprovalId)))) {
        console.warn("Unverified webhook signature for payment", preapprovalId);
      }

      const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const result = await processPixPayment(admin, String(preapprovalId));
      return new Response(result, { status: 200 });
    }

    if (eventType !== "subscription_preapproval" && eventType !== "preapproval") {
      return new Response("ignored", { status: 200 });
    }
    if (!preapprovalId) {
      return new Response("missing preapproval id", { status: 200 });
    }

    if (MP_WEBHOOK_SECRET) {
      const validSignature = await verifySignature(req, String(preapprovalId));
      if (!validSignature) {
        console.error("Invalid webhook signature for preapproval", preapprovalId);
        return new Response("invalid signature", { status: 200 });
      }
    }

    // Nunca confia no payload do webhook sozinho: busca o status real na API do MP.
    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${preapprovalId}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!mpRes.ok) {
      console.error("Failed to fetch preapproval from Mercado Pago", await mpRes.text());
      return new Response("mp fetch failed", { status: 200 });
    }

    const preapproval = await mpRes.json();
    const newStatus = STATUS_MAP[preapproval.status] ?? "inactive";
    const periodEnd = preapproval?.auto_recurring?.next_payment_date
      ? new Date(preapproval.auto_recurring.next_payment_date).toISOString()
      : null;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let update = admin
      .from("subscriptions")
      .update({
        status: newStatus,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
        ...(newStatus === "active" ? { payment_method: "card" } : {}),
      })
      .eq("mp_preapproval_id", preapprovalId);

    // Uma assinatura no cartão abandonada (pendente/cancelada) não pode derrubar
    // quem pagou com Pix depois. Só a ativação do cartão troca o método.
    if (newStatus !== "active") {
      update = update.or("payment_method.is.null,payment_method.neq.pix");
    }

    const { error } = await update;

    if (error) {
      console.error("Supabase update error:", error);
    }

    return new Response("ok", { status: 200 });
  } catch (err) {
    console.error("Unexpected webhook error:", err);
    return new Response("ok", { status: 200 });
  }
});
