export function markdownToHtml(md) {
  const lines = md.split('\n')
  const out = []
  let inList = false

  for (const raw of lines) {
    const line = raw.trimEnd()
    if (!line) {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      continue
    }

    if (line.startsWith('### ')) {
      if (inList) {
        out.push('</ul>')
        inList = false
      }
      out.push(`<h3>${esc(line.slice(4))}</h3>`)
      continue
    }

    if (line.startsWith('- ')) {
      if (!inList) {
        out.push('<ul>')
        inList = true
      }
      out.push(`<li>${inlineFmt(line.slice(2))}</li>`)
      continue
    }

    if (inList) {
      out.push('</ul>')
      inList = false
    }
    out.push(`<p>${inlineFmt(esc(line))}</p>`)
  }

  if (inList) out.push('</ul>')
  return out.join('\n')
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function inlineFmt(s) {
  return s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
}
