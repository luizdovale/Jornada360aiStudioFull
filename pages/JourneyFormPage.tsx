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

    // ------------------------------
    // Responsivo + carregamento
    // ------------------------------
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


    // ------------------------------
    // Handlers
    // ------------------------------
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


    // ------------------------------
    // Styles
    // ------------------------------
    const inputContainerStyle = "relative w-full";
    const inputIconStyle = "absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5";
    const inputStyle = "w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition outline-none text-base text-gray-800 placeholder-gray-400 shadow-sm";
    const labelStyle = "text-sm font-semibold text-gray-600 mb-2 ml-1 block";

    const toggleLabel = (active: boolean, color: string) =>
        `flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all 
         ${active ? `${color} bg-opacity-20` : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}
        `;

    if (journeysLoading) return <div className="p-6 text-center">Carregando...</div>;

    return (
        <div className="pb-32 px-4 max-w-xl mx-auto w-full space-y-6">

            {/* HEADER */}
            <div className="flex items-center gap-3 mt-4">
                <button onClick={handleCancel} className="p-2 rounded-full hover:bg-gray-100 text-gray-600">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h1 className="text-2xl font-bold text-primary-dark">
                    {isEditing ? 'Editar Jornada' : 'Nova Jornada'}
                </h1>
            </div>

            {/* FORM */}
            <div className="bg-white p-5 rounded-2xl shadow-soft">
                <form id="journey-form" onSubmit={handleSubmit} className="flex flex-col gap-6">

                    {/* Feriado / Folga */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                        <label className={toggleLabel(formData.is_feriado, "border-yellow-500 text-yellow-700")}>
                            <input type="checkbox" name="is_feriado" checked={formData.is_feriado} onChange={handleChange} className="hidden" />
                            {formData.is_feriado && <Check className="w-4 h-4 mr-2" />}
                            Feriado
                        </label>

                        <label className={toggleLabel(formData.is_day_off, "border-red-500 text-red-700")}>
                            <input type="checkbox" name="is_day_off" checked={formData.is_day_off} onChange={handleChange} className="hidden" />
                            {formData.is_day_off && <Check className="w-4 h-4 mr-2" />}
                            Dia de Folga
                        </label>
                    </div>

                    {/* Data */}
                    <div className={inputContainerStyle}>
                        <label className={labelStyle}>Data</label>
                        <div className="relative">
                            <Calendar className={inputIconStyle} />
                            <input type="date" name="date" value={formData.date} onChange={handleChange} required className={inputStyle} />
                        </div>
                    </div>

                    {/* Horários */}
                    {!formData.is_day_off && (
                        <div className="space-y-6">
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                
                                <div className={inputContainerStyle}>
                                    <label className={labelStyle}>Início</label>
                                    <div className="relative">
                                        <Clock className={inputIconStyle} />
                                        <input type="time" name="start_at" value={formData.start_at} onChange={handleChange} required className={inputStyle} />
                                    </div>
                                </div>

                                <div className={inputContainerStyle}>
                                    <label className={labelStyle}>Fim</label>
                                    <div className="relative">
                                        <Clock className={inputIconStyle} />
                                        <input type="time" name="end_at" value={formData.end_at} onChange={handleChange} required className={inputStyle} />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                                <div className={inputContainerStyle}>
                                    <label className={labelStyle}>Início Refeição</label>
                                    <div className="relative">
                                        <Coffee className={inputIconStyle} />
                                        <input type="time" name="meal_start" value={formData.meal_start} onChange={handleChange} required className={inputStyle} />
                                    </div>
                                </div>

                                <div className={inputContainerStyle}>
                                    <label className={labelStyle}>Fim Refeição</label>
                                    <div className="relative">
                                        <Coffee className={inputIconStyle} />
                                        <input type="time" name="meal_end" value={formData.meal_end} onChange={handleChange} required className={inputStyle} />
                                    </div>
                                </div>
                            </div>

                            <div className={inputContainerStyle}>
                                <label className={labelStyle}>Descanso Adicional (min)</label>
                                <div className="relative">
                                    <Coffee className={inputIconStyle} />
                                    <input type="number" name="rest_duration" value={formData.rest_duration} onChange={handleChange} className={inputStyle} placeholder="Opcional" />
                                </div>
                            </div>

                        </div>
                    )}

                    {/* KM */}
                    {settings?.km_enabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

                            <div className={inputContainerStyle}>
                                <label className={labelStyle}>KM Inicial</label>
                                <div className="relative">
                                    <Map className={inputIconStyle} />
                                    <input type="number" step="0.1" name="km_start" value={formData.km_start} onChange={handleChange} className={inputStyle} placeholder="Opcional" />
                                </div>
                            </div>

                            <div className={inputContainerStyle}>
                                <label className={labelStyle}>KM Final</label>
                                <div className="relative">
                                    <Map className={inputIconStyle} />
                                    <input type="number" step="0.1" name="km_end" value={formData.km_end} onChange={handleChange} className={inputStyle} placeholder="Opcional" />
                                </div>
                            </div>

                        </div>
                    )}

                    {/* RV / Notas */}
                    <div className="space-y-6">
                        <div className={inputContainerStyle}>
                            <label className={labelStyle}>Nº do RV (opcional)</label>
                            <div className="relative">
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
            <div className="fixed bottom-0 left-0 w-full bg-white border-t p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-40">
                <div className="max-w-xl mx-auto flex gap-3">
                    <button
                        type="button"
                        onClick={handleCancel}
                        className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-lg"
                    >
                        Cancelar
                    </button>

                    <button
                        type="submit"
                        form="journey-form"
                        disabled={loading}
                        className="flex-1 py-4 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-primary-dark transition active:scale-95 disabled:opacity-70 text-lg"
                    >
                        {loading ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>

        </div>
    );
};

export default JourneyFormPage;
