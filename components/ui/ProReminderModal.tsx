
import React from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { X, ShieldCheck, CalendarRange, Clock, Crown } from 'lucide-react';
import Jornada360Icon from './Jornada360Icon';

interface ProReminderModalProps {
    onClose: () => void;
}

// Lembrete de upgrade mostrado uma vez por sessão para quem ainda não é PRO.
// Prioriza o plano anual (melhor custo para o usuário e para conversão).
const ProReminderModal: React.FC<ProReminderModalProps> = ({ onClose }) => {
    const navigate = useNavigate();

    const handleSeePlans = () => {
        onClose();
        navigate('/subscription');
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-white w-full max-w-sm rounded-3xl p-6 shadow-floating relative text-center"
                onClick={(e) => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
                    <X className="w-5 h-5" />
                </button>

                <div className="flex justify-center mb-4">
                    <div className="relative">
                        <Jornada360Icon className="w-16 h-16 text-accent" />
                        <div className="absolute -top-1 -right-1 bg-accent text-primary-dark text-[10px] font-bold px-2 py-0.5 rounded-full ring-2 ring-white">PRO</div>
                    </div>
                </div>

                <h2 className="text-xl font-bold text-primary-dark mb-1">Desbloqueie o Jornada360 PRO</h2>
                <p className="text-sm text-muted-foreground mb-5">Exporte relatórios em PDF e veja sua escala completa, sem limites.</p>

                <div className="bg-primary-light/40 border border-accent/30 rounded-2xl p-4 mb-5">
                    <span className="text-[11px] font-bold text-accent uppercase tracking-widest">Plano Anual · Melhor custo</span>
                    <div className="flex items-baseline justify-center gap-1 mt-1">
                        <span className="text-3xl font-black text-primary-dark">R$ 99,90</span>
                        <span className="text-muted-foreground text-sm">/ano</span>
                    </div>
                    <p className="text-xs text-green-600 font-semibold mt-1">Equivale a R$ 8,33/mês — 2 meses grátis</p>
                </div>

                <ul className="space-y-2 mb-6 text-left">
                    <li className="flex items-center gap-2 text-sm text-gray-700"><ShieldCheck className="w-4 h-4 text-green-600 flex-shrink-0" /> Relatórios em PDF ilimitados</li>
                    <li className="flex items-center gap-2 text-sm text-gray-700"><CalendarRange className="w-4 h-4 text-green-600 flex-shrink-0" /> Calendário de escala completo</li>
                    <li className="flex items-center gap-2 text-sm text-gray-700"><Clock className="w-4 h-4 text-green-600 flex-shrink-0" /> Suporte prioritário</li>
                </ul>

                <button
                    onClick={handleSeePlans}
                    className="w-full bg-accent text-primary-dark font-black py-3.5 rounded-2xl flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                    <Crown className="w-5 h-5" /> Quero ser PRO
                </button>
                <button onClick={onClose} className="w-full text-xs text-muted-foreground mt-3 py-2 hover:text-gray-600">
                    Agora não
                </button>
            </div>
        </div>
    );
};

export default ProReminderModal;
