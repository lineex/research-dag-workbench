import fs from 'node:fs'

const lines = fs.readFileSync('D:\\ZhuanZ\\Documents\\research-dag\\workbench\\.ref\\dwb-client.js', 'utf8').split(/\r?\n/)
const from = Number(process.argv[2])
const to = Number(process.argv[3])
for (let i = from - 1; i < Math.min(to, lines.length); i += 1) {
  console.log(String(i + 1).padStart(5) + ': ' + lines[i])
}
