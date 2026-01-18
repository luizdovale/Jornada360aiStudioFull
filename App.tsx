
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

const AppContent: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const { settings, loading: journeyLoading } = useJourneys();
    const navigate = useNavigate();
    const location = useLocation();
    
    const [isIntercepting, setIsIntercepting] = useState(false);

    // INTERCEPTADOR DE SESSÃO MANUAL
    useEffect(() => {
        const handleAuthToken = async () => {
            const hash = window.location.hash;
            
            // Verifica se há um token de acesso na URL (formato do Supabase: #access_token=...)
            if (hash.includes('access_token=') || hash.includes('type=recovery')) {
                setIsIntercepting(true);
                console.log("Token detectado. Iniciando validação manual...");

                try {
                    // Extrai os parâmetros do hash transformando-o em uma query string legível
                    const searchParams = new URLSearchParams(hash.replace(/^#\/?/, '').replace('#', '&'));
                    const accessToken = searchParams.get('access_token');
                    const refreshToken = searchParams.get('refresh_token');

                    if (accessToken && refreshToken) {
                        // Força o Supabase a aceitar essa sessão
                        const { error } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken
                        });

                        if (!error) {
                            console.log("Sessão injetada com sucesso.");
                            // Limpa a URL e vai para a página de troca de senha dentro do Router
                            navigate('/password-reset', { replace: true });
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

    // Carregamento Global / Interceptação
    if (isIntercepting || (authLoading && !user && !window.location.hash.includes('access_token'))) {
        return (
            <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 text-center">
                <div className="relative">
                    <Loader2 className="w-12 h-12 text-accent animate-spin mb-4" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </div>
                </div>
                <p className="text-white font-bold tracking-tight">VALIDANDO IDENTIDADE</p>
                <p className="text-white/40 text-[10px] mt-2 uppercase tracking-widest">Acesso Seguro Jornada360</p>
            </div>
        );
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
