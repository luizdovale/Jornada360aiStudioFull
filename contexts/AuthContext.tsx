
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';

// Definindo a interface para o valor do contexto
interface AuthContextType {
    user: User | null;
    session: Session | null;
    loading: boolean;
    signOut: () => Promise<void>;
    updateUserMetadata: (data: object) => Promise<void>;
}

// Criando o contexto com um valor padrão
const AuthContext = createContext<AuthContextType>({
    user: null,
    session: null,
    loading: true,
    signOut: async () => {},
    updateUserMetadata: async (data: object) => {},
});

// Criando o provedor do contexto
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Pega a sessão inicial, se existir
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // Escuta por mudanças no estado de autenticação
        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event: AuthChangeEvent, session: Session | null) => {
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
            }
        );

        // Limpa o listener quando o componente é desmontado
        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        const { error } = await supabase.auth.signOut();
        if (error) {
            console.error('Error signing out:', error);
        }
    };
    
    const updateUserMetadata = async (data: object) => {
        const { data: { user: updatedUser }, error } = await supabase.auth.updateUser({ data });
        if (error) {
            console.error('Error updating user metadata:', error);
            throw error;
        }
        if (updatedUser) {
            // Atualiza o estado local para refletir a mudança imediatamente
            setUser(updatedUser);
        }
    };

    const value = {
        user,
        session,
        loading,
        signOut,
        updateUserMetadata,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook customizado para usar o contexto de autenticação
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
