

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../hooks/useToast';
import { ArrowLeft } from 'lucide-react';
import Jornada360Logo from '../components/ui/Jornada360Logo';

const ForgotPasswordPage: React.FC = () => {
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // FIX: Use window.location.origin for a more robust redirect URL that works across environments.
        const redirectTo = window.location.origin;

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectTo,
        });

        setLoading(false);

        if (error) {
            toast({ title: "Erro", description: "Não foi possível enviar o email de redefinição. Verifique o email digitado.", variant: 'destructive' });
        } else {
            toast({ title: "Email enviado!", description: "Verifique sua caixa de entrada para o link de redefinição." });
            setSent(true);
        }
    };

    return (
        <div className="min-h-screen bg-primary flex flex-col justify-center py-12">
            <div className="max-w-sm mx-auto px-6 w-full">
                <Jornada360Logo variant="pageHeader" title="Recuperar Senha" />

                <div className="bg-card rounded-3xl shadow-card p-6 space-y-5">
                    {sent ? (
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-primary-dark">Verifique seu Email</h2>
                            <p className="text-muted-foreground mt-2">Um link para redefinir sua senha foi enviado para <strong>{email}</strong>.</p>
                        </div>
                    ) : (
                        <>
                            <h2 className="text-xl font-bold text-primary-dark">Insira seu email</h2>
                            <p className="text-sm text-muted-foreground">Enviaremos um link para você redefinir sua senha.</p>
                            <form onSubmit={handlePasswordReset} className="space-y-4">
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground">Email</label>
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        className="w-full mt-1 p-3 bg-white border border-gray-300 rounded-lg text-primary-dark focus:ring-2 focus:ring-primary-dark/50 focus:border-primary-dark transition"
                                        placeholder="seu@email.com"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-primary-medium text-primary-dark font-bold py-3 rounded-lg hover:brightness-95 transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center"
                                >
                                    {loading ? <div className="w-5 h-5 border-2 border-t-transparent border-primary-dark rounded-full animate-spin"></div> : 'Enviar Link'}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                <p className="mt-6 text-center text-sm text-gray-400">
                    <Link to="/login" className="text-accent font-semibold hover:underline flex items-center justify-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Voltar para o Login
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
