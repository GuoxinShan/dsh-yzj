# pitfall-033：yzj-cli 文件消息不能挂回复链

## 现象

话题 job-done（R29）把总结回帖到云之家锚点后，普通文件（`.md` / `.pdf` 等）出现在**群主时间线**，不在锚点的回复气泡里。点开锚点只看见文字总结；文件气泡要滑回群聊才能看到。图片可以进回复。总结会写「文件发在群时间线（CLI 文件消息不能挂回复链）」。

## 复现条件

1. `yzj-cli im message send --msg-type file --file-id <ID> --reply-msg-id <MSG_ID> --group-id <GID>`
2. CLI 拒绝该组合（skill `im.md`：`file` 不支持 `--content` / `--at-*` / `--reply-msg-id`）。
3. 本仓 `parseImSend` 同样拦：`im-send: msg-type file does not support content, reply, or images`。
4. dsh-2 真机（2026-08-19）：总结帖 `replyRootMsgId` = 锚点；`[文件]:*.md` 无 `replyMsgId`。

`--help` 把 `--reply-msg-id` 列成通用 flag，**不能据此以为 file 能回复**。契约在 skill 细节清单，不在 help。

## 根因

云之家 CLI 当前只让 `text` / `richText` 带 `--reply-msg-id`。`file` 是独立消息类型，没有回复字段。本仓禁止绕过桥接直调 HTTP，不能自己补平台未暴露的 file+reply。富文本 `--image` 只收图片 fileId，不能把 `.md` 塞进 richText。

## 解法

产品折中（R29 + R30，不要再尝试给 file 加 `replyMsgId`）：

- **图片** → 同一条 `richText` 回复（`--image` + `[图片]`），进回复链。
- **其它文件** → `file upload` 后 `msg-type file` **不带** `--reply-msg-id`，跟发群时间线；总结正文只写**实际上传成功**的文件名。
- **话题抽屉** → 同一批 write/edit 文件画在助手气泡下（DSH 本地卡）。发群不停。
- 等 CLI 支持 file+reply 再把 `parseImSend` / `yzj_im_message_send` 闸打开，并把跟发改成挂锚点。在那之前改闸 = 发出去被 CLI 打回。

## 回归覆盖

- `packages/ui-yzj/tests/bound-io.spec.ts`：file + `replyMsgId` 被 `parseImSend` 拒绝。
- `packages/ui-yzj/tests/topic-deliver.spec.ts`：图走 richText 回复；`.md` 跟发且 `replyMsgId` 为空；upload 失败的文件名不进总结。
