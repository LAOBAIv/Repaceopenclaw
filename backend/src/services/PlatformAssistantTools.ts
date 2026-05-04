/**
 * PlatformAssistantTools — 平台助手后台 API 调度器
 * 
 * 所有 RepaceClaw 后端接口都可通过此模块调度。
 * 平台助手在回答用户问题时，自动决定何时调用 API 获取实时数据。
 * 
 * 工具列表：
 * - call_api: 通用 API 调用工具，支持所有 RepaceClaw 后端接口
 */

import { getDb } from '../db/client';

/** 内部工具函数：执行 SQL 并返回行数组 */
function execToRows(db: any, sql: string, params?: any[]): any[] {
  const result = params ? db.exec(sql, params) : db.exec(sql);
  if (!result.length) return [];
  const cols = result[0].columns;
  return result[0].values.map((row: any[]) => {
    const obj: any = {};
    cols.forEach((c: string, i: number) => (obj[c] = row[i]));
    return obj;
  });
}

// ─── 工具定义（OpenAI function calling 格式） ───

export const PLATFORM_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'call_api',
      description: `调用 RepaceClaw 平台后端 API 获取实时数据。
支持所有 /api/* 接口，包括：
- GET /api/agents — 智能体列表
- GET /api/conversations — 会话列表
- GET /api/projects — 项目列表
- GET /api/tasks — 任务列表
- GET /api/admin/templates — 模板列表
- GET /api/admin/user-agents — 用户智能体
- GET /api/admin/organizations — 组织列表
- GET /api/audit-logs — 审计日志
- GET /api/system/stats — 系统统计
- GET /api/token-channels — Token 渠道
- GET /api/bot-channels — Bot 渠道
- GET /api/skills — 技能列表
- GET /api/plugins — 插件列表
- GET /api/models — 模型列表
- GET /api/model-providers — 模型提供商
- GET /api/agent-templates — Agent 模板
- GET /api/search?q=xxx — 全局搜索`,
      parameters: {
        type: 'object',
        properties: {
          method: {
            type: 'string',
            enum: ['GET', 'POST'],
            description: 'HTTP 方法，默认 GET',
          },
          path: {
            type: 'string',
            description: 'API 路径，例如: /api/agents, /api/conversations, /api/system/stats',
          },
          query: {
            type: 'string',
            description: '查询参数（GET 请求），例如: ?limit=10&userId=xxx',
          },
          body: {
            type: 'object',
            description: '请求体（POST 请求），JSON 对象',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'query_db',
      description: '直接查询数据库获取精确数据，适用于统计、计数、列表等场景',
      parameters: {
        type: 'object',
        properties: {
          table: {
            type: 'string',
            enum: ['agents', 'conversations', 'users', 'projects', 'tasks', 'agent_templates', 'messages', 'conversation_agents', 'audit_logs', 'token_channels', 'bot_channels', 'organizations', 'skills', 'plugins'],
            description: '要查询的表名',
          },
          columns: {
            type: 'string',
            description: '要查询的列，逗号分隔，默认 * 查询全部',
          },
          where: {
            type: 'string',
            description: 'WHERE 条件，例如: user_id = "xxx" AND status = "active"',
          },
          limit: {
            type: 'number',
            description: '返回数量限制，默认 20',
          },
          orderBy: {
            type: 'string',
            description: '排序字段，例如: created_at DESC',
          },
        },
        required: ['table'],
      },
    },
  },
];

// ─── 工具执行器 ───

export interface ToolCall {
  name: string;
  arguments: Record<string, any>;
}

export async function executeToolCall(toolCall: ToolCall, userId?: string): Promise<string> {
  try {
    switch (toolCall.name) {
      case 'call_api': {
        return await executeApiCall(toolCall.arguments, userId);
      }

      case 'query_db': {
        return executeDbQuery(toolCall.arguments);
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolCall.name}` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: `Tool execution failed: ${err.message}` });
  }
}

/**
 * 通用 API 调用执行器
 * 通过内部 HTTP 请求调用 RepaceClaw 后端 API
 */
async function executeApiCall(args: any, userId?: string): Promise<string> {
  const http = require('http');
  const https = require('https');

  const method = (args.method || 'GET').toUpperCase();
  const path = args.path || '';
  const query = args.query || '';
  const body = args.body ? JSON.stringify(args.body) : undefined;

  if (!path.startsWith('/api/')) {
    return JSON.stringify({ error: '只允许调用 /api/* 接口' });
  }

  const url = new URL(`http://127.0.0.1:3001${path}${query}`);

  return new Promise<string>((resolve) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request(url.toString(), {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
      },
      timeout: 15000,
    }, (res: any) => {
      let data = '';
      res.on('data', (chunk: Buffer) => (data += chunk.toString()));
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          // 只返回 data 字段，避免暴露完整响应结构
          resolve(JSON.stringify({
            status: res.statusCode,
            data: json.data !== undefined ? json.data : json,
          }));
        } catch {
          resolve(JSON.stringify({ status: res.statusCode, raw: data.substring(0, 1000) }));
        }
      });
    });

    req.on('error', (err: any) => resolve(JSON.stringify({ error: err.message })));
    req.on('timeout', () => { req.destroy(); resolve(JSON.stringify({ error: 'API timeout (15s)' })); });

    if (body) req.write(body);
    req.end();
  });
}

/**
 * 直接数据库查询执行器
 */
function executeDbQuery(args: any): string {
  const db = getDb();
  const table = args.table || '';
  const columns = args.columns || '*';
  const where = args.where ? ` WHERE ${args.where}` : '';
  const orderBy = args.orderBy ? ` ORDER BY ${args.orderBy}` : ' ORDER BY created_at DESC';
  const limit = args.limit || 20;

  // 安全校验：只允许查询已知表
  const allowedTables = [
    'agents', 'conversations', 'users', 'projects', 'tasks',
    'agent_templates', 'messages', 'conversation_agents', 'audit_logs',
    'token_channels', 'bot_channels', 'organizations', 'skills', 'plugins',
  ];
  if (!allowedTables.includes(table)) {
    return JSON.stringify({ error: `不允许查询表: ${table}` });
  }

  try {
    const rows = execToRows(db, `SELECT ${columns} FROM ${table}${where}${orderBy} LIMIT ?`, [limit]);
    return JSON.stringify({
      table,
      total: rows.length,
      rows,
    });
  } catch (err: any) {
    return JSON.stringify({ error: err.message });
  }
}
