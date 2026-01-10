
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    isPro: boolean;
    signOut: () => Promise<void>;
    updateUserMetadata: (data: object) => Promise<void>;
    refreshSubscription: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    isPro: false,
    signOut: async () => {},
    updateUserMetadata: async (data: object) => {},
    refreshSubscription: async () => {},
});

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [isPro, setIsPro] = useState(false);
    const [loading, setLoading] = useState(true);

    const checkSubscription = async (userId: string) => {
        try {
            const { data, error } = await supabase
                .from('subscriptions')
                .select('plan, status')
                .eq('user_id', userId)
                .single();
            
            if (data && data.plan === 'pro' && data.status === 'active') {
                setIsPro(true);
            } else {
                setIsPro(false);
            }
        } catch (e) {
            setIsPro(false);
        }
    };

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            if (session?.user) checkSubscription(session.user.id);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event: AuthChangeEvent, session: Session | null) => {
                setSession(session);
                setUser(session?.user ?? null);
                if (session?.user) {
                    checkSubscription(session.user.id);
                } else {
                    setIsPro(false);
                }
                setLoading(false);
            }
        );

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };
    
    const updateUserMetadata = async (data: object) => {
        const { data: { user: updatedUser }, error } = await supabase.auth.updateUser({ data });
        if (error) throw error;
        if (updatedUser) setUser(updatedUser);
    };

    const refreshSubscription = async () => {
        if (user) await checkSubscription(user.id);
    };

    return (
        <AuthContext.Provider value={{ user, session, loading, isPro, signOut, updateUserMetadata, refreshSubscription }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
