// A tiny in-memory stand-in for the parts of supabase-js that cloud.js uses,
// with the same rev behaviour as the database trigger (every update bumps rev).
export function fakeDb(rows = []) {
  const table = new Map(rows.map((r) => [r.id, { rev: 1, versions: null, ...r }]));
  const calls = [];

  function query(name) {
    const q = { name, op: "select", cols: "*", filters: [], payload: null, single: false };
    const pick = (row) => {
      if (q.cols === "*") return { ...row };
      return Object.fromEntries(q.cols.split(",").map((c) => c.trim()).map((c) => [c, row[c] ?? null]));
    };
    const matches = (row) => q.filters.every(([k, v, kind]) => (kind === "in" ? v.includes(row[k]) : row[k] === v));
    const run = () => {
      calls.push({ table: name, op: q.op, filters: q.filters, payload: q.payload, cols: q.cols });
      if (name !== "projects") return { data: q.single ? null : [], error: null };
      if (q.op === "insert") {
        const row = q.payload;
        if (table.has(row.id)) return { data: null, error: { code: "23505", message: "duplicate key" } };
        table.set(row.id, { rev: 1, versions: null, ...row });
        return { data: [pick(table.get(row.id))], error: null };
      }
      if (q.op === "update") {
        const hit = [...table.values()].filter(matches);
        for (const row of hit) {
          Object.assign(row, q.payload);
          row.rev += 1;
        }
        return { data: hit.map(pick), error: null };
      }
      if (q.op === "delete") {
        for (const row of [...table.values()].filter(matches)) table.delete(row.id);
        return { data: [], error: null };
      }
      const hit = [...table.values()].filter(matches).map(pick);
      return { data: q.single ? hit[0] || null : hit, error: null };
    };
    const b = {
      select(cols = "*") {
        q.cols = cols;
        return b;
      },
      insert(payload) {
        q.op = "insert";
        q.payload = payload;
        return b;
      },
      update(payload) {
        q.op = "update";
        q.payload = payload;
        return b;
      },
      upsert(payload) {
        q.op = "upsert";
        q.payload = payload;
        return b;
      },
      delete() {
        q.op = "delete";
        return b;
      },
      eq(k, v) {
        q.filters.push([k, v]);
        return b;
      },
      in(k, v) {
        q.filters.push([k, v, "in"]);
        return b;
      },
      order() {
        return b;
      },
      maybeSingle() {
        q.single = true;
        return b;
      },
      then(resolve, reject) {
        return Promise.resolve(run()).then(resolve, reject);
      },
    };
    return b;
  }

  return { from: query, table, calls };
}
