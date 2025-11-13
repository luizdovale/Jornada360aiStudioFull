
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJourneys } from '../contexts/JourneyContext';

const OnboardingPage: React.FC = () => {
    const navigate = useNavigate();
    const { settings, loading } = useJourneys();

    useEffect(() => {
        // Redireciona para as configurações para o usuário preencher os dados iniciais
        if (!loading) {
            if (settings) {
                // Se já tem configurações, vai para a home
                navigate('/');
            } else {
                 // Se não, força a ida para as configurações
                 navigate('/settings');
            }
        }
    }, [settings, loading, navigate]);
    
    return (
        <div className="min-h-screen bg-primary-dark flex flex-col items-center justify-center text-white p-4">
            <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-accent mb-6"></div>
            <h1 className="text-2xl font-bold">Configurando sua conta...</h1>
            <p className="text-muted-foreground mt-2">Estamos preparando tudo para você.</p>
        </div>
    );
};

export default OnboardingPage;
