#!/usr/bin/env node
const fs = require('fs')
const path = require('path')

function walk(dir, results) {
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules' || e.name === '.git') continue
      const p = path.join(dir, e.name)
      try {
        if (e.isFile()) {
          results.push({ path: p, size: fs.statSync(p).size })
        } else if (e.isDirectory()) {
          walk(p, results)
        }
      } catch {}
    }
  } catch {}
}

const files = []
walk('data', files)
files.sort((a, b) => b.size - a.size)

const total = files.reduce((s, f) => s + f.size, 0)
console.log('data/ total:', (total / 1048576).toFixed(1), 'MB')
console.log('data/ files:', files.length)
console.log('\nTop 20:')
for (const f of files.slice(0, 20)) {
  console.log('  ' + (f.size / 1048576).toFixed(1) + ' MB  ' + f.path)
}

const otherFiles = []
walk('.', otherFiles)
const otherTotal = otherFiles.reduce((s, f) => s + f.size, 0)
console.log('\nAll project files (excl node_modules/.git):', (otherTotal / 1048576).toFixed(1), 'MB')
