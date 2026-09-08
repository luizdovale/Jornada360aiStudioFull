import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Journey, Settings } from '../types';
import { useAuth } from './AuthContext';
import { useToast } from '../hooks/useToast';

// Chaves para o localStorage, isoladas por usuário (evita que, num dispositivo
// compartilhado, os dados de uma conta apareçam brevemente para a próxima que logar)
const journeysCacheKey = (userId: string) => `jornada360-journeys-${userId}`;
const settingsCacheKey = (userId: string) => `jornada360-settings-${userId}`;

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

    // O usuário só é conhecido de forma assíncrona (via AuthContext), então o cache
    // não pode ser lido de forma síncrona no primeiro render — ele é hidratado no
    // efeito abaixo, já isolado pelo id do usuário logado.
    const [journeys, setJourneys] = useState<Journey[]>([]);
    const [settings, setSettings] = useState<Settings | null>(null);

    const [loading, setLoading] = useState(true);

    // Hidrata do cache local assim que soubermos qual usuário está logado
    useEffect(() => {
        if (!user) return;
        try {
            const cachedJourneys = localStorage.getItem(journeysCacheKey(user.id));
            if (cachedJourneys) setJourneys(JSON.parse(cachedJourneys));
        } catch (error) {
            console.error("Failed to parse journeys from localStorage", error);
        }
        try {
            const cachedSettings = localStorage.getItem(settingsCacheKey(user.id));
            if (cachedSettings) setSettings(JSON.parse(cachedSettings));
        } catch (error) {
            console.error("Failed to parse settings from localStorage", error);
        }
    }, [user?.id]);

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
            localStorage.setItem(journeysCacheKey(user.id), JSON.stringify(journeysData || []));

            // Carrega as configurações
            const { data: settingsData, error: settingsError } = await supabase
                .from('settings')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (settingsError) {
                 throw settingsError;
            }
            setSettings(settingsData);
            localStorage.setItem(settingsCacheKey(user.id), JSON.stringify(settingsData));

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
            // Limpa os dados em memória se o usuário deslogar (o cache em localStorage já é
            // isolado por user_id, então não precisa ser removido — só não é mais lido)
            setJourneys([]);
            setSettings(null);
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
            .maybeSingle();

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
            localStorage.setItem(journeysCacheKey(user.id), JSON.stringify(updatedJourneys));
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
            if (user) localStorage.setItem(journeysCacheKey(user.id), JSON.stringify(updatedJourneys));
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
        if (user) localStorage.setItem(journeysCacheKey(user.id), JSON.stringify(updatedJourneys));
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
            localStorage.setItem(settingsCacheKey(user.id), JSON.stringify(data));
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
