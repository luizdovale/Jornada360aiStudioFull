import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
// Token configurado pelo painel DEV (tabela asaas_config). O secret
// ASAAS_WEBHOOK_TOKEN continua aceito para quem preferir configurar à mão.
const ASAAS_WEBHOOK_TOKEN = Deno.env.get("ASAAS_WEBHOOK_TOKEN") ?? "";
// Chaves de sandbox começam com $aact_hmlg_; dá para forçar com ASAAS_BASE_URL.
const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ??
  (ASAAS_API_KEY.startsWith("$aact_hmlg_") ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3");

const PLANS = {
  monthly: { amount: 9.9 },
  yearly: { amount: 99.9 },
} as const;

type IntervalKey = keyof typeof PLANS;

const PAID_STATUSES = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];
const REVERSED_STATUSES = ["REFUNDED", "REFUND_REQUESTED", "REFUND_IN_PROGRESS", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"];

async function asaas(path: string): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    headers: { access_token: ASAAS_API_KEY, "Content-Type": "application/json", "User-Agent": "Jornada360" },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) console.error("Asaas error GET", path, res.status, JSON.stringify(data));
  return { ok: res.ok, status: res.status, data };
}

// Comparação em tempo constante, para não vazar o token por tempo de resposta.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Confere uma cobrança na API do Asaas e, se paga, credita o PRO.
// Mantenha igual à cópia em asaas-subscription.
async function processAsaasPayment(admin: SupabaseClient, paymentId: string): Promise<string> {
  const { ok, data: payment } = await asaas(`/payments/${paymentId}`);
  if (!ok) return "asaas_fetch_failed";
  if (!payment.subscription) return "not_subscription";

  const { data: sub } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("asaas_customer_id", payment.customer)
    .maybeSingle();
  if (!sub) return "unknown_customer";

  if (PAID_STATUSES.includes(payment.status)) {
    const { ok: subOk, data: asaasSub } = await asaas(`/subscriptions/${payment.subscription}`);
    if (!subOk) return "asaas_fetch_failed";
    const interval: IntervalKey | null =
      asaasSub.cycle === "YEARLY" ? "yearly" : asaasSub.cycle === "MONTHLY" ? "monthly" : null;
    if (!interval || Number(payment.value) < PLANS[interval].amount - 0.01) {
      console.error("Asaas payment does not match a plan", paymentId, asaasSub.cycle, payment.value);
      return "mismatch";
    }

    const { error } = await admin.rpc("credit_asaas_payment", {
      p_payment_id: payment.id,
      p_user_id: sub.user_id,
      p_subscription_id: payment.subscription,
      p_interval: interval,
      p_billing_type: payment.billingType,
      p_value: payment.value,
      p_due_date: payment.dueDate,
    });
    if (error) {
      console.error("credit_asaas_payment error:", error);
      return "credit_failed";
    }
    return "credited";
  }

  if (REVERSED_STATUSES.includes(payment.status)) {
    // O PRO não é removido automaticamente; fica registrado para tratar no painel.
    console.warn("Asaas payment reversed", paymentId, payment.status);
  }

  // Registra o status sem sobrescrever uma cobrança já creditada (exceto estorno).
  const { data: existing } = await admin
    .from("asaas_payments")
    .select("credited_at")
    .eq("asaas_payment_id", payment.id)
    .maybeSingle();
  const row = {
    asaas_payment_id: payment.id,
    user_id: sub.user_id,
    asaas_subscription_id: payment.subscription,
    billing_type: payment.billingType,
    value: payment.value,
    due_date: payment.dueDate,
    status: payment.status,
    updated_at: new Date().toISOString(),
  };
  if (!existing) {
    await admin.from("asaas_payments").insert(row);
  } else if (!existing.credited_at || REVERSED_STATUSES.includes(payment.status)) {
    await admin.from("asaas_payments").update(row).eq("asaas_payment_id", payment.id);
  }

  return payment.status;
}

// O Asaas só considera entregue com HTTP 200; qualquer outro status conta como
// falha e, após 15 falhas seguidas, a fila do webhook é pausada. Por isso tudo
// que não é problema de autenticação responde 200 — o asaas-subscription (sync)
// reprocessa as cobranças quando o usuário abre a tela de assinatura.
Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return new Response("ok", { status: 200 });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const { data: cfg } = await admin
    .from("asaas_config")
    .select("webhook_token, previous_webhook_token")
    .eq("id", 1)
    .maybeSingle();
  const received = req.headers.get("asaas-access-token") ?? "";
  const accepted = [cfg?.webhook_token, cfg?.previous_webhook_token, ASAAS_WEBHOOK_TOKEN].filter((t): t is string => !!t);
  if (!received || !accepted.some((t) => safeEqual(received, t))) {
    console.error("Asaas webhook with invalid token");
    return new Response("unauthorized", { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const event: string = body?.event ?? "";

    if (event.startsWith("PAYMENT_") && body?.payment?.id) {
      // Nunca confia no payload: a cobrança é buscada de novo na API do Asaas.
      const result = await processAsaasPayment(admin, String(body.payment.id));
      console.log("Asaas webhook", body.id, event, body.payment.id, result);
      return new Response(result, { status: 200 });
    }

    if ((event === "SUBSCRIPTION_DELETED" || event === "SUBSCRIPTION_INACTIVATED") && body?.subscription?.id) {
      // Cancelada pelo painel do Asaas: o PRO continua até o fim do período pago.
      await admin
        .from("subscriptions")
        .update({ canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("asaas_subscription_id", String(body.subscription.id))
        .is("canceled_at", null);
      console.log("Asaas webhook", body.id, event, body.subscription.id);
      return new Response("ok", { status: 200 });
    }

    return new Response("ignored", { status: 200 });
  } catch (err) {
    console.error("Unexpected Asaas webhook error:", err);
    return new Response("ok", { status: 200 });
  }
});
