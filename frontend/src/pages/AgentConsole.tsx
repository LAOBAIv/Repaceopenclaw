/**
 * @file AgentConsole 向后兼容 re-export
 * App.tsx 中 import { AgentConsole } from './pages/AgentConsole' 会解析到此文件
 * 实际实现已拆分为 AgentConsole/ 子目录
 */
export { AgentConsole } from './AgentConsole/index';
