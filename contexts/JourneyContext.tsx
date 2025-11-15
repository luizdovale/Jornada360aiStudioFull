import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Journey, Settings } from '../types';
import { useAuth } from './AuthContext';
import { useToast } from '../hooks/useToast';

// Chaves para o localStorage
const JOURNEYS_CACHE_KEY = 'jornada360-journeys';
const SETTINGS_CACHE_KEY = 'jornada360-settings';

interface JourneyContextType {
    journeys: Journey[];
    settings: Settings | null;
    loading: boolean;
    fetchData: () => Promise<void>;
    addJourney: (journey: Omit<Journey, 'id' | 'user_id'>) => Promise<boolean>;
    updateJourney: (journey: Journey) => Promise<boolean>;
    deleteJourney: (id: string) => Promise<boolean>;
    saveSettings: (settings: Omit<Settings, 'user_id' | 'id'>) => Promise<boolean>;
}

const JourneyContext = createContext<JourneyContextType | undefined>(undefined);

export const JourneyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    
    // Inicia o estado com dados do localStorage, se disponíveis
    const [journeys, setJourneys] = useState<Journey[]>(() => {
        try {
            const cachedJourneys = localStorage.getItem(JOURNEYS_CACHE_KEY);
            return cachedJourneys ? JSON.parse(cachedJourneys) : [];
        } catch (error) {
            console.error("Failed to parse journeys from localStorage", error);
            return [];
        }
    });
    const [settings, setSettings] = useState<Settings | null>(() => {
        try {
            const cachedSettings = localStorage.getItem(SETTINGS_CACHE_KEY);
            return cachedSettings ? JSON.parse(cachedSettings) : null;
        } catch (error) {
            console.error("Failed to parse settings from localStorage", error);
            return null;
        }
    });

    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Carrega as jornadas
            const { data: journeysData, error: journeysError } = await supabase
                .from('journeys')
                .select('*')
                .eq('user_id', user.id)
                .order('date', { ascending: false });

            if (journeysError) throw journeysError;
            setJourneys(journeysData || []);
            localStorage.setItem(JOURNEYS_CACHE_KEY, JSON.stringify(journeysData || []));

            // Carrega as configurações
            const { data: settingsData, error: settingsError } = await supabase
                .from('settings')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (settingsError && settingsError.code !== 'PGRST116') { // Ignora erro "No rows found"
                 throw settingsError;
            }
            setSettings(settingsData);
            localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(settingsData));

        } catch (error: any) {
            console.error('Erro ao carregar dados:', error);
            toast({ title: "Erro ao carregar dados", description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [user, toast]);

    useEffect(() => {
        if (user) {
            fetchData();
        } else {
            // Limpa os dados e o cache se o usuário deslogar
            setJourneys([]);
            setSettings(null);
            localStorage.removeItem(JOURNEYS_CACHE_KEY);
            localStorage.removeItem(SETTINGS_CACHE_KEY);
            setLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    const addJourney = async (journeyData: Omit<Journey, 'id' | 'user_id'>): Promise<boolean> => {
        if (!user) return false;

        // VALIDAÇÃO LOCAL: Checa se já existe uma jornada para a data selecionada no estado atual.
        // Isso previne duplicidade de forma instantânea, funcionando perfeitamente no modo mock e
        // fornecendo um feedback mais rápido ao usuário no ambiente real.
        if (journeys.some(j => j.date === journeyData.date)) {
            toast({ title: 'Jornada já existe', description: 'Já existe uma jornada registrada para esta data.', variant: 'destructive' });
            return false;
        }

        // A verificação abaixo, contra o banco de dados, é mantida como uma segunda camada de segurança
        // para o ambiente real, cobrindo casos de race condition ou cache local desatualizado.
        const { data: existing } = await supabase
            .from('journeys')
            .select('id')
            .eq('user_id', user.id)
            .eq('date', journeyData.date)
            .single();

        if (existing) {
            toast({ title: 'Jornada já existe', description: 'Já existe uma jornada registrada para esta data.', variant: 'destructive' });
            return false;
        }

        const { data, error } = await supabase
            .from('journeys')
            .insert({ ...journeyData, user_id: user.id })
            .select()
            .single();
        
        if (error) {
            toast({ title: 'Erro ao adicionar jornada', description: error.message, variant: 'destructive' });
            return false;
        }
        if (data) {
            const updatedJourneys = [data, ...journeys].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            setJourneys(updatedJourneys);
            localStorage.setItem(JOURNEYS_CACHE_KEY, JSON.stringify(updatedJourneys));
            toast({ title: 'Sucesso!', description: 'Jornada adicionada com sucesso.' });
            return true;
        }
        return false;
    };

    const updateJourney = async (journey: Journey): Promise<boolean> => {
        const { data, error } = await supabase
            .from('journeys')
            .update(journey)
            .eq('id', journey.id)
            .select()
            .single();

        if (error) {
            toast({ title: 'Erro ao atualizar jornada', description: error.message, variant: 'destructive' });
            return false;
        }
        if (data) {
            const updatedJourneys = journeys.map(j => (j.id === data.id ? data : j));
            setJourneys(updatedJourneys);
            localStorage.setItem(JOURNEYS_CACHE_KEY, JSON.stringify(updatedJourneys));
            toast({ title: 'Sucesso!', description: 'Jornada atualizada com sucesso.' });
            return true;
        }
        return false;
    };

    const deleteJourney = async (id: string): Promise<boolean> => {
        const { error } = await supabase.from('journeys').delete().eq('id', id);

        if (error) {
            toast({ title: 'Erro ao deletar jornada', description: error.message, variant: 'destructive' });
            return false;
        }
        const updatedJourneys = journeys.filter(j => j.id !== id);
        setJourneys(updatedJourneys);
        localStorage.setItem(JOURNEYS_CACHE_KEY, JSON.stringify(updatedJourneys));
        toast({ title: 'Sucesso!', description: 'Jornada deletada.' });
        return true;
    };

    const saveSettings = async (newSettings: Omit<Settings, 'user_id' | 'id'>): Promise<boolean> => {
        if (!user) return false;
        
        const settingsPayload = {
            ...newSettings,
            user_id: user.id,
        };
        
        // CORREÇÃO: O comando `upsert` no Supabase real precisa saber em qual coluna
        // verificar o conflito para saber se deve INSERIR ou ATUALIZAR.
        // A falta disso era o erro principal que impedia as configurações de serem salvas.
        const { data, error } = await supabase
            .from('settings')
            .upsert(settingsPayload, {
                onConflict: 'user_id',
            })
            .select()
            .single();

        if (error) {
            toast({ title: 'Erro ao salvar configurações', description: error.message, variant: 'destructive' });
            return false;
        }
        if (data) {
            setSettings(data);
            localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(data));
            toast({ title: 'Sucesso!', description: 'Configurações salvas.' });
            return true;
        }
        return false;
    };


    return (
        <JourneyContext.Provider value={{ journeys, settings, loading, fetchData, addJourney, updateJourney, deleteJourney, saveSettings }}>
            {children}
        </JourneyContext.Provider>
    );
};

export const useJourneys = () => {
    const context = useContext(JourneyContext);
    if (context === undefined) {
        throw new Error('useJourneys must be used within a JourneyProvider');
    }
    return context;
};
