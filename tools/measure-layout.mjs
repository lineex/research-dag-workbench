/**
 * 用 headless Chrome + CDP 量出工作台的真实布局尺寸，定位「右侧大片空白」的根源。
 *
 * 用法: node tools/measure-layout.mjs [html] [width] [height]
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const htmlPath = resolve(process.argv[2] || '.preview/real-render.html')
const W = Number(process.argv[3]) || 1680
const H = Number(process.argv[4]) || 1000

if (!existsSync(htmlPath)) {
  console.error('HTML 不存在:', htmlPath)
  process.exit(1)
}
mkdirSync(dirname(resolve('.preview/x')), { recursive: true })

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
]
const exe = CANDIDATES.find((p) => existsSync(p))
if (!exe) { console.error('找不到 Chrome/Edge'); process.exit(1) }

const port = 9900 + Math.floor(Math.random() * 80)
const child = spawn(exe, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run',
  '--no-default-browser-check', '--disable-extensions',
  `--remote-debugging-port=${port}`, `--window-size=${W},${H}`,
  '--user-data-dir=' + resolve('.preview/.cdp-measure'), 'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getJson(path) {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}${path}`)
      if (r.ok) return await r.json()
    } catch { /* not ready */ }
    await sleep(250)
  }
  throw new Error('CDP 未就绪: ' + path)
}

let msgId = 0
function rpc(ws, method, params, timeout = 30000) {
  const id = ++msgId
  return new Promise((res, rej) => {
    const timer = setTimeout(() => { ws.removeEventListener('message', on); rej(new Error('超时: ' + method)) }, timeout)
    const on = (ev) => {
      let d
      try { d = JSON.parse(ev.data) } catch { return }
      if (d.id !== id) return
      clearTimeout(timer)
      ws.removeEventListener('message', on)
      d.error ? rej(new Error(method + ': ' + d.error.message)) : res(d.result)
    }
    ws.addEventListener('message', on)
    ws.send(JSON.stringify({ id, method, params: params || {} }))
  })
}

const PROBE = `
(() => {
  const q = (s) => document.querySelector(s)
  const rect = (el) => {
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }
  }
  const out = { viewport: { w: innerWidth, h: innerHeight } }
  for (const sel of ['.rdw-shell', '.rdw-body', '.rdw-business', '.rdw-stage', '.rdw-chat', '.rdw-drawer']) {
    out[sel] = rect(q(sel))
  }

  /* 关键：列出 .rdw-body 的每个直接子元素及其计算样式 */
  const body = q('.rdw-body')
  if (body) {
    out.bodyChildren = [...body.children].map((c) => {
      const cs = getComputedStyle(c)
      return {
        cls: String(c.className || '(none)'),
        tag: c.tagName,
        rect: rect(c),
        flex: cs.flex,
        display: cs.display,
        width: cs.width,
        flexBasis: cs.flexBasis,
      }
    })
    const bcs = getComputedStyle(body)
    out.bodyComputed = { display: bcs.display, flexDirection: bcs.flexDirection, gap: bcs.gap, width: bcs.width }
  }

  /* 再看 .rdw-business 的直接子元素 */
  const biz = q('.rdw-business')
  if (biz) {
    out.bizChildren = [...biz.children].map((c) => ({
      cls: String(c.className || '(none)'),
      inline: c.getAttribute('style') || '',
      rect: rect(c),
    }))
  }

  const stage = q('.rdw-stage')
  if (stage) {
    out.stageGrid = getComputedStyle(stage).gridTemplateColumns
  }
  return JSON.stringify(out, null, 2)
})()
`

try {
  const ver = await getJson('/json/version')
  console.log('browser:', ver.Browser)
  const list = await getJson('/json/list')
  const page = (list || []).find((t) => t.type === 'page')
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

  await rpc(ws, 'Page.enable')
  await rpc(ws, 'Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false })
  await rpc(ws, 'Page.navigate', { url: 'file:///' + htmlPath.replace(/\\/g, '/') })
  await sleep(2200)

  const r = await rpc(ws, 'Runtime.evaluate', { expression: PROBE, returnByValue: true })
  console.log(r.result.value)
  ws.close()
} finally {
  try { child.kill() } catch { /* ignore */ }
}
