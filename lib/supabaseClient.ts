import { createClient } from '@supabase/supabase-js';

// =================================================================================
// PASSO FINAL: Substitua as duas linhas abaixo pelas chaves do seu projeto Supabase
// =================================================================================
const supabaseUrl = 'SUA_URL_DO_SUPABASE_AQUI'; 
const supabaseAnonKey = 'SUA_ANON_KEY_DO_SUPABASE_AQUI'; 
// =================================================================================

const isPlaceholder = supabaseUrl.includes('SUA_URL') || supabaseUrl.includes('placeholder');

let supabase;

if (isPlaceholder) {
    console.warn("!!! ATENÇÃO: O app está rodando em MODO DE SIMULAÇÃO COMPLETA. O backend é simulado via localStorage. Para conectar a um banco de dados real, insira suas chaves do Supabase no arquivo 'lib/supabaseClient.ts'. !!!");

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
        const listeners = new Set();

        const triggerAuthStateChange = (event, newSession) => {
            session = newSession;
            saveSessionToStorage(session);
            // @ts-ignore
            listeners.forEach(listener => listener(event, session));
        };

        const mockQueryBuilder = (tableName) => ({
            select: function(columns = '*') {
                // CORREÇÃO: Esta função pode iniciar uma query OU especificar o retorno de um upsert/insert.
                // Se uma query de modificação já foi definida, não sobrescrevemos seu tipo.
                if (!this._query || this._query.type === 'select') {
                    this._query = { type: 'select', table: tableName, columns, filters: [] };
                }
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
            upsert: function(data) {
                this._query = { type: 'upsert', table: tableName, data };
                return this;
            },
            eq: function(column, value) {
                this._query.filters.push({ column, value });
                return this;
            },
            order: function() { return this; }, // Simplificado
            single: function() {
                this._single = true;
                return this;
            },
            then: function(callback) {
                const db = getDb();
                let resultData = [];
                let error = null;

                try {
                    switch (this._query.type) {
                        case 'select':
                            let tableData = db[this._query.table] || [];
                            resultData = tableData.filter(item => 
                                this._query.filters.every(f => item[f.column] === f.value)
                            );
                            if (this._single) {
                                resultData = resultData.length > 0 ? resultData[0] : null;
                                if (!resultData) error = { message: 'No rows found', code: 'PGRST116' };
                            }
                            break;
                        
                        case 'insert':
                            const newItem = { ...this._query.data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
                            db[this._query.table].push(newItem);
                            saveDb(db);
                            resultData = newItem;
                            break;

                        case 'update':
                            let itemUpdated = false;
                            db[this._query.table] = db[this._query.table].map(item => {
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
                            const initialLength = db[this._query.table].length;
                            db[this._query.table] = db[this._query.table].filter(item => 
                                !this._query.filters.every(f => item[f.column] === f.value)
                            );
                            if (db[this._query.table].length === initialLength) {
                                error = { message: "Item not found for deletion" };
                            }
                            saveDb(db);
                            break;
                        
                        case 'upsert':
                            const existingIndex = db[this._query.table].findIndex(item => item.user_id === this._query.data.user_id);
                            if (existingIndex > -1) {
                                // Update
                                const updatedItem = { ...db[this._query.table][existingIndex], ...this._query.data, updatedAt: new Date().toISOString() };
                                db[this._query.table][existingIndex] = updatedItem;
                                resultData = updatedItem;
                            } else {
                                // Insert
                                const newItemUpsert = { ...this._query.data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
                                db[this._query.table].push(newItemUpsert);
                                resultData = newItemUpsert;
                            }
                            saveDb(db);
                            break;
                    }
                } catch (e) {
                    error = { message: e.message };
                }
                
                if (this._single) {
                    callback({ data: resultData, error });
                } else {
                    callback({ data: Array.isArray(resultData) ? resultData : [resultData], error });
                }
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
                        password, // Em um app real, isso seria hasheado!
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
                    // @ts-ignore
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