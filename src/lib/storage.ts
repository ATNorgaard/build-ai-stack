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

class SupabaseStore implements Store {
  kind = 'supabase' as const;
  constructor(private sb: SupabaseClient) {}
  async save(s: Solution) {
    persist(s);
    const { error } = await this.sb.from('solutions').upsert({ id: s.id, name: s.name, data: s, updated_at: new Date(s.updatedAt).toISOString() });
    if (error) throw error;
  }
  async load(id: string) {
    const { data, error } = await this.sb.from('solutions').select('data').eq('id', id).maybeSingle();
    if (error) throw error;
    return normalise(data?.data as Partial<Solution>);
  }
}

export function createStore(): Store {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url && key) return new SupabaseStore(createClient(url, key));
  return new LocalStore();
}
