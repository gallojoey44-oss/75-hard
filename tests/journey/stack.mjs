/**
 * A real Supabase stack, on this machine, for the Friends and Our Journey tests.
 *
 * Not a mock. It runs Supabase's own images — the Supabase Postgres build (with
 * its roles: anon, authenticated, authenticator, supabase_auth_admin…), the
 * Supabase Auth server (GoTrue) and PostgREST — plus Mailpit to receive the
 * sign-in emails, so a test signs in exactly as a person does: ask for a code,
 * read it from the email, enter it. A small gateway on :54321 stands in for
 * Kong, routing /auth/v1 and /rest/v1 the way a hosted project does and
 * insisting on the project key.
 *
 * The migration under test is applied fresh, as the `postgres` role, the same
 * way the Supabase SQL editor applies it. Everything the tests prove about who
 * can read or change what is therefore proven by the real database and the
 * real Data API.
 *
 * Requires Docker. Containers are reused between runs; data is reset each run.
 */
import http from 'node:http';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createHmac, createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const MIGRATION = join(root, 'supabase', 'migrations', '20261127000000_forge_friends_and_journey.sql');

const PW = 'forge-local-test-pw';
const JWT_SECRET = 'forge-local-test-jwt-secret-at-least-32-chars';
const PORTS = { gateway: 54321, db: 54322, rest: 54330, auth: 54331, smtp: 1025, mail: 8025 };
export const SUPABASE_URL = `http://localhost:${PORTS.gateway}`;
const MAIL_API = `http://127.0.0.1:${PORTS.mail}/api/v1`;

function sign(payload) {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const data = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}`;
  return `${data}.${createHmac('sha256', JWT_SECRET).update(data).digest('base64url')}`;
}
// The two project keys, made the way Supabase makes them: JWTs naming a role.
export const ANON_KEY = sign({ iss: 'supabase', role: 'anon', iat: 1764000000, exp: 2079360000 });
export const SERVICE_KEY = sign({ iss: 'supabase', role: 'service_role', iat: 1764000000, exp: 2079360000 });

const IMAGES = {
  db: 'supabase/postgres:15.8.1.085',
  rest: 'postgrest/postgrest:v12.2.12',
  auth: 'supabase/gotrue:v2.177.0',
  mail: 'axllent/mailpit:v1.27',
};

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() };
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export function dockerAvailable() {
  return sh('docker', ['info']).ok;
}

function running(name) {
  return sh('docker', ['inspect', '-f', '{{.State.Running}}', name]).out === 'true';
}

function configHash(image, env, cmd) {
  return createHash('sha256').update(JSON.stringify([image, env, cmd])).digest('hex').slice(0, 16);
}

/** Start a container unless one with exactly this configuration is running. */
function ensureContainer(name, image, env, cmd = []) {
  const want = configHash(image, env, cmd);
  const have = sh('docker', ['inspect', '-f', '{{index .Config.Labels "forge.cfg"}}', name]).out;
  if (running(name) && have === want) return;
  runContainer(name, image, env, cmd, want);
}

function runContainer(name, image, env, cmd = [], hash = '') {
  sh('docker', ['rm', '-f', name]);
  const args = ['run', '-d', '--name', name, '--network', 'host', '--label', `forge.cfg=${hash}`];
  for (const [k, v] of Object.entries(env)) args.push('-e', `${k}=${v}`);
  const r = sh('docker', [...args, image, ...cmd]);
  if (!r.ok) throw new Error(`could not start ${name}: ${r.err}`);
}

async function waitUntil(test, what, ms = 90000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try { if (await test()) return; } catch { /* not yet */ }
    await sleep(500);
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** psql inside the database container. */
export function psql(sql, { user = 'postgres', stdin = null } = {}) {
  const args = ['exec', '-i', 'forge-sb-db', 'psql', '-U', user, '-h', 'localhost', '-p', String(PORTS.db),
    '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At', '-q'];
  const r = stdin != null
    ? sh('docker', [...args, '-f', '-'], { input: stdin })
    : sh('docker', [...args, '-c', sql]);
  return r;
}

/** Start whatever is not already running. Idempotent. */
export async function ensureStack() {
  if (!dockerAvailable()) throw new Error('Docker is not available');
  {
    ensureContainer('forge-sb-db', IMAGES.db, {
      POSTGRES_PASSWORD: PW, PGPASSWORD: PW, PGPORT: PORTS.db, POSTGRES_PORT: PORTS.db,
      POSTGRES_HOST: '/var/run/postgresql', PGDATABASE: 'postgres', POSTGRES_DB: 'postgres',
      JWT_SECRET, JWT_EXP: 3600,
    }, ['postgres', '-c', 'config_file=/etc/postgresql/postgresql.conf', '-c', 'log_min_messages=fatal']);
  }
  await waitUntil(() => sh('docker', ['exec', 'forge-sb-db', 'pg_isready', '-U', 'postgres', '-h', 'localhost', '-p', String(PORTS.db)]).ok, 'database');
  // The services log in as these roles, as they do in a hosted project.
  await waitUntil(() => psql(`alter user authenticator with password '${PW}'; alter user supabase_auth_admin with password '${PW}';`, { user: 'supabase_admin' }).ok, 'database roles');

  {
    ensureContainer('forge-sb-mail', IMAGES.mail, {
      MP_SMTP_AUTH_ACCEPT_ANY: 1, MP_SMTP_AUTH_ALLOW_INSECURE: 1,
      MP_SMTP_BIND_ADDR: `127.0.0.1:${PORTS.smtp}`, MP_UI_BIND_ADDR: `127.0.0.1:${PORTS.mail}`,
    });
  }
  {
    ensureContainer('forge-sb-rest', IMAGES.rest, {
      PGRST_DB_URI: `postgres://authenticator:${PW}@127.0.0.1:${PORTS.db}/postgres`,
      // What a hosted project exposes by default. `forge` is not in it.
      PGRST_DB_SCHEMAS: 'public,graphql_public',
      PGRST_DB_ANON_ROLE: 'anon',
      PGRST_JWT_SECRET: JWT_SECRET,
      PGRST_DB_USE_LEGACY_GUCS: 'false',
      PGRST_SERVER_PORT: PORTS.rest,
    });
  }
  {
    ensureContainer('forge-sb-auth', IMAGES.auth, {
      GOTRUE_API_HOST: '127.0.0.1', GOTRUE_API_PORT: PORTS.auth,
      API_EXTERNAL_URL: `${SUPABASE_URL}/auth/v1`,
      GOTRUE_DB_DRIVER: 'postgres',
      GOTRUE_DB_DATABASE_URL: `postgres://supabase_auth_admin:${PW}@127.0.0.1:${PORTS.db}/postgres`,
      GOTRUE_SITE_URL: 'http://localhost:4175',
      GOTRUE_DISABLE_SIGNUP: 'false',
      GOTRUE_JWT_ADMIN_ROLES: 'service_role', GOTRUE_JWT_AUD: 'authenticated',
      // New users get the `authenticated` role, as in a hosted project.
      GOTRUE_JWT_DEFAULT_GROUP_NAME: 'authenticated',
      GOTRUE_JWT_EXP: 3600, GOTRUE_JWT_SECRET: JWT_SECRET,
      GOTRUE_EXTERNAL_EMAIL_ENABLED: 'true',
      // Real email confirmation: a code must be read from the email to sign in.
      GOTRUE_MAILER_AUTOCONFIRM: 'false',
      GOTRUE_SMTP_ADMIN_EMAIL: 'forge@example.test', GOTRUE_SMTP_HOST: '127.0.0.1', GOTRUE_SMTP_PORT: PORTS.smtp,
      GOTRUE_SMTP_USER: 'forge', GOTRUE_SMTP_PASS: 'forge', GOTRUE_SMTP_SENDER_NAME: 'Forge',
      GOTRUE_MAILER_OTP_EXP: 3600,
      // A hosted project allows one code per address per minute and a few
      // emails an hour. The tests sign in many times in a row, so those
      // limits are lifted here — and only here.
      GOTRUE_SMTP_MAX_FREQUENCY: '1s', GOTRUE_RATE_LIMIT_EMAIL_SENT: 10000,
      GOTRUE_RATE_LIMIT_OTP: 10000, GOTRUE_RATE_LIMIT_VERIFY: 10000, GOTRUE_RATE_LIMIT_TOKEN_REFRESH: 10000,
      GOTRUE_EXTERNAL_PHONE_ENABLED: 'false',
    });
  }
  await waitUntil(async () => (await fetch(`http://127.0.0.1:${PORTS.auth}/health`)).ok, 'auth');
  await waitUntil(async () => (await fetch(`http://127.0.0.1:${PORTS.rest}/`)).ok, 'rest');
  await waitUntil(async () => (await fetch(`${MAIL_API}/info`)).ok, 'mail');
}

/** Apply the migration to an empty Forge schema, as the SQL editor would. */
export async function resetDatabase() {
  const reset = psql(`
    drop schema if exists forge cascade;
    do $$ declare f regprocedure; begin
      for f in select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                where n.nspname = 'public' and p.proname like 'forge\\_%' loop
        execute 'drop function ' || f;
      end loop;
    end $$;
    delete from auth.users;`, { user: 'supabase_admin' });
  if (!reset.ok) throw new Error(`reset failed: ${reset.err}`);
  const applied = psql(null, { stdin: readFileSync(MIGRATION, 'utf8') });
  if (!applied.ok) throw new Error(`migration failed: ${applied.err}`);
  await clearMail();
  // Give PostgREST a moment to reload its schema cache.
  await waitUntil(async () => {
    const r = await fetch(`http://127.0.0.1:${PORTS.rest}/rpc/forge_snapshot`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}',
    });
    return r.status === 401 || r.status === 403;   // exists, and refuses anon
  }, 'schema reload', 20000);
}

/**
 * The gateway: what Kong does in a hosted project, and no more. Routes by path,
 * requires a project key, answers CORS preflights for the app's origin.
 */
export function startGateway(port = PORTS.gateway) {
  const routes = [['/auth/v1', PORTS.auth], ['/rest/v1', PORTS.rest]];
  const server = http.createServer((req, res) => {
    const cors = {
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] || '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Expose-Headers': 'Content-Range, X-Supabase-Api-Version',
      Vary: 'Origin',
    };
    if (req.method === 'OPTIONS') { res.writeHead(204, cors); res.end(); return; }
    const route = routes.find(([p]) => req.url === p || req.url.startsWith(`${p}/`) || req.url.startsWith(`${p}?`));
    const fail = (code, message) => {
      res.writeHead(code, { ...cors, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message }));
    };
    if (!route) return fail(404, 'no route');
    const key = req.headers.apikey || new URL(req.url, 'http://x').searchParams.get('apikey');
    if (key !== ANON_KEY && key !== SERVICE_KEY) return fail(401, 'Invalid API key');
    const headers = { ...req.headers, host: `127.0.0.1:${route[1]}` };
    delete headers.apikey;
    const upstream = http.request({
      host: '127.0.0.1', port: route[1], method: req.method,
      path: req.url.slice(route[0].length) || '/', headers,
    }, (up) => {
      // Like Kong's CORS plugin: the gateway's CORS headers replace the
      // service's own (Auth sends `*`; two values would be refused).
      const out = Object.fromEntries(Object.entries(up.headers).filter(([k]) => !/^access-control-/i.test(k)));
      res.writeHead(up.statusCode, { ...out, ...cors });
      up.pipe(res);
    });
    upstream.on('error', () => fail(502, 'upstream unavailable'));
    req.pipe(upstream);
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve({ close: () => new Promise(r => server.close(r)) }));
  });
}

// ── Mail ─────────────────────────────────────────────────────────────────────

export async function clearMail() {
  await fetch(`${MAIL_API}/messages`, { method: 'DELETE' });
}

/** The sign-in code from the newest email to this address. */
export async function latestCode(email, { after = 0, timeout = 15000 } = {}) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const list = await (await fetch(`${MAIL_API}/messages`)).json();
    const msg = (list.messages || []).find(m => (m.To || []).some(t => t.Address.toLowerCase() === email.toLowerCase())
      && new Date(m.Created).getTime() >= after);
    if (msg) {
      const full = await (await fetch(`${MAIL_API}/message/${msg.ID}`)).json();
      const code = /code:\s*(\d{6,10})/.exec(full.Text || '')?.[1];
      if (code) return code;
    }
    await sleep(250);
  }
  throw new Error(`no sign-in code arrived for ${email}`);
}

export async function mailCount(email) {
  const list = await (await fetch(`${MAIL_API}/messages`)).json();
  return (list.messages || []).filter(m => (m.To || []).some(t => t.Address.toLowerCase() === email.toLowerCase())).length;
}

/** Everything the suites need, started and reset. */
export async function bootStack() {
  await ensureStack();
  await resetDatabase();
  const gateway = await startGateway();
  return { gateway, url: SUPABASE_URL, anonKey: ANON_KEY };
}
