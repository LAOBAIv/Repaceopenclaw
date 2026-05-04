import fs from 'fs';

const OPENCLAW_CONFIG_PATH = '/root/.openclaw/openclaw.json';

/**
 * OpenClaw Gateway 连接信息解析器。
 *
 * 背景：RepaceClaw backend 直接调用 OpenClaw Gateway 的 /v1/chat/completions。
 * 实际部署中，backend 进程不一定总能带着 OPENCLAW_GATEWAY_TOKEN 环境变量启动，
 * 这会导致“前端看起来不回复”，但根因其实是 backend -> gateway 返回 401 Unauthorized。
 *
 * 规则：
 * 1. 优先使用进程环境变量（便于容器化/显式注入）
 * 2. 若环境变量缺失，则回退读取 /root/.openclaw/openclaw.json 中的 gateway.auth.token
 * 3. URL 同理：优先环境变量，否则回退到本机 127.0.0.1:${gateway.port}
 *
 * 这样做的目的，是避免把“能否回复”建立在手工 source .env 这种脆弱启动方式上。
 */
export const REPACECLAW_MESSAGE_CHANNEL = 'repaceclaw';

type GatewayResolved = {
  url: string;
  token: string;
};

function readOpenClawConfig(): any {
  try {
    if (!fs.existsSync(OPENCLAW_CONFIG_PATH)) return null;
    return JSON.parse(fs.readFileSync(OPENCLAW_CONFIG_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function resolveOpenClawGateway(): GatewayResolved {
  // 优先环境变量；没有就读取 OpenClaw 主配置，保证 backend 独立重启后仍能拿到正确 token。
  const envUrl = process.env.OPENCLAW_GATEWAY_URL?.trim();
  const envToken = process.env.OPENCLAW_GATEWAY_TOKEN?.trim();

  const cfg = readOpenClawConfig();
  const port = cfg?.gateway?.port || 18789;
  const token = cfg?.gateway?.auth?.token || '';
  const bindUrl = `http://127.0.0.1:${port}`;

  return {
    url: envUrl || bindUrl,
    token: envToken || token,
  };
}
