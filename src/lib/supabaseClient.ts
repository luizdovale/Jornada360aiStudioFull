
import { createClient } from '@supabase/supabase-js';

// =================================================================================
// 🔑 CONFIGURAÇÃO DO SUPABASE
// As credenciais fornecidas foram integradas para conectar ao backend real.
// =================================================================================
const supabaseUrl = "https://xfyfirbkhkzognbpfozk.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmeWZpcmJraGt6b2duYnBmb3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzAxNTgsImV4cCI6MjA3ODc0NjE1OH0.j5bjiqRfYm0nnG2fBdItYmCNnfM22QfwQpVi6qjqltI";
// =================================================================================

// Verificação robusta para determinar se o app deve rodar em modo de simulação.
const isPlaceholder = !supabaseUrl || supabaseUrl.includes('id-do-seu-projeto') || !supabaseAnonKey || supabaseAnonKey.includes('exemplo-de-chave');

let supabase;

if (isPlaceholder) {
    console.warn("!!! ATENÇÃO: O app está rodando em MODO DE SIMULAÇÃO. O backend é simulado via localStorage. Para conectar a um banco de dados real, insira suas chaves do Supabase em 'lib/supabaseClient.ts'. !!!");

    // =================================================================================
    // MODO DE SIMULAÇÃO (MOCK) - Versão corrigida e completa
    // =================================================================================
    const createFullMockClient = () => {
        const DB_KEY = 'jornada360_mock_db';
        const SESSION_KEY = 'jornada360_mock_session';

        const getDb = () => {
            try {
                const db = JSON.parse(localStorage.getItem(DB_KEY) || '{}');
                return {
                    users: db.users || [],
                    journeys: db.journeys || [],
                    settings: db.settings || [],
                };
            } catch {
                return { users: [], journeys: [], settings: [] };
            }
        };

        const saveDb = (db) => {
            localStorage.setItem(DB_KEY, JSON.stringify(db));
        };
        
        const getSessionFromStorage = () => {
            try {
                return JSON.parse(localStorage.getItem(SESSION_KEY));
            } catch {
                return null;
            }
        }
        
        const saveSessionToStorage = (session) => {
             if (session) {
                localStorage.setItem(SESSION_KEY, JSON.stringify(session));
             } else {
                localStorage.removeItem(SESSION_KEY);
             }
        }

        let session = getSessionFromStorage();
        // FIX: Explicitly type the Set to avoid type inference issues with callbacks.
        const listeners = new Set<Function>();

        const triggerAuthStateChange = (event, newSession) => {
            session = newSession;
            saveSessionToStorage(session);
            listeners.forEach(listener => listener(event, session));
        };

        const mockQueryBuilder = (tableName) => ({
            _query: null,
            _single: false,
            _options: null,

            select: function(columns = '*') {
                // CORREÇÃO: Previne que '.select()' sobrescreva uma query de mutação.
                if (this._query && ['insert', 'update', 'upsert', 'delete'].includes(this._query.type)) {
                    return this;
                }
                this._query = { type: 'select', table: tableName, columns, filters: [] };
                return this;
            },
            insert: function(data) {
                this._query = { type: 'insert', table: tableName, data };
                return this;
            },
            update: function(data) {
                this._query = { type: 'update', table: tableName, data, filters: [] };
                return this;
            },
            delete: function() {
                this._query = { type: 'delete', table: tableName, filters: [] };
                return this;
            },
            upsert: function(data, options) {
                this._query = { type: 'upsert', table: tableName, data };
                this._options = options;
                return this;
            },
            eq: function(column, value) {
                if (!this._query) this._query = { filters: [] };
                if (!this._query.filters) this._query.filters = [];
                this._query.filters.push({ column, value });
                return this;
            },
            order: function() { return this; },
            single: function() {
                this._single = true;
                return this;
            },
            then: function(callback) {
                const db = getDb();
                let resultData = null;
                let error = null;

                try {
                    const tableData = db[this._query.table] || [];

                    switch (this._query.type) {
                        case 'select':
                            let filteredData = tableData.filter(item => 
                                this._query.filters.every(f => item[f.column] === f.value)
                            );
                            if (this._single) {
                                resultData = filteredData.length > 0 ? filteredData[0] : null;
                                if (!resultData) error = { message: 'No rows found', code: 'PGRST116' };
                            } else {
                                resultData = filteredData;
                            }
                            break;
                        
                        case 'insert':
                            const newItem = { ...this._query.data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
                            db[this._query.table] = [...tableData, newItem];
                            saveDb(db);
                            resultData = this._single ? newItem : [newItem];
                            break;

                        case 'update':
                            let itemUpdated = false;
                            db[this._query.table] = tableData.map(item => {
                                if (this._query.filters.every(f => item[f.column] === f.value)) {
                                    itemUpdated = true;
                                    const updatedItem = { ...item, ...this._query.data, updatedAt: new Date().toISOString() };
                                    resultData = updatedItem; // for single()
                                    return updatedItem;
                                }
                                return item;
                            });
                            if (!itemUpdated) error = { message: "Item not found for update" };
                            saveDb(db);
                            break;

                        case 'delete':
                            const initialLength = tableData.length;
                            db[this._query.table] = tableData.filter(item => 
                                !this._query.filters.every(f => item[f.column] === f.value)
                            );
                            if (db[this._query.table].length === initialLength) {
                                error = { message: "Item not found for deletion" };
                            }
                            saveDb(db);
                            break;
                        
                        case 'upsert':
                            // Mock strategy: try to find by ID first, then by user_id (common for settings)
                            let existingIndex = -1;
                            
                            if (this._query.data.id) {
                                existingIndex = tableData.findIndex(item => item.id === this._query.data.id);
                            }
                            
                            // Fallback logic mainly for 'settings' table which often doesn't send ID on upsert but uses user_id as unique key
                            if (existingIndex === -1 && this._query.data.user_id && this._query.table === 'settings') {
                                existingIndex = tableData.findIndex(item => item.user_id === this._query.data.user_id);
                            }

                            if (existingIndex > -1) {
                                const updatedItem = { ...tableData[existingIndex], ...this._query.data, updatedAt: new Date().toISOString() };
                                db[this._query.table][existingIndex] = updatedItem;
                                resultData = updatedItem;
                            } else {
                                const newItemUpsert = { ...this._query.data };
                                if (!newItemUpsert.id) newItemUpsert.id = crypto.randomUUID();
                                newItemUpsert.createdAt = new Date().toISOString();
                                
                                db[this._query.table].push(newItemUpsert);
                                resultData = newItemUpsert;
                            }
                            saveDb(db);
                            break;
                    }
                } catch (e) {
                    error = { message: e.message };
                }
                
                callback({ data: resultData, error });
            }
        });

        return {
            auth: {
                getSession: async () => ({ data: { session }, error: null }),
                signInWithPassword: async ({ email, password }) => {
                    const db = getDb();
                    const user = db.users.find(u => u.email === email && u.password === password);
                    if (user) {
                        const newSession = {
                            access_token: crypto.randomUUID(),
                            user: { id: user.id, email: user.email, user_metadata: user.user_metadata }
                        };
                        triggerAuthStateChange('SIGNED_IN', newSession);
                        return { data: { session: newSession, user: newSession.user }, error: null };
                    }
                    return { data: { session: null, user: null }, error: { message: "Invalid login credentials" } };
                },
                signUp: async ({ email, password, options }) => {
                    const db = getDb();
                    if (db.users.some(u => u.email === email)) {
                        return { data: { session: null, user: null }, error: { message: "User already registered" } };
                    }
                    const newUser = {
                        id: crypto.randomUUID(),
                        email,
                        password,
                        user_metadata: options.data
                    };
                    db.users.push(newUser);
                    saveDb(db);
                    return { data: { session: null, user: { id: newUser.id, email: newUser.email, user_metadata: newUser.user_metadata } }, error: null };
                },
                signOut: async () => {
                    triggerAuthStateChange('SIGNED_OUT', null);
                    return { error: null };
                },
                onAuthStateChange: (callback) => {
                    listeners.add(callback);
                    setTimeout(() => callback('INITIAL_SESSION', session), 0);
                    return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } };
                },
                resetPasswordForEmail: async (email) => {
                    console.log(`[MOCK] Solicitação de redefinição de senha para ${email}`);
                    return { data: {}, error: null };
                },
                updateUser: async ({ data, password }) => {
                    if (!session || !session.user) return { data: { user: null }, error: { message: "User not authenticated" } };
                    const db = getDb();
                    let userUpdated = false;
                    db.users = db.users.map(u => {
                        if (u.id === session.user.id) {
                            userUpdated = true;
                            if (data) u.user_metadata = { ...u.user_metadata, ...data };
                            if (password) u.password = password;
                            return u;
                        }
                        return u;
                    });
                    if (userUpdated) {
                        saveDb(db);
                        const updatedUser = { ...session.user, user_metadata: { ...session.user.user_metadata, ...data } };
                        triggerAuthStateChange('USER_UPDATED', { ...session, user: updatedUser });
                        return { data: { user: updatedUser }, error: null };
                    }
                    return { data: { user: null }, error: { message: "Failed to update user" } };
                },
            },
            from: (tableName) => mockQueryBuilder(tableName),
        };
    };

    supabase = createFullMockClient();

} else {
    console.log("Supabase client inicializado com sucesso. Conectado ao backend real.");
    supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
