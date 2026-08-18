---
name: dsh-plugin-tools
description: >-
  Author or change a model-facing yzj tool — defineTool shape, execute
  contract, output schema, presentationMeta, and WRITE_SPECS confirm gate.
  Use when adding or editing packages/tool-yzj tools.
---

# Tool authoring (dsh-yzj)

Distilled from harness `docs/cookbook/adding-a-tool.md` (`99f6f02fec`) plus
this repo's write-gate. Full upstream text lives in the sibling harness
checkout.

## Shape

```ts
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'tool-yzj'
export const inject = ['tools', 'yzjBridge']

export function apply(ctx: Context) {
  ctx.tools.register(defineTool({
    name: 'yzj_im_list',
    description: 'What the model sees.',
    parameters: {
      groupId: { type: 'string', required: true, description: 'Yunzhijia group id' },
    },
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: /* bounded digest */ String(value) }],
    },
    async execute(args) {
      return ctx.yzjBridge.run(['im', 'message', 'list', '--group-id', args.groupId])
    },
  }))
}
```

Registration is an effect: disposing the fiber unregisters the tool.

## execute() contract

- Args are validated before `execute`. Still check non-empty strings / cross-field rules.
- Return one canonical JSON value. `output.schema` should stay a real object
  (pitfall-009: do not widen to bare `object` if you can help it; arrays of
  objects go as a JSON string like todo `records`).
- Throw or invalid return → `isError`. Domain outcomes stay in the value.
- Honor `exec.signal` when the call can cancel.
- Bound the digest. Put structured card data on `output.presentationMeta`.
- Caps (`timeoutMs` / `maxRenderChars` / `maxMetaChars`) are Config fields.

## Writes

Agent-initiated writes must enter `WRITE_SPECS` in `packages/tool-yzj/src/guard.ts`
in the same commit (delete-class = strong, others = standard). User-direct
writes (`home-send`, todo toggle, panel composer) do **not** go through the
confirm card.

`whenSession` for robot notify/continue must cover `yzj-home-*` and
`yzj-topic-*` (R10).

## Checklist

Domain module → guard table if write → keyed card in `ui-yzj` → package README
tool list → test (skip when CLI/login missing).
