
import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { AdminUserRow } from '../types';
import { Search, Users, Crown, Route, Loader2, RefreshCw, ShieldCheck } from 'lucide-react';
import DevUserDetailModal from '../components/dev/DevUserDetailModal';

const DevDashboardPage: React.FC = () => {
    const [rows, setRows] = useState<AdminUserRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedUser, setSelectedUser] = useState<AdminUserRow | null>(null);

    const loadUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase.rpc('admin_list_users');
        if (!error && data) {
            setRows(data as AdminUserRow[]);
        }
        setLoading(false);
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const base = q ? rows.filter(r => r.email?.toLowerCase().includes(q)) : rows;
        return [...base].sort((a, b) => (a.email || '').localeCompare(b.email || ''));
    }, [rows, search]);

    // "PRO" só conta quando o pagamento foi realmente confirmado (status active).
    // plan='pro' sozinho só significa que o usuário clicou em "Assinar" e o
    // checkout foi iniciado — o status continua "pending" até o Mercado Pago
    // confirmar o pagamento.
    const stats = useMemo(() => ({
        total: rows.length,
        admins: rows.filter(r => r.role === 'admin').length,
        pro: rows.filter(r => r.plan === 'pro' && r.status === 'active').length,
        journeys: rows.reduce((acc, r) => acc + (r.journeys_count || 0), 0),
    }), [rows]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                    <ShieldCheck className="w-6 h-6 text-accent" />
                    <h1 className="text-title-lg text-primary-dark">Painel DEV</h1>
                </div>
                <p className="text-sm text-muted-foreground">Acesso total: usuários, jornadas, configurações e assinaturas.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <StatCard icon={Users} label="Usuários" value={stats.total} />
                <StatCard icon={Crown} label="Admins" value={stats.admins} />
                <StatCard icon={ShieldCheck} label="Plano Pro" value={stats.pro} />
                <StatCard icon={Route} label="Jornadas" value={stats.journeys} />
            </div>

            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Buscar por e-mail..."
                        className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl bg-white text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                </div>
                <button onClick={loadUsers} className="px-3 rounded-xl border border-gray-200 bg-white text-gray-500 hover:text-primary-dark">
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
                ) : filtered.length === 0 ? (
                    <p className="p-6 text-sm text-gray-400 text-center">Nenhum usuário encontrado.</p>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {filtered.map(r => (
                            <button
                                key={r.id}
                                onClick={() => setSelectedUser(r)}
                                className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-gray-50 transition-colors"
                            >
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium text-primary-dark truncate">{r.email}</span>
                                        {r.role === 'admin' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-accent/15 text-accent">ADMIN</span>}
                                        {r.plan === 'pro' && r.status === 'active' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary-light text-primary-dark">PRO</span>}
                                        {r.plan === 'pro' && r.status === 'pending' && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">PAGAMENTO PENDENTE</span>}
                                    </div>
                                    <p className="text-xs text-gray-400">
                                        {r.journeys_count} jornadas · desde {new Date(r.created_at).toLocaleDateString('pt-BR')}
                                        {r.last_journey_date ? ` · última em ${new Date(r.last_journey_date + 'T00:00:00').toLocaleDateString('pt-BR')}` : ''}
                                    </p>
                                </div>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {selectedUser && (
                <DevUserDetailModal
                    userRow={selectedUser}
                    onClose={() => setSelectedUser(null)}
                    onChanged={loadUsers}
                />
            )}
        </div>
    );
};

const StatCard: React.FC<{ icon: any; label: string; value: number }> = ({ icon: Icon, label, value }) => (
    <div className="bg-white p-4 rounded-2xl border border-gray-100 flex flex-col gap-1">
        <Icon className="w-4 h-4 text-accent" />
        <span className="text-lg font-bold text-primary-dark">{value}</span>
        <span className="text-[11px] text-gray-400">{label}</span>
    </div>
);

export default DevDashboardPage;
