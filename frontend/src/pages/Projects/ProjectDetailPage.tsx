import React from 'react';
import { useNavigate } from 'react-router-dom';

export function ProjectDetailPage() {
  const navigate = useNavigate();

  return (
    <div style={{ 
      display: 'flex', 
      height: '100%',
      background: 'var(--body-bg)',
      fontFamily: '"Microsoft YaHei","Segoe UI",sans-serif'
    }}>
      {/* 左侧导航栏 */}
      <div style={{
        width: '240px',
        background: '#ffffff',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ 
          padding: '16px', 
          borderBottom: '1px solid #f3f4f6',
          marginBottom: '16px'
        }}>
          <button
            onClick={() => navigate('/')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'transparent',
              border: 'none',
              fontSize: '16px',
              fontWeight: 600,
              color: '#1f2937',
              cursor: 'pointer',
              padding: '8px 0'
            }}
          >
            <span>🏠</span>
            RepaceClaw
          </button>
        </div>
      </div>

      {/* 中间聊天区域 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* 顶部标题栏 */}
        <div style={{
          height: '56px',
          flexShrink: 0,
          borderBottom: '1px solid #e5e7eb',
          background: '#fff',
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          gap: '16px'
        }}>
          <span>💬</span>
          <span style={{ fontWeight: 700, fontSize: '15px', color: '#1a202c' }}>
            项目详情
          </span>
        </div>

        {/* 聊天区域 */}
        <div style={{ 
          flex: 1, 
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center'
        }}>
          <div style={{ textAlign: 'center', color: '#6b7280' }}>
            <h2>群聊功能开发中</h2>
            <p>正在集成WebSocket和API，请稍后...</p>
          </div>
        </div>
      </div>

      {/* 右侧成员列表 */}
      <div style={{
        width: '240px',
        background: '#ffffff',
        borderLeft: '1px solid #e5e7eb',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h3 style={{ 
          fontSize: '16px', 
          fontWeight: 600, 
          color: '#1f2937', 
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '1px solid #f3f4f6'
        }}>
          成员列表
        </h3>
      </div>
    </div>
  );
}