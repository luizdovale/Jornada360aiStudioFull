import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useJourneys } from '../contexts/JourneyContext';
import { useToast } from '../hooks/useToast';
import { Settings } from '../types';

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { settings, saveSettings, loading: contextLoading } = useJourneys();
    const { toast } = useToast();
    const [formData, setFormData] = useState<Omit<Settings, 'id' | 'user_id'>>({
        jornada_base: 480,
        km_enabled: true,
        month_start_day: 21,
        escala_pattern: '6x1',
        escala_start_date: new Date().toISOString().split('T')[0],
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (settings) {
            setFormData({
                jornada_base: settings.jornada_base,
                km_enabled: settings.km_enabled,
                month_start_day: settings.month_start_day,
                escala_pattern: settings.escala_pattern,
                escala_start_date: settings.escala_start_date || new Date().toISOString().split('T')[0],
            });
        }
    }, [settings]);

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
        setLoading(true);
        const dataToSave = {
            ...formData,
            jornada_base: Number(formData.jornada_base),
            month_start_day: Number(formData.month_start_day),
        };
        const success = await saveSettings(dataToSave);
        if (success) {
            // Navega para a home após salvar com sucesso
            navigate('/');
        }
        setLoading(false);
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

    return (
        <div className="space-y-6">
            <h1 className="text-title-lg text-primary-dark">Configurações</h1>
            <div className="bg-white p-6 rounded-2xl shadow-card">
                <form onSubmit={handleSubmit} className="space-y-4">
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
                    
                    <div className="pt-4 text-right">
                        <button type="submit" disabled={loading} className="inline-flex justify-center rounded-md border border-transparent bg-primary-medium text-primary-dark font-bold py-2 px-4 text-sm shadow-sm hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:ring-offset-2 disabled:opacity-50 transition-transform active:scale-[0.98]">
                            {loading ? 'Salvando...' : 'Salvar Alterações'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SettingsPage;
