/**
 * AgentAvatar - 智能体头像组件
 * 根据智能体名称首字母和颜色生成圆形头像
 */
import type { Agent } from '@/types';

export function AgentAvatar({ agent }: { agent: Agent }) {
  return (
    <div style={{
      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
      background: agent.color + '22',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: agent.color, fontWeight: 700, fontSize: 15,
      border: `2px solid ${agent.color}44`,
    }}>
      {agent.name.charAt(0)}
    </div>
  );
}
