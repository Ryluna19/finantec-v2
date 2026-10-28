import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

test('the start command accepts an environment PORT without a physical .env file', { timeout: 20000 }, async (t) => {
  const directory = await mkdtemp(join(tmpdir(), 'finantec-env-test-'))
  const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
  const args = manifest.scripts.start.split(' ').slice(1)
  args[args.length - 1] = fileURLToPath(new URL('../src/server.js', import.meta.url))

  const child = spawn(process.execPath, args, {
    cwd: directory,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      PORT: '0',
      FRONTEND_ORIGIN: '',
      PGHOST: '127.0.0.1',
      PGPORT: '1',
      PGDATABASE: 'unused_startup_test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })

  t.after(async () => {
    if (child.pid && child.exitCode === null && child.signalCode === null) {
      const closed = once(child, 'close')
      child.kill()
      await closed
    }
    assert.equal(dirname(resolve(directory)), resolve(tmpdir()))
    await rm(directory, { recursive: true, force: true })
  })

  let output = ''
  let errors = ''
  child.stderr.on('data', (chunk) => { errors += chunk })
  const port = await new Promise((done, reject) => {
    child.once('error', reject)
    child.once('exit', (code) => reject(new Error(`Server exited (${code}): ${errors}`)))
    child.stdout.on('data', (chunk) => {
      output += chunk
      const match = output.match(/FinanTec API running on port (\d+)/)
      if (match) done(Number(match[1]))
    })
  })

  assert.ok(port > 0)
  assert.notEqual(port, 3000)
  const response = await fetch(`http://127.0.0.1:${port}/health`)
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { status: 'ok' })
})
