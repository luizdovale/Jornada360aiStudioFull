
import React, { useState, useEffect } from 'react';
import { useJourneys } from '../contexts/JourneyContext';
import { useToast } from '../hooks/useToast';
import { Journey } from '../types';
import { X, CalendarOff } from 'lucide-react';

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

// Interface local para o estado do formulário, permitindo strings vazias nos campos numéricos para melhor UX
interface JourneyFormData {
    date: string;
    start_at: string;
    end_at: string;
    meal_duration: number | string;
    rest_duration: number | string;
    is_feriado: boolean;
    is_day_off: boolean;
    km_start: number | string;
    km_end: number | string;
    rv_number: string;
    notes: string;
}

const JourneyFormModal: React.FC<JourneyFormModalProps> = ({ isOpen, onClose, journey }) => {
    const { addJourney, updateJourney, settings } = useJourneys();
    const { toast } = useToast();
    
    const [formData, setFormData] = useState<JourneyFormData>({
        date: getTodayString(),
        start_at: '08:00',
        end_at: '18:00',
        meal_duration: 61, 
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
        if (journey) {
            setFormData({
                date: journey.date,
                start_at: journey.start_at,
                end_at: journey.end_at,
                meal_duration: journey.meal_duration,
                rest_duration: journey.rest_duration || '', 
                is_feriado: journey.is_feriado,
                is_day_off: journey.is_day_off || false,
                km_start: journey.km_start !== undefined ? journey.km_start : '',
                km_end: journey.km_end !== undefined ? journey.km_end : '',
                rv_number: journey.rv_number || '',
                notes: journey.notes || '',
            });
        } else {
             // Reseta o formulário para um novo registro
             setFormData({
                date: getTodayString(),
                start_at: '08:00',
                end_at: '18:00',
                meal_duration: 61,
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
        // Se for dia de folga, não valida horários
        if (formData.is_day_off) return true;
        
        // A validação de horário foi removida para permitir jornadas que cruzam a meia-noite (ex: 22:00 às 05:00).
        // O cálculo em utils.ts já lida com isso corretamente.
        
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
        
        // Se for dia de folga, força horários zerados
        const finalFormData = formData.is_day_off ? {
            ...formData,
            start_at: '00:00',
            end_at: '00:00',
            meal_duration: 0,
            rest_duration: 0,
        } : formData;

        // Converte strings vazias para 0 antes de enviar para o banco
        const dataToSave = {
            ...finalFormData,
            meal_duration: Number(finalFormData.meal_duration) || 0,
            rest_duration: Number(finalFormData.rest_duration) || 0,
            km_start: Number(finalFormData.km_start) || 0,
            km_end: Number(finalFormData.km_end) || 0,
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
    
    const inputStyle = "w-full mt-1 p-3 bg-white border border-gray-400 rounded-lg shadow-sm text-primary-dark font-medium focus:ring-2 focus:ring-primary-dark/50 focus:border-primary-dark transition placeholder-gray-400";

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in-0" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col animate-in fade-in-0 zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b sticky top-0 bg-white z-10 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-primary-dark">{journey ? 'Editar Jornada' : 'Nova Jornada'}</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X /></button>
                    </div>
                </div>
                <div className="p-6 space-y-5 overflow-y-auto">
                    <form id="journey-form" onSubmit={handleSubmit}>
                        
                        {/* SEÇÃO DIA DE FOLGA */}
                        <div className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-300 shadow-sm">
                            <div className="flex items-center">
                                <div className="relative flex items-center">
                                    <input
                                        type="checkbox"
                                        id="is_day_off"
                                        name="is_day_off"
                                        checked={formData.is_day_off}
                                        onChange={handleChange}
                                        className="h-6 w-6 rounded border-gray-400 text-primary focus:ring-primary cursor-pointer"
                                    />
                                </div>
                                <label htmlFor="is_day_off" className="ml-3 text-lg font-bold text-gray-800 cursor-pointer flex items-center gap-2 select-none">
                                    <CalendarOff className="w-5 h-5 text-gray-600" />
                                    Marcar como Folga
                                </label>
                            </div>
                            <p className="text-xs text-gray-500 mt-2 pl-9">Ative se você não trabalhou nesta data.</p>
                        </div>

                        {/* DATA E FERIADO */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Data</label>
                                <input type="date" name="date" value={formData.date} onChange={handleChange} required className={inputStyle} />
                            </div>
                             <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Feriado?</label>
                                <div className={`mt-1 p-3 flex items-center h-[52px] bg-white border border-gray-400 rounded-lg shadow-sm ${formData.is_day_off ? 'opacity-50 pointer-events-none' : ''}`}>
                                    <input type="checkbox" id="is_feriado" name="is_feriado" checked={formData.is_feriado} onChange={handleChange} className="h-5 w-5 rounded border-gray-400 text-primary focus:ring-primary" />
                                    <label htmlFor="is_feriado" className="ml-2 text-gray-700 text-sm font-medium select-none">Sim, feriado</label>
                                </div>
                            </div>
                        </div>

                        {/* CAMPOS DE HORÁRIO (Escondidos se for folga) */}
                        {!formData.is_day_off && (
                            <>
                                <div className="grid grid-cols-2 gap-8 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Início</label>
                                        <input type="time" name="start_at" value={formData.start_at} onChange={handleChange} required className={inputStyle} />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Fim</label>
                                        <input type="time" name="end_at" value={formData.end_at} onChange={handleChange} required className={inputStyle} />
                                    </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-6 mb-4 animate-in fade-in slide-in-from-top-2 duration-300">
                                     <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Refeição (min)</label>
                                        <input 
                                            type="number" 
                                            name="meal_duration" 
                                            value={formData.meal_duration} 
                                            onChange={handleChange} 
                                            required 
                                            className={inputStyle} 
                                            placeholder="61"
                                        />
                                    </div>
                                     <div>
                                        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Descanso (min)</label>
                                        <input 
                                            type="number" 
                                            name="rest_duration" 
                                            value={formData.rest_duration} 
                                            onChange={handleChange} 
                                            className={inputStyle}
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* KM, RV e NOTAS */}
                        {settings?.km_enabled && (
                         <div className="grid grid-cols-2 gap-6 mb-4">
                            <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">KM Inicial</label>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    name="km_start" 
                                    value={formData.km_start} 
                                    onChange={handleChange} 
                                    className={inputStyle}
                                    placeholder="0"
                                />
                            </div>
                             <div>
                                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">KM Final</label>
                                <input 
                                    type="number" 
                                    step="0.1" 
                                    name="km_end" 
                                    value={formData.km_end} 
                                    onChange={handleChange} 
                                    className={inputStyle}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        )}
                        <div className="mb-4">
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Nº do RV (opcional)</label>
                            <input type="text" name="rv_number" value={formData.rv_number} onChange={handleChange} className={inputStyle} placeholder="Ex: 12345" />
                        </div>
                        <div>
                            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1 block">Notas (opcional)</label>
                            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={`${inputStyle} h-auto`} placeholder="Observações adicionais..."></textarea>
                        </div>
                    </form>
                </div>
                <div className="p-6 border-t mt-auto bg-gray-50 flex-shrink-0">
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-100 transition-colors shadow-sm">Cancelar</button>
                        <button type="submit" form="journey-form" disabled={loading} className="px-6 py-2 bg-primary-medium text-primary-dark font-bold rounded-lg disabled:opacity-50 flex items-center justify-center min-w-[120px] hover:brightness-95 transition-transform active:scale-[0.98] shadow-md border border-transparent">
                            {loading ? <div className="w-5 h-5 border-2 border-t-transparent border-primary-dark rounded-full animate-spin"></div> : 'Salvar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JourneyFormModal;
