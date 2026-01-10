
import React, { useState } from 'react';
// @ts-ignore
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../hooks/useToast';
import { ArrowLeft, Mail, Loader2 } from 'lucide-react';
import Jornada360Icon from '../components/ui/Jornada360Icon';

const ForgotPasswordPage: React.FC = () => {
    const { toast } = useToast();
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [sent, setSent] = useState(false);

    const handlePasswordReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // APONTAMENTO CRUCIAL: Aponta para o arquivo físico .html
        // Isso evita que o link enviado pelo Supabase venha com "##" (dois hashes)
        const redirectTo = `${window.location.origin}/password-reset`;

        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: redirectTo,
        });

        setLoading(false);

        if (error) {
            toast({ title: "Erro", description: "Não foi possível enviar o email. Verifique o endereço digitado.", variant: 'destructive' });
        } else {
            toast({ title: "Email enviado!", description: "Verifique sua caixa de entrada para o link de redefinição." });
            setSent(true);
        }
    };

    return (
        <div className="min-h-screen bg-primary flex flex-col justify-center py-12 px-6">
            <div className="max-w-sm mx-auto w-full">
                <div className="mb-8 text-center flex flex-col items-center">
                     <Jornada360Icon className="w-20 h-20 mb-4 text-accent" />
                    <h1 className="text-2xl font-bold text-white">Recuperar Senha</h1>
                </div>

                <div className="bg-white rounded-3xl shadow-card p-8 space-y-6">
                    {sent ? (
                        <div className="text-center space-y-4">
                            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                                <Mail className="w-8 h-8 text-green-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-primary-dark">Tudo pronto!</h2>
                            <p className="text-muted-foreground">Enviamos as instruções para <strong>{email}</strong>. Verifique sua caixa de entrada e spam.</p>
                            <Link to="/login" className="block w-full bg-primary text-white py-4 rounded-2xl font-bold transition-all hover:bg-primary-dark">
                                Voltar para o Login
                            </Link>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <h2 className="text-xl font-bold text-primary-dark">Esqueceu sua senha?</h2>
                                <p className="text-sm text-muted-foreground">Não se preocupe! Insira seu e-mail abaixo para receber o link de recuperação.</p>
                            </div>
                            
                            <form onSubmit={handlePasswordReset} className="space-y-5">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">E-mail</label>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-primary-dark focus:ring-2 focus:ring-accent outline-none transition-all"
                                            placeholder="seu@email.com"
                                        />
                                    </div>
                                </div>
                                
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-accent text-primary-dark font-black py-4 rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Enviar Link'}
                                </button>
                            </form>
                        </>
                    )}
                </div>

                <div className="mt-8 text-center">
                    <Link to="/login" className="text-accent font-bold hover:underline inline-flex items-center gap-2">
                        <ArrowLeft className="w-4 h-4" />
                        Voltar para o Login
                    </Link>
                </div>
            </div>
        </div>
    );
};

export default ForgotPasswordPage;
