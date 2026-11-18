import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ASAAS_API_KEY = Deno.env.get("ASAAS_API_KEY") ?? "";
// Chaves de sandbox começam com $aact_hmlg_; dá para forçar com ASAAS_BASE_URL.
const ASAAS_BASE_URL = Deno.env.get("ASAAS_BASE_URL") ??
  (ASAAS_API_KEY.startsWith("$aact_hmlg_") ? "https://api-sandbox.asaas.com/v3" : "https://api.asaas.com/v3");

const ENVIRONMENT = ASAAS_BASE_URL.includes("sandbox") ? "sandbox" : "production";
const WEBHOOK_URL = `${SUPABASE_URL}/functions/v1/asaas-webhook`;
// Eventos que o asaas-webhook trata (cobranças e assinaturas).
const WEBHOOK_EVENTS = [
  "PAYMENT_CREATED", "PAYMENT_UPDATED", "PAYMENT_CONFIRMED", "PAYMENT_RECEIVED", "PAYMENT_OVERDUE",
  "PAYMENT_DELETED", "PAYMENT_RESTORED", "PAYMENT_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS",
  "PAYMENT_CHARGEBACK_REQUESTED", "PAYMENT_CHARGEBACK_DISPUTE", "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED",
  "SUBSCRIPTION_CREATED", "SUBSCRIPTION_UPDATED", "SUBSCRIPTION_INACTIVATED", "SUBSCRIPTION_DELETED",
];

const PLANS = {
  monthly: { amount: 9.9, cycle: "MONTHLY", label: "Mensal" },
  yearly: { amount: 99.9, cycle: "YEARLY", label: "Anual" },
} as const;

type IntervalKey = keyof typeof PLANS;
type BillingType = "PIX" | "CREDIT_CARD";

const PAID_STATUSES = ["CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"];
const OPEN_STATUSES = ["PENDING", "OVERDUE"];
const REVERSED_STATUSES = ["REFUNDED", "REFUND_REQUESTED", "REFUND_IN_PROGRESS", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE"];

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

async function asaas(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(`${ASAAS_BASE_URL}${path}`, {
    ...init,
    headers: {
      access_token: ASAAS_API_KEY,
      "Content-Type": "application/json",
      "User-Agent": "Jornada360",
      ...(init.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) console.error("Asaas error", init.method ?? "GET", path, res.status, JSON.stringify(data));
  return { ok: res.ok, status: res.status, data };
}

// Mensagem legível de um erro do Asaas ({ errors: [{ description }] }).
function asaasErrorMessage(data: any, fallback: string): string {
  return data?.errors?.[0]?.description ?? fallback;
}

// Data de hoje (ou de um instante) em Brasília, no formato YYYY-MM-DD.
function brasiliaDate(date = new Date()): string {
  return new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function isValidCpf(raw: string): boolean {
  const cpf = raw.replace(/\D/g, "");
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  for (const len of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
    const digit = ((sum * 10) % 11) % 10;
    if (digit !== Number(cpf[len])) return false;
  }
  return true;
}

// Confere uma cobrança na API do Asaas e, se paga, credita o PRO.
// Mantenha igual à cópia em asaas-webhook.
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

// Cobranças da assinatura no Asaas, mais recentes primeiro.
async function listSubscriptionPayments(subscriptionId: string): Promise<any[]> {
  const { ok, data } = await asaas(`/subscriptions/${subscriptionId}/payments?limit=10`);
  if (!ok) return [];
  return [...(data.data ?? [])].sort((a, b) => String(b.dueDate).localeCompare(String(a.dueDate)));
}

async function findOrCreateCustomer(user: any, cpf: string): Promise<{ id?: string; error?: string }> {
  const found = await asaas(`/customers?externalReference=${encodeURIComponent(user.id)}&limit=1`);
  const existing = found.ok ? found.data?.data?.[0] : null;
  if (existing?.id && !existing.deleted) return { id: existing.id };

  const meta = user.user_metadata ?? {};
  const name = meta.nome || meta.full_name || meta.name || String(user.email ?? "").split("@")[0] || "Cliente Jornada360";
  const created = await asaas("/customers", {
    method: "POST",
    body: JSON.stringify({
      name,
      cpfCnpj: cpf.replace(/\D/g, ""),
      email: user.email,
      externalReference: user.id,
    }),
  });
  if (!created.ok) return { error: asaasErrorMessage(created.data, "Não foi possível cadastrar seus dados no Asaas.") };
  return { id: created.data.id };
}

async function handleCreate(admin: SupabaseClient, user: any, body: any) {
  const interval = body.interval as IntervalKey;
  const billingType = body.billingType as BillingType;
  if (!interval || !(interval in PLANS)) return json({ error: "Plano inválido." }, 400);
  if (billingType !== "PIX" && billingType !== "CREDIT_CARD") return json({ error: "Forma de pagamento inválida." }, 400);
  const plan = PLANS[interval];

  const { data: current } = await admin
    .from("subscriptions")
    .select("status, plan, provider, payment_method, current_period_end, asaas_customer_id, asaas_subscription_id, canceled_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const now = new Date();
  const periodEnd = current?.current_period_end ? new Date(current.current_period_end) : null;
  const hasPaidPeriod = current?.status === "active" && current?.plan === "pro" && !!periodEnd && periodEnd > now;

  // Assinante de cartão no Mercado Pago e PRO liberado manualmente não têm
  // vencimento: assinar no Asaas por cima geraria cobrança em dobro.
  if (
    current?.status === "active" && current?.plan === "pro" &&
    current?.provider === "mercadopago" && current?.payment_method !== "pix"
  ) {
    return json({ error: "Você já tem uma assinatura PRO ativa." }, 409);
  }

  // Já tem assinatura no Asaas em andamento.
  if (current?.asaas_subscription_id && !current?.canceled_at) {
    if (hasPaidPeriod) return json({ error: "Você já tem uma assinatura ativa." }, 409);
    // Nunca paga (ou atrasada sem PRO): troca pela nova para não ficar com
    // duas assinaturas gerando cobranças.
    await asaas(`/subscriptions/${current.asaas_subscription_id}`, { method: "DELETE" });
  }

  let customerId = current?.asaas_customer_id as string | undefined;
  if (!customerId) {
    const cpf = String(body.cpf ?? "");
    if (!isValidCpf(cpf)) return json({ error: "CPF inválido." }, 400);
    const customer = await findOrCreateCustomer(user, cpf);
    if (!customer.id) return json({ error: customer.error }, 502);
    customerId = customer.id;
  }

  // Quem ainda tem dias pagos só é cobrado quando eles acabam.
  const nextDueDate = hasPaidPeriod ? brasiliaDate(periodEnd!) : brasiliaDate(now);

  const created = await asaas("/subscriptions", {
    method: "POST",
    body: JSON.stringify({
      customer: customerId,
      billingType,
      value: plan.amount,
      nextDueDate,
      cycle: plan.cycle,
      description: `Jornada360 PRO - ${plan.label}`,
      externalReference: user.id,
    }),
  });
  if (!created.ok) {
    return json({ error: asaasErrorMessage(created.data, "Não foi possível criar a assinatura no Asaas.") }, 502);
  }

  const { error: upsertError } = await admin.from("subscriptions").upsert(
    {
      user_id: user.id,
      plan: "pro",
      status: hasPaidPeriod ? "active" : "pending",
      provider: "asaas",
      billing_interval: interval,
      payment_method: billingType === "PIX" ? "pix" : "card",
      asaas_customer_id: customerId,
      asaas_subscription_id: created.data.id,
      canceled_at: null,
      // Desliga uma assinatura antiga do Mercado Pago (abandonada) deste usuário,
      // para um evento atrasado dela não mexer nesta linha.
      mp_preapproval_id: null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (upsertError) {
    console.error("Supabase upsert error:", upsertError);
    // Sem a linha o pagamento não seria creditado: desfaz no Asaas.
    await asaas(`/subscriptions/${created.data.id}`, { method: "DELETE" });
    return json({ error: "Falha ao registrar a assinatura." }, 500);
  }

  // A primeira cobrança pode levar alguns instantes para aparecer.
  let open: any = null;
  for (let attempt = 0; attempt < 3 && !open; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000));
    const payments = await listSubscriptionPayments(created.data.id);
    open = payments.find((p) => OPEN_STATUSES.includes(p.status)) ?? null;
  }

  return json({
    subscription_id: created.data.id,
    next_due_date: nextDueDate,
    invoice_url: open?.invoiceUrl ?? null,
  });
}

async function handleSync(admin: SupabaseClient, userId: string) {
  const { data: current } = await admin
    .from("subscriptions")
    .select("asaas_subscription_id, canceled_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!current?.asaas_subscription_id) return json({ synced: false, reason: "no_subscription" });

  const subscriptionId = current.asaas_subscription_id;
  const payments = await listSubscriptionPayments(subscriptionId);
  const results: Record<string, string> = {};
  for (const p of payments) {
    results[p.id] = await processAsaasPayment(admin, p.id);
  }

  // Assinatura cancelada direto no painel do Asaas.
  if (!current.canceled_at) {
    const { ok, data: asaasSub } = await asaas(`/subscriptions/${subscriptionId}`);
    if (ok && (asaasSub.deleted || asaasSub.status === "INACTIVE" || asaasSub.status === "EXPIRED")) {
      await admin
        .from("subscriptions")
        .update({ canceled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("asaas_subscription_id", subscriptionId);
    }
  }

  const open = payments.find((p) => OPEN_STATUSES.includes(p.status));
  return json({
    synced: true,
    payments: results,
    open_invoice_url: open?.invoiceUrl ?? null,
    open_due_date: open?.dueDate ?? null,
  });
}

// ---------------------------------------------------------------------------
// Painel DEV: status da integração e configuração automática do webhook.
// ---------------------------------------------------------------------------

async function isAdmin(admin: SupabaseClient, userId: string): Promise<boolean> {
  const { data } = await admin.from("profiles").select("role").eq("id", userId).maybeSingle();
  return data?.role === "admin";
}

// Token forte para o Asaas enviar em cada evento (32 bytes aleatórios).
function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return "j360_" + Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function handleAdminStatus(admin: SupabaseClient) {
  if (!ASAAS_API_KEY) return json({ key_configured: false, environment: null });

  const ping = await asaas("/webhooks?limit=1");
  const { data: cfg } = await admin
    .from("asaas_config")
    .select("environment, webhook_id, configured_at")
    .eq("id", 1)
    .maybeSingle();

  let webhook = null;
  if (ping.ok && cfg?.webhook_id && cfg.environment === ENVIRONMENT) {
    const res = await asaas(`/webhooks/${cfg.webhook_id}`);
    if (res.ok) {
      webhook = {
        enabled: !!res.data.enabled,
        interrupted: !!res.data.interrupted,
        url_ok: res.data.url === WEBHOOK_URL,
        penalized_requests: res.data.penalizedRequestsCount ?? 0,
      };
    }
  }

  return json({
    key_configured: true,
    key_valid: ping.ok,
    environment: ENVIRONMENT,
    configured_at: cfg?.environment === ENVIRONMENT ? cfg?.configured_at ?? null : null,
    webhook,
  });
}

// Cria (ou atualiza) o webhook no Asaas com um token novo e guarda o token
// no banco. Também reativa a fila se ela tiver sido interrompida.
async function handleSetupWebhook(admin: SupabaseClient, user: any) {
  if (!ASAAS_API_KEY) return json({ error: "Cadastre a chave ASAAS_API_KEY no Supabase primeiro." }, 400);

  const list = await asaas("/webhooks?limit=100");
  if (!list.ok) {
    return json({ error: asaasErrorMessage(list.data, "Não foi possível acessar o Asaas. Confira a chave de API.") }, 502);
  }

  // Grava o token novo antes de enviá-lo ao Asaas, mantendo o anterior válido
  // para eventos que já estavam a caminho.
  const token = randomToken();
  const { data: cfg } = await admin.from("asaas_config").select("webhook_token").eq("id", 1).maybeSingle();
  const { error: saveError } = await admin
    .from("asaas_config")
    .upsert({ id: 1, webhook_token: token, previous_webhook_token: cfg?.webhook_token ?? null });
  if (saveError) {
    console.error("asaas_config save error:", saveError);
    return json({ error: "Falha ao salvar a configuração." }, 500);
  }

  const existing = (list.data.data ?? []).find((w: any) => w.url === WEBHOOK_URL);
  const payload = {
    name: "Jornada360",
    url: WEBHOOK_URL,
    enabled: true,
    interrupted: false,
    sendType: "SEQUENTIALLY",
    authToken: token,
    events: WEBHOOK_EVENTS,
  };
  const res = existing
    ? await asaas(`/webhooks/${existing.id}`, { method: "PUT", body: JSON.stringify(payload) })
    : await asaas("/webhooks", { method: "POST", body: JSON.stringify({ ...payload, email: user.email, apiVersion: 3 }) });

  if (!res.ok) {
    // O Asaas não aceitou: volta ao token anterior.
    await admin
      .from("asaas_config")
      .update({ webhook_token: cfg?.webhook_token ?? null, previous_webhook_token: null })
      .eq("id", 1);
    return json({ error: asaasErrorMessage(res.data, "O Asaas recusou a configuração do webhook.") }, 502);
  }

  const webhookId = res.data.id ?? existing?.id;
  await admin
    .from("asaas_config")
    .update({ environment: ENVIRONMENT, webhook_id: webhookId, configured_at: new Date().toISOString(), configured_by: user.id })
    .eq("id", 1);

  return json({ ok: true, created: !existing, environment: ENVIRONMENT, webhook_id: webhookId });
}

async function handleCancel(admin: SupabaseClient, userId: string) {
  const { data: current } = await admin
    .from("subscriptions")
    .select("asaas_subscription_id, canceled_at, status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();
  if (!current?.asaas_subscription_id || current.canceled_at) {
    return json({ error: "Nenhuma assinatura ativa para cancelar." }, 400);
  }

  const res = await asaas(`/subscriptions/${current.asaas_subscription_id}`, { method: "DELETE" });
  if (!res.ok && res.status !== 404) {
    return json({ error: asaasErrorMessage(res.data, "Não foi possível cancelar no Asaas.") }, 502);
  }

  // O PRO continua até o fim do período já pago; sem período pago, encerra já.
  const hasPaidPeriod = !!current.current_period_end && new Date(current.current_period_end) > new Date();
  await admin
    .from("subscriptions")
    .update({
      canceled_at: new Date().toISOString(),
      status: hasPaidPeriod ? current.status : "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  return json({ canceled: true, pro_until: hasPaidPeriod ? current.current_period_end : null });
}

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
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    if (body.action === "admin_status" || body.action === "setup_webhook") {
      if (!(await isAdmin(admin, user.id))) return json({ error: "Acesso restrito." }, 403);
      return body.action === "admin_status" ? await handleAdminStatus(admin) : await handleSetupWebhook(admin, user);
    }

    if (!ASAAS_API_KEY) {
      console.error("ASAAS_API_KEY not configured");
      return json({ error: "Pagamentos indisponíveis no momento." }, 503);
    }

    switch (body.action) {
      case "create":
        return await handleCreate(admin, user, body);
      case "sync":
        return await handleSync(admin, user.id);
      case "cancel":
        return await handleCancel(admin, user.id);
      default:
        return json({ error: "Ação inválida." }, 400);
    }
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Erro inesperado" }, 500);
  }
});
