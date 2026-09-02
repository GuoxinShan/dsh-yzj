#!/usr/bin/env node
/**
 * Fake yzj-cli binary for bridge tests. Behavior is driven by argv:
 * - `boom`     → exit 7 with a stderr line
 * - `slow`     → delay 10s then exit 0 (bridge timeout kills it)
 * - `big`      → emit output far beyond any test capture cap
 * - `echoin`   → read stdin and echo it inside the JSON payload
 * - `confirm`  → 0.1.6 high-risk gate: exit 10 + confirmation_required JSON
 * - `unauth`   → 0.1.6 auth miss: exit 3 + credentials_missing JSON
 * - `envelope` → 0.1.6 success envelope `{success, identity, data}`
 * - anything else → exit 0 with `{"argv": [...]}`
 */
const args = process.argv.slice(2)
const first = args[0] ?? ''

if (first === 'boom') {
  process.stderr.write('boom failed\n')
  process.exit(7)
} else if (first === 'slow') {
  setTimeout(() => process.exit(0), 10_000)
} else if (first === 'big') {
  process.stdout.write(JSON.stringify({ argv: args, pad: 'x'.repeat(10_000) }))
  process.exit(0)
} else if (first === 'echoin') {
  let body = ''
  process.stdin.on('data', (chunk) => { body += String(chunk) })
  process.stdin.on('end', () => {
    process.stdout.write(JSON.stringify({ argv: args, stdin: body }))
    process.exit(0)
  })
} else if (first === 'confirm') {
  process.stderr.write(`${JSON.stringify({
    success: false,
    error: {
      type: 'user',
      subtype: 'confirmation_required',
      message: 'High-risk command requires --yes',
      hint: 'Re-run with --yes',
      code: 'CONFIRM',
    },
  })}\n`)
  process.exit(10)
} else if (first === 'unauth') {
  process.stderr.write(`${JSON.stringify({
    success: false,
    error: {
      type: 'authentication',
      subtype: 'credentials_missing',
      message: 'Not logged in',
      hint: 'yzj-cli auth login',
      code: 'AUTH',
    },
  })}\n`)
  process.exit(3)
} else if (first === 'envelope') {
  process.stdout.write(JSON.stringify({
    success: true,
    identity: { openId: 'u1' },
    data: { list: [{ groupId: 'g1', groupName: '测试群' }], more: false },
  }))
  process.exit(0)
} else {
  process.stdout.write(JSON.stringify({ argv: args }))
  process.exit(0)
}
