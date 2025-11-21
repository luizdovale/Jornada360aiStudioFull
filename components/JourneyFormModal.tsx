
import React, { useState, useEffect } from 'react';
import { useJourneys } from '../contexts/JourneyContext';
import { useToast } from '../hooks/useToast';
import { Journey } from '../types';
import { X, Coffee, Clock, Map, FileText, Calendar, Check } from 'lucide-react';

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

// Helper type for form state where number fields can be empty strings for UI purposes
type JourneyFormState = Omit<Journey, 'id' | 'user_id' | 'rest_duration' | 'km_start' | 'km_end' | 'meal_start' | 'meal_end'> & {
    rest_duration: number | string;
    km_start: number | string;
    km_end: number | string;
    is_day_off: boolean;
    meal_start: string;
    meal_end: string;
};

const JourneyFormModal: React.FC<JourneyFormModalProps> = ({ isOpen, onClose, journey }) => {
    const { addJourney, updateJourney, settings } = useJourneys();
    const { toast } = useToast();
    
    // Initialize state with potentially empty strings for optional number fields
    const [formData, setFormData] = useState<JourneyFormState>({
        date: getTodayString(),
        start_at: '08:00',
        end_at: '18:00',
        meal_start: '12:00', // Valor padrão
        meal_end: '13:00',   // Valor padrão
        meal_duration: 60, 
        rest_duration: '', // Start empty
        is_feriado: false,
        is_day_off: false,
        km_start: '', // Start empty
        km_end: '', // Start empty
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
                meal_start: journey.meal_start || '12:00',
                meal_end: journey.meal_end || '13:00',
                meal_duration: journey.meal_duration,
                rest_duration: journey.rest_duration !== undefined && journey.rest_duration !== 0 ? journey.rest_duration : '',
                is_feriado: journey.is_feriado,
                is_day_off: journey.is_day_off || false,
                km_start: journey.km_start !== undefined && journey.km_start !== 0 ? journey.km_start : '',
                km_end: journey.km_end !== undefined && journey.km_end !== 0 ? journey.km_end : '',
                rv_number: journey.rv_number || '',
                notes: journey.notes || '',
            });
        } else {
             // Reseta o formulário para um novo registro
             setFormData({
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
                toast({ title: 'Horário Inválido', description: 'A hora final da jornada deve ser posterior à hora inicial.', variant: 'destructive' });
                return false;
            }
        }

        // Validação da Refeição
        const mealStartMinutes = timeToMinutes(formData.meal_start);
        const mealEndMinutes = timeToMinutes(formData.meal_end);

        if (mealEndMinutes <= mealStartMinutes) {
             toast({ title: 'Horário de Refeição Inválido', description: 'O fim da refeição deve ser após o início.', variant: 'destructive' });
             return false;
        }
        
        if (settings?.km_enabled) {
            const kmStart = formData.km_start === '' ? 0 : Number(formData.km_start);
            const kmEnd = formData.km_end === '' ? 0 : Number(formData.km_end);
            
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

        // Calcula a duração da refeição
        const mealStartMinutes = timeToMinutes(formData.meal_start);
        const mealEndMinutes = timeToMinutes(formData.meal_end);
        const calculatedMealDuration = mealEndMinutes - mealStartMinutes;

        // Se for dia de folga, reseta os horários para 00:00 e durações para 0
        const dataToProcess = formData.is_day_off ? {
            ...formData,
            start_at: '00:00',
            end_at: '00:00',
            meal_start: '00:00',
            meal_end: '00:00',
            meal_duration: 0,
            rest_duration: 0,
        } : {
            ...formData,
            meal_duration: calculatedMealDuration
        };

        // Convert empty strings back to 0 for submission
        const dataToSave: Omit<Journey, 'id' | 'user_id'> = {
            ...dataToProcess,
            meal_duration: Number(dataToProcess.meal_duration),
            rest_duration: dataToProcess.rest_duration === '' ? 0 : Number(dataToProcess.rest_duration),
            is_day_off: dataToProcess.is_day_off,
            km_start: dataToProcess.km_start === '' ? 0 : Number(dataToProcess.km_start),
            km_end: dataToProcess.km_end === '' ? 0 : Number(dataToProcess.km_end),
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
    
    // Estilos Mobile-First Aprimorados
    const inputContainerStyle = "relative";
    const inputIconStyle = "absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5";
    const inputStyle = "w-full pl-12 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none text-base text-gray-800 placeholder-gray-400 shadow-sm";
    const labelStyle = "text-sm font-semibold text-gray-600 mb-2 block ml-1";
    
    // Estilo especial para os toggles
    const toggleLabelStyle = (checked: boolean, colorClass: string = "border-primary bg-primary/5 text-primary") => `
        relative flex items-center justify-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 shadow-sm
        ${checked ? colorClass : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'}
    `;

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in-0" onClick={onClose}>
            <div className="bg-white w-full sm:max-w-lg sm:rounded-3xl rounded-t-3xl shadow-2xl max-h-[95vh] flex flex-col animate-in slide-in-from-bottom-10 sm:zoom-in-95 duration-300" onClick={e => e.stopPropagation()}>
                
                {/* Header Fixo */}
                <div className="p-5 border-b flex justify-between items-center bg-white rounded-t-3xl z-10">
                    <h2 className="text-xl font-bold text-primary-dark">{journey ? 'Editar Jornada' : 'Nova Jornada'}</h2>
                    <button onClick={onClose} className="p-2 rounded-full bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>
                
                {/* Corpo com Scroll */}
                <div className="p-6 overflow-y-auto flex-1">
                    <form id="journey-form" onSubmit={handleSubmit} className="flex flex-col gap-6">
                        
                        {/* Toggle Cards */}
                        <div className="grid grid-cols-2 gap-4">
                             <label className={toggleLabelStyle(formData.is_feriado, "border-yellow-500 bg-yellow-50 text-yellow-700")}>
                                <input 
                                    type="checkbox" 
                                    name="is_feriado" 
                                    checked={formData.is_feriado} 
                                    onChange={handleChange} 
                                    className="hidden"
                                />
                                {formData.is_feriado && <Check className="w-4 h-4 mr-2" />}
                                <span className="font-bold">Feriado</span>
                            </label>

                            <label className={toggleLabelStyle(formData.is_day_off, "border-red-500 bg-red-50 text-red-700")}>
                                <input 
                                    type="checkbox" 
                                    name="is_day_off" 
                                    checked={formData.is_day_off} 
                                    onChange={handleChange} 
                                    className="hidden"
                                />
                                {formData.is_day_off && <Check className="w-4 h-4 mr-2" />}
                                <span className="font-bold">Dia de Folga</span>
                            </label>
                        </div>

                        {/* Data */}
                        <div className={inputContainerStyle}>
                            <label className={labelStyle}>Data</label>
                            <div className="relative">
                                <Calendar className={inputIconStyle} />
                                <input 
                                    type="date" 
                                    name="date" 
                                    value={formData.date} 
                                    onChange={handleChange} 
                                    required 
                                    className={inputStyle} 
                                />
                            </div>
                        </div>

                        {/* Inputs de Horário (ocultos se for folga) */}
                        {!formData.is_day_off && (
                            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="grid grid-cols-2 gap-5">
                                    <div className={inputContainerStyle}>
                                        <label className={labelStyle}>Início Jornada</label>
                                        <div className="relative">
                                            <Clock className={inputIconStyle} />
                                            <input 
                                                type="time" 
                                                name="start_at" 
                                                value={formData.start_at} 
                                                onChange={handleChange} 
                                                required 
                                                className={inputStyle} 
                                            />
                                        </div>
                                    </div>
                                    <div className={inputContainerStyle}>
                                        <label className={labelStyle}>Fim Jornada</label>
                                        <div className="relative">
                                            <Clock className={inputIconStyle} />
                                            <input 
                                                type="time" 
                                                name="end_at" 
                                                value={formData.end_at} 
                                                onChange={handleChange} 
                                                required 
                                                className={inputStyle} 
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-5">
                                     <div className={inputContainerStyle}>
                                        <label className={labelStyle}>Início Refeição</label>
                                        <div className="relative">
                                            <Coffee className={inputIconStyle} />
                                            <input 
                                                type="time" 
                                                name="meal_start" 
                                                value={formData.meal_start} 
                                                onChange={handleChange} 
                                                required 
                                                className={inputStyle} 
                                            />
                                        </div>
                                    </div>
                                     <div className={inputContainerStyle}>
                                        <label className={labelStyle}>Fim Refeição</label>
                                        <div className="relative">
                                            <Coffee className={inputIconStyle} />
                                            <input 
                                                type="time" 
                                                name="meal_end" 
                                                value={formData.meal_end} 
                                                onChange={handleChange} 
                                                required
                                                className={inputStyle} 
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Descanso permanece numérico/opcional */}
                                <div className={inputContainerStyle}>
                                    <label className={labelStyle}>Descanso Adicional (min)</label>
                                    <div className="relative">
                                        <Coffee className={inputIconStyle} />
                                        <input 
                                            type="number" 
                                            name="rest_duration" 
                                            value={formData.rest_duration} 
                                            onChange={handleChange} 
                                            className={inputStyle} 
                                            placeholder="Opcional"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* KM Inputs */}
                        {settings?.km_enabled && (
                         <div className="grid grid-cols-2 gap-5">
                            <div className={inputContainerStyle}>
                                <label className={labelStyle}>KM Inicial</label>
                                <div className="relative">
                                    <Map className={inputIconStyle} />
                                    <input 
                                        type="number" 
                                        step="0.1" 
                                        name="km_start" 
                                        value={formData.km_start} 
                                        onChange={handleChange} 
                                        className={inputStyle} 
                                        placeholder="Opcional"
                                    />
                                </div>
                            </div>
                             <div className={inputContainerStyle}>
                                <label className={labelStyle}>KM Final</label>
                                <div className="relative">
                                    <Map className={inputIconStyle} />
                                    <input 
                                        type="number" 
                                        step="0.1" 
                                        name="km_end" 
                                        value={formData.km_end} 
                                        onChange={handleChange} 
                                        className={inputStyle} 
                                        placeholder="Opcional"
                                    />
                                </div>
                            </div>
                        </div>
                        )}

                        {/* Detalhes Adicionais */}
                        <div className="space-y-6">
                            <div className={inputContainerStyle}>
                                <label className={labelStyle}>Nº do RV (opcional)</label>
                                <div className="relative">
                                    <FileText className={inputIconStyle} />
                                    <input 
                                        type="text" 
                                        name="rv_number" 
                                        value={formData.rv_number} 
                                        onChange={handleChange} 
                                        className={inputStyle} 
                                        placeholder="Ex: 12345" 
                                    />
                                </div>
                            </div>
                            <div className={inputContainerStyle}>
                                <label className={labelStyle}>Notas (opcional)</label>
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

                {/* Footer Fixo */}
                <div className="p-5 border-t bg-white flex gap-3 sticky bottom-0">
                    <button type="button" onClick={onClose} className="flex-1 py-4 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors text-lg">
                        Cancelar
                    </button>
                    <button type="submit" form="journey-form" disabled={loading} className="flex-1 py-4 bg-primary text-white font-bold rounded-xl shadow-lg hover:bg-primary-dark transition-transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed text-lg">
                        {loading ? 'Salvando...' : 'Salvar'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default JourneyFormModal;
