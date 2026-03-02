
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../hooks/useToast';
import AuthLayout from '../components/layout/AuthLayout';
import AuthInput from '../components/ui/AuthInput';
import { Mail, Lock, User, Loader2 } from 'lucide-react';

const SignUpPage: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [nome, setNome] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSignUp = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: { nome },
                emailRedirectTo: window.location.origin,
            },
        });

        setLoading(false);

        if (error) {
            toast({ title: 'Erro ao cadastrar', description: error.message, variant: 'destructive' });
            return;
        }

        if (data.user && !data.session) {
            toast({
                title: 'Cadastro quase completo!',
                description: 'Enviamos um link de confirmação para o seu email.',
            });
            navigate('/login');
        } else if (data.user && data.session) {
            toast({
                title: `Bem-vindo(a), ${nome.split(' ')[0]}!`,
                description: 'Sua conta foi criada e você já está conectado.',
            });
            navigate('/');
        } else {
            toast({
                title: 'Erro inesperado',
                description: 'Não foi possível completar o cadastro. Tente novamente.',
                variant: 'destructive',
            });
        }
    };

    return (
        <AuthLayout title="Criar Conta" subtitle="Preencha seus dados para começar">
            <form onSubmit={handleSignUp} className="space-y-4">
                <AuthInput
                    id="nome"
                    label="Nome completo"
                    type="text"
                    value={nome}
                    onChange={e => setNome(e.target.value)}
                    placeholder="Seu nome"
                    required
                    autoComplete="name"
                    icon={<User className="w-4 h-4" />}
                />

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

                <AuthInput
                    id="password"
                    label="Senha"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    required
                    minLength={6}
                    autoComplete="new-password"
                    icon={<Lock className="w-4 h-4" />}
                />

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 bg-[#1c3152] text-white font-bold py-3 rounded-xl hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Criar conta'}
                </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
                Já tem uma conta?{' '}
                <Link to="/login" className="text-gray-900 font-semibold hover:underline">
                    Faça login
                </Link>
            </p>
        </AuthLayout>
    );
};

export default SignUpPage;
