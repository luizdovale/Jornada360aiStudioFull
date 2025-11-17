
import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { JourneyProvider } from './contexts/JourneyContext';

import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './components/layout/MainLayout';

import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import SignUpPage from './pages/SignUpPage';
import JourneysPage from './pages/JourneysPage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';
import OnboardingPage from './pages/OnboardingPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import UpdatePasswordPage from './pages/UpdatePasswordPage'; // Importa a nova página
import ProfilePage from './pages/ProfilePage';
import CalendarPage from './pages/CalendarPage';
import NotFoundPage from './pages/NotFoundPage';
import { Toaster } from './components/ui/Toaster';

const App: React.FC = () => {
    return (
        <HashRouter>
            <AuthProvider>
                <JourneyProvider>
                    <Routes>
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/cadastro" element={<SignUpPage />} />
                        <Route path="/recuperar-senha" element={<ForgotPasswordPage />} />
                        <Route path="/update-password" element={<UpdatePasswordPage />} />

                        <Route
                            path="/"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <HomePage />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/journeys"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <JourneysPage />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/settings"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <SettingsPage />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/reports"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <ReportsPage />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/profile"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <ProfilePage />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                         <Route
                            path="/calendar"
                            element={
                                <ProtectedRoute>
                                    <MainLayout>
                                        <CalendarPage />
                                    </MainLayout>
                                </ProtectedRoute>
                            }
                        />
                        <Route
                            path="/onboarding"
                            element={
                                <ProtectedRoute>
                                    <OnboardingPage />
                                </ProtectedRoute>
                            }
                        />
                        
                        <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                <Toaster />
                </JourneyProvider>
            </AuthProvider>
        </HashRouter>
    );
};

export default App;
