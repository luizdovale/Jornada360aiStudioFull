
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../hooks/useToast';
import AuthLayout from '../components/layout/AuthLayout';
import AuthInput from '../components/ui/AuthInput';
import { Loader2, Lock, ShieldCheck, AlertCircle } from 'lucide-react';

const UpdatePasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const checkAuth = async () => {
            const { data: { session } } = await supabase.auth.getSession();

            if (session) {
                if (isMounted) setLoading(false);
                return;
            }

            const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
                if (session && isMounted) setLoading(false);
            });

            const timer = setTimeout(() => {
                if (isMounted) {
                    setError('Link de recuperação expirado ou inválido. Por favor, solicite um novo e-mail.');
                    setLoading(false);
                }
            }, 5000);

            return () => {
                subscription.unsubscribe();
                clearTimeout(timer);
            };
        };

        checkAuth();
        return () => { isMounted = false; };
    }, []);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6) {
            toast({ title: 'Senha muito curta', description: 'Use pelo menos 6 caracteres.', variant: 'destructive' });
            return;
        }

        if (password !== confirmPassword) {
            toast({ title: 'Erro', description: 'As senhas não coincidem.', variant: 'destructive' });
            return;
        }

        setSaving(true);

        const { error: updateError } = await supabase.auth.updateUser({ password });

        if (updateError) {
            toast({ title: 'Erro na atualização', description: updateError.message, variant: 'destructive' });
            setSaving(false);
        } else {
            toast({ title: 'Senha atualizada!', description: 'Sua conta agora está segura.' });
            navigate('/', { replace: true });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="w-10 h-10 text-accent animate-spin mb-3" />
                <p className="text-sm font-semibold text-gray-600">Verificando sessão segura...</p>
            </div>
        );
    }

    if (error) {
        return (
            <AuthLayout title="Link Expirado">
                <div className="text-center space-y-5 py-2">
                    <div className="w-14 h-14 bg-red-50 rounded-full flex items-center justify-center mx-auto">
                        <AlertCircle className="w-7 h-7 text-red-500" />
                    </div>
                    <p className="text-sm text-gray-500">{error}</p>
                    <div className="space-y-2">
                        <button
                            onClick={() => navigate('/login')}
                            className="w-full bg-[#1c3152] text-white font-bold py-3 rounded-xl text-sm hover:brightness-110 transition-all active:scale-[0.98]"
                        >
                            Voltar ao Login
                        </button>
                        <button
                            onClick={() => navigate('/recuperar-senha')}
                            className="w-full bg-gray-100 text-gray-600 font-semibold py-3 rounded-xl text-sm hover:bg-gray-200 transition-all"
                        >
                            Solicitar Novo E-mail
                        </button>
                    </div>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Nova Senha" subtitle="Escolha uma senha segura para sua conta">
            {/* Badge de sessão segura */}
            <div className="flex items-center gap-2 text-green-600 bg-green-50 border border-green-100 px-3 py-2 rounded-lg mb-5">
                <ShieldCheck className="w-4 h-4 flex-shrink-0" />
                <span className="text-xs font-semibold">Sessão segura confirmada</span>
            </div>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
                <AuthInput
                    id="new-password"
                    label="Nova Senha"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    autoComplete="new-password"
                    icon={<Lock className="w-4 h-4" />}
                />

                <AuthInput
                    id="confirm-password"
                    label="Confirmar Nova Senha"
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha"
                    required
                    autoComplete="new-password"
                    icon={<Lock className="w-4 h-4" />}
                />

                <button
                    type="submit"
                    disabled={saving}
                    className="w-full mt-2 bg-[#1c3152] text-white font-bold py-3 rounded-xl hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Alteração'}
                </button>
            </form>
        </AuthLayout>
    );
};

export default UpdatePasswordPage;
