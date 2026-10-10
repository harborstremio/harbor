import { readFileSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join, basename } from 'node:path';

const BASE = process.env.HARBOR_OPS_BASE || 'https://harbor.elfhosted.com/themes/api';
const FNAME = /^Harbor_\d+\.\d+\.\d+_(x64-setup\.exe|x64-installer\.exe|aarch64\.app\.tar\.gz|aarch64\.dmg|aarch64_legacy\.app\.tar\.gz)$/;
const SEMVER = /^\d+\.\d+\.\d+$/;
const needsSig = (n) => /\.exe$|\.app\.tar\.gz$/.test(n);

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

const token = (process.env.HARBOR_THEMES_ADMIN_TOKEN || '').trim();
if (!token) {
  console.error('HARBOR_THEMES_ADMIN_TOKEN is not set. Source ~/.harbor/harbor-themes.env first.');
  process.exit(1);
}

const dir = arg('dir');
const version = arg('version');
const channel = arg('channel', 'beta');
const notesFile = arg('notes-file');
const dry = arg('dry', false) === true;
const skipUpload = arg('skip-upload', false) === true;
const publishOnly = arg('publish-only', false) === true;

if (!dir || dir === true || !version || version === true || !SEMVER.test(version)) {
  console.error('Usage: node scripts/publish-release.mjs --dir <artifacts> --version 0.9.129 [--channel beta] [--notes-file notes.txt] [--dry] [--skip-upload] [--publish-only]');
  process.exit(1);
}

async function api(path, { method = 'GET', body, raw, headers = {} } = {}) {
  const init = { method, headers: { Authorization: `Bearer ${token}`, ...headers } };
  if (raw !== undefined) {
    init.body = raw;
    init.headers['Content-Type'] = 'application/octet-stream';
  } else if (body !== undefined) {
    init.body = JSON.stringify(body);
    init.headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(`${BASE}${path}`, init);
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 400) }; }
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status} ${JSON.stringify(data)}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function fmt(bytes) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${bytes} B`;
}

function readSlice(path, start, length) {
  const fd = openSync(path, 'r');
  try {
    const buf = Buffer.allocUnsafe(length);
    let off = 0;
    while (off < length) {
      const n = readSync(fd, buf, off, length - off, start + off);
      if (n <= 0) break;
      off += n;
    }
    return off === length ? buf : buf.subarray(0, off);
  } finally {
    closeSync(fd);
  }
}

async function upload(path) {
  const name = basename(path);
  const size = statSync(path).size;
  const sigPath = `${path}.sig`;
  let sig;
  if (needsSig(name)) {
    try { sig = readFileSync(sigPath, 'utf8').trim(); } catch {
      throw new Error(`${name} needs ${name}.sig and it is missing`);
    }
    if (!sig) throw new Error(`${name}.sig is empty`);
  }
  console.log(`\n-> ${name}  ${fmt(size)}${sig ? ' (+sig)' : ''}`);
  if (dry) { console.log('   --dry, not uploaded'); return; }

  const init = await api('/ops/releases/artifact/chunk/init', { method: 'POST', body: { filename: name } });
  const uploadId = init.uploadId;
  const partSize = Number(init.partSize);
  if (!uploadId || !Number.isInteger(partSize) || partSize < 1) throw new Error(`bad upload config ${JSON.stringify(init)}`);
  const total = Math.ceil(size / partSize) || 1;
  const parts = [];
  try {
    for (let start = 0; start < size; start += partSize) {
      const length = Math.min(partSize, size - start);
      const partNumber = parts.length + 1;
      const chunk = readSlice(path, start, length);
      let lastErr;
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        try {
          const q = `?filename=${encodeURIComponent(name)}&uploadId=${encodeURIComponent(uploadId)}&partNumber=${partNumber}`;
          const part = await api(`/ops/releases/artifact/chunk${q}`, { method: 'PUT', raw: chunk });
          parts.push({ partNumber, etag: part.etag });
          lastErr = null;
          break;
        } catch (e) {
          lastErr = e;
          if (attempt < 4) await new Promise((r) => setTimeout(r, 1500 * attempt));
        }
      }
      if (lastErr) throw lastErr;
      process.stdout.write(`\r   part ${parts.length}/${total}  ${fmt(Math.min(start + length, size))} / ${fmt(size)}   `);
    }
    process.stdout.write('\n');
    const done = await api('/ops/releases/artifact/chunk/complete', { method: 'POST', body: { filename: name, uploadId, parts, sig } });
    console.log(`   staged ${name} (${fmt(done.size ?? size)})${done.version ? ` version ${done.version}` : ''}`);
  } catch (e) {
    try { await api('/ops/releases/artifact/chunk/abort', { method: 'POST', body: { filename: name, uploadId } }); } catch {}
    throw e;
  }
}

const found = readdirSync(dir)
  .filter((f) => FNAME.test(f))
  .filter((f) => f.includes(`_${version}_`))
  .sort();

if (!publishOnly) {
  if (!found.length) {
    console.error(`No artifacts in ${dir} matching Harbor_${version}_*`);
    process.exit(1);
  }
  console.log(`Artifacts for ${version}: ${found.join(', ')}`);
  for (const f of found) {
    if (skipUpload) { console.log(`\n-> ${f} (skip-upload)`); continue; }
    await upload(join(dir, f));
  }
}

const before = await api('/ops/releases/status');
console.log(`\nstaged now: ${JSON.stringify(before.staged)}`);

const notes = notesFile && notesFile !== true ? readFileSync(notesFile, 'utf8').replace(/\r\n/g, '\n').trim() : '';
if (dry) {
  console.log(`\n--dry: would publish ${version} to ${channel} with ${notes.length} chars of notes.`);
  process.exit(0);
}

console.log(`\nPublishing ${version} to ${channel} ...`);
const r = await api('/ops/releases/publish', { method: 'POST', body: { version, channel, notes } });
console.log(`published ${r.published} to ${r.channel}`);

const after = await api('/ops/releases/status');
console.log(`live ${channel}: ${JSON.stringify(after.live?.[channel], null, 2)}`);
