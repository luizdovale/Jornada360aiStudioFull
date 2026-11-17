
import React, { useState, useEffect, useMemo } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { useJourneys } from '../contexts/JourneyContext';
import { Clock, Map, Briefcase, Coffee, ArrowLeft, Check, ChevronRight, Building2, Minus, Plus } from 'lucide-react';
import { Settings } from '../types';
import { getLocalDateString, parseEscalaPattern } from '../lib/utils';
import ScheduleWeekPreview from '../components/ui/ScheduleWeekPreview';
import TripLabelPicker from '../components/ui/TripLabelPicker';

// Primeiro acesso: fundo cinza, cards brancos e detalhes em azul, uma pergunta por tela.

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
        type="button"
        onClick={onClick}
        aria-pressed={selected}
        className={`w-full text-left p-4 rounded-2xl border-2 bg-white transition-all duration-200 flex items-center gap-4
            ${selected ? 'border-blue-600 bg-blue-50/60 shadow-sm' : 'border-gray-200 hover:border-gray-300'}
        `}
    >
        <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors flex-shrink-0
            ${selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'}
        `}>
            <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1">
            <h3 className="font-bold text-base text-primary-dark">{title}</h3>
            {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        {selected && <div className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center"><Check className="w-4 h-4"/></div>}
    </button>
);

const Stepper = ({ value, onMinus, onPlus, label }: { value: number, onMinus: () => void, onPlus: () => void, label: string }) => (
    <div className="flex items-center justify-center gap-5">
        <button
            type="button"
            onClick={onMinus}
            aria-label={`Diminuir ${label}`}
            className="w-11 h-11 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-primary-dark"
        ><Minus className="w-4 h-4" /></button>
        <span className="text-4xl font-bold text-blue-600 w-16 text-center tabular-nums">{value}</span>
        <button
            type="button"
            onClick={onPlus}
            aria-label={`Aumentar ${label}`}
            className="w-11 h-11 rounded-full border border-gray-200 bg-white hover:bg-gray-50 flex items-center justify-center text-primary-dark"
        ><Plus className="w-4 h-4" /></button>
    </div>
);

const StepHeader = ({ title, subtitle }: { title: string, subtitle: string }) => (
    <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-primary-dark mb-1">{title}</h2>
        <p className="text-gray-500">{subtitle}</p>
    </div>
);

const OnboardingPage: React.FC = () => {
    const navigate = useNavigate();
    const { settings, saveSettings, loading } = useJourneys();

    // State do Wizard
    const [step, setStep] = useState(1);
    const totalSteps = 6;
    const [isSaving, setIsSaving] = useState(false);

    // Estado do Formulário acumulado
    const [formData, setFormData] = useState<Omit<Settings, 'id' | 'user_id'>>({
        jornada_base: 480, // 8h padrão
        km_enabled: true,
        month_start_day: 21,
        escala_pattern: '6x1',
        escala_start_date: getLocalDateString(),
        company_name: '',
        trip_label: '',
    });

    // Estado auxiliar do último passo: em vez de pedir uma data técnica de "início de ciclo",
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

    // Recalcula a escala_start_date sempre que a resposta do último passo muda
    useEffect(() => {
        const dayInCycle = todayStatus === 'working' ? (dayNumber - 1) : (workDays + dayNumber - 1);
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        start.setDate(start.getDate() - dayInCycle);
        setFormData(prev => ({ ...prev, escala_start_date: getLocalDateString(start) }));
    }, [todayStatus, dayNumber, workDays]);

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
        const tripLabel = formData.trip_label?.trim();
        const success = await saveSettings({
            ...formData,
            company_name: formData.company_name?.trim() || null,
            trip_label: tripLabel && tripLabel !== 'RV' ? tripLabel : null,
        });
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

    // Conteúdo dos Passos
    const renderStepContent = () => {
        switch (step) {
            case 1:
                return (
                    <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300">
                        <StepHeader title="Qual sua jornada diária?" subtitle="Usada no cálculo das horas extras." />
                        <div className="space-y-3">
                            <OptionCard
                                icon={Clock}
                                title="8 horas"
                                subtitle="480 minutos por dia"
                                selected={formData.jornada_base === 480}
                                onClick={() => selectAndNext('jornada_base', 480)}
                            />
                            <OptionCard
                                icon={Clock}
                                title="7 horas e 20 min"
                                subtitle="440 minutos por dia"
                                selected={formData.jornada_base === 440}
                                onClick={() => selectAndNext('jornada_base', 440)}
                            />
                        </div>
                    </div>
                );
            case 2:
                return (
                    <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300">
                        <StepHeader title="Sua empresa" subtitle="Aparece nas jornadas e nos relatórios." />
                        <div className="bg-white p-5 rounded-2xl border border-gray-200 space-y-5">
                            <div>
                                <label htmlFor="onb_company" className="flex items-center gap-2 text-sm font-semibold text-primary-dark mb-2">
                                    <Building2 className="w-4 h-4 text-blue-600" /> Nome da empresa
                                </label>
                                <input
                                    id="onb_company"
                                    type="text"
                                    maxLength={80}
                                    value={formData.company_name || ''}
                                    onChange={e => updateData('company_name', e.target.value)}
                                    placeholder="Opcional"
                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl text-primary-dark shadow-sm focus:ring-2 focus:ring-blue-600/40 focus:border-blue-600 outline-none"
                                />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-primary-dark mb-2">Como sua empresa chama o registro de viagem?</p>
                                <TripLabelPicker
                                    value={formData.trip_label || ''}
                                    onChange={value => updateData('trip_label', value)}
                                />
                            </div>
                        </div>
                    </div>
                );
            case 3:
                return (
                    <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300">
                        <StepHeader title="Controla quilometragem?" subtitle="Você precisa registrar o KM inicial e final?" />
                        <div className="space-y-3">
                            <OptionCard
                                icon={Map}
                                title="Sim, controlo KM"
                                subtitle="Mostra os campos de odômetro"
                                selected={formData.km_enabled === true}
                                onClick={() => selectAndNext('km_enabled', true)}
                            />
                            <OptionCard
                                icon={Map}
                                title="Não, apenas horas"
                                subtitle="Esconde os campos de KM"
                                selected={formData.km_enabled === false}
                                onClick={() => selectAndNext('km_enabled', false)}
                            />
                        </div>
                    </div>
                );
            case 4:
                return (
                    <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300">
                        <StepHeader title="Dia de fechamento" subtitle="Em que dia do mês sua folha de ponto reinicia?" />
                        <div className="bg-white p-6 rounded-2xl border border-gray-200 text-center">
                            <p className="text-sm text-gray-500 mb-3">Dia do mês</p>
                            <Stepper
                                label="dia de fechamento"
                                value={formData.month_start_day}
                                onMinus={() => updateData('month_start_day', Math.max(1, formData.month_start_day - 1))}
                                onPlus={() => updateData('month_start_day', Math.min(31, formData.month_start_day + 1))}
                            />
                            <p className="text-xs text-gray-500 mt-4">
                                Ex.: com o dia 21, seu mês vai do dia 21 até o dia 20 do mês seguinte.
                            </p>
                        </div>
                    </div>
                );
            case 5:
                return (
                    <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300">
                        <StepHeader title="Qual sua escala de trabalho?" subtitle="Define os dias de trabalho e folga do calendário." />
                        <div className="bg-white p-5 rounded-2xl border border-gray-200">
                            <p className="flex items-center gap-2 text-sm font-semibold text-primary-dark mb-3">
                                <Briefcase className="w-4 h-4 text-blue-600" /> Tipo de escala
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                {['6x1', '5x2', '6x2', '12x36'].map(pattern => (
                                    <button
                                        key={pattern}
                                        type="button"
                                        onClick={() => selectAndNext('escala_pattern', pattern)}
                                        aria-pressed={formData.escala_pattern === pattern}
                                        className={`py-3 px-3 rounded-xl text-sm font-bold border-2 transition-colors
                                            ${formData.escala_pattern === pattern
                                                ? 'border-blue-600 bg-blue-600 text-white'
                                                : 'border-gray-200 bg-white text-primary-dark hover:border-gray-300'}
                                        `}
                                    >
                                        {pattern}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-500 mt-3">
                                {formData.escala_pattern === '12x36'
                                    ? 'Ex.: trabalha um turno de 12h e folga as próximas 36h. No calendário isso aparece como um dia sim, um dia não.'
                                    : `Ex.: ${formData.escala_pattern.split('x')[0]} dia(s) trabalhando e ${formData.escala_pattern.split('x')[1]} de folga, repetindo em ciclo.`}
                            </p>
                        </div>
                    </div>
                );
            case 6:
                return (
                    <div className="space-y-4 animate-in slide-in-from-right fade-in duration-300">
                        <StepHeader title="Onde você está na escala hoje?" subtitle="Com isso o calendário se ajusta sozinho." />

                        <div className="grid grid-cols-2 gap-3">
                            {([
                                { status: 'working', icon: Briefcase, label: 'Trabalhando hoje' },
                                { status: 'off', icon: Coffee, label: 'De folga hoje' },
                            ] as const).map(({ status, icon: Icon, label }) => (
                                <button
                                    key={status}
                                    type="button"
                                    onClick={() => { setTodayStatus(status); setDayNumber(1); }}
                                    aria-pressed={todayStatus === status}
                                    className={`p-4 rounded-2xl border-2 bg-white flex flex-col items-center gap-2 transition-all
                                        ${todayStatus === status ? 'border-blue-600 bg-blue-50/60' : 'border-gray-200 hover:border-gray-300'}
                                    `}
                                >
                                    <Icon className={`w-6 h-6 ${todayStatus === status ? 'text-blue-600' : 'text-gray-500'}`} />
                                    <span className="text-sm font-bold text-primary-dark">{label}</span>
                                </button>
                            ))}
                        </div>

                        {maxDayNumber > 1 && (
                            <div className="bg-white p-5 rounded-2xl border border-gray-200 text-center">
                                <p className="text-sm text-gray-500 mb-3">
                                    Há quantos dias {todayStatus === 'working' ? 'você está trabalhando' : 'você está de folga'}?
                                </p>
                                <Stepper
                                    label="dias"
                                    value={dayNumber}
                                    onMinus={() => setDayNumber(n => Math.max(1, n - 1))}
                                    onPlus={() => setDayNumber(n => Math.min(maxDayNumber, n + 1))}
                                />
                                <p className="text-xs text-gray-500 mt-3">
                                    Ex.: se hoje é seu 1º dia {todayStatus === 'working' ? 'de trabalho depois da folga' : 'de folga'}, deixe em 1.
                                </p>
                            </div>
                        )}

                        <ScheduleWeekPreview
                            settings={formData}
                            variant="light"
                            label="Prévia dos próximos dias:"
                        />
                        <p className="text-[11px] text-center text-gray-500">
                            Não precisa ser exato: dá para ajustar depois em Configurações.
                        </p>
                    </div>
                );
            default: return null;
        }
    };

    if (loading) return <div className="min-h-screen bg-gray-100 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"/></div>;

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col">
            {/* Cabeçalho */}
            <div className="px-6 pt-6 pb-2 max-w-md mx-auto w-full">
               <h1 className="text-lg font-bold text-primary-dark flex items-center gap-2">
                   <span className="w-2 h-2 rounded-full bg-blue-600"/> Configuração inicial
               </h1>
            </div>

            {/* Área de Conteúdo */}
            <div className="flex-1 flex flex-col justify-center px-6 pb-28 max-w-md mx-auto w-full">
                <div className="flex items-center gap-1.5 mb-8" aria-label={`Passo ${step} de ${totalSteps}`}>
                    {Array.from({ length: totalSteps }).map((_, i) => (
                        <div
                            key={i}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                                i + 1 === step ? 'w-8 bg-blue-600' :
                                i + 1 < step ? 'w-4 bg-blue-600' : 'w-4 bg-gray-300'
                            }`}
                        />
                    ))}
                    <span className="ml-auto text-xs text-gray-500">Passo {step} de {totalSteps}</span>
                </div>
                {renderStepContent()}
            </div>

            {/* Barra de Navegação Fixa */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 z-50">
                <div className="max-w-md mx-auto flex items-center justify-between">
                    {step > 1 ? (
                        <button
                            type="button"
                            onClick={handleBack}
                            className="px-4 py-3 text-gray-600 font-medium hover:bg-gray-100 rounded-xl transition-colors flex items-center gap-2"
                        >
                            <ArrowLeft className="w-5 h-5" /> Voltar
                        </button>
                    ) : (
                        <div /> // Espaçador
                    )}

                    {step < totalSteps ? (
                        <button
                            type="button"
                            onClick={handleNext}
                            className="px-6 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                        >
                            Próximo <ChevronRight className="w-5 h-5" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={handleFinish}
                            disabled={isSaving}
                            className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm disabled:opacity-70"
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
