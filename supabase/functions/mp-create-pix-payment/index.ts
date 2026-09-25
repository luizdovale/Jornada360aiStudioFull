import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;

// Pix é avulso: cada pagamento libera 1 mês ou 1 ano de PRO, sem renovação automática.
const PLANS = {
  monthly: { amount: 9.9, label: "Mensal (1 mês)" },
  yearly: { amount: 99.9, label: "Anual (12 meses)" },
} as const;

type IntervalKey = keyof typeof PLANS;

// Tempo para o usuário pagar o QR Code antes de expirar.
const PIX_EXPIRATION_MINUTES = 30;

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

// O Mercado Pago espera date_of_expiration no formato "yyyy-MM-ddTHH:mm:ss.SSS-03:00".
function toBrasiliaIso(date: Date): string {
  const shifted = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  return shifted.toISOString().replace("Z", "-03:00");
}

function pixResponse(payment: any, interval: IntervalKey) {
  const tx = payment?.point_of_interaction?.transaction_data ?? {};
  return {
    payment_id: String(payment.id),
    status: payment.status,
    interval,
    amount: payment.transaction_amount,
    qr_code: tx.qr_code ?? null,
    qr_code_base64: tx.qr_code_base64 ?? null,
    ticket_url: tx.ticket_url ?? null,
    expires_at: payment.date_of_expiration ?? null,
  };
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
    const interval = body.interval as IntervalKey;
    if (!interval || !(interval in PLANS)) {
      return json({ error: "Invalid interval, use 'monthly' or 'yearly'" }, 400);
    }
    const selectedPlan = PLANS[interval];

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Quem já é PRO pelo cartão (ou liberado manualmente) não deve pagar Pix por
    // cima: o cartão continuaria cobrando e o PRO passaria a ter vencimento.
    const { data: sub } = await admin
      .from("subscriptions")
      .select("status, plan, payment_method")
      .eq("user_id", user.id)
      .maybeSingle();
    if (sub?.status === "active" && sub?.plan === "pro" && sub?.payment_method !== "pix") {
      return json({ error: "Você já tem uma assinatura PRO ativa." }, 409);
    }

    // Reaproveita um Pix pendente do mesmo plano ainda dentro do prazo, para não
    // gerar uma cobrança nova cada vez que o usuário abre a tela.
    const reuseSince = new Date(Date.now() - (PIX_EXPIRATION_MINUTES - 5) * 60 * 1000).toISOString();
    const { data: pending } = await admin
      .from("pix_payments")
      .select("mp_payment_id")
      .eq("user_id", user.id)
      .eq("billing_interval", interval)
      .eq("status", "pending")
      .gte("created_at", reuseSince)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pending?.mp_payment_id) {
      const existingRes = await fetch(`https://api.mercadopago.com/v1/payments/${pending.mp_payment_id}`, {
        headers: { Authorization: `Bearer ${MP_ACCESS_TOKEN}` },
      });
      if (existingRes.ok) {
        const existing = await existingRes.json();
        if (existing.status === "pending" && existing.point_of_interaction?.transaction_data?.qr_code) {
          return json(pixResponse(existing, interval));
        }
      }
    }

    const mpResponse = await fetch("https://api.mercadopago.com/v1/payments", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
        "X-Idempotency-Key": crypto.randomUUID(),
      },
      body: JSON.stringify({
        transaction_amount: selectedPlan.amount,
        description: `Jornada360 PRO - ${selectedPlan.label}`,
        payment_method_id: "pix",
        payer: { email: user.email },
        external_reference: user.id,
        notification_url: `${SUPABASE_URL}/functions/v1/mp-webhook?source_news=webhooks`,
        date_of_expiration: toBrasiliaIso(new Date(Date.now() + PIX_EXPIRATION_MINUTES * 60 * 1000)),
        metadata: { user_id: user.id, interval },
      }),
    });

    const mpData = await mpResponse.json();
    if (!mpResponse.ok) {
      console.error("Mercado Pago pix error:", mpData);
      return json({ error: "Falha ao gerar o Pix no Mercado Pago", details: mpData }, 502);
    }

    const { error: insertError } = await admin.from("pix_payments").insert({
      mp_payment_id: String(mpData.id),
      user_id: user.id,
      billing_interval: interval,
      amount: selectedPlan.amount,
      status: mpData.status ?? "pending",
    });
    if (insertError) {
      // Sem essa linha o pagamento não seria creditado; melhor não mostrar o QR.
      console.error("Supabase insert pix_payments error:", insertError);
      return json({ error: "Falha ao registrar o Pix" }, 500);
    }

    return json(pixResponse(mpData, interval));
  } catch (err) {
    console.error("Unexpected error:", err);
    return json({ error: "Erro inesperado" }, 500);
  }
});
