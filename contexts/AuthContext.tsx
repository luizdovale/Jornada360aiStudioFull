
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
    refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    signOut: async () => {},
    updateUserMetadata: async (data: object) => {},
    isPro: false,
    refreshSubscription: async () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPro, setIsPro] = useState(false);

    // Fix: Implement refreshSubscription to check the user's current subscription status in Supabase
    const refreshSubscription = async () => {
        if (!user) {
            setIsPro(false);
            return;
        }
        try {
            const { data, error } = await supabase
                .from('subscriptions')
                .select('status, plan')
                .eq('user_id', user.id)
                .single();
            
            if (!error && data && data.status === 'active' && data.plan === 'pro') {
                setIsPro(true);
            } else {
                setIsPro(false);
            }
        } catch (e) {
            console.error("Error refreshing subscription:", e);
            setIsPro(false);
        }
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event: AuthChangeEvent, session: Session | null) => {
                setSession(session);
                setUser(session?.user ?? null);
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
        <AuthContext.Provider value={{ user, session, loading, signOut, updateUserMetadata, isPro, refreshSubscription }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
