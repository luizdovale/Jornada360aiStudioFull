
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute: React.FC<{ children: React.ReactElement }> = ({ children }) => {
    const { user, loading } = useAuth();

    if (loading) {
        // Mostra uma tela de carregamento enquanto verifica a autenticação
        return (
            <div className="min-h-screen bg-primary-dark flex items-center justify-center">
                <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-accent"></div>
            </div>
        );
    }

    if (!user) {
        // Redireciona para a página de login se não houver usuário
        return <Navigate to="/login" replace />;
    }

    return children;
};

export default ProtectedRoute;
