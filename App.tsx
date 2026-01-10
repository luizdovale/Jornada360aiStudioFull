
import React, { useEffect } from 'react';
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
import SubscriptionPage from './pages/SubscriptionPage';
import NotFoundPage from './pages/NotFoundPage';
import { Toaster } from './components/ui/Toaster';

const AppContent: React.FC = () => {
    const { user, loading: authLoading } = useAuth();
    const { settings, loading: journeyLoading } = useJourneys();
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        // Intercepta eventos de recuperação de senha globalmente
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                navigate('/password-reset');
            }
        });

        return () => subscription.unsubscribe();
    }, [navigate]);

    useEffect(() => {
        if (!authLoading && !journeyLoading && user && !settings && location.pathname !== '/onboarding' && location.pathname !== '/password-reset') {
            navigate('/onboarding');
        }
    }, [user, settings, authLoading, journeyLoading, location.pathname, navigate]);

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<SignUpPage />} />
            <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
            <Route path="/password-reset" element={<UpdatePasswordPage />} />
            <Route path="/premium" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />

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
