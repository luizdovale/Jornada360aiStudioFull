
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
    
    // Verificação SÍNCRONA de token para evitar 404 imediato
    const hasRecoveryToken = useMemo(() => {
        const hash = window.location.hash;
        return hash.includes('access_token=') || hash.includes('type=recovery');
    }, []);

    const [isIntercepting, setIsIntercepting] = useState(hasRecoveryToken);

    useEffect(() => {
        if (hasRecoveryToken) {
            console.log("Token de recuperação detectado. Redirecionando internamente...");
            const hash = window.location.hash;
            const rawParams = hash.includes('?') ? hash.split('?')[1] : hash.replace(/^#\/?/, '');
            
            // Forçamos a navegação para a rota correta do React
            navigate(`/password-reset?${rawParams}`, { replace: true });
            
            // Pequeno delay para o Router processar a nova rota antes de tirar o loader
            const timer = setTimeout(() => setIsIntercepting(false), 500);
            return () => clearTimeout(timer);
        }
    }, [hasRecoveryToken, navigate]);

    // Escuta eventos globais de auth (caso o token seja processado pelo SDK em background)
    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                navigate('/password-reset', { replace: true });
                setIsIntercepting(false);
            }
        });
        return () => subscription.unsubscribe();
    }, [navigate]);

    // Lógica de Onboarding
    useEffect(() => {
        const isPublicRoute = ['/login', '/cadastro', '/recuperar-senha', '/password-reset'].includes(location.pathname);
        if (!authLoading && !journeyLoading && user && !settings && !isPublicRoute) {
            navigate('/onboarding');
        }
    }, [user, settings, authLoading, journeyLoading, location.pathname, navigate]);

    // Se estiver interceptando o token ou em carregamento crítico, mostra o Loader Global
    if (isIntercepting || (authLoading && !user)) {
        return (
            <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="w-12 h-12 text-accent animate-spin mb-4" />
                <p className="text-white font-medium">Validando sua identidade...</p>
                <p className="text-white/40 text-[10px] mt-2 italic">Acesso seguro Jornada360</p>
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
