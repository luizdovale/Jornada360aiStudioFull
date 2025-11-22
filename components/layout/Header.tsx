import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, User as UserIcon, Home } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useToast } from '../../hooks/useToast';

const Header: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    
    // Simplificado: Busca o nome apenas dos metadados do usuário autenticado.
    const userName = user?.user_metadata?.nome || 'Usuário';

    // Estado para a foto do usuário
    const [avatar, setAvatar] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Carregar avatar do localStorage ao iniciar
    useEffect(() => {
        if (user?.id) {
            const storedAvatar = localStorage.getItem(`jornada360-avatar-${user.id}`);
            if (storedAvatar) {
                setAvatar(storedAvatar);
            }
        }
    }, [user]);

    const handleAvatarClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            // Validação de tamanho (limite 2MB para localStorage)
            if (file.size > 2 * 1024 * 1024) {
                toast({ title: "Erro", description: "A imagem é muito grande. Máximo de 2MB.", variant: 'destructive' });
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                const base64String = reader.result as string;
                setAvatar(base64String);
                if (user?.id) {
                    try {
                        localStorage.setItem(`jornada360-avatar-${user.id}`, base64String);
                        toast({ title: "Sucesso", description: "Foto de perfil atualizada." });
                    } catch (e) {
                        toast({ title: "Erro", description: "Espaço insuficiente no navegador.", variant: 'destructive' });
                    }
                }
            };
            reader.readAsDataURL(file);
        }
    };

    return (
        <header className="bg-primary pt-10 pb-20 px-5 text-white">
            <div className="max-w-md mx-auto md:max-w-2xl lg:max-w-4xl">
                <div className="flex items-center justify-between mb-6">
                    {/* Lado Esquerdo: Apenas o botão de Menu */}
                    <div className="flex items-center gap-2">
                        <button onClick={onMenuClick} className="w-9 h-9 rounded-full bg-primary-dark/40 flex items-center justify-center text-white">
                            <Menu className="w-5 h-5" />
                        </button>
                    </div>
                    {/* Lado Direito: Apenas o botão de Home */}
                    <div className="flex items-center gap-3">
                        <Link to="/" className="w-9 h-9 rounded-full bg-primary-dark/40 flex items-center justify-center text-white">
                            <Home className="w-5 h-5" />
                        </Link>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    {/* Avatar interativo */}
                    <div 
                        onClick={handleAvatarClick}
                        className="w-14 h-14 rounded-full bg-primary-light flex items-center justify-center text-primary-dark overflow-hidden cursor-pointer relative"
                    >
                       {avatar ? (
                           <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                       ) : (
                           <UserIcon className="w-8 h-8" />
                       )}
                       <input 
                           type="file" 
                           ref={fileInputRef} 
                           onChange={handleFileChange} 
                           className="hidden" 
                           accept="image/*"
                       />
                    </div>
                    <div>
                        <p className="text-sm text-muted-foreground">Olá,</p>
                        <p className="text-xl font-bold">{userName}</p>
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;