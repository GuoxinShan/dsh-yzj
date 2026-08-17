# pitfall-014: 发进群乐观 `local-*` 锚了话题后，ack 成真实 msgId 对不上「交给助手」

## 复现条件（Reproduction）

群房间点「发进群」→ 立刻 ②（`local-<ts>`）→ 很快点「交给助手」→ 话题锚在 local id。CLI ack 把日志行改写成真实云之家 msgId 后，群房间再渲染这条消息时 `topicByRoot.get(entry.msgId)` 落空，仍显示「交给助手」而不是「话题 ·」。`verify-group-room-e2e.mjs` 的幂等断言因此失败。

## 根因（Root cause）

T8 只改 bound-log 的 msgId，不改 `yzj_topic_anchors` 的 `(groupId, rootMsgId)` 键。会话 id 仍是 `yzj-topic-…-local-…`，但查找键已经是真实 msgId。

## 解法（Fix）

`YzjHomeService.ackLocal` 在 log ack 之后调用 `TopicAnchorStore.retargetAnchor(group, localId, realMsgId)`：删旧锚、写入新锚，**不**另开话题、不改 session id。

## 回归覆盖（Regression coverage）

`packages/tool-yzj/tests/topics.spec.ts`：local-* → m-real 后 `ensureTopic(m-real)` 是 focus。真机：`.acceptance/verify-group-room-e2e.mjs` 回群房间后同一条显示「话题 ·」。
