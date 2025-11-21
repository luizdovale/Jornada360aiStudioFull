import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useJourneys } from '../contexts/JourneyContext';
import { useToast } from '../hooks/useToast';
import { Journey } from '../types';
import { X, Coffee, Clock, Map, FileText, Calendar, Check, ArrowLeft } from 'lucide-react';

const getTodayString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
};

const timeToMinutes = (timeString: string): number => {
    if (!timeString || !timeString.includes(':')) return 0;
    const [h, m] = timeString.split(':').map(Number);
    return h * 60 + m;
};

type JourneyFormState = Omit<
    Journey,
    'id' | 'user_id' | 'rest_duration' | 'km_start' | 'km_end' | 'meal_start' | 'meal_end'
> & {
    rest_duration: number | string;
    km_start: number | string;
    km_end: number | string;
    is_day_off: boolean;
    meal_start: string;
    meal_end: string;
};

const JourneyFormPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { addJourney, updateJourney, journeys, settings, loading: journeysLoading } = useJourneys();
    const { toast } = useToast();

    const isEditing = Boolean(id);
    const existingJourney = isEditing ? journeys.find(j => j.id === id) : undefined;

    const [formData, setFormData] = useState<JourneyFormState>({
        date: getTodayString(),
        start_at: '08:00',
        end_at: '18:00',
        meal_start: '12:00',
        meal_end: '13:00',
        meal_duration: 60,
        rest_duration: '',
        is_feriado: false,
        is_day_off: false,
        km_start: '',
        km_end: '',
        rv_number: '',
        notes: '',
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isEditing && existingJourney) {
            setFormData({
                date: existingJourney.date,
                start_at: existingJourney.start_at,
                end_at: existingJourney.end_at,
                meal_start: existingJourney.meal_start || '12:00',
                meal_end: existingJourney.meal_end || '13:00',
                meal_duration: existingJourney.meal_duration,
                rest_duration: existingJourney.rest_duration || '',
                is_feriado: existingJourney.is_feriado,
                is_day_off: existingJourney.is_day_off,
                km_start: existingJourney.km_start || '',
                km_end: existingJourney.km_end || '',
                rv_number: existingJourney.rv_number || '',
                notes: existingJourney.notes || '',
            });
        } else if (isEditing && !existingJourney && !journeysLoading) {
            toast({
                title: 'Erro',
                description: 'Jornada não encontrada.',
                variant: 'destructive'
            });
            navigate('/journeys');
        }
    }, [isEditing, existingJourney, journeysLoading, navigate, toast]);

    const handleChange = (e: any) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const validateForm = () => {
        if (formData.is_day_off) return true;

        const start = timeToMinutes(formData.start_at);
        const end = timeToMinutes(formData.end_at);

        if (end < start) {
            toast({
                title: 'Horário inválido',
                description: 'O fim da jornada deve ser após o início.',
                variant: 'destructive',
            });
            return false;
        }

        const ms = timeToMinutes(formData.meal_start);
        const me = timeToMinutes(formData.meal_end);

        if (me <= ms) {
            toast({
                title: 'Refeição inválida',
                description: 'O fim da refeição deve ser após o início.',
                variant: 'destructive',
            });
            return false;
        }

        if (settings?.km_enabled) {
            const ks = Number(formData.km_start || 0);
            const ke = Number(formData.km_end || 0);
            if (ke > 0 && ke < ks) {
                toast({
                    title: 'KM inválido',
                    description: 'KM final não pode ser menor que o inicial.',
                    variant: 'destructive'
                });
                return false;
            }
        }

        return true;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;

        setLoading(true);

        const ms = timeToMinutes(formData.meal_start);
        const me = timeToMinutes(formData.meal_end);

        const processed = formData.is_day_off
            ? {
                ...formData,
                start_at: '00:00',
                end_at: '00:00',
                meal_start: '00:00',
                meal_end: '00:00',
                meal_duration: 0,
                rest_duration: 0
            }
            : {
                ...formData,
                meal_duration: me - ms
            };

        const dataToSave = {
            ...processed,
            rest_duration: processed.rest_duration ? Number(processed.rest_duration) : 0,
            km_start: processed.km_start ? Number(processed.km_start) : 0,
            km_end: processed.km_end ? Number(processed.km_end) : 0,
        };

        let success;

        if (isEditing && id) {
            success = await updateJourney({ ...dataToSave, id, user_id: existingJourney!.user_id });
        } else {
            success = await addJourney(dataToSave);
        }

        if (success) navigate('/journeys');
        setLoading(false);
    };

    const handleCancel = () => navigate('/journeys');

    // Styles Corrigidos para Mobile
    const inputContainerStyle = "relative w-full min-w-0"; // min-w-0 permite encolher
    const inputIconStyle = "absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none";
    
    // box-border e w-full são cruciais. min-w-0 em flex items previne overflow.
    const inputStyle = "w-full min-w-0 pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition outline-none text-base text-gray-800 placeholder-gray-400 shadow-sm box-border appearance-none";
    
    const labelStyle = "text-sm font-semibold text-gray-600 mb-2 ml-1 block";

    const toggleLabel = (active: boolean, color: string) =>
        `flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all w-full
         ${active ? `${color} bg-opacity-20` : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}
        `;

    if (journeysLoading) return <div className="p-6 text-center">Carregando...</div>;

    return (
        // overflow-hidden no eixo X para garantir que nada saia da tela
        <div className="pb-32 w-full max-w-full overflow-x-hidden">

            {/* HEADER */}
            <div className="flex items-center gap-3 mt-2 mb-6 px-1">
                <button onClick={handleCancel} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 flex-shrink-0">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-primary-dark truncate">
                    {isEditing ? 'Editar Jornada' : 'Nova Jornada'}
                </h1>
            </div>

            {/* FORM CONTAINER */}
            {/* Removido padding lateral extra que poderia somar com o do MainLayout */}
            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-soft w-full box-border">
                <form id="journey-form" onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">

                    {/* Feriado / Folga - Lado a Lado (grid-cols-2 forçado) */}
                    <div className="grid grid-cols-2 gap-4 w-full">
                        <label className={toggleLabel(formData.is_feriado, "border-yellow-500 text-yellow-700")}>
                            <input type="checkbox" name="is_feriado" checked={formData.is_feriado} onChange={handleChange} className="hidden" />
                            {formData.is_feriado && <Check className="w-4 h-4 mr-2 flex-shrink-0" />}
                            <span className="whitespace-nowrap text-sm sm:text-base">Feriado</span>
                        </label>

                        <label className={toggleLabel(formData.is_day_off, "border-red-500 text-red-700")}>
                            <input type="checkbox" name="is_day_off" checked={formData.is_day_off} onChange={handleChange} className="hidden" />
                            {formData.is_day_off && <Check className="w-4 h-4 mr-2 flex-shrink-0" />}
                            <span className="whitespace-nowrap text-sm sm:text-base">Folga</span>
                        </label>
                    </div>

                    {/* Data */}
                    <div className={inputContainerStyle}>
                        <label className={labelStyle}>Data</label>
                        <div className="relative w-full">
                            <Calendar className={inputIconStyle} />
                            <input type="date" name="date" value={formData.date} onChange={handleChange} required className={inputStyle} />
                        </div>
                    </div>

                    {/* Horários - Grid Responsivo */}
                    {!formData.is_day_off && (
                        <div className="space-y-6 w-full">
                            
                            {/* Jornada */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                                <div className={inputContainerStyle}>
                                    <label className={labelStyle}>Início Jornada</label>
                                    <div className="relative w-full">
                                        <Clock className={inputIconStyle} />
                                        <input type="time" name="start_at" value={formData.start_at} onChange={handleChange} required className={inputStyle} />
                                    </div>
                                </div>

                                <div className={inputContainerStyle}>
                                    <label className={labelStyle}>Fim Jornada</label>
                                    <div className="relative w-full">
                                        <Clock className={inputIconStyle} />
                                        <input type="time" name="end_at" value={formData.end_at} onChange={handleChange} required className={inputStyle} />
                                    </div>
                                </div>
                            </div>

                            {/* Refeição */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                                <div className={inputContainerStyle}>
                                    <label className={labelStyle}>Início Refeição</label>
                                    <div className="relative w-full">
                                        <Coffee className={inputIconStyle} />
                                        <input type="time" name="meal_start" value={formData.meal_start} onChange={handleChange} required className={inputStyle} />
                                    </div>
                                </div>

                                <div className={inputContainerStyle}>
                                    <label className={labelStyle}>Fim Refeição</label>
                                    <div className="relative w-full">
                                        <Coffee className={inputIconStyle} />
                                        <input type="time" name="meal_end" value={formData.meal_end} onChange={handleChange} required className={inputStyle} />
                                    </div>
                                </div>
                            </div>

                            {/* Descanso */}
                            <div className={inputContainerStyle}>
                                <label className={labelStyle}>Descanso Adicional (min)</label>
                                <div className="relative w-full">
                                    <Coffee className={inputIconStyle} />
                                    <input type="number" name="rest_duration" value={formData.rest_duration} onChange={handleChange} className={inputStyle} placeholder="Opcional" />
                                </div>
                            </div>

                        </div>
                    )}

                    {/* KM */}
                    {settings?.km_enabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full">
                            <div className={inputContainerStyle}>
                                <label className={labelStyle}>KM Inicial</label>
                                <div className="relative w-full">
                                    <Map className={inputIconStyle} />
                                    <input type="number" step="0.1" name="km_start" value={formData.km_start} onChange={handleChange} className={inputStyle} placeholder="Opcional" />
                                </div>
                            </div>

                            <div className={inputContainerStyle}>
                                <label className={labelStyle}>KM Final</label>
                                <div className="relative w-full">
                                    <Map className={inputIconStyle} />
                                    <input type="number" step="0.1" name="km_end" value={formData.km_end} onChange={handleChange} className={inputStyle} placeholder="Opcional" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* RV / Notas */}
                    <div className="space-y-6 w-full">
                        <div className={inputContainerStyle}>
                            <label className={labelStyle}>Nº do RV (opcional)</label>
                            <div className="relative w-full">
                                <FileText className={inputIconStyle} />
                                <input type="text" name="rv_number" value={formData.rv_number} onChange={handleChange} className={inputStyle} placeholder="Ex: 12345" />
                            </div>
                        </div>

                        <div className={inputContainerStyle}>
                            <label className={labelStyle}>Observações</label>
                            <textarea
                                name="notes"
                                value={formData.notes}
                                onChange={handleChange}
                                rows={3}
                                className={`${inputStyle} pl-4 h-auto min-h-[100px] resize-y`}
                                placeholder="Observações sobre o dia..."
                            ></textarea>
                        </div>
                    </div>

                </form>
            </div>

            {/* FOOTER FIXO RESPONSIVO */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 px-4 py-4 box-border">
                <div className="w-full max-w-2xl mx-auto flex gap-3">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm sm:text-base"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        form="journey-form"
                        disabled={loading}
                        className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-primary-dark transition active:scale-95 disabled:opacity-70 text-sm sm:text-base"
                    >
                        {loading ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

        </div>
    );
};

export default JourneyFormPage;