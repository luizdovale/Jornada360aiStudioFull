import React from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Menu, User as UserIcon, Home } from 'lucide-react';
import { Link } from 'react-router-dom';

const Header: React.FC<{ onMenuClick: () => void }> = ({ onMenuClick }) => {
    const { user } = useAuth();
    
    // Simplificado: Busca o nome apenas dos metadados do usuário autenticado.
    const userName = user?.user_metadata?.nome || 'Usuário';

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
                    <div className="w-14 h-14 rounded-full bg-primary-light flex items-center justify-center text-primary-dark">
                       <UserIcon className="w-8 h-8" />
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