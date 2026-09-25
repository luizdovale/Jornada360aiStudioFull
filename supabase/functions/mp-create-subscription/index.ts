import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MP_ACCESS_TOKEN = Deno.env.get("MP_ACCESS_TOKEN")!;
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://jornada360.valetechsolucoes.com.br";

const PLANS = {
  monthly: { amount: 9.9, frequency: 1, label: "Mensal" },
  yearly: { amount: 99.9, frequency: 12, label: "Anual" },
} as const;

type IntervalKey = keyof typeof PLANS;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Client com o JWT do usuário: só para descobrir quem está chamando.
    const authedClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await authedClient.auth.getUser();
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;

    const body = await req.json().catch(() => ({}));
    const interval = body.interval as IntervalKey;
    if (!interval || !(interval in PLANS)) {
      return new Response(JSON.stringify({ error: "Invalid interval, use 'monthly' or 'yearly'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const selectedPlan = PLANS[interval];

    const mpResponse = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${MP_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        reason: `Jornada360 PRO - ${selectedPlan.label}`,
        auto_recurring: {
          frequency: selectedPlan.frequency,
          frequency_type: "months",
          transaction_amount: selectedPlan.amount,
          currency_id: "BRL",
        },
        back_url: `${SITE_URL}/#/subscription`,
        payer_email: user.email,
        external_reference: user.id,
      }),
    });

    const mpData = await mpResponse.json();

    if (!mpResponse.ok) {
      console.error("Mercado Pago error:", mpData);
      return new Response(JSON.stringify({ error: "Falha ao criar assinatura no Mercado Pago", details: mpData }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Grava com service_role (bypassa RLS) — o cliente nunca tem permissão direta de
    // escrever em subscriptions; só esta function, já validado o dono do token.
    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Quem ainda tem PRO via Pix mantém o status ativo; só guardamos o novo
    // preapproval. Quando o cartão for autorizado, o webhook troca para "card".
    const { data: current } = await adminClient
      .from("subscriptions")
      .select("status, payment_method, current_period_end")
      .eq("user_id", user.id)
      .maybeSingle();
    const hasValidPix =
      current?.status === "active" &&
      current?.payment_method === "pix" &&
      !!current?.current_period_end &&
      new Date(current.current_period_end) > new Date();

    const { error: upsertError } = hasValidPix
      ? await adminClient
          .from("subscriptions")
          .update({ mp_preapproval_id: mpData.id, updated_at: new Date().toISOString() })
          .eq("user_id", user.id)
      : await adminClient
          .from("subscriptions")
          .upsert(
            {
              user_id: user.id,
              plan: "pro",
              status: "pending",
              billing_interval: interval,
              mp_preapproval_id: mpData.id,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" }
          );

    if (upsertError) {
      console.error("Supabase upsert error:", upsertError);
    }

    return new Response(JSON.stringify({ init_point: mpData.init_point }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
