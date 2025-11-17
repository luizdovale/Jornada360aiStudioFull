
import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { AuthChangeEvent, Session, User } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';

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
    const navigate = useNavigate();

    useEffect(() => {
        // Busca a sessão inicial para evitar a tela de login piscando.
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });

        // O onAuthStateChange é o listener em tempo real para eventos de autenticação.
        // Ele lida com SIGNED_IN, SIGNED_OUT, e crucialmente, USER_UPDATED.
        // Quando você atualiza os metadados do usuário em um dispositivo, o Supabase
        // dispara o evento USER_UPDATED para todos os clientes logados, garantindo
        // a sincronização em tempo real.
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event: AuthChangeEvent, session: Session | null) => {
                if (event === 'PASSWORD_RECOVERY') {
                    // This event is fired when the user is redirected from the password recovery link.
                    // The session is set, and we should navigate to the update password page.
                    navigate('/update-password', { replace: true });
                }
                setSession(session);
                setUser(session?.user ?? null);
                setLoading(false);
            }
        );

        // Limpa o listener quando o componente é desmontado para evitar memory leaks.
        return () => {
            subscription.unsubscribe();
        };
    }, [navigate]);

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
