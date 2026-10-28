import fs from 'node:fs'

const asar = 'D:\\software\\DSH Desktop\\resources\\app.asar'
const fd = fs.openSync(asar, 'r')
const head = Buffer.alloc(16)
fs.readSync(fd, head, 0, 16, 0)
const size = head.readUInt32LE(12)
const hb = Buffer.alloc(size)
fs.readSync(fd, hb, 0, size, 16)
const index = JSON.parse(hb.toString('utf8'))
const base = 16 + size

const files = []
function walk(node, prefix) {
  if (!node || typeof node !== 'object') return
  if (node.files) {
    for (const [name, child] of Object.entries(node.files)) walk(child, prefix ? `${prefix}/${name}` : name)
  } else if (typeof node.size === 'number' && typeof node.offset === 'string') {
    files.push({ path: prefix, size: node.size, offset: Number(node.offset) })
  }
}
walk(index, '')

const hits = files.filter((file) => /workbench/i.test(file.path))
console.log('workbench files:', hits.length)
for (const file of hits.slice(0, 200)) console.log(`${file.size}\t${file.path}`)

fs.writeFileSync(
  'D:\\ZhuanZ\\Documents\\research-dag\\workbench\\.ref\\asar-files.json',
  JSON.stringify({ base, files }, null, 0),
)
fs.closeSync(fd)
