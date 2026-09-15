// Lagringsadapter: lokalt (localStorage + URL-hash) som standard, Supabase når miljøvariablerne er sat.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { normalise, persist, type Solution } from './state';

export interface Store {
  kind: 'local' | 'supabase';
  save(s: Solution): Promise<void>;
  load(id: string): Promise<Solution | null>;
}

class LocalStore implements Store {
  kind = 'local' as const;
  async save(s: Solution) { persist(s); }
  async load() { return null; }
}

// Tabellen er lukket for anon; alt går gennem RPC (se supabase/schema.sql), så man skal kende et id
// for at læse eller skrive. Ingen kan liste alle løsninger eller overskrive dem samlet.
class SupabaseStore implements Store {
  kind = 'supabase' as const;
  constructor(private sb: SupabaseClient) {}
  async save(s: Solution) {
    persist(s);
    const { error } = await this.sb.rpc('save_solution', { p_id: s.id, p_name: s.name, p_data: s, p_updated_at: new Date(s.updatedAt).toISOString() });
    if (error) throw error;
  }
  async load(id: string) {
    const { data, error } = await this.sb.rpc('load_solution', { p_id: id });
    if (error) throw error;
    return normalise(data as Partial<Solution> | null);
  }
}

export function createStore(): Store {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url && key) return new SupabaseStore(createClient(url, key));
  return new LocalStore();
}
