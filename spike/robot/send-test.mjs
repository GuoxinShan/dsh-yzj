// Outbound sendMsgUrl tests (R0 spikes ⑤⑥⑦b).
// Subcommands: len [chars] | rate [count] [intervalMs] | app | card | notify <openId> [msg] | reply <msgId> [msg]
// Prints each full response body (checking whether a msgId comes back — spike ⑦b).
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const secretPath = join(here, 'secret.local.json')
let sendMsgUrl = process.env.YZJ_SEND_MSG_URL ?? ''
if (sendMsgUrl === '' && existsSync(secretPath)) {
  try { sendMsgUrl = JSON.parse(readFileSync(secretPath, 'utf8')).sendMsgUrl ?? '' } catch {}
}
if (sendMsgUrl === '') { console.error('need sendMsgUrl in spike/robot/secret.local.json or YZJ_SEND_MSG_URL'); process.exit(1) }

async function post(label, payload) {
  const t0 = Date.now()
  try {
    const res = await fetch(sendMsgUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json;charset=utf-8' },
      body: JSON.stringify(payload),
    })
    const text = await res.text()
    console.log(`[${new Date().toISOString()}] ${label} -> HTTP ${res.status} (${Date.now() - t0}ms)`)
    console.log(`  body: ${text.slice(0, 500)}`)
    return { ok: res.ok, text }
  } catch (e) {
    console.log(`[${new Date().toISOString()}] ${label} -> THROW ${e.message}`)
    return { ok: false, text: '' }
  }
}

const [cmd, a1, a2, ...rest] = process.argv.slice(2)
switch (cmd) {
  case 'len': {
    const n = Number(a1 ?? 5000)
    await post(`len(${n})`, { content: '长'.repeat(n) })
    break
  }
  case 'rate': {
    const count = Number(a1 ?? 35), interval = Number(a2 ?? 1000)
    let ok = 0, fail = 0
    for (let i = 1; i <= count; i++) {
      const r = await post(`rate#${i}`, { content: `频控测试 ${i}/${count}` })
      r.ok ? ok++ : fail++
      if (i < count) await new Promise(r2 => setTimeout(r2, interval))
    }
    console.log(`\nrate summary: ok=${ok} fail=${fail} (interval ${interval}ms)`)
    break
  }
  case 'app': {
    await post('app-msg', {
      content: 'spike 应用类消息预览', msgType: 1,
      param: { appName: 'DSH Spike', title: 'spike 标题', lightAppId: '0', thumbUrl: '', webpageUrl: 'https://example.com', customStyle: 0, content: 'spike 正文' },
    })
    break
  }
  case 'card': {
    await post('card-msg', {
      msgtype: 25, content: 'spike 卡片消息',
      msg: { title: 'spike card', baseInfo: { templateId: '000000000000000000000000', dataContent: '{"title":"spike"}' } },
    })
    break
  }
  case 'notify': {
    const openId = a1, msg = rest.join(' ') || 'spike 单发通知'
    await post(`notify(${openId})`, { content: msg, notifyParams: [{ type: 'openIds', values: [openId] }] })
    break
  }
  case 'reply': {
    const msgId = a1, msg = rest.join(' ') || 'spike 引用回复'
    await post(`reply(${msgId})`, {
      msgtype: 2, content: msg,
      param: { replyMsgId: msgId, replyTitle: '', isReference: true, replySummary: '原文摘要', replyPersonName: 'spike' },
      paramType: 3,
    })
    break
  }
  default:
    console.log('usage: send-test.mjs len [chars] | rate [count] [intervalMs] | app | card | notify <openId> [msg] | reply <msgId> [msg]')
}
