/**
 * AgentManager 样式定义
 * 包含所有 CSS 类样式
 */
export const agentManagerStyles = `
  .am-wrap {
    width: 100%;
    flex: 1; min-height: 0;
    display: flex; flex-direction: column;
    font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
    background: #f5f7fa;
    padding: 16px; box-sizing: border-box;
    overflow: hidden;
  }
  .am-shell {
    flex: 1; min-height: 0; display: flex; flex-direction: column;
    background: #fafbfc; border: 1px solid #e5e6eb;
    border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    overflow: hidden;
  }
  .am-header {
    padding: 16px 32px;
    min-height: 58px;
    border-bottom: 1px solid #e5e6eb;
    background: #fff;
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
    box-sizing: border-box;
  }
  .am-header-left { display: flex; align-items: center; gap: 10px; }
  .am-header-btn {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 8px; border: none;
    background: #2a3b4d; color: #fff;
    font-weight: 600; font-size: 13px; cursor: pointer;
    font-family: inherit; transition: background 0.15s;
  }
  .am-header-btn:hover { background: #1e2d3d; }
  .am-scroll {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 14px 20px 16px;
    box-sizing: border-box;
  }
  .am-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }
  .am-item {
    padding: 16px;
    background: #ffffff;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
    display: flex; flex-direction: column; gap: 10px;
    min-height: 220px;
  }
  .am-item:hover {
    border-color: #cfd6df;
    box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  }
  .am-item-top { display: flex; align-items: center; gap: 10px; }
  .am-item-new {
    padding: 20px;
    background: #ffffff;
    border: 1px dashed #c8cfd8;
    border-radius: 12px;
    cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px;
    transition: border-color 0.15s, box-shadow 0.15s;
    color: #94a3b8; font-size: 14px;
    min-height: 220px;
  }
  .am-item-new:hover {
    border-color: #2a3b4d;
    color: #2a3b4d;
    box-shadow: 0 2px 10px rgba(0,0,0,0.06);
  }
  .am-name {
    font-size: 14px; font-weight: 600;
    color: #333333;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .am-style {
    font-size: 11px; color: #9ca3af; margin-top: 2px;
  }
  .am-desc {
    font-size: 12px; color: #6b7280;
    line-height: 1.6;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    min-height: 38px;
  }
  .am-tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .am-tag {
    padding: 2px 8px; border-radius: 999px; font-size: 11px;
    background: #f3f4f6; color: #6b7280; border: 1px solid #e5e7eb;
  }
  /* ── 卡片操作区 ── */
  .am-item { position: relative; }
  .am-item-actions {
    position: absolute; top: 10px; right: 10px;
    display: flex; gap: 4px;
    opacity: 0; transition: opacity 0.15s;
  }
  .am-item:hover .am-item-actions { opacity: 1; }
  .am-action-btn {
    width: 28px; height: 28px; border-radius: 7px;
    border: none; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s, color 0.15s;
  }
  .am-action-btn-del {
    background: #fff0f0; color: #d1453b;
  }
  .am-action-btn-del:hover { background: #ffd9d9; color: #b91c1c; }
  .am-action-btn-edit {
    background: #f0f5ff; color: #2a6be8;
  }
  .am-action-btn-edit:hover { background: #dce8ff; color: #1a4fc4; }

  /* ── 删除确认弹窗 ── */
  .am-del-mask {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.35);
    display: flex; align-items: center; justify-content: center;
  }
  .am-del-dialog {
    background: #fff; border-radius: 14px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    width: 360px; padding: 28px 28px 24px;
    display: flex; flex-direction: column; gap: 0;
    font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
  }
  .am-del-icon-wrap {
    width: 48px; height: 48px; border-radius: 50%;
    background: #fff3f3; display: flex; align-items: center; justify-content: center;
    margin-bottom: 16px;
  }
  .am-del-title {
    font-size: 16px; font-weight: 700; color: #1a202c; margin-bottom: 8px;
  }
  .am-del-desc {
    font-size: 13px; color: #6b7280; line-height: 1.6; margin-bottom: 24px;
  }
  .am-del-desc strong { color: #1a202c; }
  .am-del-btns { display: flex; justify-content: flex-end; gap: 10px; }
  .am-del-btn-cancel {
    padding: 8px 20px; border-radius: 8px; border: 1px solid #e5e7eb;
    background: #fff; color: #374151; font-size: 13px; font-weight: 500;
    cursor: pointer; font-family: inherit; transition: background 0.15s;
  }
  .am-del-btn-cancel:hover { background: #f9fafb; }
  .am-del-btn-confirm {
    padding: 8px 20px; border-radius: 8px; border: none;
    background: #dc2626; color: #fff; font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: inherit; transition: background 0.15s;
  }
  .am-del-btn-confirm:hover:not(:disabled) { background: #b91c1c; }
  .am-del-btn-confirm:disabled { background: #fca5a5; cursor: not-allowed; }

  /* ── Skill 配置弹窗 ── */
  .am-skill-mask {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.35);
    display: flex; align-items: center; justify-content: center;
  }
  .am-skill-dialog {
    background: #fff; border-radius: 14px;
    box-shadow: 0 8px 40px rgba(0,0,0,0.18);
    width: 420px; padding: 24px 24px 20px;
    display: flex; flex-direction: column; gap: 0;
    font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
    max-height: 80vh;
  }
  .am-skill-title {
    font-size: 15px; font-weight: 700; color: #1a202c; margin-bottom: 4px;
  }
  .am-skill-subtitle {
    font-size: 12px; color: #9ca3af; margin-bottom: 16px;
  }
  .am-skill-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px;
    margin-bottom: 20px;
  }
  .am-skill-item {
    display: flex; align-items: center; gap: 8px;
    padding: 8px 10px; border-radius: 8px;
    border: 1px solid #e5e7eb; cursor: pointer;
    transition: all 0.15s; user-select: none;
  }
  .am-skill-item:hover { border-color: #2a3b4d; background: #f9fafb; }
  .am-skill-item.active { border-color: #2a3b4d; background: #f0f5ff; }
  .am-skill-dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  }
  .am-skill-item-label { font-size: 13px; color: #374151; flex: 1; }
  .am-skill-item-status { font-size: 11px; color: #9ca3af; }
  .am-skill-btns { display: flex; justify-content: flex-end; gap: 10px; }

  /* ── 可见性选择器 ── */
  .am-vis-selector {
    display: flex; gap: 6px; margin-bottom: 16px;
  }
  .am-vis-btn {
    flex: 1; padding: 8px 0; border-radius: 8px; border: 1.5px solid #e5e7eb;
    background: #fff; cursor: pointer; text-align: center;
    font-size: 12px; color: #6b7280; transition: all 0.15s;
  }
  .am-vis-btn:hover { border-color: #2a3b4d; }
  .am-vis-btn.active { border-color: #2a3b4d; background: #f0f5ff; color: #2a3b4d; font-weight: 600; }
  .am-vis-btn:disabled { opacity: 0.5; cursor: not-allowed; }

  /* ── 模型参数区 ── */
  .am-model-bar {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 10px;
    background: #f8f9fb;
    border: 1px solid #edf0f3;
    border-radius: 8px;
    margin-top: auto;
  }
  .am-model-channel {
    font-size: 11.5px; font-weight: 600; color: #374151;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    max-width: 100px;
  }
  .am-model-name {
    font-size: 11.5px; color: #6b7280;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    flex: 1; min-width: 0;
  }
  .am-model-sep {
    width: 1px; height: 12px; background: #e5e7eb; flex-shrink: 0;
  }

  @media (max-width: 900px) {
    .am-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 560px) {
    .am-grid { grid-template-columns: 1fr; }
    .am-scroll { padding: 14px 16px 16px; }
    .am-header { padding: 14px 16px; }
  }
`;
