
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../contexts/AuthContext';
import Jornada360Icon from '../components/ui/Jornada360Icon';
import { Link } from 'react-router-dom';

const UpdatePasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user, loading: authLoading } = useAuth();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!authLoading && !user) {
            toast({
                title: 'Link inválido ou expirado',
                description: 'Por favor, solicite um novo link de redefinição de senha.',
                variant: 'destructive',
            });
            navigate('/recuperar-senha', { replace: true });
        }
    }, [authLoading, user, navigate, toast]);

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (password.length < 6) {
            toast({ title: 'Senha muito curta', description: 'A senha deve ter no mínimo 6 caracteres.', variant: 'destructive' });
            return;
        }
        if (password !== confirmPassword) {
            toast({ title: 'Senhas não conferem', description: 'As senhas digitadas não são iguais.', variant: 'destructive' });
            return;
        }

        setLoading(true);
        const { error } = await supabase.auth.updateUser({ password });

        setLoading(false);
        if (error) {
            toast({ title: 'Erro ao atualizar senha', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Sucesso!', description: 'Sua senha foi alterada. Por favor, faça o login novamente.' });
            await supabase.auth.signOut();
            navigate('/login');
        }
    };

    if (authLoading || !user) {
        return (
             <div className="min-h-screen bg-primary flex flex-col justify-center items-center text-white p-4">
                 <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-accent mb-6"></div>
                 <p className="text-xl">Verificando...</p>
             </div>
        );
    }
    
    const inputStyle = "w-full mt-1 p-3 bg-white border border-gray-300 rounded-lg text-primary-dark focus:ring-2 focus:ring-primary-dark/50 focus:border-primary-dark transition";

    return (
        <div className="min-h-screen bg-primary flex flex-col justify-center py-12">
            <div className="max-w-sm mx-auto px-6 w-full">
                <div className="mb-8 text-center flex flex-col items-center">
                     <Jornada360Icon className="w-20 h-20 mb-4 text-accent" />
                    <h1 className="text-2xl font-bold text-white">Definir Nova Senha</h1>
                </div>

                <div className="bg-card rounded-3xl shadow-card p-6 space-y-5">
                    <h2 className="text-xl font-bold text-primary-dark">Crie uma nova senha</h2>
                    <form onSubmit={handlePasswordUpdate} className="space-y-4">
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Nova Senha</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                                className={inputStyle}
                                placeholder="Mínimo 6 caracteres"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Confirmar Nova Senha</label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                                className={inputStyle}
                                placeholder="Repita a senha"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary-medium text-primary-dark font-bold py-3 rounded-lg hover:brightness-95 transition-transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center"
                        >
                             {loading ? <div className="w-5 h-5 border-2 border-t-transparent border-primary-dark rounded-full animate-spin"></div> : 'Salvar Nova Senha'}
                        </button>
                    </form>
                </div>
                 <p className="mt-6 text-center text-sm text-gray-400">
                    Lembrou a senha?{' '}
                    <Link to="/login" className="text-accent font-semibold hover:underline">
                        Fazer login
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default UpdatePasswordPage;
