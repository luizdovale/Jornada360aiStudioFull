
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://xfyfirbkhkzognbpfozk.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhmeWZpcmJraGt6b2duYnBmb3prIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMxNzAxNTgsImV4cCI6MjA3ODc0NjE1OH0.j5bjiqRfYm0nnG2fBdItYmCNnfM22QfwQpVi6qjqltI";

const isPlaceholder = !supabaseUrl || supabaseUrl.includes('id-do-seu-projeto');

let supabase;

if (isPlaceholder) {
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
                    subscriptions: db.subscriptions || [],
                };
            } catch {
                return { users: [], journeys: [], settings: [], subscriptions: [] };
            }
        };

        const saveDb = (db) => localStorage.setItem(DB_KEY, JSON.stringify(db));
        const saveSessionToStorage = (s) => s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY);
        
        let session = null;
        try { session = JSON.parse(localStorage.getItem(SESSION_KEY)); } catch(e) {}
        const listeners = new Set<Function>();

        const triggerAuthStateChange = (event, newSession) => {
            session = newSession;
            saveSessionToStorage(session);
            listeners.forEach(listener => listener(event, session));
        };

        const mockQueryBuilder = (tableName) => ({
            _query: null,
            _single: false,

            select: function(columns = '*') {
                this._query = { type: 'select', table: tableName, filters: [] };
                return this;
            },
            upsert: function(data) {
                this._query = { type: 'upsert', table: tableName, data, filters: [] };
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
                            let filtered = tableData.filter(item => 
                                this._query.filters?.every(f => item[f.column] === f.value)
                            );
                            resultData = this._single ? (filtered[0] || null) : filtered;
                            break;
                        
                        case 'upsert':
                            const idx = tableData.findIndex(item => item.user_id === this._query.data.user_id);
                            if (idx > -1) {
                                db[this._query.table][idx] = { ...tableData[idx], ...this._query.data, updatedAt: new Date().toISOString() };
                                resultData = db[this._query.table][idx];
                            } else {
                                const newItem = { ...this._query.data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
                                db[this._query.table].push(newItem);
                                resultData = newItem;
                            }
                            saveDb(db);
                            break;

                        case 'insert':
                            const insertItem = { ...this._query.data, id: crypto.randomUUID(), createdAt: new Date().toISOString() };
                            db[this._query.table].push(insertItem);
                            saveDb(db);
                            resultData = insertItem;
                            break;

                        case 'update':
                            db[this._query.table] = tableData.map(item => {
                                if (this._query.filters?.every(f => item[f.column] === f.value)) {
                                    return { ...item, ...this._query.data, updatedAt: new Date().toISOString() };
                                }
                                return item;
                            });
                            saveDb(db);
                            break;

                        case 'delete':
                            db[this._query.table] = tableData.filter(item => 
                                !this._query.filters?.every(f => item[f.column] === f.value)
                            );
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
                        const newSession = { access_token: 'tk', user: { id: user.id, email: user.email, user_metadata: user.user_metadata } };
                        triggerAuthStateChange('SIGNED_IN', newSession);
                        return { data: { session: newSession }, error: null };
                    }
                    return { error: { message: "Inválido" } };
                },
                signUp: async ({ email, password, options }) => {
                    const db = getDb();
                    const newUser = { id: crypto.randomUUID(), email, password, user_metadata: options.data };
                    db.users.push(newUser);
                    saveDb(db);
                    return { data: { user: newUser }, error: null };
                },
                signOut: async () => triggerAuthStateChange('SIGNED_OUT', null),
                onAuthStateChange: (cb) => {
                    listeners.add(cb);
                    setTimeout(() => cb('INITIAL', session), 0);
                    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
                },
                updateUser: async ({ data }) => {
                    const db = getDb();
                    const uIdx = db.users.findIndex(u => u.id === session.user.id);
                    db.users[uIdx].user_metadata = { ...db.users[uIdx].user_metadata, ...data };
                    saveDb(db);
                    const updatedUser = { ...session.user, user_metadata: db.users[uIdx].user_metadata };
                    triggerAuthStateChange('USER_UPDATED', { ...session, user: updatedUser });
                    return { data: { user: updatedUser } };
                }
            },
            from: (tableName) => mockQueryBuilder(tableName),
            storage: { from: () => ({ upload: async () => ({}), getPublicUrl: () => ({ data: { publicUrl: '' } }) }) }
        };
    };
    supabase = createFullMockClient();
} else {
    supabase = createClient(supabaseUrl, supabaseAnonKey);
}

export { supabase };
