import { vi } from "vitest";

/**
 * A chainable Supabase stub. `rpc` and table ops resolve from the `responses` map
 * keyed by rpc name or `${table}:${op}`; everything else resolves to { data:null }.
 */
export function makeSupabase(opts: {
  user?: { id: string; email?: string } | null;
  rpc?: Record<string, any>;
  tables?: Record<string, any>;
} = {}) {
  const { user = null, rpc = {}, tables = {} } = opts;
  const calls: any[] = [];

  const builder = (table: string) => {
    const state: any = { table, op: "select" };
    const chain: any = {
      select: () => chain,
      insert: (v: any) => { state.op = "insert"; state.value = v; return chain; },
      update: (v: any) => { state.op = "update"; state.value = v; return chain; },
      upsert: (v: any) => { state.op = "upsert"; state.value = v; return chain; },
      delete: () => { state.op = "delete"; return chain; },
      eq: () => chain,
      is: () => chain,
      order: () => chain,
      limit: () => chain,
      single: async () => resolve(),
      maybeSingle: async () => resolve(),
      then: (res: any, rej: any) => Promise.resolve(resolve()).then(res, rej),
    };
    const resolve = () => {
      const key = `${table}:${state.op}`;
      calls.push({ table, op: state.op, value: state.value });
      const r = tables[key] ?? tables[table];
      return typeof r === "function" ? r(state) : (r ?? { data: null, error: null });
    };
    return chain;
  };

  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user }, error: null })),
    },
    rpc: vi.fn(async (name: string) => (name in rpc ? rpc[name] : { data: null, error: null })),
    from: vi.fn((table: string) => builder(table)),
    _calls: calls,
  };
  return supabase;
}
