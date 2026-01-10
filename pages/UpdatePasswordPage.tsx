
import React, { useState, useEffect } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../hooks/useToast';
import Jornada360Icon from '../components/ui/Jornada360Icon';
import { Loader2, Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react';

const UpdatePasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const checkSession = async () => {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError || !session) {
                setError("Link de recuperação expirado ou inválido. Por favor, solicite um novo link.");
                setLoading(false);
                return;
            }
            
            setLoading(false);
        };

        checkSession();
    }, []);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (password.length < 6) {
            toast({ title: "Senha muito curta", description: "A senha deve ter pelo menos 6 caracteres.", variant: 'destructive' });
            return;
        }

        if (password !== confirmPassword) {
            toast({ title: "Senhas não conferem", description: "As senhas digitadas não são iguais.", variant: 'destructive' });
            return;
        }

        setSaving(true);

        const { error: updateError } = await supabase.auth.updateUser({
            password: password,
        });

        if (updateError) {
            toast({ title: "Erro ao atualizar", description: updateError.message, variant: 'destructive' });
            setSaving(false);
        } else {
            toast({ title: "Sucesso!", description: "Sua senha foi alterada. Faça login com a nova senha." });
            await supabase.auth.signOut();
            navigate('/login');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="w-12 h-12 text-accent animate-spin mb-4" />
                <p className="text-white font-medium">Validando link de segurança...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-primary flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-white rounded-3xl p-8 shadow-floating max-w-sm w-full space-y-6">
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                        <Lock className="w-10 h-10 text-red-600" />
                    </div>
                    <h2 className="text-2xl font-bold text-primary-dark">Ops!</h2>
                    <p className="text-muted-foreground">{error}</p>
                    <button 
                        onClick={() => navigate('/recuperar-senha')}
                        className="w-full bg-primary text-white py-4 rounded-2xl font-bold transition-all hover:bg-primary-dark"
                    >
                        Solicitar Novo Link
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-primary flex flex-col justify-center py-12 px-6">
            <div className="max-w-sm mx-auto w-full">
                <div className="mb-8 text-center flex flex-col items-center">
                    <Jornada360Icon className="w-20 h-20 mb-4 text-accent" />
                    <h1 className="text-2xl font-bold text-white">Nova Senha</h1>
                    <p className="text-primary-light/60 text-sm mt-2">Crie uma senha forte para proteger sua conta.</p>
                </div>

                <div className="bg-white rounded-3xl shadow-card p-8 space-y-6">
                    <div className="flex items-center gap-2 text-green-600 bg-green-50 p-3 rounded-xl">
                        <ShieldCheck className="w-5 h-5 flex-shrink-0" />
                        <span className="text-xs font-semibold leading-tight">Link validado. Agora você pode redefinir sua senha.</span>
                    </div>

                    <form onSubmit={handleUpdatePassword} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Nova Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full pl-12 pr-10 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-primary-dark focus:ring-2 focus:ring-accent outline-none transition-all"
                                    placeholder="Mínimo 6 caracteres"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider ml-1">Confirmar Senha</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    minLength={6}
                                    className="w-full pl-12 pr-10 py-4 bg-gray-50 border border-gray-200 rounded-2xl text-primary-dark focus:ring-2 focus:ring-accent outline-none transition-all"
                                    placeholder="Repita a nova senha"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                                >
                                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={saving}
                            className="w-full bg-accent text-primary-dark font-black py-4 rounded-2xl shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {saving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Atualizar Senha'}
                        </button>
                    </form>
                </div>
                
                <p className="text-center mt-8 text-sm text-primary-light/40">
                    Ao atualizar, sua sessão será reiniciada por segurança.
                </p>
            </div>
        </div>
    );
};

export default UpdatePasswordPage;
