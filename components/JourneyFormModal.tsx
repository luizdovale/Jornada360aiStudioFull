
import React, { useState, useEffect } from 'react';
import { useJourneys } from '../contexts/JourneyContext';
import { useToast } from '../hooks/useToast';
import { Journey } from '../types';
import { X } from 'lucide-react';

const getTodayString = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const timeToMinutes = (timeString: string): number => {
    if (!timeString || !timeString.includes(':')) return 0;
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
};

interface JourneyFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    journey?: Journey;
}

const JourneyFormModal: React.FC<JourneyFormModalProps> = ({ isOpen, onClose, journey }) => {
    const { addJourney, updateJourney, settings } = useJourneys();
    const { toast } = useToast();
    const [formData, setFormData] = useState<Omit<Journey, 'id' | 'user_id'>>({
        date: getTodayString(),
        start_at: '08:00',
        end_at: '18:00',
        meal_duration: 61, // Updated default to 61
        rest_duration: 0,
        is_feriado: false,
        is_day_off: false,
        km_start: 0,
        km_end: 0,
        rv_number: '',
        notes: '',
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (journey) {
            setFormData({
                date: journey.date,
                start_at: journey.start_at,
                end_at: journey.end_at,
                meal_duration: journey.meal_duration,
                rest_duration: journey.rest_duration || 0,
                is_feriado: journey.is_feriado,
                is_day_off: journey.is_day_off || false,
                km_start: journey.km_start || 0,
                km_end: journey.km_end || 0,
                rv_number: journey.rv_number || '',
                notes: journey.notes || '',
            });
        } else {
             // Reseta o formulário para um novo registro
             setFormData({
                date: getTodayString(),
                start_at: '08:00',
                end_at: '18:00',
                meal_duration: 61, // Updated default to 61
                rest_duration: 0,
                is_feriado: false,
                is_day_off: false,
                km_start: 0,
                km_end: 0,
                rv_number: '',
                notes: '',
            });
        }
    }, [journey, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        if (type === 'checkbox') {
            const { checked } = e.target as HTMLInputElement;
            setFormData(prev => ({ ...prev, [name]: checked }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const validateForm = () => {
        // If it's a day off, we skip time validation
        if (formData.is_day_off) return true;

        const startMinutes = timeToMinutes(formData.start_at);
        const endMinutes = timeToMinutes(formData.end_at);
        
        if (endMinutes > 0 && startMinutes > 0 && endMinutes < startMinutes) {
            const isNextDay = endMinutes < startMinutes;
            if(!isNextDay) {
                toast({ title: 'Horário Inválido', description: 'A hora final deve ser posterior à hora inicial.', variant: 'destructive' });
                return false;
            }
        }
        
        if (settings?.km_enabled) {
            const kmStart = Number(formData.km_start) || 0;
            const kmEnd = Number(formData.km_end) || 0;
            if (kmEnd > 0 && kmEnd < kmStart) {
                toast({ title: 'KM Inválido', description: 'A quilometragem final não pode ser menor que a inicial.', variant: 'destructive' });
                return false;
            }
        }
        
        return true;
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateForm()) return;
        
        setLoading(true);

        // If is_day_off is true, force time values to zero/default
        const finalData = formData.is_day_off ? {
            ...formData,
            start_at: '00:00',
            end_at: '00:00',
            meal_duration: 0,
            rest_duration: 0,
        } : formData;

        const dataToSave = {
            ...finalData,
            meal_duration: Number(finalData.meal_duration),
            rest_duration: Number(finalData.rest_duration),
            km_start: Number(finalData.km_start),
            km_end: Number(finalData.km_end),
        };
        
        let success;
        if (journey) {
            success = await updateJourney({ ...dataToSave, id: journey.id, user_id: journey.user_id });
        } else {
            success = await addJourney(dataToSave);
        }

        if (success) {
            onClose();
        }
        setLoading(false);
    };
    
    if (!isOpen) return null;
    
    const inputStyle = "w-full mt-1 p-4 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-dark/50 focus:border-primary-dark transition text-base shadow-sm";
    const labelStyle = "text-sm font-semibold text-gray-700 mb-1 block";
    const checkboxContainerStyle = "flex items-center h-14 px-4 bg-white border border-gray-200 rounded-xl cursor-pointer transition hover:bg-gray-50 shadow-sm";

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in-0" onClick={onClose}>
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col animate-in fade-in-0 zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b sticky top-0 bg-white z-10 flex-shrink-0 flex justify-between items-center rounded-t-3xl">
                    <h2 className="text-xl font-bold text-primary-dark">{journey ? 'Editar Jornada' : 'Nova Jornada'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-100 transition-colors"><X className="w-6 h-6 text-gray-500" /></button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto">
                    <form id="journey-form" onSubmit={handleSubmit}>
                        
                        {/* Checkboxes Section */}
                        <div className="grid grid-cols-2 gap-4 mb-6">
                             <label className={`${checkboxContainerStyle} ${formData.is_feriado ? 'border-primary bg-primary/5' : ''}`}>
                                <input 
                                    type="checkbox" 
                                    name="is_feriado" 
                                    checked={formData.is_feriado} 
                                    onChange={handleChange} 
                                    className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                                />
                                <span className="ml-3 font-medium text-gray-900">Feriado</span>
                            </label>
                            <label className={`${checkboxContainerStyle} ${formData.is_day_off ? 'border-primary bg-primary/5' : ''}`}>
                                <input 
                                    type="checkbox" 
                                    name="is_day_off" 
                                    checked={formData.is_day_off} 
                                    onChange={handleChange} 
                                    className="w-5 h-5 text-primary border-gray-300 rounded focus:ring-primary"
                                />
                                <span className="ml-3 font-medium text-gray-900">Folga</span>
                            </label>
                        </div>

                        {/* Date Field */}
                        <div className="mb-6">
                            <label className={labelStyle}>Data</label>
                            <input type="date" name="date" value={formData.date} onChange={handleChange} required className={inputStyle} />
                        </div>

                        {/* Conditional Fields based on is_day_off */}
                        {!formData.is_day_off && (
                            <>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className={labelStyle}>Início</label>
                                        <input type="time" name="start_at" value={formData.start_at} onChange={handleChange} required className={inputStyle} />
                                    </div>
                                    <div>
                                        <label className={labelStyle}>Fim</label>
                                        <input type="time" name="end_at" value={formData.end_at} onChange={handleChange} required className={inputStyle} />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4 mb-6">
                                     <div>
                                        <label className={labelStyle}>Refeição (min)</label>
                                        <input type="number" name="meal_duration" value={formData.meal_duration} onChange={handleChange} required className={inputStyle} />
                                    </div>
                                     <div>
                                        <label className={labelStyle}>Descanso (min)</label>
                                        <input type="number" name="rest_duration" value={formData.rest_duration} onChange={handleChange} className={inputStyle} />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* KM Fields - Always visible if enabled in settings */}
                        {settings?.km_enabled && (
                         <div className="grid grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className={labelStyle}>KM Inicial</label>
                                <input type="number" step="0.1" name="km_start" value={formData.km_start} onChange={handleChange} className={inputStyle} />
                            </div>
                             <div>
                                <label className={labelStyle}>KM Final</label>
                                <input type="number" step="0.1" name="km_end" value={formData.km_end} onChange={handleChange} className={inputStyle} />
                            </div>
                        </div>
                        )}

                        {/* Optional Fields */}
                        <div className="space-y-6">
                            <div>
                                <label className={labelStyle}>Nº do RV (opcional)</label>
                                <input type="text" name="rv_number" value={formData.rv_number} onChange={handleChange} className={inputStyle} placeholder="Ex: 12345" />
                            </div>
                            <div>
                                <label className={labelStyle}>Notas (opcional)</label>
                                <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={`${inputStyle} h-auto min-h-[100px] resize-y`} placeholder="Observações sobre o dia..."></textarea>
                            </div>
                        </div>
                    </form>
                </div>
                <div className="p-6 border-t bg-gray-50 rounded-b-3xl flex justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-6 py-3 bg-white border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors shadow-sm text-base">Cancelar</button>
                    <button type="submit" form="journey-form" disabled={loading} className="px-6 py-3 bg-primary text-white font-bold rounded-xl shadow-md hover:bg-primary-dark transition-transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center min-w-[120px] text-base">
                        {loading ? <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div> : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JourneyFormModal;