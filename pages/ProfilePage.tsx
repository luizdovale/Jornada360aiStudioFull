
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import { supabase } from '../lib/supabaseClient';
import { Eye, EyeOff, Lock } from 'lucide-react';

const ProfilePage: React.FC = () => {
    const { user, updateUserMetadata } = useAuth();
    const { toast } = useToast();

    const [nome, setNome] = useState(user?.user_metadata?.nome || '');
    const [nameLoading, setNameLoading] = useState(false);

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);

    const handleNameUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (nome.trim().length < 2) {
            toast({ title: 'Nome inválido', description: 'O nome deve ter pelo menos 2 caracteres.', variant: 'destructive' });
            return;
        }
        setNameLoading(true);
        try {
            await updateUserMetadata({ nome });
            toast({ title: 'Sucesso!', description: 'Seu nome foi atualizado.' });
        } catch (error: any) {
            toast({ title: 'Erro ao atualizar nome', description: error.message, variant: 'destructive' });
        } finally {
            setNameLoading(false);
        }
    };

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
        setPasswordLoading(true);
        const { error } = await supabase.auth.updateUser({ password });
        if (error) {
            toast({ title: 'Erro ao atualizar senha', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Sucesso!', description: 'Sua senha foi alterada.' });
            setPassword('');
            setConfirmPassword('');
        }
        setPasswordLoading(false);
    };

    const inputStyle = "w-full mt-1 p-3 bg-white border border-gray-300 rounded-lg text-primary-dark focus:ring-2 focus:ring-primary-dark/50 focus:border-primary-dark transition";
    const disabledInputStyle = "w-full mt-1 p-3 bg-gray-100 border border-gray-300 rounded-lg text-muted-foreground transition";

    return (
        <div className="space-y-8">
            <h1 className="text-title-lg text-primary-dark">Meu Perfil</h1>
            
            {/* Formulário de Informações Pessoais */}
            <div className="bg-white p-6 rounded-2xl shadow-soft">
                <h2 className="text-lg font-bold text-primary-dark mb-4">Informações Pessoais</h2>
                <form onSubmit={handleNameUpdate} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
                        <input
                            type="email"
                            id="email"
                            value={user?.email || ''}
                            disabled
                            className={disabledInputStyle}
                        />
                    </div>
                    <div>
                        <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome Completo</label>
                        <input
                            type="text"
                            id="nome"
                            value={nome}
                            onChange={(e) => setNome(e.target.value)}
                            className={inputStyle}
                        />
                    </div>
                    <div className="text-right">
                        <button type="submit" disabled={nameLoading} className="inline-flex justify-center rounded-md border border-transparent bg-primary-medium text-primary-dark py-2 px-4 text-sm font-bold shadow-sm hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 disabled:opacity-50 transition-transform active:scale-[0.98]">
                            {nameLoading ? 'Salvando...' : 'Salvar Nome'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Formulário de Alteração de Senha */}
            <div className="bg-white p-6 rounded-2xl shadow-soft">
                <h2 className="text-lg font-bold text-primary-dark mb-4">Alterar Senha</h2>
                <form onSubmit={handlePasswordUpdate} className="space-y-4">
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700">Nova Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type={showPassword ? "text" : "password"}
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Mínimo 6 caracteres"
                                className={`${inputStyle} pl-10 pr-10`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                            >
                                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirmar Nova Senha</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type={showConfirmPassword ? "text" : "password"}
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className={`${inputStyle} pl-10 pr-10`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary transition-colors"
                            >
                                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                     <div className="text-right">
                        <button type="submit" disabled={passwordLoading} className="inline-flex justify-center rounded-md border border-transparent bg-primary-medium text-primary-dark py-2 px-4 text-sm font-bold shadow-sm hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 disabled:opacity-50 transition-transform active:scale-[0.98]">
                            {passwordLoading ? 'Alterando...' : 'Alterar Senha'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ProfilePage;
