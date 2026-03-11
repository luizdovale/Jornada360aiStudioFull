
import React, { useEffect, useState } from 'react';
// @ts-ignore
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { JourneyProvider, useJourneys } from './contexts/JourneyContext';
import { supabase } from './lib/supabaseClient';

import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import JourneysPage from './pages/JourneysPage';
import JourneyFormPage from './pages/JourneyFormPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';
import OnboardingPage from './pages/OnboardingPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import UpdatePasswordPage from './pages/UpdatePasswordPage';
import ProfilePage from './pages/ProfilePage';
import CalendarPage from './pages/CalendarPage';
import NotFoundPage from './pages/NotFoundPage';
import { Toaster } from './components/ui/Toaster';
import { Loader2 } from 'lucide-react';
import SplashScreen from './components/ui/SplashScreen';

const AppContent: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const { settings, loading: journeyLoading } = useJourneys();
    const navigate = useNavigate();
    const location = useLocation();
    
    const [isIntercepting, setIsIntercepting] = useState(false);
    const [showSplash, setShowSplash] = useState(true);

    // Tempo mínimo para a Splash Screen
    useEffect(() => {
        const timer = setTimeout(() => {
            setShowSplash(false);
        }, 2000); // 2 segundos mínimo
        return () => clearTimeout(timer);
    }, []);

    // INTERCEPTADOR DE SESSÃO MANUAL
    useEffect(() => {
        const handleAuthToken = async () => {
            const hash = window.location.hash;
            
            // Verifica se há um token de acesso na URL (formato do Supabase: #access_token=...)
            if (hash.includes('access_token=')) {
                setIsIntercepting(true);
                console.log("Token detectado. Iniciando validação manual...");

                try {
                    // Extrai os parâmetros do hash transformando-o em uma query string legível
                    const searchParams = new URLSearchParams(hash.replace(/^#\/?/, '').replace('#', '&'));
                    const accessToken = searchParams.get('access_token');
                    const refreshToken = searchParams.get('refresh_token');
                    const type = searchParams.get('type');

                    if (accessToken && refreshToken) {
                        // Força o Supabase a aceitar essa sessão
                        const { error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken
                        });

                        if (!error) {
                            console.log(`Sessão injetada com sucesso. Tipo: ${type}`);
                            
                            // SE FOR RECUPERAÇÃO DE SENHA, VAI PARA A PÁGINA DE TROCA
                            if (type === 'recovery') {
                                navigate('/password-reset', { replace: true });
                            } else {
                                // SE FOR CONFIRMAÇÃO DE CADASTRO OU OUTRO, VAI PARA A HOME
                                navigate('/', { replace: true });
                            }
                        } else {
                            console.error("Erro ao injetar sessão:", error.message);
                        }
                    }
                } catch (err) {
                    console.error("Erro no processamento do token:", err);
                } finally {
                    // Pequeno delay para garantir que o navigate foi processado
                    setTimeout(() => setIsIntercepting(false), 800);
                }
            }
        };

        handleAuthToken();
    }, [navigate]);

    // Redirecionamento para Onboarding
    useEffect(() => {
        const isPublicRoute = ['/login', '/cadastro', '/recuperar-senha', '/password-reset'].includes(location.pathname);
        if (!authLoading && !journeyLoading && user && !settings && !isPublicRoute) {
            navigate('/onboarding');
        }
    }, [user, settings, authLoading, journeyLoading, location.pathname, navigate]);

    // Carregamento Global / Interceptação / Splash Screen
    const shouldShowSplash = showSplash || isIntercepting || (authLoading && !user && !window.location.hash.includes('access_token'));

    if (shouldShowSplash) {
        return <SplashScreen />;
    }

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<SignUpPage />} />
            <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
            <Route path="/password-reset" element={<UpdatePasswordPage />} />
            
            <Route path="/" element={<ProtectedRoute><MainLayout><HomePage /></MainLayout></ProtectedRoute>} />
            <Route path="/journeys" element={<ProtectedRoute><MainLayout><JourneysPage /></MainLayout></ProtectedRoute>} />
            <Route path="/journeys/new" element={<ProtectedRoute><MainLayout><JourneyFormPage /></MainLayout></ProtectedRoute>} />
            <Route path="/journeys/edit/:id" element={<ProtectedRoute><MainLayout><JourneyFormPage /></MainLayout></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><MainLayout><SettingsPage /></MainLayout></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><MainLayout><ReportsPage /></MainLayout></ProtectedRoute>} />
            <Route path="/profile" element={<ProtectedRoute><MainLayout><ProfilePage /></MainLayout></ProtectedRoute>} />
            <Route path="/calendar" element={<ProtectedRoute><MainLayout><CalendarPage /></MainLayout></ProtectedRoute>} />
            <Route path="/onboarding" element={<ProtectedRoute><OnboardingPage /></ProtectedRoute>} />
            
            <Route path="*" element={<NotFoundPage />} />
        </Routes>
    );
}

const App: React.FC = () => {
    return (
        <AuthProvider>
            <JourneyProvider>
                <HashRouter>
                    <AppContent />
                </HashRouter>
                <Toaster />
            </JourneyProvider>
        </AuthProvider>
    );
};

export default App;
