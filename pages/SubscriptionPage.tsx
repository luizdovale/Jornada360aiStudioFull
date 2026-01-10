
import React, { useState } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../hooks/useToast';
import { Check, ShieldCheck, Zap, Star, ArrowLeft, Loader2, CreditCard } from 'lucide-react';
import Jornada360Icon from '../components/ui/Jornada360Icon';

const SubscriptionPage: React.FC = () => {
    const { user, isPro, refreshSubscription } = useAuth();
    const { toast } = useToast();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);

    const handleSubscribe = async () => {
        if (!user) return;
        setLoading(true);

        try {
            await supabase.from('subscriptions').upsert({
                user_id: user.id,
                plan: 'pro',
                status: 'active',
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            }, { onConflict: 'user_id' });

            await refreshSubscription();
            toast({ 
                title: "Assinatura Ativada!", 
                description: "Parabéns! Você agora é um usuário PRO do Jornada360.",
            });
            navigate('/');
        } catch (e) {
            toast({ title: "Erro", description: "Não foi possível processar a assinatura.", variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    };

    const features = [
        { icon: ShieldCheck, text: "Relatórios PDF ilimitados" },
        { icon: Zap, text: "Cálculo automático de Adicional Noturno" },
        { icon: Star, text: "Sem anúncios e suporte priorizado" },
        { icon: Star, text: "Controle de KM e Manutenção" },
        { icon: Star, text: "Backup em tempo real na nuvem" },
    ];

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
                    <p className="text-muted-foreground">Tenha o controle total do seu trabalho com as ferramentas profissionais do Jornada360.</p>
                </div>

                <div className="bg-white rounded-3xl p-6 shadow-floating border border-accent/20 relative overflow-hidden">
                    <div className="absolute top-0 right-0 bg-accent text-primary-dark font-bold text-xs px-4 py-1 rounded-bl-2xl">RECOMENDADO</div>
                    
                    <div className="mb-6">
                        <span className="text-sm font-bold text-primary-dark/60 uppercase tracking-widest">Plano Mensal</span>
                        <div className="flex items-baseline gap-1 mt-1">
                            <span className="text-4xl font-black text-primary-dark">R$ 19,90</span>
                            <span className="text-muted-foreground">/mês</span>
                        </div>
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

                    <button 
                        onClick={handleSubscribe}
                        disabled={loading || isPro}
                        className="w-full bg-accent text-primary-dark font-black py-4 rounded-2xl flex items-center justify-center gap-3 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : (
                            isPro ? "Você já é PRO" : <> <CreditCard className="w-5 h-5" /> Assinar Agora </>
                        )}
                    </button>
                    <p className="text-[10px] text-center text-muted-foreground mt-4">Cancele a qualquer momento. Pagamento seguro via CPF.</p>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionPage;
