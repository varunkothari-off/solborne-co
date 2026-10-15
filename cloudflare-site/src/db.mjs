export function database(env) {
  if (!env.DB?.prepare || !env.DB?.batch) throw new Error('DATABASE_UNAVAILABLE');
  return env.DB;
}
export async function first(env, sql, values = []) { return database(env).prepare(sql).bind(...values).first(); }
export async function all(env, sql, values = []) { const result = await database(env).prepare(sql).bind(...values).all(); return result.results || []; }
export async function run(env, sql, values = []) { return database(env).prepare(sql).bind(...values).run(); }
export async function rateLimit(env, key, now, windowMs, limit) {
  const window = Math.floor(now / windowMs);
  const row = await first(env, `INSERT INTO solborne_rate_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count`,[`${key}:${window}`, now + windowMs * 2]);
  return row.count <= limit;
}
export async function cleanup(env, now) {
  // Only short-lived security state expires here; registrations are never silently removed.
  await database(env).batch([
    database(env).prepare('DELETE FROM solborne_form_sessions WHERE expires_at < ?').bind(now),
    database(env).prepare('DELETE FROM solborne_rate_limits WHERE expires_at < ?').bind(now),
    database(env).prepare('DELETE FROM solborne_access_grants WHERE expires_at < ?').bind(now)
  ]);
}
