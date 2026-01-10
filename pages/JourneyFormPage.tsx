
import React, { useState, useEffect } from 'react';
// @ts-ignore
import { useNavigate, useParams } from 'react-router-dom';
import { useJourneys } from '../contexts/JourneyContext';
import { useToast } from '../hooks/useToast';
import { Journey } from '../types';
import { X, Coffee, Clock, Map, FileText, Calendar, Check, ArrowLeft, Shield, Package } from 'lucide-react';

const DRAFT_KEY = 'jornada360_journey_draft';

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
    'id' | 'user_id' | 'rest_duration' | 'km_start' | 'km_end' | 'meal_start' | 'meal_end' | 'deliveries'
> & {
    rest_duration: number | string;
    km_start: number | string;
    km_end: number | string;
    deliveries: number | string;
    is_day_off: boolean;
    is_plantao: boolean;
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

    const [formData, setFormData] = useState<JourneyFormState>(() => {
        if (!isEditing) {
            const savedDraft = localStorage.getItem(DRAFT_KEY);
            if (savedDraft) {
                try {
                    return JSON.parse(savedDraft);
                } catch (e) {
                    console.error("Erro ao carregar rascunho", e);
                }
            }
        }
        
        return {
            date: getTodayString(),
            start_at: '08:00',
            end_at: '17:00',
            meal_start: '12:00',
            meal_end: '13:00',
            meal_duration: 60,
            rest_duration: '',
            is_feriado: false,
            is_day_off: false,
            is_plantao: false,
            km_start: '',
            km_end: '',
            deliveries: '',
            rv_number: '',
            notes: '',
        };
    });

    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isEditing) {
            localStorage.setItem(DRAFT_KEY, JSON.stringify(formData));
        }
    }, [formData, isEditing]);

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
                is_day_off: existingJourney.is_day_off || false,
                is_plantao: existingJourney.is_plantao || false,
                km_start: existingJourney.km_start || '',
                km_end: existingJourney.km_end || '',
                deliveries: existingJourney.deliveries || '',
                rv_number: existingJourney.rv_number || '',
                notes: existingJourney.notes || '',
            });
        } else if (isEditing && !existingJourney && !journeysLoading) {
            toast({ title: 'Erro', description: 'Jornada não encontrada.', variant: 'destructive' });
            navigate('/journeys');
        }
    }, [isEditing, existingJourney, journeysLoading, navigate, toast]);

    const handleChange = (e: any) => {
        const { name, value, type, checked } = e.target;
        
        setFormData(prev => {
            let nextState = { ...prev, [name]: type === 'checkbox' ? checked : value };

            // Se marcar Folga, desmarca Plantão
            if (name === 'is_day_off' && checked) {
                nextState.is_plantao = false;
            }
            
            // Se marcar Plantão, desmarca Folga mas MANTÉM Feriado se já estiver marcado
            if (name === 'is_plantao' && checked) {
                nextState.is_day_off = false;
                nextState.start_at = '13:00';
                nextState.end_at = '19:00';
            }

            return nextState;
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const ms = timeToMinutes(formData.meal_start);
        const me = timeToMinutes(formData.meal_end);
        let calculatedMealDuration = me - ms;
        if (calculatedMealDuration < 0) calculatedMealDuration += 24 * 60; 

        const hideDetails = formData.is_day_off || formData.is_plantao;

        const dataToSave = {
            ...formData,
            meal_duration: hideDetails ? 0 : calculatedMealDuration,
            rest_duration: hideDetails ? 0 : (formData.rest_duration ? Number(formData.rest_duration) : 0),
            km_start: hideDetails ? 0 : (formData.km_start ? Number(formData.km_start) : 0),
            km_end: hideDetails ? 0 : (formData.km_end ? Number(formData.km_end) : 0),
            deliveries: formData.deliveries ? Number(formData.deliveries) : 0,
            rv_number: hideDetails ? '' : formData.rv_number,
            meal_start: hideDetails ? '00:00' : formData.meal_start,
            meal_end: hideDetails ? '00:00' : formData.meal_end,
        };

        if (formData.is_day_off) {
            dataToSave.start_at = '00:00';
            dataToSave.end_at = '00:00';
        }

        let success;
        if (isEditing && id) {
            success = await updateJourney({ ...dataToSave, id, user_id: existingJourney!.user_id } as any);
        } else {
            success = await addJourney(dataToSave as any);
        }

        if (success) {
            localStorage.removeItem(DRAFT_KEY);
            navigate('/journeys');
        }
        setLoading(false);
    };

    const handleCancel = () => {
        if (!isEditing) localStorage.removeItem(DRAFT_KEY);
        navigate('/journeys');
    };

    const inputContainerStyle = "relative w-full min-w-0";
    const inputIconStyle = "absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5 pointer-events-none";
    const inputStyle = "w-full min-w-0 pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition outline-none text-base text-gray-800 placeholder-gray-400 shadow-sm box-border appearance-none";
    const labelStyle = "text-sm font-semibold text-gray-600 mb-2 ml-1 block";

    const toggleLabel = (active: boolean, color: string) =>
        `flex flex-col items-center justify-center p-3 rounded-xl border-2 cursor-pointer transition-all w-full
         ${active ? `${color} bg-opacity-10` : 'border-gray-200 bg-white text-gray-400 hover:bg-gray-50'}
        `;

    if (journeysLoading) return <div className="p-6 text-center">Carregando...</div>;

    return (
        <div className="pb-32 w-full max-w-full overflow-x-hidden">
            <div className="flex items-center gap-3 mt-2 mb-6 px-1">
                <button onClick={handleCancel} className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 flex-shrink-0">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-xl sm:text-2xl font-bold text-primary-dark truncate">
                    {isEditing ? 'Editar Jornada' : 'Nova Jornada'}
                </h1>
            </div>

            <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-soft w-full box-border">
                <form id="journey-form" onSubmit={handleSubmit} className="flex flex-col gap-6 w-full">

                    <div className="grid grid-cols-3 gap-2 sm:gap-3 w-full">
                        <label className={toggleLabel(formData.is_feriado, "border-yellow-500 text-yellow-700")}>
                            <input type="checkbox" name="is_feriado" checked={formData.is_feriado} onChange={handleChange} className="hidden" />
                            <span className="text-[10px] uppercase font-bold tracking-tighter mb-1">Feriado</span>
                            <Calendar className={`w-5 h-5 ${formData.is_feriado ? 'text-yellow-600' : 'text-gray-300'}`} />
                        </label>

                        <label className={toggleLabel(formData.is_plantao, "border-blue-500 text-blue-700")}>
                            <input type="checkbox" name="is_plantao" checked={formData.is_plantao} onChange={handleChange} className="hidden" />
                            <span className="text-[10px] uppercase font-bold tracking-tighter mb-1">Plantão</span>
                            <Shield className={`w-5 h-5 ${formData.is_plantao ? 'text-blue-600' : 'text-gray-300'}`} />
                        </label>

                        <label className={toggleLabel(formData.is_day_off, "border-red-500 text-red-700")}>
                            <input type="checkbox" name="is_day_off" checked={formData.is_day_off} onChange={handleChange} className="hidden" />
                            <span className="text-[10px] uppercase font-bold tracking-tighter mb-1">Folga</span>
                            <Check className={`w-5 h-5 ${formData.is_day_off ? 'text-red-600' : 'text-gray-300'}`} />
                        </label>
                    </div>

                    <div className={inputContainerStyle}>
                        <label className={labelStyle}>Data</label>
                        <div className="relative w-full">
                            <Calendar className={inputIconStyle} />
                            <input type="date" name="date" value={formData.date} onChange={handleChange} required className={inputStyle} />
                        </div>
                    </div>

                    {!formData.is_day_off && (
                        <div className="space-y-6 w-full animate-in fade-in duration-300">
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

                            {!formData.is_plantao && (
                                <>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 w-full animate-in slide-in-from-top-2">
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
                                    <div className={inputContainerStyle}>
                                        <label className={labelStyle}>Descanso Adicional (min)</label>
                                        <div className="relative w-full">
                                            <Coffee className={inputIconStyle} />
                                            <input type="number" name="rest_duration" value={formData.rest_duration} onChange={handleChange} className={inputStyle} placeholder="Opcional" />
                                        </div>
                                    </div>
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
                                </>
                            )}

                            <div className="grid grid-cols-2 gap-5 w-full">
                                <div className={inputContainerStyle}>
                                    <label className={labelStyle}>Qtd. Entregas</label>
                                    <div className="relative w-full">
                                        <Package className={inputIconStyle} />
                                        <input type="number" name="deliveries" value={formData.deliveries} onChange={handleChange} className={inputStyle} placeholder="0" />
                                    </div>
                                </div>
                                {!formData.is_plantao && (
                                    <div className={inputContainerStyle}>
                                        <label className={labelStyle}>Nº do RV</label>
                                        <div className="relative w-full">
                                            <FileText className={inputIconStyle} />
                                            <input type="text" name="rv_number" value={formData.rv_number} onChange={handleChange} className={inputStyle} placeholder="Opcional" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

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
                </form>
            </div>

            <div className="fixed bottom-0 left-0 w-full bg-white border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-50 px-4 py-4 box-border">
                <div className="w-full max-w-2xl mx-auto flex gap-3">
                    <button type="button" onClick={handleCancel} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-sm sm:text-base">Cancelar</button>
                    <button type="submit" form="journey-form" disabled={loading} className="flex-1 py-3 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-primary-dark transition active:scale-95 disabled:opacity-70 text-sm sm:text-base">
                        {loading ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JourneyFormPage;
