import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;

const STATUS_MAP: Record<string, string> = {
  authorized: "active",
  paused: "inactive",
  cancelled: "canceled",
  pending: "pending",
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Confere um pagamento Pix na API do MP e, se aprovado, credita o PRO.
// Mantenha igual à cópia em mp-webhook.
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
    console.warn("Credited pix payment was reversed", paymentId, payment.status);
  }

  await admin
    .from("pix_payments")
    .update({ status: payment.status, updated_at: new Date().toISOString() })
    .eq("mp_payment_id", paymentId);

  return payment.status;
}

// Confere o status real no Mercado Pago e atualiza o banco. Usado quando o
// usuario abre a tela de assinatura e, a cada poucos segundos, enquanto ele
// esta com um QR Code Pix aberto (o webhook pode atrasar ou nao chegar).
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await authedClient.auth.getUser();
    if (userError || !userData?.user) return json({ error: "Not authenticated" }, 401);
    const userId = userData.user.id;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // 1) Pix pendentes das últimas 24h.
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: pendingPix } = await admin
      .from("pix_payments")
      .select("mp_payment_id")
      .eq("user_id", userId)
      .eq("status", "pending")
      .gte("created_at", since);

    const pix: Record<string, string> = {};
    for (const p of pendingPix ?? []) {
      pix[p.mp_payment_id] = await processPixPayment(admin, p.mp_payment_id);
    }

    // 2) Assinatura no cartão.
    const { data: sub } = await admin
      .from("subscriptions")
      .select("mp_preapproval_id, status, plan, payment_method, current_period_end")
      .eq("user_id", userId)
      .maybeSingle();

    if (!sub?.mp_preapproval_id) {
      return json({ synced: false, reason: "no_preapproval", pix });
    }

    const mpRes = await fetch(`https://api.mercadopago.com/preapproval/${sub.mp_preapproval_id}`, {
      headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
    });

    if (!mpRes.ok) {
      console.error("MP fetch failed", await mpRes.text());
      return json({ synced: false, reason: "mp_fetch_failed", pix });
    }

    const preapproval = await mpRes.json();
    const newStatus = STATUS_MAP[preapproval.status] ?? "inactive";
    const periodEnd = preapproval?.auto_recurring?.next_payment_date
      ? new Date(preapproval.auto_recurring.next_payment_date).toISOString()
      : null;

    // Quem pagou com Pix não perde o PRO por causa de uma assinatura no cartão
    // abandonada. Só a ativação do cartão troca o método.
    if (sub.payment_method === "pix" && newStatus !== "active") {
      return json({ synced: false, reason: "pix_active", mp_status: preapproval.status, pix });
    }

    await admin
      .from("subscriptions")
      .update({
        status: newStatus,
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
        ...(newStatus === "active" ? { payment_method: "card" } : {}),
      })
      .eq("user_id", userId);

    return json({ synced: true, status: newStatus, mp_status: preapproval.status, pix });
  } catch (err) {
    console.error("Unexpected sync error:", err);
    return json({ error: "Erro inesperado" }, 500);
  }
});
