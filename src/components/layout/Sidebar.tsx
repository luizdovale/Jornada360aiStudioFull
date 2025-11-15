import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Home, List, Settings, FileText, LogOut, X, User, CalendarDays } from 'lucide-react';
import Jornada360Icon from '../ui/Jornada360Icon';

const NavItem = ({ icon: Icon, label, path, onClick }: { icon: React.ElementType, label: string, path?: string, onClick?: () => void }) => {
    const navigate = useNavigate();
    const handleClick = () => {
        if (path) navigate(path);
        if (onClick) onClick();
    };

    return (
        <button onClick={handleClick} className="w-full flex items-center gap-4 px-3 py-3 rounded-xl hover:bg-primary/15 text-sm font-medium transition-colors">
            <Icon className="w-5 h-5 text-accent" />
            <span className="text-white">{label}</span>
        </button>
    );
};

const Sidebar: React.FC<{ isOpen: boolean; setIsOpen: (isOpen: boolean) => void; }> = ({ isOpen, setIsOpen }) => {
    const { signOut } = useAuth();
    const navigate = useNavigate();

    const handleLogout = async () => {
        await signOut();
        navigate('/login');
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 transition-opacity duration-300" onClick={() => setIsOpen(false)}>
            <div
                className={`fixed top-0 left-0 h-full w-72 bg-primary-dark shadow-lg p-6 flex flex-col gap-8 transition-transform duration-300 transform ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <Jornada360Icon className="w-8 h-8 text-accent" />
                        <span className="text-white font-bold text-lg">Jornada360</span>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-muted-foreground hover:text-white">
                        <X />
                    </button>
                </div>

                <nav className="flex flex-col gap-2 flex-1">
                    <NavItem icon={Home} label="Home" path="/" onClick={() => setIsOpen(false)}/>
                    <NavItem icon={List} label="Minhas Jornadas" path="/journeys" onClick={() => setIsOpen(false)}/>
                    <NavItem icon={CalendarDays} label="Calendário de Escala" path="/calendar" onClick={() => setIsOpen(false)}/>
                    <NavItem icon={Settings} label="Configurações" path="/settings" onClick={() => setIsOpen(false)}/>
                    <NavItem icon={FileText} label="Exportar PDF" path="/reports" onClick={() => setIsOpen(false)}/>
                    <NavItem icon={User} label="Meu Perfil" path="/profile" onClick={() => setIsOpen(false)}/>
                </nav>

                <div>
                    <NavItem icon={LogOut} label="Logout" onClick={handleLogout}/>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;