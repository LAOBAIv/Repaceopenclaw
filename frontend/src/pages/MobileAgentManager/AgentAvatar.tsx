/**
 * AgentAvatar 智能体头像组件
 * 显示智能体名称首字母，带颜色主题
 */
import { Agent } from '@/types';

interface AgentAvatarProps {
  agent: Agent;
}

/**
 * 智能体头像组件
 * 以圆形背景显示智能体名称首字母，颜色跟随 agent.color
 */
export function AgentAvatar({ agent }: AgentAvatarProps) {
  return (
    <div style={{
      width: 44,
      height: 44,
      borderRadius: '50%',
      flexShrink: 0,
      background: agent.color + '22',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: agent.color,
      fontWeight: 700,
      fontSize: 18,
      border: `2px solid ${agent.color}44`,
    }}>
      {agent.name.charAt(0)}
    </div>
  );
}
