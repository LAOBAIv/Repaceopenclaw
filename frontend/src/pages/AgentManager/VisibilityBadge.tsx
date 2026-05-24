/**
 * VisibilityBadge - 可见性标签组件
 * 根据 visibility 值显示对应的图标和标签（私有/公开/模板）
 */
import { Eye, EyeOff } from 'lucide-react';

export function VisibilityBadge({ visibility }: { visibility?: string }) {
  const v = visibility || 'private';
  const config: Record<string, { icon: React.ComponentType<{ size?: number }>; label: string; bg: string; color: string }> = { // [2026-05-24] 类型安全
    private: { icon: EyeOff, label: '私有', bg: '#f3f4f6', color: '#6b7280' },
    public:  { icon: Eye,    label: '公开', bg: '#dcfce7', color: '#16a34a' },
    template:{ icon: Eye,    label: '模板', bg: '#dbeafe', color: '#2563eb' },
  };
  const { icon: Icon, label, bg, color } = config[v] || config.private;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 6px', borderRadius: 10,
      background: bg, fontSize: 10, color, fontWeight: 500,
    }} title={`可见性: ${label}`}>
      <Icon size={9} />
      {label}
    </span>
  );
}
