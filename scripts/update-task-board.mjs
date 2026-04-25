import { readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const BOARD_PATH = join(__dirname, '../docs/AI_TASK_BOARD.md')

function usage() {
  console.log('Usage: node scripts/update-task-board.mjs <task-id> <status> [notes]')
  console.log('  status: planned | in_progress | blocked | review | done')
  process.exit(1)
}

const [taskId, status, ...notesParts] = process.argv.slice(2)
if (!taskId || !status) usage()

const notes = notesParts.join(' ') || ''

const validStatuses = ['planned', 'in_progress', 'blocked', 'review', 'done']
if (!validStatuses.includes(status)) {
  console.error(`Invalid status: ${status}. Use: ${validStatuses.join(', ')}`)
  process.exit(1)
}

let board = readFileSync(BOARD_PATH, 'utf-8')

// Find task section and update status
const taskRegex = new RegExp(`(### ${taskId}\\s*- \\w+: )[^\\n]+`, 'g')
if (!taskRegex.test(board)) {
  console.error(`Task ${taskId} not found in AI_TASK_BOARD.md`)
  process.exit(1)
}

board = board.replace(taskRegex, `$1${status}`)

// Update notes if provided
if (notes) {
  const notesRegex = new RegExp(`(### ${taskId}[^]*?- notes: )[^\\n]*`, 'g')
  board = board.replace(notesRegex, `$1${notes}`)
}

writeFileSync(BOARD_PATH, board)
console.log(`[task-board] ${taskId} → ${status}${notes ? ` | ${notes}` : ''}`)
