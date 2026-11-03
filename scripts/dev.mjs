import { spawn } from 'node:child_process'
const child = spawn('tsx', ['watch', '--clear-screen=false', 'server/src/index.ts', '--dev'], {
  stdio: 'inherit',
})
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal))
child.on('exit', (code) => process.exit(code ?? 0))
