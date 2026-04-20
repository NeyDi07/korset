#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

function scan(dir, depth) {
  let total = 0
  const entries = []
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.name === 'node_modules' || e.name === '.git') continue
      try {
        if (e.isFile()) {
          const s = fs.statSync(p).size
          total += s
          entries.push({ path: p, size: s, isFile: true })
        } else if (e.isDirectory()) {
          const sub = scan(p, depth + 1)
          total += sub.total
          entries.push({ path: p, size: sub.total, isFile: false, children: sub.entries })
        }
      } catch {}
    }
  } catch {}
  entries.sort((a, b) => b.size - a.size)
  return { total, entries }
}

const top = scan('.', 0)
const mb = (n) => (n / 1048576).toFixed(1) + ' MB'

console.log('=== PROJECT SIZE BREAKDOWN ===\n')

for (const e of top.entries.slice(0, 15)) {
  const name = e.path.replace(/\\/g, '/').replace('./', '')
  console.log(mb(e.size).padStart(12), name)
}

console.log('\n=== NODE_MODULES TOP CONSUMERS ===\n')
try {
  const nmDir = path.join('.', 'node_modules')
  for (const e of fs.readdirSync(nmDir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue
    const p = path.join(nmDir, e.name)
    let s = 0
    try {
      for (const f of fs.readdirSync(p, { withFileTypes: true })) {
        const fp = path.join(p, f.name)
        if (f.isFile()) s += fs.statSync(fp).size
      }
    } catch {}
    if (s > 1048576) {
      entries_nm.push({ name: e.name, size: s })
    }
  }
} catch {}

const nmScan = scan('./node_modules', 0)
for (const e of nmScan.entries.slice(0, 15)) {
  const name = e.path.replace(/\\/g, '/').replace('./node_modules/', '')
  console.log(mb(e.size).padStart(12), name)
}

console.log('\n=== DATA/ LARGEST FILES ===\n')
const dataScan = scan('./data', 0)
for (const e of dataScan.entries.slice(0, 10)) {
  const name = e.path.replace(/\\/g, '/').replace('./', '')
  if (e.isFile) console.log(mb(e.size).padStart(12), name)
  else console.log(mb(e.size).padStart(12), name + '/')
}
