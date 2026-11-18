
import React, { useState, useEffect, useCallback } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../hooks/useToast';
import { Check, ShieldCheck, CalendarRange, Clock, ArrowLeft, Loader2, CreditCard, QrCode, ExternalLink } from 'lucide-react';
import Jornada360Icon from '../components/ui/Jornada360Icon';
import ConfirmationModal from '../components/ui/ConfirmationModal';

type Interval = 'monthly' | 'yearly';
type Method = 'card' | 'pix';

const PLANS: Record<Interval, { label: string; price: string; suffix: string; note?: string }> = {
    monthly: { label: 'Plano Mensal', price: 'R$ 9,90', suffix: '/mês' },
    yearly: { label: 'Plano Anual', price: 'R$ 99,90', suffix: '/ano', note: 'Equivale a R$ 8,33/mês — 2 meses grátis' },
};

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const formatDay = (ymd: string) => new Date(ymd + 'T00:00:00').toLocaleDateString('pt-BR');

// current_period_end do Asaas é o fim do dia do próximo vencimento; o
// vencimento em si é o dia anterior a esse instante.
const nextChargeDate = (periodEnd: string) => new Date(new Date(periodEnd).getTime() - 1).toLocaleDateString('pt-BR');

const formatCpf = (value: string) => {
    const d = value.replace(/\D/g, '').slice(0, 11);
    return d
        .replace(/^(\d{3})(\d)/, '$1.$2')
        .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
        .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
};

const isValidCpf = (raw: string) => {
    const cpf = raw.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    for (const len of [9, 10]) {
        let sum = 0;
        for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i);
        if (((sum * 10) % 11) % 10 !== Number(cpf[len])) return false;
    }
    return true;
};

// Em erro HTTP o corpo (com a mensagem da function) vem em error.context.
const functionErrorMessage = async (error: any, fallback: string) => {
    const body = await error?.context?.json?.().catch(() => null);
    return body?.error || fallback;
};

// Abre a fatura do Asaas. No app (Capacitor) abre no navegador do aparelho;
// ao voltar, a tela confere o pagamento sozinha.
const openInvoice = (url: string) => {
    const win = window.open(url, '_blank');
    if (!win) window.location.href = url;
};

const SubscriptionPageAsaas: React.FC = () => {
    const { isPro, proUntil, subscription, refreshSubscription } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [interval, setInterval] = useState<Interval>('yearly');
    const [method, setMethod] = useState<Method>('card');
    const [cpf, setCpf] = useState('');
    const [cpfError, setCpfError] = useState('');
    const [loading, setLoading] = useState(false);
    const [openInvoiceUrl, setOpenInvoiceUrl] = useState<string | null>(null);
    const [openDueDate, setOpenDueDate] = useState<string | null>(null);
    const [changingMethod, setChangingMethod] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [canceling, setCanceling] = useState(false);

    // Assinatura antiga do Mercado Pago (cartão) ou PRO liberado manualmente.
    const isLegacyPro = isPro && subscription?.provider !== 'asaas' && subscription?.payment_method !== 'pix';
    const asaasActive = subscription?.provider === 'asaas' && !!subscription.asaas_subscription_id && !subscription.canceled_at;
    const needsCpf = !subscription?.asaas_customer_id;

    // Confere no Asaas o status real (o webhook pode atrasar) e atualiza o app.
    const sync = useCallback(async () => {
        try {
            const { data } = await supabase.functions.invoke('asaas-subscription', { body: { action: 'sync' } });
            setOpenInvoiceUrl(data?.open_invoice_url ?? null);
            setOpenDueDate(data?.open_due_date ?? null);
            await refreshSubscription();
        } catch (e) {
            console.error('Erro ao sincronizar assinatura:', e);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Ao abrir a tela e ao voltar da fatura (o app volta ao primeiro plano).
    useEffect(() => {
        sync();
        const onVisible = () => { if (document.visibilityState === 'visible') sync(); };
        document.addEventListener('visibilitychange', onVisible);
        return () => document.removeEventListener('visibilitychange', onVisible);
    }, [sync]);

    // Com assinatura no Asaas, o card mostra o plano assinado.
    useEffect(() => {
        if (subscription?.provider === 'asaas' && subscription.billing_interval) setInterval(subscription.billing_interval);
    }, [subscription?.provider, subscription?.billing_interval]);

    const features = [
        { icon: ShieldCheck, text: "Relatórios em PDF ilimitados" },
        { icon: CalendarRange, text: "Calendário de escala completo, sem limite de meses" },
        { icon: Clock, text: "Suporte prioritário" },
    ];

    const handleSubscribe = async () => {
        if (needsCpf && !isValidCpf(cpf)) {
            setCpfError('Informe um CPF válido.');
            return;
        }
        setLoading(true);
        try {
            const { data, error } = await supabase.functions.invoke('asaas-subscription', {
                body: { action: 'create', interval, billingType: method === 'pix' ? 'PIX' : 'CREDIT_CARD', cpf },
            });
            if (error || !data?.subscription_id) {
                throw new Error(await functionErrorMessage(error, 'Não foi possível iniciar a assinatura.'));
            }

            setChangingMethod(false);
            await refreshSubscription();
            if (data.invoice_url) {
                setOpenInvoiceUrl(data.invoice_url);
                openInvoice(data.invoice_url);
            } else {
                toast({
                    title: 'Assinatura criada',
                    description: `A primeira cobrança vence em ${formatDay(data.next_due_date)} e chega no seu e-mail.`,
                });
            }
        } catch (e: any) {
            toast({ title: 'Erro ao assinar', description: e.message || 'Tente novamente em instantes.', variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async () => {
        setConfirmCancel(false);
        setCanceling(true);
        try {
            const { data, error } = await supabase.functions.invoke('asaas-subscription', { body: { action: 'cancel' } });
            if (error || !data?.canceled) {
                throw new Error(await functionErrorMessage(error, 'Não foi possível cancelar.'));
            }
            await refreshSubscription();
            setOpenInvoiceUrl(null);
            toast({
                title: 'Assinatura cancelada',
                description: data.pro_until ? `Seu PRO continua até ${formatDate(data.pro_until)}.` : 'Nenhuma nova cobrança será feita.',
            });
        } catch (e: any) {
            toast({ title: 'Erro ao cancelar', description: e.message, variant: 'destructive' });
        } finally {
            setCanceling(false);
        }
    };

    const plan = PLANS[interval];
    const showSubscribeForm = !isLegacyPro && (!asaasActive || changingMethod);

    const methodOption = (value: Method, Icon: any, title: string, subtitle: string) => (
        <button
            type="button"
            onClick={() => setMethod(value)}
            aria-pressed={method === value}
            className={`p-3 rounded-2xl border-2 text-left transition-colors ${method === value ? 'border-primary bg-primary-light' : 'border-gray-200 hover:border-gray-300'}`}
        >
            <Icon className="w-5 h-5 text-primary-dark mb-1" />
            <p className="text-sm font-bold text-primary-dark">{title}</p>
            <p className="text-[11px] text-gray-500 leading-snug">{subtitle}</p>
        </button>
    );

    const renderSubscribeForm = () => (
        <div className="space-y-4">
            {proUntil && (
                <div className="p-3 rounded-2xl bg-green-50 text-green-800 text-xs text-center">
                    Você é PRO até <strong>{formatDate(proUntil)}</strong>.
                    <br />Assinando agora, a primeira cobrança só acontece nessa data.
                </div>
            )}

            <div className="grid grid-cols-2 gap-2">
                {methodOption('card', CreditCard, 'Cartão', 'Cobrado automaticamente a cada período')}
                {methodOption('pix', QrCode, 'Pix', 'Cobrança enviada por e-mail a cada período')}
            </div>

            {needsCpf && (
                <div>
                    <label htmlFor="sub_cpf" className="block text-xs font-medium text-gray-500 mb-1.5">CPF do titular</label>
                    <input
                        id="sub_cpf"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={cpf}
                        onChange={e => { setCpf(formatCpf(e.target.value)); setCpfError(''); }}
                        placeholder="000.000.000-00"
                        className={`block w-full h-11 px-3 border rounded-lg bg-white text-base text-primary-dark outline-none focus:ring-2 focus:ring-primary/20 ${cpfError ? 'border-red-400' : 'border-gray-200 focus:border-primary'}`}
                        aria-invalid={!!cpfError}
                        aria-describedby="sub_cpf_help"
                    />
                    <p id="sub_cpf_help" className={`text-[11px] mt-1 ${cpfError ? 'text-red-600' : 'text-gray-500'}`}>
                        {cpfError || 'Exigido pelo Asaas para emitir a cobrança. Pedimos só uma vez.'}
                    </p>
                </div>
            )}

            <button
                type="button"
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full bg-accent text-primary-dark font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50"
            >
                {loading
                    ? <Loader2 className="w-6 h-6 animate-spin" />
                    : <>{method === 'pix' ? <QrCode className="w-5 h-5" /> : <CreditCard className="w-5 h-5" />} Assinar com {method === 'pix' ? 'Pix' : 'cartão'}</>}
            </button>

            {changingMethod && (
                <button type="button" onClick={() => setChangingMethod(false)} className="w-full text-sm text-gray-500 py-1">
                    Voltar
                </button>
            )}
        </div>
    );

    const renderAsaasStatus = () => {
        const isCard = subscription?.payment_method === 'card';
        const intervalLabel = subscription?.billing_interval === 'yearly' ? 'anual' : 'mensal';

        if (!isPro) {
            // Criada, mas a primeira cobrança ainda não foi paga (ou venceu).
            return (
                <div className="space-y-3">
                    <div className="p-3 rounded-2xl bg-amber-50 border border-amber-100 text-amber-900 text-xs text-center">
                        <strong>Aguardando pagamento</strong> da assinatura {intervalLabel} ({isCard ? 'cartão' : 'Pix'}).
                        <br />Assim que o pagamento for confirmado, o PRO é liberado.
                    </div>
                    {openInvoiceUrl ? (
                        <button
                            type="button"
                            onClick={() => openInvoice(openInvoiceUrl)}
                            className="w-full bg-accent text-primary-dark font-black py-4 rounded-2xl flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all"
                        >
                            <ExternalLink className="w-5 h-5" /> Pagar agora
                        </button>
                    ) : (
                        <p className="text-xs text-center text-gray-500 flex items-center justify-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" /> Gerando sua cobrança...
                        </p>
                    )}
                    <div className="flex items-center justify-center gap-3">
                        <button type="button" onClick={() => setChangingMethod(true)} className="text-xs text-gray-500 py-1 whitespace-nowrap">
                            Trocar forma de pagamento
                        </button>
                        <span className="text-gray-300" aria-hidden="true">·</span>
                        <button
                            type="button"
                            onClick={() => setConfirmCancel(true)}
                            disabled={canceling}
                            className="text-xs text-gray-500 py-1 whitespace-nowrap disabled:opacity-50"
                        >
                            {canceling ? 'Cancelando...' : 'Cancelar assinatura'}
                        </button>
                    </div>
                </div>
            );
        }

        return (
            <div className="space-y-3">
                <div className="p-3 rounded-2xl bg-primary-light text-primary-dark text-xs text-center space-y-1">
                    <p><strong>Assinatura {intervalLabel} ativa</strong> · {isCard ? 'cartão' : 'Pix'}</p>
                    {subscription?.current_period_end && (
                        <p>
                            Próxima cobrança em {nextChargeDate(subscription.current_period_end)}
                            {isCard ? ', automática no cartão.' : ', enviada para o seu e-mail.'}
                        </p>
                    )}
                </div>
                {openInvoiceUrl && (
                    <button
                        type="button"
                        onClick={() => openInvoice(openInvoiceUrl)}
                        className="w-full bg-primary text-white font-bold py-3 rounded-2xl flex items-center justify-center gap-2 active:scale-[0.98] transition-all"
                    >
                        <ExternalLink className="w-4 h-4" /> Pagar cobrança{openDueDate ? ` de ${formatDay(openDueDate)}` : ''}
                    </button>
                )}
                <button
                    type="button"
                    onClick={() => setConfirmCancel(true)}
                    disabled={canceling}
                    className="w-full text-sm text-gray-500 py-1 disabled:opacity-50"
                >
                    {canceling ? 'Cancelando...' : 'Cancelar assinatura'}
                </button>
            </div>
        );
    };

    const renderAction = () => {
        if (isLegacyPro) {
            return (
                <button
                    disabled
                    className="w-full bg-primary/10 text-primary-dark font-black py-4 rounded-2xl flex items-center justify-center gap-3"
                >
                    Você já é PRO ✓
                </button>
            );
        }
        if (showSubscribeForm) return renderSubscribeForm();
        return renderAsaasStatus();
    };

    return (
        <div className="min-h-screen bg-primary flex flex-col p-6 pb-20 overflow-x-hidden">
            <ConfirmationModal
                isOpen={confirmCancel}
                onClose={() => setConfirmCancel(false)}
                onConfirm={handleCancel}
                title="Cancelar assinatura"
                message={proUntil
                    ? `Nenhuma nova cobrança será feita. Seu PRO continua até ${formatDate(proUntil)}.`
                    : isPro
                        ? 'Nenhuma nova cobrança será feita.'
                        : 'A cobrança pendente será cancelada e você não receberá novas cobranças.'}
                confirmText="Cancelar assinatura"
            />

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

                {showSubscribeForm && (
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

                    {renderAction()}

                    <p className="text-[10px] text-center text-muted-foreground mt-4">
                        Pagamento processado com segurança pelo Asaas. Renova automaticamente; cancele quando quiser.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionPageAsaas;
