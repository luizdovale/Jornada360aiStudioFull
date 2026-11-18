import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useToast } from '../../hooks/useToast';
import { CreditCard, Loader2, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';

interface AsaasStatus {
    key_configured: boolean;
    key_valid?: boolean;
    environment: 'sandbox' | 'production' | null;
    configured_at?: string | null;
    webhook?: { enabled: boolean; interrupted: boolean; url_ok: boolean; penalized_requests: number } | null;
}

// Painel DEV: situação da integração com o Asaas e configuração automática do
// webhook (cria/atualiza no Asaas e guarda o token no banco).
const AsaasIntegrationCard: React.FC = () => {
    const { toast } = useToast();
    const [status, setStatus] = useState<AsaasStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [configuring, setConfiguring] = useState(false);

    const load = async () => {
        setLoading(true);
        const { data, error } = await supabase.functions.invoke('asaas-subscription', { body: { action: 'admin_status' } });
        if (error) console.error('Erro ao consultar Asaas:', error);
        setStatus(error ? null : data);
        setLoading(false);
    };

    useEffect(() => { load(); }, []);

    const setupWebhook = async () => {
        setConfiguring(true);
        const { data, error } = await supabase.functions.invoke('asaas-subscription', { body: { action: 'setup_webhook' } });
        if (error || !data?.ok) {
            const body = await (error as any)?.context?.json?.().catch(() => null);
            toast({ title: 'Não foi possível configurar', description: body?.error || data?.error || 'Tente novamente.', variant: 'destructive' });
        } else {
            toast({ title: data.created ? 'Webhook criado no Asaas' : 'Webhook atualizado no Asaas' });
            await load();
        }
        setConfiguring(false);
    };

    const webhookOk = !!status?.webhook && status.webhook.enabled && !status.webhook.interrupted && status.webhook.url_ok;

    const renderBody = () => {
        if (loading) return <Loader2 className="w-5 h-5 animate-spin text-gray-400" />;
        if (!status) return <p className="text-sm text-red-600">Não foi possível consultar a integração.</p>;
        if (!status.key_configured) {
            return (
                <p className="text-sm text-gray-600">
                    Chave de API não cadastrada. No Supabase, em <strong>Edge Functions → Secrets</strong>, crie o segredo{' '}
                    <code className="text-xs bg-gray-100 px-1 py-0.5 rounded">ASAAS_API_KEY</code> com a chave do Asaas e atualize esta página.
                </p>
            );
        }
        if (!status.key_valid) {
            return <p className="text-sm text-red-600">O Asaas recusou a chave de API. Confira se ela foi copiada inteira e se é do ambiente certo.</p>;
        }
        return (
            <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                    {webhookOk ? (
                        <><CheckCircle2 className="w-4 h-4 text-green-600" /><span className="text-gray-700">Webhook ativo</span></>
                    ) : status.webhook?.interrupted ? (
                        <><AlertTriangle className="w-4 h-4 text-amber-600" /><span className="text-gray-700">Fila do webhook pausada pelo Asaas</span></>
                    ) : (
                        <><AlertTriangle className="w-4 h-4 text-amber-600" /><span className="text-gray-700">Webhook não configurado</span></>
                    )}
                </div>
                {status.configured_at && (
                    <p className="text-xs text-gray-500">Configurado em {new Date(status.configured_at).toLocaleString('pt-BR')}</p>
                )}
                <button
                    type="button"
                    onClick={setupWebhook}
                    disabled={configuring}
                    className="h-10 px-4 rounded-lg bg-primary text-white text-sm font-semibold hover:bg-primary-dark transition-colors flex items-center gap-2 disabled:opacity-60"
                >
                    {configuring && <Loader2 className="w-4 h-4 animate-spin" />}
                    {webhookOk ? 'Reconfigurar webhook' : status.webhook?.interrupted ? 'Reativar webhook' : 'Configurar webhook'}
                </button>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-bold text-primary-dark">Pagamentos (Asaas)</h2>
                    {status?.environment && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${status.environment === 'sandbox' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                            {status.environment === 'sandbox' ? 'SANDBOX' : 'PRODUÇÃO'}
                        </span>
                    )}
                </div>
                <button type="button" onClick={load} aria-label="Atualizar status do Asaas" className="text-gray-400 hover:text-primary-dark">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>
            {renderBody()}
        </div>
    );
};

export default AsaasIntegrationCard;
