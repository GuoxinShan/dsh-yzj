/**
 * Compact IM confirm card for pending yzj writes (assistant present-layer).
 * Reuses write-card titles / decide verbs without the official toolview seat.
 */
import { useState } from 'react'
import type { YzjWriteRecord } from '../write-gate.ts'
import type { WriteCardInjected } from './write-card.tsx'
import { writableDraft } from './write-card.tsx'
import css from './shell.module.css'

export function YzjImConfirmCard(props: {
  record: YzjWriteRecord
  inject: Pick<WriteCardInjected, 'decideWrite' | 'openContext' | 'editDraft'>
}) {
  const { record } = props
  const [status, setStatus] = useState(record.status)
  if (status !== 'pending') return null
  const args = typeof record.args === 'object' && record.args !== null
    ? record.args as Record<string, unknown>
    : {}
  const group = typeof args.groupId === 'string' ? args.groupId : ''
  const title = record.toolName === 'yzj_im_message_send'
    ? `发送到 ${group === '' ? '云之家' : group}`
    : record.reason
  const draft = writableDraft(record)
  const decide = (outcome: 'allowed-once' | 'rejected'): void => {
    void props.inject.decideWrite(record.writeId, outcome).then((ok) => {
      if (ok) setStatus(outcome === 'allowed-once' ? 'approved' : 'cancelled')
    })
  }
  return (
    <div className={css.confirm} data-testid="yzj-im-confirm" role="status">
      <div className={css.confirmTitle}>{title}</div>
      {typeof args.content === 'string' && args.content !== '' && (
        <div>{args.content}</div>
      )}
      <div className={css.confirmActions}>
        <button type="button" className={css.ghost} onClick={() => props.inject.openContext(record)}>查看上下文</button>
        {draft !== '' && (
          <button type="button" className={css.ghost} onClick={() => {
            props.inject.editDraft(draft)
            decide('rejected')
          }}>编辑</button>
        )}
        <button type="button" className={css.ghost} data-testid="yzj-im-confirm-cancel" onClick={() => decide('rejected')}>取消</button>
        <button type="button" className={css.primary} data-testid="yzj-im-confirm-ok" onClick={() => decide('allowed-once')}>确认</button>
      </div>
    </div>
  )
}
