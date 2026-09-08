
import React, { useState, useEffect } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../hooks/useToast';
import { Check, ShieldCheck, CalendarRange, Clock, ArrowLeft, Loader2, CreditCard } from 'lucide-react';
import Jornada360Icon from '../components/ui/Jornada360Icon';

type Interval = 'monthly' | 'yearly';

const PLANS: Record<Interval, { label: string; price: string; suffix: string; note?: string }> = {
    monthly: { label: 'Plano Mensal', price: 'R$ 9,90', suffix: '/mês' },
    yearly: { label: 'Plano Anual', price: 'R$ 99,90', suffix: '/ano', note: 'Equivale a R$ 8,33/mês — 2 meses grátis' },
};

const SubscriptionPage: React.FC = () => {
    const { isPro, refreshSubscription } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [interval, setInterval] = useState<Interval>('yearly');
    const [loading, setLoading] = useState(false);

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

    const plan = PLANS[interval];

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

                {!isPro && (
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

                    {isPro ? (
                        <button
                            disabled
                            className="w-full bg-primary/10 text-primary-dark font-black py-4 rounded-2xl flex items-center justify-center gap-3"
                        >
                            Você já é PRO ✓
                        </button>
                    ) : (
                        <button
                            onClick={handleSubscribe}
                            disabled={loading}
                            className="w-full bg-accent text-primary-dark font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CreditCard className="w-5 h-5" /> Assinar Agora</>}
                        </button>
                    )}
                    <p className="text-[10px] text-center text-muted-foreground mt-4">Pagamento processado com segurança pelo Mercado Pago. Cancele quando quiser.</p>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionPage;
