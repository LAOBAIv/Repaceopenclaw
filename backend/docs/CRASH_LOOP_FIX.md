# 循环重启 Bug 修复记录

> 日期：2026-05-05
> 根因：2026-05-04 crash loop

## Bug 描述

systemd 启动后端服务时，出现 **无限重启循环**：

```
May 04 23:49:00 — Started repaceclaw.service
May 04 23:49:00 — Main process exited, code=exited, status=1/FAILURE
May 04 23:49:15 — Scheduled restart job, restart counter is at 19
May 04 23:49:16 — Main process exited, code=exited, status=1/FAILURE
...
May 04 23:49:46 — Start request repeated too quickly → Failed
```

## 根因分析

### 直接原因

端口 3001 被旧进程占用 → `EADDRINUSE` → 服务退出。

### 深层原因（代码 Bug）

`src/index.ts` 中 `server.on('error')` 的 EADDRINUSE 处理逻辑有缺陷：

```typescript
// ❌ 旧代码（有问题）
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // ... 杀掉旧进程
    setTimeout(() => server.listen(PORT), 2000);  // 安排了重试
    return;
  }
  process.exit(1);  // ← 这里不会执行到，因为上面 return 了
}
```

但实际上 `process.exit(1)` 在 if 分支**外面**，即使成功安排重试，
后续的 `process.exit(1)` 也会立即杀死当前进程。

**结果**：杀旧进程 → 安排重试 → 立刻 self-kill → systemd 拉起新进程 →
端口仍未释放 → 又 EADDRINUSE → 无限循环。

### systemd 配置加重问题

- `RestartSec=5` 太短，5 秒内旧进程的端口 TIME_WAIT 还没释放
- 没有 `StartLimitBurst` 限制，systemd 会无限制重试

## 修复方案

### 1. 代码修复（`src/index.ts`）

**EADDRINUSE handler**：成功安排重试后直接 return，不再执行 exit。

```typescript
// ✅ 修复后
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    // ... 杀掉旧进程
    setTimeout(() => server.listen(PORT), 2000);
    return;  // ← 关键：不再走到 process.exit(1)
  }
  // 只有无法恢复时才 exit
  process.exit(1);
});
```

**uncaughtException handler**：不再对所有异常 exit(1)，
区分致命错误（MODULE_NOT_FOUND 等）和可恢复错误。

**unhandledRejection handler**：不再 exit(1)，
unhandled rejection 通常是单个异步操作失败，不代表进程不可用。

### 2. systemd 配置修复

```ini
RestartSec=15          # 5s → 15s，给端口足够释放时间
StartLimitIntervalSec=60   # 60 秒窗口内...
StartLimitBurst=3          # ...最多重启 3 次，超限后 systemd 放弃
```

## 防循环重启总结

| 层级 | 措施 | 效果 |
|------|------|------|
| 代码 | EADDRINUSE 重试后不 exit | 单进程内自我恢复 |
| 代码 | uncaughtException 区分严重性 | 偶发异常不崩溃 |
| 代码 | unhandledRejection 不 exit | 异步错误不连锁 |
| systemd | RestartSec=15s | 防止快速重启 |
| systemd | StartLimitBurst=3 | 超限后放弃，写日志 |

## 验证方法

```bash
# 模拟端口占用（另开一个进程占 3001）
node -e "require('http').createServer().listen(3001)"

# 然后启动服务，观察是否能在杀掉占用进程后恢复
systemctl start repaceclaw
journalctl -u repaceclaw -f
```
