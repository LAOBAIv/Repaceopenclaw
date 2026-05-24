/**
 * AgentManager 常量定义
 * 包含有效模型白名单和 Skill 配置项
 */

/** 有效模型名称白名单 */
export const VALID_MODELS = [
  'claude-opus-4-6',
  'glm-5',
  'glm-5.1',
  'glm5',
  'qwen3-max-2026-01-23',
  'kimi-k2.5',
  'minimax-m2.5',
  'qwen3.6-plus',
  'geographer',
  'doubao-pro-32k',
  'qwen-max',
  'auto',
];

/** Skill 配置项 */
export const SKILL_ITEMS: { key: string; label: string; risk: 'high' | 'medium' | 'low' }[] = [
  { key: 'exec', label: '代码执行', risk: 'high' },
  { key: 'shell', label: 'Shell 命令', risk: 'high' },
  { key: 'file_write', label: '文件写入', risk: 'high' },
  { key: 'browser', label: '浏览器控制', risk: 'high' },
  { key: 'image_generation', label: '图片生成', risk: 'medium' },
  { key: 'web_search', label: '网络搜索', risk: 'low' },
  { key: 'file_read', label: '文件读取', risk: 'low' },
];
