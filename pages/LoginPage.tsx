
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../hooks/useToast';
import AuthLayout from '../components/layout/AuthLayout';
import AuthInput from '../components/ui/AuthInput';
import { Mail, Lock, Loader2 } from 'lucide-react';

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { error } = await supabase.auth.signInWithPassword({ email, password });

        setLoading(false);

        if (error) {
            toast({
                title: 'Erro de autenticação',
                description: 'Email ou senha incorretos. Se você acabou de criar sua conta, verifique seu email.',
                variant: 'destructive',
            });
        } else {
            toast({ title: 'Login bem-sucedido!', description: 'Bem-vindo de volta.' });
            navigate('/');
        }
    };

    return (
        <AuthLayout title="Jornada360" subtitle="Faça login na sua conta">
            <form onSubmit={handleLogin} className="space-y-4">
                <AuthInput
                    id="email"
                    label="Email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                    icon={<Mail className="w-4 h-4" />}
                />

                <div className="space-y-1">
                    <AuthInput
                        id="password"
                        label="Senha"
                        type="password"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoComplete="current-password"
                        icon={<Lock className="w-4 h-4" />}
                    />
                    <div className="text-right">
                        <Link
                            to="/recuperar-senha"
                            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
                        >
                            Esqueceu a senha?
                        </Link>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 bg-[#1c3152] text-white font-bold py-3 rounded-xl hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Entrar'}
                </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
                Não tem conta?{' '}
                <Link to="/cadastro" className="text-gray-900 font-semibold hover:underline">
                    Cadastre-se
                </Link>
            </p>
        </AuthLayout>
    );
};

export default LoginPage;
