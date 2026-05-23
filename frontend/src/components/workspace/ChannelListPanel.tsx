/**
 * ChannelListPanel — 消息渠道列表面板组件
 *
 * 职责：展示已配置的消息渠道列表（飞书、企业微信、钉钉等），
 * 提供连接按钮。从 TabPanel 拆分。
 */
import React from 'react';
import { CHANNEL_LIST } from '@/components/workspace';

const itemStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '10px 12px', borderRadius: 8, background: '#f9fafb',
  marginBottom: 7, fontSize: 13, color: '#374151', border: '1px solid #f0f0f0',
};

const badgeStyle = (color: string): React.CSSProperties => ({
  fontSize: 11, padding: '2px 8px', borderRadius: 4,
  background: color + '18', color,
});

const connectBtnStyle: React.CSSProperties = {
  fontSize: 12, padding: '4px 14px', borderRadius: 6,
  border: '1.5px solid #e5e7eb', background: '#fff',
  cursor: 'pointer', color: '#374151',
  fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif',
};

export function ChannelListPanel() {
  return (
    <div>
      {CHANNEL_LIST.map(ch => (
        <div key={ch.name} style={itemStyle}>
          <span style={{ fontWeight: 500 }}>{ch.name}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={badgeStyle(ch.color)}>{ch.status}</span>
            <button style={connectBtnStyle}>连接</button>
          </div>
        </div>
      ))}
    </div>
  );
}
