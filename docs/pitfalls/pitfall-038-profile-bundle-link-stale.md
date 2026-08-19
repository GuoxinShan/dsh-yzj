# pitfall-038: web profile 的 bundle link 被切到 worktree——主 checkout 的 build 与 GUI 加载脱节

## 复现条件(Reproduction)

harness web profile 用 `pnpm dsh plugin add -w link:<路径>` 安装本仓 bundle;某次并行开发
(③.2 意图线程订阅)在 Qoder worktree(`~/.qoder/worktree/dsh-yzj/<hash>`)里把 link 重新
指向了 worktree。之后主 checkout 的任何 `pnpm run build` 都正常出产物,GUI 也正常重启,
但运行的始终是 worktree 的旧 bundle——验证结果会与代码事实脱节:真机实验中
「决策 25 去重」的真机回归在旧代码上跑出 PASS(完全重放在新旧语义下都幂等,巧合成立),
而「本人消息过滤修复」首轮验证 FAIL,才暴露 link 指向不对。

## 根因(Root cause)

`~/.dsh/profiles/web/node_modules/@dsh-yzj/bundle` 是 symlink;worktree 流程把它改指
worktree 路径后没有归位。node ESM 加载后文件即关闭,`lsof` 看不到加载源;GUI 重启正常、
功能大体正常(新旧版本行为相近时),没有任何表面信号提示「跑的不是你 build 的代码」。

## 解法(Solution)

验收/实验前置检查加一条(成本 1 秒):

```sh
ls -la ~/.dsh/profiles/web/node_modules/@dsh-yzj/bundle
# 期望: -> /Users/guoxinshan/dev/dsh-yzj(主 checkout)
```

发现指错就归位:`ln -sfn /Users/guoxinshan/dev/dsh-yzj <该路径>`,再重启 GUI。
merge 完成后应及时删 worktree 并归位 link;`git worktree list` 里的 `+` 标记
(branch checked out in a linked worktree)是日常巡检信号。

## 回归覆盖(Regression coverage)

无自动化(环境态);本条目即检查单。真机实验 self-filter 验证脚本
(`.acceptance/advance-830-self-filter.mjs`)是先验反例:它首轮 FAIL 的直接原因就是
link 指错,归位后同脚本 ALL PASS。
