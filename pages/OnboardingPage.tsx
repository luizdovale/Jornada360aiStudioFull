
import React, { useState, useEffect, useMemo } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { useJourneys } from '../contexts/JourneyContext';
import { useAuth } from '../contexts/AuthContext';
import { Clock, Map, Calendar, Briefcase, Coffee, ArrowLeft, Check, ChevronRight } from 'lucide-react';
import { Settings } from '../types';
import { getLocalDateString, parseEscalaPattern, getDayTypeForScale } from '../lib/utils';

const WEEKDAY_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const OnboardingPage: React.FC = () => {
    const navigate = useNavigate();
    const { settings, saveSettings, loading } = useJourneys();
    const { user } = useAuth();

    // State do Wizard
    const [step, setStep] = useState(1);
    const totalSteps = 5;
    const [isSaving, setIsSaving] = useState(false);

    // Estado do Formulário acumulado
    const [formData, setFormData] = useState<Omit<Settings, 'id' | 'user_id'>>({
        jornada_base: 480, // 8h padrão
        km_enabled: true,
        month_start_day: 21,
        escala_pattern: '6x1',
        escala_start_date: getLocalDateString(),
    });

    // Estado auxiliar do Passo 5: em vez de pedir uma data técnica de "início de ciclo",
    // pergunta em termos que a pessoa responde de cabeça — se hoje é dia de trabalho ou
    // folga, e há quantos dias. A escala_start_date é calculada a partir disso.
    const [todayStatus, setTodayStatus] = useState<'working' | 'off'>('working');
    const [dayNumber, setDayNumber] = useState(1);

    const { work: workDays, off: offDays } = useMemo(
        () => parseEscalaPattern(formData.escala_pattern),
        [formData.escala_pattern]
    );
    const maxDayNumber = todayStatus === 'working' ? workDays : offDays;

    // Garante que o "dia Nº" continua válido se o padrão de escala mudar (ex: voltar
    // no wizard e trocar de 6x1 para 5x2)
    useEffect(() => {
        setDayNumber(n => Math.min(Math.max(1, n), Math.max(1, maxDayNumber)));
    }, [maxDayNumber]);

    // Recalcula a escala_start_date sempre que a resposta do Passo 5 muda
    useEffect(() => {
        const dayInCycle = todayStatus === 'working' ? (dayNumber - 1) : (workDays + dayNumber - 1);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - dayInCycle);
        setFormData(prev => ({ ...prev, escala_start_date: getLocalDateString(start) }));
    }, [todayStatus, dayNumber, workDays]);

    // Prévia visual: próximos 7 dias, mostrando Trabalho/Folga com a configuração atual
    const previewDays = useMemo(() => {
        const tempSettings: Settings = { ...formData, user_id: '' };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Array.from({ length: 7 }).map((_, i) => {
            const d = new Date(today);
            d.setDate(d.getDate() + i);
            return {
                date: d,
                type: getDayTypeForScale(d, tempSettings),
            };
        });
    }, [formData]);

    // Se já tiver settings carregados, redireciona para a home
    useEffect(() => {
        if (!loading && settings) {
            navigate('/');
        }
    }, [loading, settings, navigate]);

    // Handlers
    const handleNext = () => {
        if (step < totalSteps) setStep(s => s + 1);
    };

    const handleBack = () => {
        if (step > 1) setStep(s => s - 1);
    };

    const updateData = (key: keyof typeof formData, value: any) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleFinish = async () => {
        setIsSaving(true);
        const success = await saveSettings(formData);
        if (success) {
            navigate('/');
        }
        setIsSaving(false);
    };

    // Seleção rápida (atualiza e avança)
    const selectAndNext = (key: keyof typeof formData, value: any) => {
        updateData(key, value);
        handleNext();
    };

    // Componentes de UI internos
    const StepIndicator = () => (
        <div className="flex items-center gap-2 mb-8">
            {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                    key={i}
                    className={`h-2 rounded-full transition-all duration-300 ${
                        i + 1 === step ? 'w-8 bg-accent' :
                        i + 1 < step ? 'w-2 bg-accent' : 'w-2 bg-primary-light/20'
                    }`}
                />
            ))}
            <span className="ml-auto text-xs text-primary-light/60">Passo {step} de {totalSteps}</span>
        </div>
    );

    const OptionCard = ({
        icon: Icon,
        title,
        subtitle,
        selected,
        onClick
    }: {
        icon: any, title: string, subtitle?: string, selected: boolean, onClick: () => void
    }) => (
        <button
            onClick={onClick}
            className={`w-full text-left p-5 rounded-2xl border-2 transition-all duration-200 flex items-center gap-4 group
                ${selected
                    ? 'border-accent bg-white/10 shadow-lg'
                    : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
                }
            `}
        >
            <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors
                ${selected ? 'bg-accent text-primary-dark' : 'bg-white/10 text-white group-hover:bg-white/20'}
            `}>
                <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1">
                <h3 className="font-bold text-lg text-white">{title}</h3>
                {subtitle && <p className="text-sm text-gray-300">{subtitle}</p>}
            </div>
            {selected && <div className="w-6 h-6 rounded-full bg-accent text-primary-dark flex items-center justify-center"><Check className="w-4 h-4"/></div>}
        </button>
    );

    const SchedulePreview = () => (
        <div className="bg-white/5 p-4 rounded-2xl border border-white/10">
            <p className="text-xs text-gray-400 mb-3">Prévia dos próximos dias com essa configuração:</p>
            <div className="grid grid-cols-7 gap-1.5">
                {previewDays.map((d, i) => (
                    <div key={i} className="flex flex-col items-center gap-1">
                        <span className="text-[10px] text-gray-400">{i === 0 ? 'Hoje' : WEEKDAY_LABELS[d.date.getDay()]}</span>
                        <div className={`w-full aspect-square rounded-lg flex items-center justify-center text-[11px] font-bold
                            ${d.type === 'work' ? 'bg-accent text-primary-dark' : 'bg-white/10 text-gray-300'}
                        `}>
                            {d.date.getDate()}
                        </div>
                    </div>
                ))}
            </div>
            <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-400">
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-accent inline-block" /> Trabalho</span>
                <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-white/10 inline-block" /> Folga</span>
            </div>
        </div>
    );

    // Conteúdo dos Passos
    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-white mb-2">Qual sua jornada diária?</h2>
                            <p className="text-gray-300">Defina quantas horas você trabalha por dia.</p>
                        </div>
                        <div className="space-y-3">
                            <OptionCard
                                icon={Clock}
                                title="8 Horas"
                                subtitle="480 minutos diários"
                                selected={formData.jornada_base === 480}
                                onClick={() => selectAndNext('jornada_base', 480)}
                            />
                            <OptionCard
                                icon={Clock}
                                title="7 Horas e 20 min"
                                subtitle="440 minutos diários"
                                selected={formData.jornada_base === 440}
                                onClick={() => selectAndNext('jornada_base', 440)}
                            />
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-white mb-2">Controla Quilometragem?</h2>
                            <p className="text-gray-300">Você precisa registrar o KM inicial e final?</p>
                        </div>
                        <div className="space-y-3">
                            <OptionCard
                                icon={Map}
                                title="Sim, controlo KM"
                                subtitle="Habilita campos de odômetro"
                                selected={formData.km_enabled === true}
                                onClick={() => selectAndNext('km_enabled', true)}
                            />
                            <OptionCard
                                icon={Map}
                                title="Não, apenas horas"
                                subtitle="Esconde campos de KM"
                                selected={formData.km_enabled === false}
                                onClick={() => selectAndNext('km_enabled', false)}
                            />
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-white mb-2">Dia de Fechamento</h2>
                            <p className="text-gray-300">Qual dia do mês sua folha de ponto reinicia?</p>
                        </div>

                        <div className="bg-white/5 p-6 rounded-2xl border border-white/10 text-center">
                            <label className="block text-sm text-gray-300 mb-2">Dia do Mês</label>
                            <div className="flex items-center justify-center gap-4">
                                <button
                                    onClick={() => updateData('month_start_day', Math.max(1, formData.month_start_day - 1))}
                                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                                >-</button>
                                <span className="text-4xl font-bold text-accent w-20">{formData.month_start_day}</span>
                                <button
                                    onClick={() => updateData('month_start_day', Math.min(31, formData.month_start_day + 1))}
                                    className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                                >+</button>
                            </div>
                            <p className="text-xs text-gray-400 mt-4">
                                Ex: Se colocar dia 21, seu mês vai de 21 até 20 do próximo mês.
                            </p>
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-white mb-2">Qual sua escala de trabalho?</h2>
                            <p className="text-gray-300">Isso define o padrão de trabalho/folga do seu calendário.</p>
                        </div>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/10">
                            <label className="flex items-center gap-2 text-sm text-gray-300 mb-3">
                                <Briefcase className="w-4 h-4" /> Tipo de Escala
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {['6x1', '5x2', '6x2', '12x36'].map(pattern => (
                                    <button
                                        key={pattern}
                                        onClick={() => selectAndNext('escala_pattern', pattern)}
                                        className={`py-3 px-3 rounded-lg text-sm font-bold transition-colors
                                            ${formData.escala_pattern === pattern
                                                ? 'bg-accent text-primary-dark'
                                                : 'bg-white/10 text-white hover:bg-white/20'}
                                        `}
                                    >
                                        {pattern}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400 mt-3">
                                {formData.escala_pattern === '12x36'
                                    ? 'Ex: trabalha um turno de 12h e folga as próximas 36h — no calendário isso aparece alternando um dia sim, um dia não.'
                                    : `Ex: ${formData.escala_pattern.split('x')[0]} dia(s) trabalhando, ${formData.escala_pattern.split('x')[1]} de folga, repetindo em ciclo.`}
                            </p>
                        </div>
                    </div>
                );
            case 5:
                return (
                    <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-white mb-2">Onde você está na escala hoje?</h2>
                            <p className="text-gray-300">Só isso já ajusta todo o calendário automaticamente.</p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => { setTodayStatus('working'); setDayNumber(1); }}
                                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all
                                    ${todayStatus === 'working' ? 'border-accent bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}
                                `}
                            >
                                <Briefcase className={`w-6 h-6 ${todayStatus === 'working' ? 'text-accent' : 'text-white'}`} />
                                <span className="text-sm font-bold text-white">Trabalhando hoje</span>
                            </button>
                            <button
                                onClick={() => { setTodayStatus('off'); setDayNumber(1); }}
                                className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all
                                    ${todayStatus === 'off' ? 'border-accent bg-white/10' : 'border-white/10 bg-white/5 hover:bg-white/10'}
                                `}
                            >
                                <Coffee className={`w-6 h-6 ${todayStatus === 'off' ? 'text-accent' : 'text-white'}`} />
                                <span className="text-sm font-bold text-white">De folga hoje</span>
                            </button>
                        </div>

                        {maxDayNumber > 1 && (
                            <div className="bg-white/5 p-5 rounded-2xl border border-white/10 text-center">
                                <label className="block text-sm text-gray-300 mb-2">
                                    Há quantos dias {todayStatus === 'working' ? 'você está trabalhando' : 'você está de folga'}?
                                </label>
                                <div className="flex items-center justify-center gap-4">
                                    <button
                                        onClick={() => setDayNumber(n => Math.max(1, n - 1))}
                                        className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                                    >-</button>
                                    <span className="text-4xl font-bold text-accent w-16">{dayNumber}</span>
                                    <button
                                        onClick={() => setDayNumber(n => Math.min(maxDayNumber, n + 1))}
                                        className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white"
                                    >+</button>
                                </div>
                                <p className="text-xs text-gray-400 mt-3">
                                    Ex: se hoje é seu 1º dia {todayStatus === 'working' ? 'de trabalho depois da folga' : 'de folga'}, deixe em 1.
                                </p>
                            </div>
                        )}

                        <SchedulePreview />
                        <p className="text-[11px] text-center text-gray-400">
                            Não precisa ser exato — dá pra ajustar depois em Configurações.
                        </p>
                    </div>
                );
            default: return null;
        }
    };

    if (loading) return <div className="min-h-screen bg-primary flex items-center justify-center"><div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin"/></div>;

    return (
        <div className="min-h-screen bg-primary flex flex-col">
            {/* Header Simples */}
            <div className="p-6">
               <h1 className="text-xl font-bold text-white flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-accent"/> Configuração Inicial
               </h1>
            </div>

            {/* Área de Conteúdo */}
            <div className="flex-1 flex flex-col justify-center px-6 pb-24 max-w-md mx-auto w-full">
                <StepIndicator />
                {renderStepContent()}
            </div>

            {/* Barra de Navegação Fixa */}
            <div className="fixed bottom-0 left-0 w-full bg-primary-dark/90 backdrop-blur-md border-t border-white/10 p-4 z-50">
                <div className="max-w-md mx-auto flex items-center justify-between">
                    {step > 1 ? (
                        <button
                            onClick={handleBack}
                            className="px-4 py-3 text-white font-medium hover:bg-white/5 rounded-xl transition-colors flex items-center gap-2"
                        >
                            <ArrowLeft className="w-5 h-5" /> Voltar
                        </button>
                    ) : (
                        <div /> // Espaçador
                    )}

                    {step < totalSteps ? (
                        <button
                            onClick={handleNext}
                            className="px-6 py-3 bg-white text-primary-dark font-bold rounded-xl hover:bg-gray-100 transition-colors flex items-center gap-2 shadow-lg"
                        >
                            Próximo <ChevronRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            onClick={handleFinish}
                            disabled={isSaving}
                            className="px-8 py-3 bg-accent text-primary-dark font-bold rounded-xl hover:brightness-110 transition-all flex items-center gap-2 shadow-lg shadow-accent/20 disabled:opacity-70"
                        >
                            {isSaving ? 'Salvando...' : 'Concluir'} <Check className="w-5 h-5" />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OnboardingPage;
