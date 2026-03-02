
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../hooks/useToast';
import AuthLayout from '../components/layout/AuthLayout';
import AuthInput from '../components/ui/AuthInput';
import { ArrowLeft, Mail, Loader2, CheckCircle2 } from 'lucide-react';

const ForgotPasswordPage: React.FC = () => {
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const redirectTo = window.location.origin;

        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

        setLoading(false);

        if (error) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        } else {
            setSent(true);
        }
    };

    if (sent) {
        return (
            <AuthLayout title="Email Enviado!">
                <div className="text-center space-y-4 py-2">
                    <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto">
                        <CheckCircle2 className="w-7 h-7 text-green-500" />
                    </div>
                    <p className="text-sm text-gray-500">
                        Enviamos instruções de recuperação para{' '}
                        <strong className="text-gray-800">{email}</strong>.
                    </p>
                    <Link
                        to="/login"
                        className="block w-full bg-[#1c3152] text-white font-bold py-3 rounded-xl text-sm text-center hover:brightness-110 transition-all active:scale-[0.98]"
                    >
                        Voltar para o Login
                    </Link>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout
            title="Recuperar Senha"
            subtitle="Insira seu e-mail para receber um link de redefinição seguro"
        >
            <form onSubmit={handlePasswordReset} className="space-y-4">
                <AuthInput
                    id="email"
                    label="E-mail"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                    icon={<Mail className="w-4 h-4" />}
                />

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full mt-2 bg-[#1c3152] text-white font-bold py-3 rounded-xl hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 text-sm"
                >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar Link de Recuperação'}
                </button>
            </form>

            <div className="mt-6 text-center">
                <Link
                    to="/login"
                    className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Voltar para o Login
                </Link>
            </div>
        </AuthLayout>
    );
};

export default ForgotPasswordPage;
