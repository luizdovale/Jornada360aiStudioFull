
import React, { useState, useEffect, useMemo } from 'react';
// @ts-ignore
import { useNavigate } from 'react-router-dom';
import { useJourneys } from '../contexts/JourneyContext';
import { useToast } from '../hooks/useToast';
import { Settings, SettingsVersion } from '../types';
import { getLocalDateString, formatMinutesToHours, getTripLabel, DEFAULT_TRIP_LABEL, SETTINGS_BASELINE_DATE } from '../lib/utils';
import ConfirmationModal from '../components/ui/ConfirmationModal';
import TripLabelPicker from '../components/ui/TripLabelPicker';
import { History, Trash2 } from 'lucide-react';

type FormData = Omit<Settings, 'id' | 'user_id'>;

// Valores como são gravados: números, textos sem espaços nas pontas e o nome
// padrão do registro ("RV") guardado como vazio.
const normalizeVersioned = (data: Partial<FormData>) => ({
    jornada_base: Number(data.jornada_base),
    month_start_day: Number(data.month_start_day),
    escala_pattern: data.escala_pattern,
    escala_start_date: data.escala_start_date || null,
    company_name: data.company_name?.trim() || null,
    trip_label: data.trip_label?.trim() && data.trip_label.trim() !== DEFAULT_TRIP_LABEL ? data.trip_label.trim() : null,
});

const formatDate = (date: string) => new Date(date + 'T00:00:00').toLocaleDateString('pt-BR');

const describeVersion = (v: SettingsVersion) => [
    `Jornada ${formatMinutesToHours(v.jornada_base)}`,
    `dia contábil ${v.month_start_day}`,
    `escala ${v.escala_pattern}`,
    getTripLabel(v),
    v.company_name ? v.company_name : null,
].filter(Boolean).join(' · ');

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { settings, settingsVersions, saveSettings, deleteSettingsVersion, loading: contextLoading } = useJourneys();
    const { toast } = useToast();
    const [formData, setFormData] = useState<FormData>({
        jornada_base: 480,
        km_enabled: true,
        month_start_day: 21,
        escala_pattern: '6x1',
        escala_start_date: getLocalDateString(),
        company_name: '',
        trip_label: '',
    });
    const [effectiveFrom, setEffectiveFrom] = useState(getLocalDateString());
    const [loading, setLoading] = useState(false);
    const [versionToDelete, setVersionToDelete] = useState<SettingsVersion | null>(null);

    useEffect(() => {
        if (settings) {
            setFormData({
                jornada_base: settings.jornada_base,
                km_enabled: settings.km_enabled,
                month_start_day: settings.month_start_day,
                escala_pattern: settings.escala_pattern,
                escala_start_date: settings.escala_start_date || getLocalDateString(),
                company_name: settings.company_name || '',
                trip_label: settings.trip_label || '',
            });
        }
    }, [settings]);

    // Mudou algo que afeta cálculos, períodos ou relatórios? Então pergunta a
    // partir de quando vale, para não mexer nos dias anteriores.
    const versionedChanged = useMemo(() => {
        if (!settings) return false;
        return JSON.stringify(normalizeVersioned(formData)) !== JSON.stringify(normalizeVersioned(settings));
    }, [formData, settings]);

    const laterVersion = useMemo(
        () => settingsVersions.find(v => v.effective_from > effectiveFrom && v.effective_from > SETTINGS_BASELINE_DATE),
        [settingsVersions, effectiveFrom]
    );

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.escala_start_date) {
            toast({ title: "Campo obrigatório", description: "Por favor, informe o primeiro dia da sua escala.", variant: 'destructive' });
            return;
        }
        if (versionedChanged && !effectiveFrom) {
            toast({ title: "Campo obrigatório", description: "Informe a partir de quando as alterações valem.", variant: 'destructive' });
            return;
        }
        setLoading(true);
        const dataToSave = {
            ...formData,
            ...normalizeVersioned(formData),
        } as FormData;
        const success = await saveSettings(dataToSave, effectiveFrom);
        if (success) {
            // Navega para a home após salvar com sucesso
            navigate('/');
        }
        setLoading(false);
    };

    const handleConfirmDelete = async () => {
        if (versionToDelete?.id) await deleteSettingsVersion(versionToDelete.id);
        setVersionToDelete(null);
    };

    if (contextLoading && !settings) {
         return (
            <div className="space-y-6">
                <h1 className="text-title-lg text-primary-dark">Configurações</h1>
                 <div className="bg-white p-6 rounded-2xl shadow-soft">
                    <p>Carregando configurações...</p>
                 </div>
            </div>
        );
    }

    // Estilo "flutuante" para os inputs
    const inputStyle = "w-full mt-1 p-3 bg-white border border-gray-200 rounded-lg text-primary-dark shadow-sm transition-all duration-200 focus:shadow-md focus:ring-2 focus:ring-primary-dark/50 focus:border-primary-dark";
    const today = getLocalDateString();
    const history = [...settingsVersions].reverse();

    return (
        <div className="space-y-6">
            <ConfirmationModal
                isOpen={!!versionToDelete}
                onClose={() => setVersionToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="Remover alteração"
                message={versionToDelete
                    ? `Os dias a partir de ${formatDate(versionToDelete.effective_from)} voltarão a usar as configurações anteriores. Deseja continuar?`
                    : ''}
                confirmText="Remover"
            />

            <h1 className="text-title-lg text-primary-dark">Configurações</h1>
            <div className="bg-white p-6 rounded-2xl shadow-card">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label htmlFor="company_name" className="block text-sm font-medium text-gray-700">Nome da Empresa</label>
                        <input
                            type="text"
                            name="company_name"
                            id="company_name"
                            maxLength={80}
                            placeholder="Opcional"
                            value={formData.company_name || ''}
                            onChange={handleChange}
                            className={inputStyle}
                        />
                        <p className="mt-1 text-xs text-gray-500">Aparece no cabeçalho dos relatórios em PDF.</p>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Registro de Viagem</label>
                        {/* key: recria o seletor quando as configurações carregam, para abrir já em "Outro" se for o caso */}
                        <TripLabelPicker
                            key={settings?.trip_label ?? 'default'}
                            value={formData.trip_label || ''}
                            onChange={value => setFormData(prev => ({ ...prev, trip_label: value }))}
                        />
                        <p className="mt-1 text-xs text-gray-500">Como sua empresa chama o registro de viagem. Aparece nas jornadas e nos relatórios.</p>
                    </div>
                    <div>
                        <label htmlFor="jornada_base" className="block text-sm font-medium text-gray-700">Jornada Diária</label>
                        <select
                            name="jornada_base"
                            id="jornada_base"
                            value={formData.jornada_base}
                            onChange={handleChange}
                             className={inputStyle}
                        >
                            <option value="480">8h 00m</option>
                            <option value="440">7h 20m</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="month_start_day" className="block text-sm font-medium text-gray-700">Primeiro dia contábil</label>
                        <input
                            type="number"
                            name="month_start_day"
                            id="month_start_day"
                            min="1"
                            max="31"
                            value={formData.month_start_day}
                            onChange={handleChange}
                            className={inputStyle}
                        />
                    </div>
                    <div>
                        <label htmlFor="escala_pattern" className="block text-sm font-medium text-gray-700">Padrão de Escala</label>
                        <select
                            name="escala_pattern"
                            id="escala_pattern"
                            value={formData.escala_pattern}
                            onChange={handleChange}
                             className={inputStyle}
                        >
                            <option value="6x1">6x1</option>
                            <option value="6x2">6x2</option>
                            <option value="5x2">5x2</option>
                            <option value="12x36">12x36</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="escala_start_date" className="block text-sm font-medium text-gray-700">Primeiro Dia da Escala</label>
                        <input
                            type="date"
                            name="escala_start_date"
                            id="escala_start_date"
                            value={formData.escala_start_date}
                            onChange={handleChange}
                            required
                            className={inputStyle}
                        />
                         <p className="mt-1 text-xs text-gray-500">Informe a data do seu primeiro dia de trabalho no ciclo da escala.</p>
                    </div>


                    <div className="flex items-start pt-2">
                        <div className="flex h-5 items-center">
                            <input
                                id="km_enabled"
                                name="km_enabled"
                                type="checkbox"
                                checked={formData.km_enabled}
                                onChange={handleChange}
                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                        </div>
                        <div className="ml-3 text-sm">
                            <label htmlFor="km_enabled" className="font-medium text-gray-700">Habilitar controle de KM</label>
                            <p className="text-gray-500">Permite registrar quilometragem inicial e final.</p>
                        </div>
                    </div>

                    {versionedChanged && (
                        <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 space-y-2">
                            <label htmlFor="effective_from" className="block text-sm font-bold text-amber-900">Essas alterações valem a partir de</label>
                            <input
                                type="date"
                                id="effective_from"
                                value={effectiveFrom}
                                onChange={e => setEffectiveFrom(e.target.value)}
                                required
                                className={inputStyle}
                            />
                            <p className="text-xs text-amber-800">
                                Os dias anteriores continuam com as configurações de antes: horas extras, períodos, escala e relatórios já lançados não mudam.
                            </p>
                            {effectiveFrom > today && (
                                <p className="text-xs text-amber-800">Até lá, continuam valendo as configurações atuais.</p>
                            )}
                            {laterVersion && (
                                <p className="text-xs text-amber-800">
                                    Já existe uma alteração a partir de {formatDate(laterVersion.effective_from)}; ela continua valendo a partir dessa data.
                                </p>
                            )}
                        </div>
                    )}

                    <div className="pt-4 text-right">
                        <button type="submit" disabled={loading} className="inline-flex justify-center rounded-md border border-transparent bg-primary-medium text-primary-dark font-bold py-2 px-4 text-sm shadow-sm hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 disabled:opacity-50 transition-transform active:scale-[0.98]">
                            {loading ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>

            {history.length > 1 && (
                <div className="bg-white p-6 rounded-2xl shadow-card space-y-3">
                    <h2 className="flex items-center gap-2 text-sm font-bold text-primary-dark">
                        <History className="w-4 h-4" /> Histórico de alterações
                    </h2>
                    <ul className="divide-y divide-gray-100">
                        {history.map(v => {
                            const isBaseline = v.effective_from <= SETTINGS_BASELINE_DATE;
                            return (
                                <li key={v.id ?? v.effective_from} className="py-3 flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-primary-dark">
                                            {isBaseline ? 'Configuração inicial' : `A partir de ${formatDate(v.effective_from)}`}
                                            {!isBaseline && v.effective_from > today && <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">AGENDADA</span>}
                                        </p>
                                        <p className="text-xs text-gray-500 break-words">{describeVersion(v)}</p>
                                    </div>
                                    {!isBaseline && (
                                        <button
                                            type="button"
                                            onClick={() => setVersionToDelete(v)}
                                            className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                                            aria-label={`Remover alteração de ${formatDate(v.effective_from)}`}
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SettingsPage;
