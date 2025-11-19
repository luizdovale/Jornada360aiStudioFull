import React, { useState, useEffect } from 'react';
import { useJourneys } from '../contexts/JourneyContext';
import { useToast } from '../hooks/useToast';
import { Journey } from '../types';
import { X } from 'lucide-react';

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
        date: new Date().toISOString().split('T')[0],
        start_at: '08:00',
        end_at: '18:00',
        meal_duration: 61,
        rest_duration: 0,
        is_feriado: false,
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
                km_start: journey.km_start || 0,
                km_end: journey.km_end || 0,
                rv_number: journey.rv_number || '',
                notes: journey.notes || '',
            });
        } else {
             // Reseta o formulário para um novo registro
             setFormData({
                date: new Date().toISOString().split('T')[0],
                start_at: '08:00',
                end_at: '18:00',
                meal_duration: 60,
                rest_duration: 0,
                is_feriado: false,
                km_start: 0,
                km_end: 0,
                rv_number: '',
                notes: '',
            });
        }
    }, [journey, isOpen]); // Roda o efeito quando o modal abre

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
        const startMinutes = timeToMinutes(formData.start_at);
        const endMinutes = timeToMinutes(formData.end_at);
        
        // CORREÇÃO: A lógica anterior bloqueava incorretamente o caso em que a hora final
        // é EXATAMENTE IGUAL à hora inicial. Esta correção permite o registro de
        // jornadas com duração zero, tratando apenas viradas de dia.
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
        e.preventDefault(); // Previne o envio padrão do formulário
        if (!validateForm()) return;
        
        setLoading(true);
        const dataToSave = {
            ...formData,
            meal_duration: Number(formData.meal_duration),
            rest_duration: Number(formData.rest_duration),
            km_start: Number(formData.km_start),
            km_end: Number(formData.km_end),
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
    
    const inputStyle = "w-full mt-1 p-3 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-dark/50 focus:border-primary-dark transition";

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-in fade-in-0" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-lg w-full max-w-md max-h-[90vh] overflow-y-auto flex flex-col animate-in fade-in-0 zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b sticky top-0 bg-white z-10 flex-shrink-0">
                    <div className="flex justify-between items-center">
                        <h2 className="text-lg font-bold text-primary-dark">{journey ? 'Editar Jornada' : 'Nova Jornada'}</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X /></button>
                    </div>
                </div>
                <div className="p-6 space-y-4 overflow-y-auto">
                    <form id="journey-form" onSubmit={handleSubmit}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Data</label>
                                <input type="date" name="date" value={formData.date} onChange={handleChange} required className={inputStyle} />
                            </div>
                             <div>
                                <label className="text-xs font-medium text-muted-foreground">Feriado?</label>
                                <div className="mt-1 p-3 flex items-center h-[50px] bg-white border border-gray-200 rounded-lg">
                                    <input type="checkbox" id="is_feriado" name="is_feriado" checked={formData.is_feriado} onChange={handleChange} className="h-5 w-5 rounded text-primary focus:ring-primary" />
                                    <label htmlFor="is_feriado" className="ml-2 text-gray-700 text-sm">Sim, foi feriado</label>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Início</label>
                                <input type="time" name="start_at" value={formData.start_at} onChange={handleChange} required className={inputStyle} />
                            </div>
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">Fim</label>
                                <input type="time" name="end_at" value={formData.end_at} onChange={handleChange} required className={inputStyle} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label className="text-xs font-medium text-muted-foreground">Refeição (min)</label>
                                <input type="number" name="meal_duration" value={formData.meal_duration} onChange={handleChange} required className={inputStyle} />
                            </div>
                             <div>
                                <label className="text-xs font-medium text-muted-foreground">Descanso (min)</label>
                                <input type="number" name="rest_duration" value={formData.rest_duration} onChange={handleChange} className={inputStyle} />
                            </div>
                        </div>
                        {settings?.km_enabled && (
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-medium text-muted-foreground">KM Inicial</label>
                                <input type="number" step="0.1" name="km_start" value={formData.km_start} onChange={handleChange} className={inputStyle} />
                            </div>
                             <div>
                                <label className="text-xs font-medium text-muted-foreground">KM Final</label>
                                <input type="number" step="0.1" name="km_end" value={formData.km_end} onChange={handleChange} className={inputStyle} />
                            </div>
                        </div>
                        )}
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Nº do RV (opcional)</label>
                            <input type="text" name="rv_number" value={formData.rv_number} onChange={handleChange} className={inputStyle} />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-muted-foreground">Notas (opcional)</label>
                            <textarea name="notes" value={formData.notes} onChange={handleChange} rows={3} className={`${inputStyle} h-auto`}></textarea>
                        </div>
                    </form>
                </div>
                <div className="p-6 border-t mt-auto bg-gray-50 flex-shrink-0">
                    <div className="flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors">Cancelar</button>
                        <button type="submit" form="journey-form" disabled={loading} className="px-4 py-2 bg-primary-medium text-primary-dark font-bold rounded-lg disabled:opacity-50 flex items-center justify-center min-w-[100px] hover:brightness-95 transition-transform active:scale-[0.98]">
                            {loading ? <div className="w-5 h-5 border-2 border-t-transparent border-primary-dark rounded-full animate-spin"></div> : 'Salvar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JourneyFormModal;
