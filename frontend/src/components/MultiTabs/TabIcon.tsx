/**
 * Tab 图标组件
 * 根据类型渲染不同的 SVG 图标（项目/任务）
 */

import React from 'react';
import type { TabIconProps } from './types';

const TabIcon: React.FC<TabIconProps> = ({ type, color = '#6366f1' }) => {
  if (type === 'project') {
    // 项目图标：文件夹
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}>
        <path
          d="M1.5 3.5C1.5 2.67 2.17 2 3 2H6L7.5 3.5H13C13.83 3.5 14.5 4.17 14.5 5V12.5C14.5 13.33 13.83 14 13 14H3C2.17 14 1.5 13.33 1.5 12.5V3.5Z"
          stroke={color}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path d="M1.5 6H14.5" stroke={color} strokeWidth="1.2" />
      </svg>
    );
  }
  // 任务图标：对勾圆圈
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ marginRight: 6 }}>
      <circle cx="8" cy="8" r="6" stroke={color} strokeWidth="1.2" />
      <path d="M5 8L7 10L11 6" stroke={color} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
};

export default TabIcon;
