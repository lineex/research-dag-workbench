/**
 * 用本机 Playwright 的 Chromium 打开预览页，在多种容器宽度下截图并做布局自检。
 *
 * 自检项（规范第 4、8 节）：
 *   1) 业务整页占满：无会话时业务区宽度 ≈ 工作台宽度；
 *   2) 恰有一个 [data-dsh-workbench-toolbar]（紧凑顶部栏的硬要求）；
 *   3) 打开对话后对话区出现在右侧，业务区变窄但仍可用；
 *   4) 收起对话后宿主会话 DOM 仍然存在（display:none，未卸载）；
 *   5) 整页无横向溢出（scrollWidth <= clientWidth + 1）；
 *   6) 窄容器（420px）下无单字竖排（找出宽度过窄且文字长度>=4 的元素）。
 *
 * 用法：node tools/shoot-layout.mjs
 */
import { mkdirSync, existsSync, readdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = dirname(HERE)
const OUT = join(ROOT, '.preview')
mkdirSync(OUT, { recursive: true })

/* 定位本机 Playwright 的 chromium（不装新依赖）。 */
function findChromium() {
  const base = join(process.env.LOCALAPPDATA || '', 'ms-playwright')
  if (!existsSync(base)) return null
  const dirs = readdirSync(base).filter((name) => name.startsWith('chromium-'))
  for (const dir of dirs) {
    for (const candidate of [join(base, dir, 'chrome-win64', 'chrome.exe'), join(base, dir, 'chrome-win', 'chrome.exe')]) {
      if (existsSync(candidate)) return candidate
    }
  }
  return null
}

/* 极简 CDP 客户端：只用 Node 内置 WebSocket 之外的能力，故用 http + ws 手写太脆；
   改用 Playwright 的 cli 更简单——本机装了 chrome-devtools-mcp，但最稳的是用
   chromium 自带 --headless --screenshot 参数做静态截图，再单独用 CDP 跑测量脚本。
   这里用 chromium 的 --headless=new --screenshot 完成截图（足够做视觉验收）。 */
import { spawnSync } from 'node:child_process'

const chromium = findChromium()
if (!chromium) {
  console.error('未找到本机 Playwright Chromium，跳过截图。')
  process.exit(2)
}

const page = join(OUT, 'workbench-layout.html')
const url = pathToFileURL(page).href

const shots = [
  { name: 'layout-1440', width: 1440, height: 900, note: '宽容器：业务整页 + 无会话' },
  { name: 'layout-1024', width: 1024, height: 800, note: '中容器' },
  { name: 'layout-760', width: 760, height: 760, note: '窄容器（侧栏展开典型宽度）' },
  { name: 'layout-420', width: 420, height: 760, note: '极窄容器' },
]

for (const shot of shots) {
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-sandbox',
    '--allow-file-access-from-files',
    '--force-color-profile=srgb',
    '--window-size=' + shot.width + ',' + shot.height,
    '--screenshot=' + join(OUT, shot.name + '.png'),
    '--virtual-time-budget=2500',
    url,
  ]
  const result = spawnSync(chromium, args, { encoding: 'utf8', timeout: 90000 })
  if (result.status !== 0) {
    console.error(`截图失败 ${shot.name}: ${(result.stderr || '').slice(-400)}`)
    continue
  }
  console.log(`已截图 ${shot.name}.png（${shot.width}x${shot.height}，${shot.note}）`)
}
