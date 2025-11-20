
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';

// Define types locally to avoid "no exported member" errors if the package version differs
export type AuthChangeEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED' | 'USER_UPDATED' | 'PASSWORD_RECOVERY' | 'INITIAL_SESSION';

export interface User {
  id: string;
  email?: string;
  user_metadata: {
    [key: string]: any;
  };
  app_metadata?: {
    [key: string]: any;
  };
  aud?: string;
  created_at?: string;
}

export interface Session {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  user: User | null;
  expires_at?: number;
}

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
        // Busca a sessão inicial para evitar a tela de login piscando.
        supabase.auth.getSession().then(({ data: { session } }) => {
            // @ts-ignore
            setSession(session);
            // @ts-ignore
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // O onAuthStateChange é o listener em tempo real para eventos de autenticação.
        // Ele lida com SIGNED_IN, SIGNED_OUT, e crucialmente, USER_UPDATED.
        // Quando você atualiza os metadados do usuário em um dispositivo, o Supabase
        // dispara o evento USER_UPDATED para todos os clientes logados, garantindo
        // a sincronização em tempo real.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event: string, session: any) => {
                // @ts-ignore
                setSession(session);
                // @ts-ignore
                setUser(session?.user ?? null);
                setLoading(false);
            }
        );

        // Limpa o listener quando o componente é desmontado para evitar memory leaks.
        return () => {
            subscription.unsubscribe();
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
        // Atualiza o estado local imediatamente para uma resposta de UI mais rápida no
        // dispositivo que fez a alteração. Os outros dispositivos serão atualizados
        // pelo listener onAuthStateChange.
        if (updatedUser) {
            // @ts-ignore
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
