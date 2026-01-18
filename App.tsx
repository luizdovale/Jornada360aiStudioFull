
import React, { useEffect, useState, useMemo } from 'react';
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

    // ESCUDO DE INTERCEPTAÇÃO DE TOKEN (Executa apenas na montagem inicial)
    useEffect(() => {
        const hash = window.location.hash;
        
        // Verifica se a URL contém um token do Supabase mas NÃO está na rota do React
        // Exemplo de problema: /#access_token=...
        // Formato corrigido: /#/password-reset#access_token=...
        if (hash.includes('access_token=') && !hash.includes('/password-reset')) {
            console.log("Detectado token de recuperação fora da rota. Corrigindo...");
            setIsIntercepting(true);
            
            // Remove o # inicial e reconstrói a URL para o HashRouter
            const cleanHash = hash.replace(/^#/, '');
            
            // O segredo aqui é manter o token visível para o Supabase Client
            // mas colocar o caminho do React Router antes dele.
            window.location.hash = `#/password-reset#${cleanHash}`;
            
            // Dá tempo para o navegador processar a mudança de hash antes de liberar a renderização
            const timer = setTimeout(() => {
                setIsIntercepting(false);
            }, 500);
            return () => clearTimeout(timer);
        }
    }, []);

    // Monitor de eventos do Supabase
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            console.log("Auth Event:", event);
            if (event === 'PASSWORD_RECOVERY') {
                // Se o evento disparar, garantimos que estamos na página certa
                if (window.location.hash.includes('password-reset')) {
                    setIsIntercepting(false);
                } else {
                    navigate('/password-reset', { replace: true });
                }
            }
        });
        return () => subscription.unsubscribe();
    }, [navigate]);

    // Redirecionamento para Onboarding
    useEffect(() => {
        const isPublicRoute = ['/login', '/cadastro', '/recuperar-senha', '/password-reset'].includes(location.pathname);
        if (!authLoading && !journeyLoading && user && !settings && !isPublicRoute) {
            navigate('/onboarding');
        }
    }, [user, settings, authLoading, journeyLoading, location.pathname, navigate]);

    // Carregamento Global
    if (isIntercepting || (authLoading && !user && !window.location.hash.includes('access_token'))) {
        return (
            <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 text-center">
                <div className="relative">
                    <Loader2 className="w-12 h-12 text-accent animate-spin mb-4" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    </div>
                </div>
                <p className="text-white font-bold tracking-tight">AUTENTICANDO ACESSO</p>
                <p className="text-white/40 text-[10px] mt-2 uppercase tracking-widest">Segurança Jornada360</p>
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
