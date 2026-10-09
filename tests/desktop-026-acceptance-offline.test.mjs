import { test } from 'node:test'
import assert from 'node:assert/strict'
import { webcrypto } from 'node:crypto'
import { deferred, loadSource, memoryStorage } from './desktop-026-acceptance-fixtures.mjs'

const ownerA = JSON.stringify(['account-a', 'profile-a'])
const ownerB = JSON.stringify(['account-b', 'profile-b'])
const fixtureDone = { id: 'download-a', owner: ownerA, metaId: 'title-a', title: 'Fixture', url: 'https://fixture.invalid/movie.mp4', path: 'C:\\Fixture\\movie.mp4',
  season: null, episode: null, status: 'done', receivedBytes: 1000000, totalBytes: 1000000, startedAt: 1, ratio: 1, bytesPerSec: 0, error: null, kind: 'video' }

function downloads(initial = []) {
  const storage = memoryStorage({ 'harbor.downloads.v1': JSON.stringify(initial) })
  let owner = ownerA, existsPort = async () => true, verifyPort = async () => null
  const observers = [], started = [], removed = []
  const policy = loadSource('lib/download/offline-policy.ts')
  const native = (id, url, path, progress, headers) => {
    const gate = deferred(), call = { id, url, path, progress, headers, gate, aborts: 0 }
    started.push(call)
    return { promise: gate.promise, abort() { call.aborts++ } }
  }
  const events = new Map()
  const store = loadSource('lib/download/downloads-store.ts', {
    '@tauri-apps/api/core': { invoke: async (command, args) => { assert.equal(command, 'download_verify'); return verifyPort(args.dest) } },
    '@tauri-apps/api/path': { downloadDir: async () => 'C:\\Fixture' },
    '@tauri-apps/plugin-fs': { exists: (...args) => existsPort(...args), mkdir: async () => {}, remove: async (path) => { removed.push(path) }, stat: async () => ({ isFile: true, size: 1000000 }) },
    '@tauri-apps/plugin-opener': { revealItemInDir: async () => {} },
    react: { useSyncExternalStore: (_subscribe, snapshot) => snapshot() },
    './filename': { buildDefaultFilename: () => 'fixture.mp4', sanitizeName: (v) => v },
    './video-download': { startDownload: native },
    '@/lib/platform': { isWindowsDesktop: () => true },
    './owner': { downloadOwner: () => owner, subscribeDownloadOwner: (callback) => { observers.push(callback) } },
    './offline-policy': policy,
    '@/lib/torrent/local-engine': { localEngineStreamRef: () => null, pauseTorrentUsage() {}, releaseTorrentUsage() {}, retainTorrentUsage() {}, torrentEnginePause() {}, torrentEngineSelectSet() {} },
  }, { localStorage: storage, navigator: { onLine: true }, crypto: webcrypto,
    window: { addEventListener: (name, callback) => events.set(name, callback) } })
  return { store, storage, started, removed, setExists(fn) { existsPort = fn }, setVerify(fn) { verifyPort = fn }, switchOwner(next) { owner = next; observers.forEach((fn) => fn()) },
    enqueue(id = 'fixture') { return store.enqueueDownload({ meta: { id, type: 'movie', name: id }, url: `https://fixture.invalid/${id}.mp4`, destinationPath: `C:\\Fixture\\${id}.mp4`, headers: { Authorization: 'synthetic-only-secret' } }) } }
}

test('026 completed-file lookup cannot expose a previous account after an awaited filesystem check', async () => {
  const f = downloads([fixtureDone]), check = deferred()
  f.setExists(() => check.promise)
  const found = f.store.completedDownloadFor('title-a', null, null)
  f.switchOwner(ownerB); check.resolve(true)
  assert.equal(await found, null)
  assert.deepEqual(f.store.downloadsSnapshot(), [])
})

test('026 completed torrent lookup rechecks ownership before returning a local path', async () => {
  const hash = 'a'.repeat(40)
  const f = downloads([{ ...fixtureDone, torrentInfoHash: hash, torrentFileIdx: 3 }]), check = deferred()
  f.setExists(() => check.promise)
  const found = f.store.completedTorrentDownloadFor(hash, 3)
  f.switchOwner(ownerB); check.resolve(true)
  assert.equal(await found, null)
})

test('026 startup keeps unfinished downloads interrupted and never contacts a provider automatically', () => {
  const f = downloads([{ ...fixtureDone, status: 'downloading' }, { ...fixtureDone, id: 'other', owner: ownerB }, { ...fixtureDone, id: 'legacy', owner: undefined }])
  assert.equal(f.started.length, 0)
  assert.deepEqual(f.store.downloadsSnapshot().map((v) => [v.id, v.status]), [['download-a', 'interrupted']])
  assert.equal(f.store.unclaimedDownloadCount(), 1)
  f.store.claimLegacyDownloads()
  assert.equal(f.store.unclaimedDownloadCount(), 1, 'a signed-in account cannot silently claim legacy files')
})

test('026 account switch pauses queued/running work, hides it, and never persists authentication headers', async () => {
  const f = downloads()
  await f.enqueue('first'); await f.enqueue('second'); await f.enqueue('third')
  assert.equal(f.started.length, 2)
  assert.doesNotMatch(f.storage.getItem('harbor.downloads.v1'), /synthetic-only-secret|Authorization/)
  f.switchOwner(ownerB)
  assert.deepEqual(f.store.downloadsSnapshot(), [])
  assert.deepEqual(f.started.map((r) => r.aborts), [1, 1])
  assert.ok(JSON.parse(f.storage.getItem('harbor.downloads.v1')).every((v) => v.status === 'paused'))
  for (const call of f.started) call.gate.reject(Object.assign(new Error('canceled'), { name: 'AbortError' }))
  await new Promise((r) => setImmediate(r))
  assert.equal(f.started.length, 2, 'switch must not drain another owner queue')
})

test('026 delete waits for the writer to stop before removing final/partial files', async () => {
  const f = downloads()
  const id = await f.enqueue()
  const deleting = f.store.removeDownload(id)
  assert.equal(f.started[0].aborts, 1)
  assert.equal(f.removed.length, 0)
  f.started[0].gate.reject(Object.assign(new Error('canceled'), { name: 'AbortError' }))
  await deleting
  assert.deepEqual(f.removed, ['C:\\Fixture\\fixture.mp4', 'C:\\Fixture\\fixture.mp4.part', 'C:\\Fixture\\fixture.mp4.part.meta.json'])
  assert.equal(f.store.downloadsSnapshot().length, 0)
})

test('026 persisted downloads requiring ephemeral headers fail visibly instead of sending a stripped request', async () => {
  const f = downloads([{ ...fixtureDone, status: 'paused', requiresHeaders: true }])
  await f.store.resumeDownload('download-a')
  assert.equal(f.started.length, 0)
  assert.equal(f.store.downloadsSnapshot()[0].status, 'error')
  assert.match(f.store.downloadsSnapshot()[0].error, /headers.*not stored/)
})

test('026 local integrity verification recovers a publish-before-checkpoint crash and rejects same-size corruption', async () => {
  const f = downloads([{ ...fixtureDone, status: 'downloading', receivedBytes: 990000, ratio: 0.99 }])
  assert.equal(f.store.downloadsSnapshot()[0].status, 'interrupted')
  f.setVerify(async (path) => { assert.equal(path, fixtureDone.path); return 1000000 })
  await f.store.verifyDownloadFiles()
  assert.equal(f.store.downloadsSnapshot()[0].status, 'done')
  assert.equal(f.store.downloadsSnapshot()[0].receivedBytes, 1000000)
  assert.equal(JSON.parse(f.storage.getItem('harbor.downloads.v1'))[0].status, 'done')
  f.setVerify(async () => { throw new Error('Synthetic equal-size digest mismatch') })
  await f.store.verifyDownloadFiles()
  assert.equal(f.store.downloadsSnapshot()[0].status, 'error')
  assert.match(f.store.downloadsSnapshot()[0].error, /could not be verified/)
  assert.equal(f.started.length, 0, 'local verification never retries the provider')
})

test('026 delayed native recovery cannot mutate a previous account after identity changes', async () => {
  const f = downloads([{ ...fixtureDone, status: 'interrupted', ratio: 0.5 }]), check = deferred()
  f.setVerify(() => check.promise)
  const verifying = f.store.verifyDownloadFiles()
  f.switchOwner(ownerB)
  check.resolve(1000000)
  await verifying
  assert.deepEqual(f.store.downloadsSnapshot(), [])
  assert.equal(JSON.parse(f.storage.getItem('harbor.downloads.v1'))[0].status, 'interrupted')
  assert.equal(f.started.length, 0)
})
