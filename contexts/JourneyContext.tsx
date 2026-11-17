import React, { createContext, useState, useEffect, useContext, ReactNode, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Journey, Settings, SettingsVersion, AccountingPeriod, VERSIONED_SETTINGS_FIELDS } from '../types';
import { useAuth } from './AuthContext';
import { useToast } from '../hooks/useToast';
import {
    SETTINGS_BASELINE_DATE,
    SettingsAt,
    buildPeriodResolver,
    getLocalDateString,
    resolveSettingsAt,
    sortSettingsVersions,
} from '../lib/utils';

// Chaves para o localStorage, isoladas por usuário (evita que, num dispositivo
// compartilhado, os dados de uma conta apareçam brevemente para a próxima que logar)
const journeysCacheKey = (userId: string) => `jornada360-journeys-${userId}`;
const settingsCacheKey = (userId: string) => `jornada360-settings-${userId}`;
const settingsVersionsCacheKey = (userId: string) => `jornada360-settings-versions-${userId}`;

interface JourneyContextType {
    journeys: Journey[];
    // Configurações vigentes hoje. Para calcular um dia específico use settingsAt.
    settings: Settings | null;
    // Configurações vigentes numa data (YYYY-MM-DD): mudar as configurações
    // não altera o cálculo de dias anteriores à mudança.
    settingsAt: SettingsAt | null;
    // Período contábil que contém a data (respeita trocas de dia contábil).
    getPeriod: ((date: string) => AccountingPeriod) | null;
    settingsVersions: SettingsVersion[];
    loading: boolean;
    fetchData: () => Promise<void>;
    addJourney: (journey: Omit<Journey, 'id' | 'user_id'>) => Promise<boolean>;
    updateJourney: (journey: Journey) => Promise<boolean>;
    deleteJourney: (id: string) => Promise<boolean>;
    // effectiveFrom: a partir de quando as mudanças valem (padrão: hoje).
    saveSettings: (settings: Omit<Settings, 'user_id' | 'id'>, effectiveFrom?: string) => Promise<boolean>;
    deleteSettingsVersion: (id: string) => Promise<boolean>;
}

const JourneyContext = createContext<JourneyContextType | undefined>(undefined);

export const JourneyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { toast } = useToast();

    // O usuário só é conhecido de forma assíncrona (via AuthContext), então o cache
    // não pode ser lido de forma síncrona no primeiro render — ele é hidratado no
    // efeito abaixo, já isolado pelo id do usuário logado.
    const [journeys, setJourneys] = useState<Journey[]>([]);
    // Linha da tabela settings: km_enabled e fallback quando não há versões.
    const [baseSettings, setSettings] = useState<Settings | null>(null);
    const [settingsVersions, setSettingsVersions] = useState<SettingsVersion[]>([]);

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
        try {
            const cachedVersions = localStorage.getItem(settingsVersionsCacheKey(user.id));
            if (cachedVersions) setSettingsVersions(JSON.parse(cachedVersions));
        } catch (error) {
            console.error("Failed to parse settings versions from localStorage", error);
        }
    }, [user?.id]);

    const fetchSettingsVersions = useCallback(async (userId: string) => {
        const { data, error } = await supabase
            .from('settings_versions')
            .select('*')
            .eq('user_id', userId)
            .order('effective_from', { ascending: true });
        // Sem o histórico, os cálculos usam a tabela settings — melhor do que
        // derrubar o carregamento inteiro.
        if (error) {
            console.error('Erro ao carregar histórico de configurações:', error);
            return;
        }
        setSettingsVersions(data || []);
        localStorage.setItem(settingsVersionsCacheKey(userId), JSON.stringify(data || []));
    }, []);

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

            await fetchSettingsVersions(user.id);

        } catch (error: any) {
            console.error('Erro ao carregar dados:', error);
            toast({ title: "Erro ao carregar dados", description: error.message, variant: 'destructive' });
        } finally {
            setLoading(false);
        }
    }, [user, toast, fetchSettingsVersions]);

    const sortedVersions = useMemo(() => sortSettingsVersions(settingsVersions), [settingsVersions]);

    const settingsAt = useMemo<SettingsAt | null>(() => {
        if (!baseSettings) return null;
        return (date: string) => resolveSettingsAt(baseSettings, sortedVersions, date);
    }, [baseSettings, sortedVersions]);

    const getPeriod = useMemo(() => {
        if (!baseSettings) return null;
        return buildPeriodResolver(baseSettings, sortedVersions);
    }, [baseSettings, sortedVersions]);

    const settings = useMemo(() => (settingsAt ? settingsAt(getLocalDateString()) : null), [settingsAt]);

    useEffect(() => {
        if (user) {
            fetchData();
        } else {
            // Limpa os dados em memória se o usuário deslogar (o cache em localStorage já é
            // isolado por user_id, então não precisa ser removido — só não é mais lido)
            setJourneys([]);
            setSettings(null);
            setSettingsVersions([]);
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

    const saveSettings = async (
        newSettings: Omit<Settings, 'user_id' | 'id'>,
        effectiveFrom: string = getLocalDateString()
    ): Promise<boolean> => {
        if (!user) return false;

        // Campos com histórico: grava uma versão valendo a partir de effectiveFrom.
        // Sem nenhuma versão ainda (usuário novo), a primeira vale para todo o passado.
        const versioned = Object.fromEntries(
            VERSIONED_SETTINGS_FIELDS.map(field => [field, (newSettings as any)[field] ?? null])
        ) as Partial<SettingsVersion>;
        const isFirstVersion = sortedVersions.length === 0;
        const current = settingsAt ? settingsAt(isFirstVersion ? SETTINGS_BASELINE_DATE : effectiveFrom) : null;
        const versionedChanged = isFirstVersion || !current ||
            VERSIONED_SETTINGS_FIELDS.some(field => ((current as any)[field] ?? null) !== (versioned as any)[field]);

        if (versionedChanged) {
            const { error: versionError } = await supabase
                .from('settings_versions')
                .upsert(
                    {
                        ...versioned,
                        user_id: user.id,
                        effective_from: isFirstVersion ? SETTINGS_BASELINE_DATE : effectiveFrom,
                    },
                    { onConflict: 'user_id,effective_from' }
                );
            if (versionError) {
                toast({ title: 'Erro ao salvar configurações', description: versionError.message, variant: 'destructive' });
                return false;
            }
        }

        // A tabela settings guarda km_enabled e serve de fallback. Os campos com
        // histórico só são espelhados nela quando a mudança já está valendo.
        const settingsPayload: any = { ...newSettings, user_id: user.id };
        if (!isFirstVersion && effectiveFrom > getLocalDateString() && baseSettings) {
            for (const field of VERSIONED_SETTINGS_FIELDS) settingsPayload[field] = (baseSettings as any)[field] ?? null;
        }

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
            await fetchSettingsVersions(user.id);
            toast({ title: 'Sucesso!', description: 'Configurações salvas.' });
            return true;
        }
        return false;
    };

    const deleteSettingsVersion = async (id: string): Promise<boolean> => {
        if (!user) return false;
        const { error } = await supabase.from('settings_versions').delete().eq('id', id).eq('user_id', user.id);
        if (error) {
            toast({ title: 'Erro ao remover alteração', description: error.message, variant: 'destructive' });
            return false;
        }
        await fetchSettingsVersions(user.id);
        toast({ title: 'Alteração removida', description: 'Os dias afetados voltaram às configurações anteriores.' });
        return true;
    };

    return (
        <JourneyContext.Provider value={{
            journeys, settings, settingsAt, getPeriod, settingsVersions: sortedVersions, loading, fetchData,
            addJourney, updateJourney, deleteJourney, saveSettings, deleteSettingsVersion,
        }}>
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
