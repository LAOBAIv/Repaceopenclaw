import { AgentCrud } from './crud';
import { AgentLlm } from './llm';
import type { Agent, DbRow } from './helpers';
export type { Agent, DbRow };
export { buildPlatformAssistantAgent, buildWechatAssistantAgent, rowToAgent } from './helpers';

export const AgentService = {
  ...AgentCrud,
  ...AgentLlm,
};
