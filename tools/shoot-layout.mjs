#!/usr/bin/env node
/**
 * 真实浏览器视觉验收（直接用 Chromium 的 CDP 协议，不依赖 playwright 模块）。
 *
 * 本机有 ms-playwright 缓存的 chromium，但没有 playwright 的 node 模块；
 * 因此这里手写最小 CDP 客户端：
 *   1) 以 --remote-debugging-port 启动 chromium（headless）；
 *   2) 通过 http://127.0.0.1:<port>/json 找到 page 目标；
 *   3) 用 WebSocket 发 Page.navigate / Runtime.evaluate / Page.captureScreenshot；
 *   4) 做布局自检（横向溢出 / 单字竖排 / 工具栏唯一性 / 令牌生效）。
 *
 * 用法：node tools/shoot-layout.mjs
 */
import { mkdirSync, existsSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { tmpdir } from 'node:os'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(HERE)
const OUT = join(ROOT, '.preview')
mkdirSync(OUT, { recursive: true })

function findChromium() {
  const base = join(process.env.LOCALAPPDATA || '', 'ms-playwright')
  if (!existsSync(base)) return null
  for (const dir of readdirSync(base).filter((n) => n.startsWith('chromium-'))) {
    for (const exe of [join(base, dir, 'chrome-win64', 'chrome.exe'), join(base, dir, 'chrome-win', 'chrome.exe')]) {
      if (existsSync(exe)) return exe
    }
  }
  for (const exe of [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ]) if (existsSync(exe)) return exe
  return null
}

const chrome = findChromium()
if (!chrome) {
  console.error('未找到 chromium，跳过截图。')
  process.exit(2)
}

const PORT = 9422
const profile = join(tmpdir(), 'rdw-cdp-' + Date.now())
const pageUrl = pathToFileURL(join(OUT, 'workbench-layout.html')).href

const child = spawn(chrome, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  '--disable-background-networking',
  '--remote-debugging-port=' + PORT,
  '--remote-allow-origins=*',
  '--user-data-dir=' + profile,
  '--allow-file-access-from-files',
  '--force-color-profile=srgb',
  'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true })

function cleanEnv() {
  const env = { ...process.env }
  const seen = new Set()
  for (const key of Object.keys(env)) {
    const lower = key.toLowerCase()
    if (seen.has(lower)) delete env[key]
    else seen.add(lower)
  }
  return env
}
child.kill()

// 重新以干净环境启动
const proc = spawn(chrome, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--no-default-browser-check', '--disable-extensions',
  '--disable-background-networking', '--remote-debugging-port=' + PORT,
  '--remote-allow-origins=*', '--user-data-dir=' + profile,
  '--allow-file-access-from-files', '--force-color-profile=srgb', 'about:blank',
], { stdio: ['ignore', 'ignore', 'ignore'], windowsHide: true, env: cleanEnv() })

async function waitForDevTools() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      if (res.ok) return await res.json()
    } catch { /* 还没起来 */ }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error('chromium DevTools 端点未就绪')
}

const version = await waitForDevTools()
console.log(`chromium: ${version.Browser}`)

/** 最小 CDP 客户端。 */
class Cdp {
  constructor(ws) {
    this.ws = ws
    this.id = 0
    this.pending = new Map()
    ws.addEventListener('message', (event) => {
      try {
        const raw = typeof event.data === 'string' ? event.data : event.data.toString()
        const msg = JSON.parse(raw)
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id)
          this.pending.delete(msg.id)
          if (msg.error) reject(new Error(msg.error.message))
          else resolve(msg.result)
        }
      } catch (err) {
        console.error('ws error:', err)
      }
    })
  }
  send(method, params = {}) {
    const id = ++this.id
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error(`CDP 超时：${method}`))
        }
      }, 30000)
    })
  }
}

const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const pageTarget = targets.find((t) => t.type === 'page')
if (!pageTarget) throw new Error('未找到 page 目标')

const ws = new WebSocket(pageTarget.webSocketDebuggerUrl)
await new Promise((resolve, reject) => {
  ws.addEventListener('open', resolve, { once: true })
  ws.addEventListener('error', reject, { once: true })
})
const cdp = new Cdp(ws)
await cdp.send('Page.enable')
await cdp.send('Runtime.enable')

const SHOTS = [
  { name: 'rdw-1440', width: 1440, height: 940 },
  { name: 'rdw-1024', width: 1024, height: 820 },
  { name: 'rdw-760', width: 760, height: 820 },
  { name: 'rdw-420', width: 420, height: 820 },
]

await cdp.send('Page.navigate', { url: pageUrl })
await new Promise((r) => setTimeout(r, 2500))

for (const shot of SHOTS) {
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: shot.width, height: shot.height, deviceScaleFactor: 1, mobile: false,
  })
  await new Promise((r) => setTimeout(r, 600))
  const evaluated = await cdp.send('Runtime.evaluate', {
    expression: `(() => {
      const shell = document.querySelector('.rdw-shell')
      const toolbars = document.querySelectorAll('[data-dsh-workbench-toolbar]')
      const st = shell ? getComputedStyle(shell) : null
      const narrow = []
      for (const el of document.querySelectorAll('.rdw-shell *')) {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.width < 24 && r.height > 8) {
          const t = (el.textContent || '').trim()
          if (t.length >= 4 && !el.querySelector('*')) narrow.push(t.slice(0, 20))
        }
      }
      return JSON.stringify({
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        toolbars: toolbars.length,
        accent: st ? st.getPropertyValue('--rdw-accent').trim() : '',
        panel: st ? st.getPropertyValue('--rdw-panel').trim() : '',
        text: st ? st.getPropertyValue('--rdw-text').trim() : '',
        narrow: narrow.slice(0, 6),
      })
    })()`,
    returnByValue: true,
  })
  const report = JSON.parse(evaluated.result.value)
  const shotResult = await cdp.send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(OUT, shot.name + '.png'), Buffer.from(shotResult.data, 'base64'))
  const ok = report.overflow <= 1 && report.toolbars === 1 && report.accent.length > 0
  console.log(
    `${ok ? 'OK  ' : 'WARN'} ${shot.name} (${shot.width}px) · 溢出=${report.overflow}px · 工具栏=${report.toolbars} · accent=${report.accent} · panel=${report.panel} · text=${report.text}` +
      (report.narrow.length ? ` · 窄元素=${report.narrow.join('|')}` : ''),
  )
}

ws.close()
proc.kill()
