import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const here = 'D:/ZhuanZ/Documents/research-dag/workbench'
const built = readFileSync(join(here, 'lib/client.js'))
const installedPath = join(process.env.USERPROFILE, '.dsh/profiles/desktop/node_modules/dsh-research-dag-workbench/lib/client.js')
const installed = readFileSync(installedPath)
const hash = (buffer) => createHash('sha256').update(buffer).digest('hex').slice(0, 16)
console.log(`workbench/lib/client.js   ${built.length}  ${hash(built)}`)
console.log(`profile/.../lib/client.js ${installed.length}  ${hash(installed)}`)
console.log(`一致：${hash(built) === hash(installed)}`)

const pkg = JSON.parse(readFileSync(join(here, 'package.json'), 'utf8'))
const installedPkg = JSON.parse(readFileSync(join(process.env.USERPROFILE, '.dsh/profiles/desktop/node_modules/dsh-research-dag-workbench/package.json'), 'utf8'))
console.log(`版本：源 ${pkg.version} / 已安装 ${installedPkg.version}`)
