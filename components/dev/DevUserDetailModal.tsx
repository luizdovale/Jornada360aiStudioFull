
import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/useToast';
import { AdminUserRow, Journey, Settings, Subscription } from '../../types';
import { formatMinutesToHours } from '../../lib/utils';
import { X, Shield, ShieldOff, Trash2, KeyRound, Save, Loader2 } from 'lucide-react';

interface Props {
    userRow: AdminUserRow;
    onClose: () => void;
    onChanged: () => void;
}

const inputStyle = "w-full mt-1 p-2.5 bg-white border border-gray-200 rounded-lg text-primary-dark text-sm shadow-sm transition-all focus:ring-2 focus:ring-primary-dark/50 focus:border-primary-dark";

const DevUserDetailModal: React.FC<Props> = ({ userRow, onClose, onChanged }) => {
    const { user: currentUser } = useAuth();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [journeys, setJourneys] = useState<Journey[]>([]);
    const [settings, setSettings] = useState<Partial<Settings>>({});
    const [subscription, setSubscription] = useState<Partial<Subscription>>({ plan: 'free', status: 'inactive' as any });
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        const load = async () => {
            setLoading(true);
            const [{ data: journeysData }, { data: settingsData }, { data: subData }] = await Promise.all([
                supabase.from('journeys').select('*').eq('user_id', userRow.id).order('date', { ascending: false }).limit(50),
                supabase.from('settings').select('*').eq('user_id', userRow.id).maybeSingle(),
                supabase.from('subscriptions').select('*').eq('user_id', userRow.id).maybeSingle(),
            ]);
            setJourneys(journeysData || []);
            if (settingsData) setSettings(settingsData);
            if (subData) setSubscription(subData);
            setLoading(false);
        };
        load();
    }, [userRow.id]);

    const handleToggleRole = async () => {
        const newRole = userRow.role === 'admin' ? 'user' : 'admin';
        setSaving(true);
        const { error } = await supabase.rpc('admin_set_role', { target_id: userRow.id, new_role: newRole });
        setSaving(false);
        if (error) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Sucesso', description: `Usuário agora é ${newRole === 'admin' ? 'administrador' : 'usuário comum'}.` });
            onChanged();
        }
    };

    const handleDeleteUser = async () => {
        if (userRow.id === currentUser?.id) {
            toast({ title: 'Ação bloqueada', description: 'Você não pode excluir a própria conta por aqui.', variant: 'destructive' });
            return;
        }
        if (!window.confirm(`Excluir permanentemente ${userRow.email}? Todos os dados (jornadas, configurações, assinatura) serão apagados. Esta ação não pode ser desfeita.`)) return;
        setSaving(true);
        const { error } = await supabase.rpc('admin_delete_user', { target_id: userRow.id });
        setSaving(false);
        if (error) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Usuário excluído', description: userRow.email });
            onChanged();
            onClose();
        }
    };

    const handleResetPassword = async () => {
        if (newPassword.length < 6) {
            toast({ title: 'Senha muito curta', description: 'Use ao menos 6 caracteres.', variant: 'destructive' });
            return;
        }
        setSaving(true);
        const { error } = await supabase.rpc('admin_reset_password', { target_id: userRow.id, new_password: newPassword });
        setSaving(false);
        if (error) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Senha atualizada', description: `Nova senha definida para ${userRow.email}.` });
            setNewPassword('');
        }
    };

    const handleSaveSettings = async () => {
        setSaving(true);
        const { error } = await supabase.from('settings').upsert({
            ...settings,
            user_id: userRow.id,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        setSaving(false);
        if (error) {
            toast({ title: 'Erro ao salvar configurações', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Configurações salvas' });
        }
    };

    const handleSaveSubscription = async () => {
        setSaving(true);
        const { error } = await supabase.from('subscriptions').upsert({
            ...subscription,
            user_id: userRow.id,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
        setSaving(false);
        if (error) {
            toast({ title: 'Erro ao salvar assinatura', description: error.message, variant: 'destructive' });
        } else {
            toast({ title: 'Assinatura salva' });
            onChanged();
        }
    };

    const handleDeleteJourney = async (id: string) => {
        if (!window.confirm('Excluir esta jornada?')) return;
        const { error } = await supabase.from('journeys').delete().eq('id', id);
        if (error) {
            toast({ title: 'Erro', description: error.message, variant: 'destructive' });
        } else {
            setJourneys(prev => prev.filter(j => j.id !== id));
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={onClose}>
            <div
                className="bg-background w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-lg flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-white">
                    <div>
                        <h2 className="font-bold text-primary-dark">{userRow.email}</h2>
                        <p className="text-xs text-muted-foreground">ID: {userRow.id}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
                </div>

                <div className="overflow-y-auto p-5 space-y-6 flex-1">
                    {loading ? (
                        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                    ) : (
                        <>
                            <section className="flex flex-wrap gap-2">
                                <button
                                    onClick={handleToggleRole}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg bg-primary-light text-primary-dark hover:brightness-95 disabled:opacity-50"
                                >
                                    {userRow.role === 'admin' ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                                    {userRow.role === 'admin' ? 'Remover Admin' : 'Tornar Admin'}
                                </button>
                                <button
                                    onClick={handleDeleteUser}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                                >
                                    <Trash2 className="w-4 h-4" /> Excluir Usuário
                                </button>
                            </section>

                            <section>
                                <h3 className="text-xs font-bold text-primary-dark/60 uppercase tracking-widest mb-2">Redefinir senha</h3>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Nova senha (mín. 6 caracteres)"
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        className={inputStyle + " mt-0"}
                                    />
                                    <button onClick={handleResetPassword} disabled={saving} className="px-4 rounded-lg bg-primary text-white text-sm font-bold flex items-center gap-1 disabled:opacity-50">
                                        <KeyRound className="w-4 h-4" /> Definir
                                    </button>
                                </div>
                            </section>

                            <section className="bg-white p-4 rounded-xl border border-gray-100">
                                <h3 className="text-xs font-bold text-primary-dark/60 uppercase tracking-widest mb-3">Assinatura</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-gray-500">Plano</label>
                                        <select className={inputStyle} value={subscription.plan || 'free'} onChange={e => setSubscription(prev => ({ ...prev, plan: e.target.value as any }))}>
                                            <option value="free">Free</option>
                                            <option value="pro">Pro</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">Status</label>
                                        <select className={inputStyle} value={subscription.status || 'inactive'} onChange={e => setSubscription(prev => ({ ...prev, status: e.target.value as any }))}>
                                            <option value="active">Active</option>
                                            <option value="inactive">Inactive</option>
                                            <option value="canceled">Canceled</option>
                                            <option value="past_due">Past due</option>
                                        </select>
                                    </div>
                                </div>
                                <button onClick={handleSaveSubscription} disabled={saving} className="mt-3 inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg bg-primary text-white disabled:opacity-50">
                                    <Save className="w-3.5 h-3.5" /> Salvar Assinatura
                                </button>
                            </section>

                            <section className="bg-white p-4 rounded-xl border border-gray-100">
                                <h3 className="text-xs font-bold text-primary-dark/60 uppercase tracking-widest mb-3">Configurações</h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs text-gray-500">Jornada Base (min)</label>
                                        <input type="number" className={inputStyle} value={settings.jornada_base ?? ''} onChange={e => setSettings(prev => ({ ...prev, jornada_base: Number(e.target.value) }))} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">Dia início do mês</label>
                                        <input type="number" min={1} max={31} className={inputStyle} value={settings.month_start_day ?? ''} onChange={e => setSettings(prev => ({ ...prev, month_start_day: Number(e.target.value) }))} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">Padrão de Escala</label>
                                        <input type="text" className={inputStyle} value={settings.escala_pattern ?? ''} onChange={e => setSettings(prev => ({ ...prev, escala_pattern: e.target.value }))} />
                                    </div>
                                    <div>
                                        <label className="text-xs text-gray-500">Início da Escala</label>
                                        <input type="date" className={inputStyle} value={settings.escala_start_date ?? ''} onChange={e => setSettings(prev => ({ ...prev, escala_start_date: e.target.value }))} />
                                    </div>
                                </div>
                                <label className="flex items-center gap-2 mt-3 text-sm text-gray-700">
                                    <input type="checkbox" checked={!!settings.km_enabled} onChange={e => setSettings(prev => ({ ...prev, km_enabled: e.target.checked }))} />
                                    Controle de KM habilitado
                                </label>
                                <button onClick={handleSaveSettings} disabled={saving} className="mt-3 inline-flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-lg bg-primary text-white disabled:opacity-50">
                                    <Save className="w-3.5 h-3.5" /> Salvar Configurações
                                </button>
                            </section>

                            <section>
                                <h3 className="text-xs font-bold text-primary-dark/60 uppercase tracking-widest mb-2">Últimas Jornadas ({journeys.length})</h3>
                                <div className="border border-gray-100 rounded-xl overflow-hidden">
                                    <div className="max-h-64 overflow-y-auto divide-y divide-gray-100">
                                        {journeys.length === 0 && <p className="p-4 text-sm text-gray-400">Nenhuma jornada registrada.</p>}
                                        {journeys.map(j => (
                                            <div key={j.id} className="flex items-center justify-between px-4 py-2.5 text-sm bg-white">
                                                <div>
                                                    <span className="font-medium text-primary-dark">{new Date(j.date + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                                                    <span className="text-gray-400 ml-2">{j.is_day_off ? 'Folga' : `${j.start_at} - ${j.end_at}`}</span>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    {!j.is_day_off && <span className="text-xs text-gray-500">{formatMinutesToHours((j.meal_duration || 0))}</span>}
                                                    <button onClick={() => handleDeleteJourney(j.id)} className="text-red-400 hover:text-red-600">
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DevUserDetailModal;
