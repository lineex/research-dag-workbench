#!/usr/bin/env node
/**
 * 只读探针：查看 DSH Desktop 的 app.asar 内部（宿主工作台 API 的真实契约）。
 *
 * 本机 PATH 上的 node 是 Electron 的 node，fs 已内置 asar 解析，
 * 因此可以直接用 'app.asar/子路径' 路径读文件，无需自己解包。
 *
 * 用法：
 *   node tools/probe-asar.mjs list <substr>      列出匹配路径
 *   node tools/probe-asar.mjs cat <asar-relative>  打印文件
 *   node tools/probe-asar.mjs grep <substr>        打印命中行（含文件名与行号）
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ASAR = 'D:/software/DSH Desktop/resources/app.asar'
const ROOT = ASAR + '/'

function listDir(dir, prefix = '', acc = []) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return acc
  }
  for (const e of entries) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name
    const full = join(dir, e.name)
    if (e.isDirectory()) listDir(full, rel, acc)
    else acc.push(rel)
  }
  return acc
}

const [, , cmd, arg] = process.argv

if (cmd === 'list') {
  const files = listDir(ROOT)
  const matches = arg ? files.filter((f) => f.toLowerCase().includes(arg.toLowerCase())) : files
  console.log(matches.join('\n'))
  console.error(`[total ${files.length} files, ${matches.length} matched]`)
} else if (cmd === 'cat') {
  const p = ROOT + arg.replace(/^\/+/, '')
  try {
    console.log(readFileSync(p, 'utf8'))
  } catch (e) {
    console.error('read failed:', p, e.message)
    process.exit(1)
  }
} else if (cmd === 'grep') {
  const files = listDir(ROOT)
  const hits = []
  for (const f of files) {
    if (!/\.(js|mjs|cjs|ts|json|yml|yaml)$/.test(f)) continue
    if (f.includes('node_modules/') && !/dsh-|desktop/.test(f)) continue
    let c
    try {
      c = readFileSync(ROOT + f, 'utf8')
    } catch {
      continue
    }
    if (!c.includes(arg)) continue
    const lines = c.split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes(arg)) {
        hits.push(`--- ${f}:${i + 1}\n${lines[i].trim().slice(0, 400)}`)
      }
    }
  }
  console.log(hits.join('\n'))
  console.error(`\n[${hits.length} hits]`)
} else {
  console.error('usage: probe-asar.mjs list|cat|grep')
  process.exit(2)
}
