# WeChat 微信 Bot 完整链路文档

> 更新时间：2026-05-18
> 维护者：RepaceClaw 平台

## 架构概览

```
微信用户 ←→ iLink 服务器 ←→ RC ILinkMonitor(轮询) ←→ RC 后端 ←→ OpenClaw Gateway ←→ AI
```

## 消息接收链路

```
微信用户发消息
  → 微信服务器
  → iLink 服务器（托管 bot 账号）
  → RC ILinkMonitor 每 18 秒 poll（ilink/bot/getupdates）
  → 收到消息（含 context_token、from_user_id、item_list）
  → 过滤 bot 自身消息（from_user_id 含 @im.bot 则跳过）
  → handleIncomingMessage()
```

## 消息处理链路

```
handleIncomingMessage(config, msg)
  ├─ 提取 text（item_list[type=1].text_item.text）
  ├─ 提取 context_token（回复时必须带回）
  ├─ getConfig(ilink/bot/getconfig) → 获取 typing_ticket
  ├─ sendTyping(ilink/bot/sendtyping, typing_ticket) → 微信显示"正在输入"
  ├─ handleILinkMessage(fromUserId, text, timestamp)
  │     ├─ 查找用户绑定（ilink_user_id → RC user_id）
  │     ├─ 获取/创建会话（conversation）
  │     ├─ 存储 user 消息到数据库（role=user, message_code 唯一）
  │     ├─ 调用 OpenClaw Gateway 获取 AI 回复
  │     ├─ 存储 agent 回复到数据库（role=agent, message_code 唯一）
  │     └─ 返回 reply 文本
  └─ sendMessage(ilink/bot/sendmessage) → 回复发送到微信
```

## 回复发送链路

```
sendMessage(config, toUserId, reply, contextToken)
  → POST ilink/bot/sendmessage
  → 请求体：
    {
      msg: {
        from_user_id: '',
        to_user_id: <用户 iLink ID>,
        client_id: 'rc-<timestamp>',
        message_type: 2 (BOT),
        message_state: 2 (FINISH),
        context_token: <从收到的消息中提取>,
        item_list: [{ type: 1, text_item: { text: <回复内容> } }]
      },
      base_info: { ... }
    }
  → iLink 服务器
  → 微信服务器
  → 微信用户收到回复
```

## 关键参数说明

| 参数 | 说明 | 来源 |
|------|------|------|
| `context_token` | iLink 会话上下文标识，回复时必须带回，否则消息不投递 | getupdates 返回的 msg 字段 |
| `typing_ticket` | 发送"正在输入"状态的凭证 | getconfig 接口返回 |
| `message_type=2` | BOT 类型消息（区别于普通用户消息 type=1） | iLink 协议要求 |
| `message_state=2` | FINISH 状态（表示完整回复） | iLink 协议要求 |
| `client_id` | 消息去重标识，每条回复唯一 | RC 生成 `rc-<timestamp>` |

## 组件职责

| 组件 | 文件 | 职责 |
|------|------|------|
| ILinkMonitor | `backend/src/services/ILinkMonitor.ts` | 轮询 iLink、收消息、发 typing、发回复 |
| wechatIncoming | `backend/src/routes/wechatIncoming.ts` | 用户绑定、消息存储、调 Gateway 获取 AI 回复 |
| ClawBotGatewayClient | `backend/src/services/ClawBotGatewayClient.ts` | WebSocket 连接 OpenClaw Gateway（备用通道） |
| OpenClaw 微信扩展 | `extensions/openclaw-weixin/` | 已禁用轮询（RC-MODE），仅保留账号管理 |

## 执行者标识

- **消息发送**：`[iLink][RC-ILinkMonitor]` — 由 RC 平台 ILinkMonitor 执行
- **OpenClaw 微信扩展**：轮询已禁用（channel.ts 第 432 行注释），`sendMessageWeixin()` 不会被触发
- **不存在重复发送**

## 数据存储

- 数据库：`backend/data/platform.db`（sql.js 内存态 + 磁盘持久化）
- 消息表：`messages`（UNIQUE 索引 `idx_messages_message_code`）
- 每条消息生成唯一 `message_code`：`wc-<timestamp>-<random>`
- 会话表：`conversations`（绑定 user_id + agent_id）

## iLink API 接口

| 接口 | 用途 | 超时 |
|------|------|------|
| `ilink/bot/getupdates` | 轮询新消息 | 18s 间隔 |
| `ilink/bot/getconfig` | 获取 typing_ticket | 5s |
| `ilink/bot/sendtyping` | 发送"正在输入"状态 | 5s |
| `ilink/bot/sendmessage` | 发送回复消息 | 默认 |

## 已知问题与修复记录（2026-05-18）

1. **ClawBotGateway 断连不重连** — shutdown 事件改为 ws.close() 触发自动重连
2. **消息被误过滤** — 改用 `@im.bot` 后缀判断 bot 自身消息
3. **回复不投递** — 补充 context_token + message_type=2 + message_state=2
4. **消息存储冲突** — 每条消息生成唯一 message_code
5. **typing 状态失效** — 先调 getconfig 获取 typing_ticket 再发 sendtyping
