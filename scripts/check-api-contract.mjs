#!/usr/bin/env node
/**
 * API contract check.
 *
 * Extracts every backend route (FastAPI decorators + the router prefixes
 * from main.py and any APIRouter(prefix=...)) and every frontend
 * `api.get/post/put/delete/patch(...)` call, then exits non-zero listing
 * calls that have no matching METHOD + path.
 *
 * Calls that are known-broken and scheduled for a later round live in
 * scripts/api-contract-allowlist.txt (one `METHOD /path   # round N` per
 * line). Allowlist entries that now match a route are reported as stale and
 * also fail the check, so the list can only shrink.
 *
 * Usage: node scripts/check-api-contract.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND_SRC = path.join(ROOT, 'wedding-planner-backend', 'src')
const FRONTEND_SRC = path.join(ROOT, 'wedding-planner-frontend', 'src')
const ALLOWLIST = path.join(ROOT, 'scripts', 'api-contract-allowlist.txt')
const METHODS = ['get', 'post', 'put', 'delete', 'patch']

function walk(dir, exts, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '__pycache__') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, exts, out)
    else if (exts.some((x) => e.name.endsWith(x))) out.push(p)
  }
  return out
}

const joinPath = (...parts) =>
  '/' + parts.join('/').split('/').filter(Boolean).join('/')

// ---------------------------------------------------------------- backend
function collectBackendRoutes() {
  const main = fs.readFileSync(path.join(BACKEND_SRC, 'main.py'), 'utf8')

  // `from routes.foo import router as foo_router`  -> var -> module file
  const varToFile = {}
  for (const m of main.matchAll(/from\s+routes\.(\w+)\s+import\s+router\s+as\s+(\w+)/g)) {
    varToFile[m[2]] = path.join(BACKEND_SRC, 'routes', `${m[1]}.py`)
  }

  const routes = []
  for (const m of main.matchAll(
    /app\.include_router\(\s*(\w+)\s*(?:,\s*prefix\s*=\s*["']([^"']*)["'])?\s*[,)]/g,
  )) {
    const [, v, mountPrefix = ''] = m
    const file = varToFile[v]
    if (!file) throw new Error(`main.py includes unknown router ${v}`)
    const src = fs.readFileSync(file, 'utf8')
    const own = src.match(/APIRouter\([^)]*prefix\s*=\s*["']([^"']*)["']/)
    const routerPrefix = own ? own[1] : ''
    for (const r of src.matchAll(
      /@router\.(get|post|put|delete|patch)\(\s*["']([^"']*)["']/g,
    )) {
      routes.push({
        method: r[1].toUpperCase(),
        path: joinPath(mountPrefix, routerPrefix, r[2]),
        file: path.relative(ROOT, file),
      })
    }
  }
  // routes declared directly on `app` in main.py
  for (const r of main.matchAll(/@app\.(get|post|put|delete|patch)\(\s*["']([^"']*)["']/g)) {
    routes.push({ method: r[1].toUpperCase(), path: joinPath(r[2]), file: 'wedding-planner-backend/src/main.py' })
  }
  return routes
}

// --------------------------------------------------------------- frontend
// Matches api.<method>( followed by a string / template literal (first arg).
const CALL_RE = new RegExp(
  String.raw`\bapi\.(${METHODS.join('|')})\(\s*(` +
    String.raw`'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|` +
    '`((?:[^`\\\\]|\\\\.|\\$\\{(?:[^{}]|\\{[^{}]*\\})*\\})*)`)',
  'g',
)

function lineOf(src, idx) {
  return src.slice(0, idx).split('\n').length
}

function collectFrontendCalls() {
  const calls = []
  const dynamic = []
  for (const file of walk(FRONTEND_SRC, ['.js', '.jsx', '.ts', '.tsx'])) {
    if (/\.test\.[jt]sx?$/.test(file)) continue
    const src = fs.readFileSync(file, 'utf8')
    const seen = new Set()
    for (const m of src.matchAll(CALL_RE)) {
      seen.add(m.index)
      const raw = m[3] ?? m[4] ?? m[5]
      calls.push({
        method: m[1].toUpperCase(),
        raw,
        path: normalizeFrontend(raw),
        file: path.relative(ROOT, file),
        line: lineOf(src, m.index),
      })
    }
    // api.<method>( with a non-literal first arg: can't be verified statically.
    for (const m of src.matchAll(new RegExp(String.raw`\bapi\.(${METHODS.join('|')})\(\s*([^'"\`\s])`, 'g'))) {
      if (!seen.has(m.index)) {
        dynamic.push(`${path.relative(ROOT, file)}:${lineOf(src, m.index)} api.${m[1]}(${m[2]}…)`)
      }
    }
  }
  return { calls, dynamic }
}

// "/guests/${id}?x=1" -> "/guests/*"
function normalizeFrontend(raw) {
  let p = raw.split('?')[0]
  // a `?` inside a ${...} would have been cut above; re-balance defensively
  p = p.replace(/\$\{[^}]*\}?/g, '*')
  return joinPath(p)
}

// ---------------------------------------------------------------- matching
const segs = (p) => p.split('/').filter(Boolean)
const isParam = (s) => /^\{[^}]+\}$/.test(s)

function segMatches(front, back) {
  if (isParam(back)) return true
  if (front === back) return true
  if (front.includes('*')) {
    const re = new RegExp(
      '^' + front.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$',
    )
    return re.test(back)
  }
  return false
}

function pathMatches(frontPath, backPath) {
  // The frontend baseURL ends in /api.
  const f = segs(joinPath('api', frontPath))
  const b = segs(backPath)
  if (f.length !== b.length) return false
  return f.every((s, i) => segMatches(s, b[i]))
}

function loadAllowlist() {
  if (!fs.existsSync(ALLOWLIST)) return []
  return fs
    .readFileSync(ALLOWLIST, 'utf8')
    .split('\n')
    .map((l) => l.replace(/\s+#.*$/, '').trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [method, ...rest] = l.split(/\s+/)
      return { method: method.toUpperCase(), path: joinPath(rest.join(' ')) }
    })
}

// -------------------------------------------------------------------- main
const routes = collectBackendRoutes()
const { calls, dynamic } = collectFrontendCalls()
const allow = loadAllowlist()

const matches = (c) => routes.some((r) => r.method === c.method && pathMatches(c.path, r.path))
const allowed = (c) => allow.some((a) => a.method === c.method && a.path === c.path)

const unmatched = calls.filter((c) => !matches(c))
const failures = unmatched.filter((c) => !allowed(c))
const stale = allow.filter(
  (a) => !unmatched.some((c) => c.method === a.method && c.path === a.path),
)

console.log(
  `API contract: ${routes.length} backend routes, ${calls.length} frontend calls, ` +
    `${unmatched.length - failures.length} allowlisted, ${failures.length} unmatched.`,
)
if (dynamic.length) {
  console.log(`\nNote: ${dynamic.length} call(s) with a non-literal path could not be checked:`)
  dynamic.forEach((d) => console.log(`  ${d}`))
}
if (unmatched.length - failures.length) {
  console.log('\nAllowlisted (known-broken, scheduled):')
  const uniq = new Map()
  unmatched.filter(allowed).forEach((c) => uniq.set(`${c.method} ${c.path}`, c))
  uniq.forEach((c, k) => console.log(`  ${k}   (${c.file}:${c.line})`))
}
let bad = false
if (failures.length) {
  bad = true
  console.error('\nFrontend calls with no matching backend route:')
  failures.forEach((c) => console.error(`  ${c.method} /api${c.path}   ${c.file}:${c.line}`))
}
if (stale.length) {
  bad = true
  console.error('\nStale allowlist entries (now matched or no longer called) — remove them:')
  stale.forEach((a) => console.error(`  ${a.method} ${a.path}`))
}
process.exit(bad ? 1 : 0)
