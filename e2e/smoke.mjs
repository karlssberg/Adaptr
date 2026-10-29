import { execSync, spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import path from 'node:path'

// Playwright is not a project dependency. Look for it locally, then in the global npm
// root, then in the path used by this project's dev container.
const require = createRequire(import.meta.url)
function globalNpmRoot() {
  try {
    return execSync('npm root -g', { encoding: 'utf8' }).trim()
  } catch {
    return null
  }
}
function loadPlaywright() {
  const candidates = [
    () => require('playwright'),
    () => {
      const root = globalNpmRoot()
      if (!root) throw new Error('npm root -g failed')
      return require(path.join(root, 'playwright'))
    },
    () => require('/opt/node22/lib/node_modules/playwright'),
  ]
  for (const load of candidates) {
    try {
      return load()
    } catch {
      // try the next location
    }
  }
  console.error('✗ Playwright not found. Install it with `npm i -g playwright`, then `npx playwright install chromium`.')
  process.exit(1)
}
const { chromium } = loadPlaywright()

const URL = 'http://localhost:4173/'
const SONGS = ['Hot Cross Buns', 'Mary Had a Little Lamb']

async function waitForServer(exited, timeoutMs = 30000) {
  const end = Date.now() + timeoutMs
  while (Date.now() < end) {
    if (exited.done) throw new Error('vite preview exited early (port 4173 in use?)')
    try {
      const res = await fetch(URL)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('preview server did not start')
}

function check(name, ok) {
  if (!ok) throw new Error(`check failed: ${name}`)
  console.log(`✓ ${name}`)
}

async function listsBoth(page) {
  const text = await page.locator('body').innerText()
  return SONGS.every((s) => text.includes(s))
}

// Refuse to run against a stale server already holding the port.
const portBusy = await fetch(URL).then(
  () => true,
  () => false,
)
if (portBusy) {
  console.error('✗ port 4173 already in use')
  process.exit(1)
}

const server = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
  stdio: 'ignore',
  detached: true,
})
const exited = { done: false }
server.on('exit', () => {
  exited.done = true
})
let browser
let code = 0
try {
  await waitForServer(exited)
  browser = await chromium.launch()
  const context = await browser.newContext()
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(e))

  await page.goto(URL)
  await page.getByText('Hot Cross Buns').waitFor()
  check('menu lists both built-in songs', await listsBoth(page))

  await page.getByLabel('Keyboard').check()
  await page
    .locator('.song-row', { hasText: 'Hot Cross Buns' })
    .getByRole('button', { name: 'Play' })
    .click()
  await page.keyboard.press('a')
  await page.getByText('Wrong note').waitFor({ timeout: 5000 })
  check('wrong key in keyboard mode ends the game with "Wrong note"', true)

  await context.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error('storage blocked')
    }
    Storage.prototype.setItem = () => {
      throw new Error('storage blocked')
    }
  })
  await page.reload()
  await page.getByText('Hot Cross Buns').waitFor()
  check('built-in songs listed when localStorage throws', await listsBoth(page))

  check('no page errors', pageErrors.length === 0)
} catch (e) {
  console.error(`✗ ${e.message}`)
  code = 1
} finally {
  if (browser) await browser.close().catch(() => {})
  // kill the whole process group: npx spawns vite as a child
  try {
    process.kill(-server.pid)
  } catch {
    server.kill()
  }
}
process.exit(code)
