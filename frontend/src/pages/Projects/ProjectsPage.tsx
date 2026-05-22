import React from 'react';
import { useNavigate } from 'react-router-dom';

export function ProjectsPage() {
  const navigate = useNavigate();

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100%',
      background: 'var(--body-bg)',
      fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif'
    }}>
      {/* 顶部导航 */}
      <div style={{
        height: 56, 
        flexShrink: 0, 
        borderBottom: '1px solid #e5e7eb',
        background: '#fff', 
        display: 'flex', 
        alignItems: 'center', 
        padding: '0 24px',
        gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>💬</span>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1a202c' }}>项目列表</span>
        </div>
      </div>

      {/* 主内容区域 */}
      <div style={{ 
        flex: 1, 
        padding: '24px', 
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#6b7280' }}>
          <h2>群聊项目功能开发中</h2>
          <p>正在集成到现有系统，请稍后...</p>
          <button
            onClick={() => navigate('/')}
            style={{
              marginTop: '24px',
              background: '#4f46e5',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            返回主页
          </button>
        </div>
      </div>
    </div>
  );
}