/**
 * 用 CDP 给静态 HTML 原型截图（自包含，不依赖项目其它脚本）。
 * 用法: node tools/shot-proto.mjs <htmlPath> <outPng> [width] [height]
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const [, , htmlArg, outArg, wArg, hArg] = process.argv
if (!htmlArg || !outArg) {
  console.error('用法: node tools/shot-proto.mjs <html> <png> [w] [h]')
  process.exit(1)
}
const htmlPath = resolve(htmlArg)
const outPath = resolve(outArg)
const W = Number(wArg) || 1600
const H = Number(hArg) || 1000
if (!existsSync(htmlPath)) {
  console.error('HTML 不存在:', htmlPath)
  process.exit(1)
}
mkdirSync(dirname(outPath), { recursive: true })

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
]
const exe = CANDIDATES.find((p) => existsSync(p))
if (!exe) {
  console.error('找不到 Chrome/Edge')
  process.exit(1)
}

const port = 9500 + Math.floor(Math.random() * 400)
const child = spawn(exe, [
  '--headless=new',
  '--disable-gpu',
  '--hide-scrollbars',
  '--no-first-run',
  '--no-default-browser-check',
  '--disable-extensions',
  `--remote-debugging-port=${port}`,
  `--window-size=${W},${H}`,
  '--user-data-dir=' + resolve('.preview/.cdp-profile'),
  'about:blank',
], { stdio: 'ignore' })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function getJson(path) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}${path}`)
      if (res.ok) return await res.json()
    } catch { /* not ready */ }
    await sleep(250)
  }
  throw new Error('CDP 未就绪: ' + path)
}

function connect(wsUrl) {
  return new Promise((res, rej) => {
    const ws = new WebSocket(wsUrl)
    ws.onopen = () => res(ws)
    ws.onerror = (e) => rej(new Error('WS 失败: ' + (e && e.message)))
  })
}

let msgId = 0
function rpc(ws, method, params, timeout = 30000) {
  const id = ++msgId
  return new Promise((res, rej) => {
    const timer = setTimeout(() => { ws.removeEventListener('message', onMsg); rej(new Error('CDP 超时: ' + method)) }, timeout)
    const onMsg = (ev) => {
      let data
      try { data = JSON.parse(ev.data) } catch { return }
      if (data.id !== id) return
      clearTimeout(timer)
      ws.removeEventListener('message', onMsg)
      if (data.error) rej(new Error(method + ': ' + data.error.message))
      else res(data.result)
    }
    ws.addEventListener('message', onMsg)
    ws.send(JSON.stringify({ id, method, params: params || {} }))
  })
}

try {
  const ver = await getJson('/json/version')
  console.log('chromium:', ver['Browser'])
  const list = await getJson('/json/list')
  const page = (list || []).find((t) => t.type === 'page')
  if (!page) throw new Error('没有 page target')
  const ws = await connect(page.webSocketDebuggerUrl)

  await rpc(ws, 'Page.enable')
  await rpc(ws, 'Runtime.enable')
  try {
    await rpc(ws, 'Emulation.setDeviceMetricsOverride', {
      width: W, height: H, deviceScaleFactor: 1, mobile: false,
    }, 8000)
  } catch (e) {
    console.warn('（跳过设备尺寸覆盖）', e.message)
  }

  await rpc(ws, 'Page.navigate', { url: pathToFileURL(htmlPath).href })
  await sleep(1400)

  const metrics = await rpc(ws, 'Page.getLayoutMetrics')
  const css = metrics.cssContentSize || metrics.contentSize
  const fullH = Math.max(H, Math.ceil(css.height))
  console.log(`页面尺寸: ${W} x ${fullH}`)

  const shot = await rpc(ws, 'Page.captureScreenshot', {
    format: 'png',
    clip: { x: 0, y: 0, width: W, height: fullH, scale: 1 },
    captureBeyondViewport: true,
  })

  const { writeFileSync } = await import('node:fs')
  writeFileSync(outPath, Buffer.from(shot.data, 'base64'))
  console.log('已截图:', outPath)
  ws.close()
} catch (e) {
  console.error('失败:', e.message)
  process.exitCode = 1
} finally {
  try { child.kill() } catch { /* ignore */ }
  await sleep(250)
}
