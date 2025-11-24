import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../hooks/useToast';
import Jornada360Icon from '../components/ui/Jornada360Icon';

const UpdatePasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const [searchParams] = useSearchParams();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const access_token = searchParams.get("access_token");
        const refresh_token = searchParams.get("refresh_token");

        if (!access_token || !refresh_token) {
            toast({
                title: "Erro",
                description: "Link inválido ou expirado.",
                variant: "destructive",
            });
            navigate('/login');
            return;
        }

        // 🔥 1. Criar sessão temporária no Supabase
        supabase.auth
            .setSession({
                access_token,
                refresh_token,
            })
            .then(({ data, error }) => {
                if (error) {
                    console.error(error);
                    toast({
                        title: "Erro",
                        description: "Não foi possível validar sua sessão.",
                        variant: "destructive",
                    });
                    navigate('/login');
                } else {
                    setLoading(false); // Agora pode mostrar o formulário
                }
            });
    }, []);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password !== confirmPassword) {
            toast({ title: "Erro", description: "As senhas não conferem.", variant: 'destructive' });
            return;
        }

        setSaving(true);

        // 🔥 2. Atualizar a senha no Supabase
        const { error } = await supabase.auth.updateUser({
            password: password,
        });

        setSaving(false);

        if (error) {
            toast({ title: "Erro", description: error.message, variant: 'destructive' });
        } else {
            toast({ title: "Senha atualizada!", description: "Sua senha foi alterada com sucesso." });

            // Redireciona para o login
            navigate('/login');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-primary flex items-center justify-center">
                <p className="text-white">Validando link de segurança...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-primary flex flex-col justify-center py-12">
            <div className="max-w-sm mx-auto px-6 w-full">
                <div className="mb-8 text-center flex flex-col items-center">
                    <Jornada360Icon className="w-20 h-20 mb-4 text-accent" />
                    <h1 className="text-2xl font-bold text-white">Nova Senha</h1>
                </div>

                <div className="bg-card rounded-3xl shadow-card p-6 space-y-5">
                    <h2 className="text-xl font-bold text-primary-dark">Defina sua nova senha</h2>
                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Nova Senha</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full mt-1 p-3 bg-white border border-gray-300 rounded-lg text-primary-dark focus:ring-2 focus:ring-primary-dark/50 focus:border-primary-dark transition"
                                placeholder="Mínimo 6 caracteres"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Confirmar Senha</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                minLength={6}
                                className="w-full mt-1 p-3 bg-white border border-gray-300 rounded-lg text-primary-dark focus:ring-2 focus:ring-primary-dark/50 focus:border-primary-dark transition"
                                placeholder="Repita a senha"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-primary-medium text-primary-dark font-bold py-3 rounded-lg hover:brightness-95 transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center"
                        >
                            {saving ? <div className="w-5 h-5 border-2 border-t-transparent border-primary-dark rounded-full animate-spin"></div> : 'Atualizar Senha'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default UpdatePasswordPage;
