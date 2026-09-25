
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';

// Fix: Locally define Supabase types as any to avoid 'no exported member' errors in environments where types are missing or incompatible
type AuthChangeEvent = any;
type Session = any;
type User = any;

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
    updateUserMetadata: (data: object) => Promise<void>;
    isPro: boolean;
    // Vencimento do PRO quando foi pago com Pix (null para cartão / liberação manual).
    pixExpiresAt: string | null;
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
    pixExpiresAt: null,
    refreshSubscription: async () => {},
    isAdmin: false,
    adminLoading: true,
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPro, setIsPro] = useState(false);
    const [pixExpiresAt, setPixExpiresAt] = useState<string | null>(null);
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
            setPixExpiresAt(null);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('subscriptions')
                .select('status, plan, payment_method, current_period_end')
                .eq('user_id', user.id)
                .maybeSingle();

            // Cartão e PRO liberado manualmente não vencem aqui (o cartão é
            // cancelado pelo webhook). Pix vale até current_period_end.
            const isPix = data?.payment_method === 'pix';
            const pixValid = isPix && !!data?.current_period_end && new Date(data.current_period_end) > new Date();
            const active = !error && !!data && data.status === 'active' && data.plan === 'pro' && (!isPix || pixValid);

            setIsPro(active);
            setPixExpiresAt(active && isPix ? data!.current_period_end : null);
        } catch (e) {
            console.error("Error refreshing subscription:", e);
            setIsPro(false);
            setPixExpiresAt(null);
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
        <AuthContext.Provider value={{ user, session, loading, signOut, updateUserMetadata, isPro, pixExpiresAt, refreshSubscription, isAdmin, adminLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
