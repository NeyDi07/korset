import { spawnSync } from 'child_process'

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
  })

  if (result.error) {
    console.error(`[memory-save] Command failed: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error(`[memory-save] Command exited with status ${result.status}`)
    process.exit(result.status ?? 1)
  }
}

console.log('[memory-save] Обновляю Vault embeddings...')
run('node', ['scripts/embed-vault.mjs'])
console.log('[memory-save] Память обновлена. Итог по чанкам смотри в выводе embed-vault выше.')
