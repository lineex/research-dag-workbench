import fs from 'node:fs'

const asar = 'D:\\software\\DSH Desktop\\resources\\app.asar'
const meta = JSON.parse(fs.readFileSync('D:\\ZhuanZ\\Documents\\research-dag\\workbench\\.ref\\asar-files.json', 'utf8'))
const fd = fs.openSync(asar, 'r')
const target = process.argv[2]
const outPath = process.argv[3]
const file = meta.files.find((item) => item.path === target)
if (!file) {
  console.error('not found:', target)
  process.exit(1)
}
const buffer = Buffer.alloc(file.size)
fs.readSync(fd, buffer, 0, file.size, meta.base + file.offset)
fs.writeFileSync(outPath, buffer)
console.log('wrote', outPath, file.size)
fs.closeSync(fd)
