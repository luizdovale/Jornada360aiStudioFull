
import React, { useState, useEffect, useRef } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../hooks/useToast';
import { Check, ShieldCheck, CalendarRange, Clock, ArrowLeft, Loader2, CreditCard, QrCode, Copy } from 'lucide-react';
import Jornada360Icon from '../components/ui/Jornada360Icon';

type Interval = 'monthly' | 'yearly';
type Method = 'card' | 'pix';

const PLANS: Record<Interval, { label: string; price: string; suffix: string; note?: string }> = {
    monthly: { label: 'Plano Mensal', price: 'R$ 9,90', suffix: '/mês' },
    yearly: { label: 'Plano Anual', price: 'R$ 99,90', suffix: '/ano', note: 'Equivale a R$ 8,33/mês — 2 meses grátis' },
};

interface PixCharge {
    payment_id: string;
    qr_code: string | null;
    qr_code_base64: string | null;
    expires_at: string | null;
}

const PIX_POLL_MS = 5000;

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

const SubscriptionPage: React.FC = () => {
    const { isPro, pixExpiresAt, refreshSubscription } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [interval, setInterval] = useState<Interval>('yearly');
    const [method, setMethod] = useState<Method>('card');
    const [loading, setLoading] = useState(false);
    const [pix, setPix] = useState<PixCharge | null>(null);
    const [pixExpired, setPixExpired] = useState(false);
    const [copied, setCopied] = useState(false);
    const pollingRef = useRef(false);

    // Quem já é PRO via Pix só pode renovar com Pix (o período é somado).
    const canRenewWithPix = isPro && !!pixExpiresAt;
    const effectiveMethod: Method = canRenewWithPix ? 'pix' : method;

    // Ao voltar do checkout do Mercado Pago (ou sempre que abrir esta tela),
    // confere o status real da assinatura direto na API deles e atualiza o
    // app — o webhook pode atrasar ou nao chegar, e o estado "isPro" do
    // contexto so era carregado uma vez no login.
    useEffect(() => {
        const sync = async () => {
            try {
                await supabase.functions.invoke('mp-sync-subscription');
                await refreshSubscription();
            } catch (e) {
                console.error('Erro ao sincronizar assinatura:', e);
            }
        };
        sync();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Enquanto o QR Code está aberto, confere o pagamento a cada poucos segundos.
    useEffect(() => {
        if (!pix) return;
        let cancelled = false;

        const check = async () => {
            if (pollingRef.current) return;
            pollingRef.current = true;
            try {
                if (pix.expires_at && new Date(pix.expires_at) < new Date()) {
                    setPixExpired(true);
                    return;
                }
                await supabase.functions.invoke('mp-sync-subscription');
                const { data } = await supabase
                    .from('pix_payments')
                    .select('status')
                    .eq('mp_payment_id', pix.payment_id)
                    .maybeSingle();
                if (cancelled) return;

                if (data?.status === 'approved') {
                    await refreshSubscription();
                    setPix(null);
                    toast({ title: 'Pagamento confirmado!', description: 'Seu Jornada360 PRO já está ativo.' });
                } else if (data?.status === 'cancelled' || data?.status === 'rejected') {
                    setPixExpired(true);
                }
            } catch (e) {
                console.error('Erro ao conferir pagamento Pix:', e);
            } finally {
                pollingRef.current = false;
            }
        };

        const timer = window.setInterval(check, PIX_POLL_MS);
        return () => {
            cancelled = true;
            window.clearInterval(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pix]);

    const features = [
        { icon: ShieldCheck, text: "Relatórios em PDF ilimitados" },
        { icon: CalendarRange, text: "Calendário de escala completo, sem limite de meses" },
        { icon: Clock, text: "Suporte prioritário" },
    ];

    const handleSubscribe = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('mp-create-subscription', {
                body: { interval },
            });

            if (error || !data?.init_point) {
                throw new Error(error?.message || 'Não foi possível iniciar a assinatura.');
            }

            window.location.href = data.init_point;
        } catch (e: any) {
            toast({
                title: 'Erro ao iniciar assinatura',
                description: e.message || 'Tente novamente em instantes.',
                variant: 'destructive',
            });
            setLoading(false);
        }
    };

    const handlePix = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('mp-create-pix-payment', {
                body: { interval },
            });

            if (error || !data?.qr_code) {
                // Em erro HTTP o corpo (com a mensagem da function) vem em error.context.
                const body = await (error as any)?.context?.json?.().catch(() => null);
                throw new Error(body?.error || data?.error || 'Não foi possível gerar o Pix.');
            }

            setPixExpired(false);
            setCopied(false);
            setPix(data);
        } catch (e: any) {
            toast({
                title: 'Erro ao gerar Pix',
                description: e.message || 'Tente novamente em instantes.',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!pix?.qr_code) return;
        try {
            await navigator.clipboard.writeText(pix.qr_code);
            setCopied(true);
            toast({ title: 'Código Pix copiado', description: 'Cole no app do seu banco para pagar.' });
        } catch {
            toast({ title: 'Não foi possível copiar', description: 'Selecione o código e copie manualmente.', variant: 'destructive' });
        }
    };

    const plan = PLANS[interval];
    const showPlanChoice = !isPro || canRenewWithPix;

    const renderPixCharge = () => (
        <div className="space-y-4">
            {pixExpired ? (
                <div className="text-center space-y-3">
                    <p className="text-sm text-gray-700">Este código Pix expirou.</p>
                    <button
                        onClick={handlePix}
                        disabled={loading}
                        className="w-full bg-accent text-primary-dark font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><QrCode className="w-5 h-5" /> Gerar novo Pix</>}
                    </button>
                </div>
            ) : (
                <>
                    {pix?.qr_code_base64 && (
                        <img
                            src={`data:image/png;base64,${pix.qr_code_base64}`}
                            alt="QR Code Pix"
                            className="w-52 h-52 mx-auto rounded-xl border border-gray-200"
                        />
                    )}
                    <p className="text-xs text-center text-gray-600">
                        Escaneie o QR Code ou copie o código abaixo e pague no app do seu banco.
                    </p>
                    <textarea
                        readOnly
                        value={pix?.qr_code ?? ''}
                        onFocus={e => e.currentTarget.select()}
                        className="w-full h-20 text-[11px] font-mono p-2 rounded-xl border border-gray-200 bg-gray-50 text-gray-700 resize-none"
                    />
                    <button
                        onClick={handleCopy}
                        className="w-full bg-accent text-primary-dark font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        {copied ? <><Check className="w-5 h-5" /> Código copiado</> : <><Copy className="w-5 h-5" /> Copiar código Pix</>}
                    </button>
                    <div className="flex items-center justify-center gap-2 text-xs text-gray-600">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Aguardando pagamento… a confirmação é automática.
                    </div>
                    {pix?.expires_at && (
                        <p className="text-[10px] text-center text-muted-foreground">
                            Válido até {new Date(pix.expires_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                    )}
                </>
            )}
            <button
                onClick={() => setPix(null)}
                className="w-full text-sm text-gray-500 py-2"
            >
                Voltar
            </button>
        </div>
    );

    const renderAction = () => {
        if (pix) return renderPixCharge();

        if (isPro && !canRenewWithPix) {
            return (
                <button
                    disabled
                    className="w-full bg-primary/10 text-primary-dark font-black py-4 rounded-2xl flex items-center justify-center gap-3"
                >
                    Você já é PRO ✓
                </button>
            );
        }

        return (
            <>
                {canRenewWithPix ? (
                    <div className="mb-4 p-3 rounded-2xl bg-green-50 text-green-800 text-xs text-center">
                        Você é PRO até <strong>{formatDate(pixExpiresAt!)}</strong> (pago com Pix).
                        <br />Renovando agora, o novo período é somado a essa data.
                    </div>
                ) : (
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        <button
                            onClick={() => setMethod('card')}
                            className={`p-3 rounded-2xl border-2 text-left transition-all ${method === 'card' ? 'border-accent bg-accent/10' : 'border-gray-200'}`}
                        >
                            <CreditCard className="w-5 h-5 text-primary-dark mb-1" />
                            <p className="text-sm font-bold text-primary-dark">Cartão</p>
                            <p className="text-[10px] text-gray-500">Renova automaticamente</p>
                        </button>
                        <button
                            onClick={() => setMethod('pix')}
                            className={`p-3 rounded-2xl border-2 text-left transition-all ${method === 'pix' ? 'border-accent bg-accent/10' : 'border-gray-200'}`}
                        >
                            <QrCode className="w-5 h-5 text-primary-dark mb-1" />
                            <p className="text-sm font-bold text-primary-dark">Pix</p>
                            <p className="text-[10px] text-gray-500">
                                {interval === 'yearly' ? 'Paga uma vez, 12 meses' : 'Paga uma vez, 1 mês'}
                            </p>
                        </button>
                    </div>
                )}

                <button
                    onClick={effectiveMethod === 'pix' ? handlePix : handleSubscribe}
                    disabled={loading}
                    className="w-full bg-accent text-primary-dark font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                >
                    {loading ? (
                        <Loader2 className="w-6 h-6 animate-spin" />
                    ) : effectiveMethod === 'pix' ? (
                        <><QrCode className="w-5 h-5" /> {canRenewWithPix ? 'Renovar com Pix' : 'Pagar com Pix'}</>
                    ) : (
                        <><CreditCard className="w-5 h-5" /> Assinar Agora</>
                    )}
                </button>
            </>
        );
    };

    return (
        <div className="min-h-screen bg-primary flex flex-col p-6 pb-20 overflow-x-hidden">
            <button onClick={() => navigate(-1)} className="mb-8 text-white flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
                <ArrowLeft className="w-5 h-5" /> Voltar
            </button>

            <div className="max-w-md mx-auto w-full space-y-8">
                <div className="text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="relative">
                            <Jornada360Icon className="w-20 h-20 text-accent" />
                            <div className="absolute -top-1 -right-1 bg-accent text-primary-dark text-[10px] font-bold px-2 py-0.5 rounded-full ring-2 ring-primary">PRO</div>
                        </div>
                    </div>
                    <h1 className="text-3xl font-bold text-white">Eleve sua Jornada</h1>
                    <p className="text-muted-foreground">Exporte seus relatórios e planeje sua escala com antecedência.</p>
                </div>

                {showPlanChoice && !pix && (
                    <div className="flex bg-white/10 p-1.5 rounded-2xl">
                        <button
                            onClick={() => setInterval('yearly')}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${interval === 'yearly' ? 'bg-white text-primary-dark shadow-md' : 'text-white/70'}`}
                        >
                            Anual
                        </button>
                        <button
                            onClick={() => setInterval('monthly')}
                            className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${interval === 'monthly' ? 'bg-white text-primary-dark shadow-md' : 'text-white/70'}`}
                        >
                            Mensal
                        </button>
                    </div>
                )}

                <div className="bg-white rounded-3xl p-6 shadow-floating border border-accent/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-accent text-primary-dark font-bold text-xs px-4 py-1 rounded-bl-2xl">
                        {interval === 'yearly' ? 'MELHOR CUSTO' : 'RECOMENDADO'}
                    </div>

                    <div className="mb-6">
                        <span className="text-sm font-bold text-primary-dark/60 uppercase tracking-widest">{plan.label}</span>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-4xl font-black text-primary-dark">{plan.price}</span>
                            <span className="text-muted-foreground">{plan.suffix}</span>
                        </div>
                        {plan.note && <p className="text-xs text-green-600 font-semibold mt-1">{plan.note}</p>}
                    </div>

                    {!pix && (
                        <ul className="space-y-4 mb-8">
                            {features.map((f, i) => (
                                <li key={i} className="flex items-center gap-3 text-sm text-gray-700">
                                    <div className="bg-green-100 p-1 rounded-full">
                                        <Check className="w-3.5 h-3.5 text-green-600" />
                                    </div>
                                    {f.text}
                                </li>
                            ))}
                        </ul>
                    )}

                    {renderAction()}

                    <p className="text-[10px] text-center text-muted-foreground mt-4">
                        {effectiveMethod === 'pix'
                            ? 'Pagamento processado com segurança pelo Mercado Pago. Pix não renova sozinho.'
                            : 'Pagamento processado com segurança pelo Mercado Pago. Cancele quando quiser.'}
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionPage;
