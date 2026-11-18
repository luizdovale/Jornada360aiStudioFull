
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';

// Fix: Locally define Supabase types as any to avoid 'no exported member' errors in environments where types are missing or incompatible
type AuthChangeEvent = any;
type Session = any;
type User = any;

// Dados da assinatura usados pela tela de assinatura.
export interface SubscriptionInfo {
    provider: 'mercadopago' | 'asaas';
    status: string;
    plan: string;
    payment_method: 'card' | 'pix' | null;
    billing_interval: 'monthly' | 'yearly' | null;
    current_period_end: string | null;
    canceled_at: string | null;
    asaas_customer_id: string | null;
    asaas_subscription_id: string | null;
}

// Dias de tolerância depois do vencimento de uma renovação do Asaas.
const ASAAS_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
    updateUserMetadata: (data: object) => Promise<void>;
    isPro: boolean;
    // Até quando o PRO está pago (null para cartão do Mercado Pago / liberação manual).
    proUntil: string | null;
    subscription: SubscriptionInfo | null;
    refreshSubscription: () => Promise<void>;
    isAdmin: boolean;
    adminLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    signOut: async () => {},
    updateUserMetadata: async (data: object) => {},
    isPro: false,
    proUntil: null,
    subscription: null,
    refreshSubscription: async () => {},
    isAdmin: false,
    adminLoading: true,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPro, setIsPro] = useState(false);
    const [proUntil, setProUntil] = useState<string | null>(null);
    const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminLoading, setAdminLoading] = useState(true);

    // Verifica se o usuário logado tem role de admin (painel DEV)
    useEffect(() => {
        const checkAdmin = async () => {
            if (!user) {
                setIsAdmin(false);
                setAdminLoading(false);
                return;
            }
            setAdminLoading(true);
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .single();
                setIsAdmin(!error && data?.role === 'admin');
            } catch (e) {
                console.error("Error checking admin role:", e);
                setIsAdmin(false);
            } finally {
                setAdminLoading(false);
            }
        };
        checkAdmin();
    }, [user]);

    // Fix: Implement refreshSubscription to check the user's current subscription status in Supabase
    const refreshSubscription = async () => {
        if (!user) {
            setIsPro(false);
            setProUntil(null);
            setSubscription(null);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('subscriptions')
                .select('provider, status, plan, payment_method, billing_interval, current_period_end, canceled_at, asaas_customer_id, asaas_subscription_id')
                .eq('user_id', user.id)
                .maybeSingle();

            // Asaas: vale até o vencimento pago + 3 dias de tolerância.
            // Pix do Mercado Pago: vale até current_period_end.
            // Cartão do Mercado Pago e PRO liberado manualmente não vencem aqui
            // (o cartão é cancelado pelo webhook).
            const end = data?.current_period_end ? new Date(data.current_period_end).getTime() : null;
            const hasPeriod = data?.provider === 'asaas' || data?.payment_method === 'pix';
            const periodValid = !hasPeriod || (end !== null && end + (data?.provider === 'asaas' ? ASAAS_GRACE_MS : 0) > Date.now());
            const active = !error && !!data && data.status === 'active' && data.plan === 'pro' && periodValid;

            setIsPro(active);
            setProUntil(active && hasPeriod ? data!.current_period_end : null);
            setSubscription(!error && data ? (data as SubscriptionInfo) : null);
        } catch (e) {
            console.error("Error refreshing subscription:", e);
            setIsPro(false);
            setProUntil(null);
            setSubscription(null);
        }
    };

    useEffect(() => {
        const initializeAuth = async () => {
            try {
                // Primeiro tenta a sessão local (rápido)
                const { data: { session } } = await supabase.auth.getSession();
                
                if (session) {
                    setSession(session);
                    const { data: { user: verifiedUser }, error } = await supabase.auth.getUser();
                    if (!error && verifiedUser) {
                        setUser(verifiedUser);
                    } else {
                        setUser(session.user);
                    }
                } else {
                    setUser(null);
                }
            } catch (err) {
                console.error("AuthContext: Erro crítico na inicialização:", err);
            } finally {
                setLoading(false);
            }
        };

        initializeAuth();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            async (event: AuthChangeEvent, session: Session | null) => {
                if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
                    setSession(session);
                    setUser(session?.user ?? null);
                } else if (event === 'SIGNED_OUT') {
                    setSession(null);
                    setUser(null);
                }
                
                setLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // Fix: Trigger a subscription check whenever the logged-in user changes to keep state consistent
    useEffect(() => {
        if (user) {
            refreshSubscription();
        } else {
            setIsPro(false);
        }
    }, [user]);

    const signOut = async () => {
        await supabase.auth.signOut();
    };
    
    const updateUserMetadata = async (data: object) => {
        const { data: { user: updatedUser }, error } = await supabase.auth.updateUser({ data });
        if (error) throw error;
        if (updatedUser) setUser(updatedUser);
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, signOut, updateUserMetadata, isPro, proUntil, subscription, refreshSubscription, isAdmin, adminLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
