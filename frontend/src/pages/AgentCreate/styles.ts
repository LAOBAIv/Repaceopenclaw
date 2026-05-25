/**
 * AgentCreate 页面内联样式表
 * 从 AgentCreate.tsx 拆分出来，避免主组件文件过长
 */

export const PAGE_STYLES = `
  .ac-wrap {
    width: 100%; flex: 1; min-height: 0;
    display: flex; flex-direction: column;
    font-family: "Microsoft YaHei", "Segoe UI", sans-serif;
    background: #f5f7fa; padding: 16px; box-sizing: border-box; overflow: hidden;
  }
  .ac-card {
    flex: 1; min-height: 0; display: flex; flex-direction: column;
    background: #fafbfc; border: 1px solid #e5e6eb;
    border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.05); overflow: hidden;
  }
  .ac-header {
    padding: 16px 32px; border-bottom: 1px solid #e5e6eb;
    background: #ffffff; display: flex; align-items: center; gap: 10px; flex-shrink: 0;
  }
  .ac-scroll {
    flex: 1; min-height: 0; overflow: hidden;
    padding: 16px 20px 0; display: flex; flex-direction: column;
  }
  .ac-form {
    flex: 1; min-height: 0; background: transparent; padding: 0;
    box-sizing: border-box; display: flex; flex-direction: column;
  }
  .ac-cols {
    flex: 1; min-height: 0;
    display: grid; grid-template-columns: 1fr 1fr; gap: 16px;
    overflow: hidden;
  }
  .ac-col {
    display: flex; flex-direction: column; gap: 0;
    min-height: 0; overflow: hidden;
  }
  .ac-footer {
    padding: 10px 24px; border-top: 1px solid #ebebeb;
    background: #fff; display: flex; justify-content: center; gap: 10px; flex-shrink: 0;
  }
  .ac-skill-trigger {
    display: flex; align-items: center; gap: 10px;
    padding: 7px 10px; border: 1px solid #d1d5db; border-radius: 7px;
    background: #fff; cursor: pointer; transition: border-color 0.15s;
    min-height: 36px; flex-wrap: wrap;
  }
  .ac-skill-trigger:hover { border-color: #2a3b4d; }
  .ac-skill-chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 10px; border-radius: 20px;
    background: #2a3b4d12; color: #2a3b4d; font-size: 12px;
    border: 1px solid #2a3b4d30;
  }
  .ac-skill-chip-del {
    display: flex; align-items: center; cursor: pointer; color: #9ca3af;
    background: none; border: none; padding: 0; line-height: 1; transition: color 0.1s;
  }
  .ac-skill-chip-del:hover { color: #2a3b4d; }
  .ac-skill-placeholder { font-size: 13px; color: #9ca3af; flex: 1; }
  .ac-skill-arrow { margin-left: auto; color: #9ca3af; flex-shrink: 0; }
  .ac-model-trigger {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 7px;
    background: #fff; cursor: pointer; transition: border-color 0.15s; min-height: 38px;
  }
  .ac-model-trigger:hover { border-color: #2a3b4d; }
  .ac-model-trigger-icon { color: #2a3b4d; flex-shrink: 0; }
  .ac-model-trigger-info { flex: 1; min-width: 0; }
  .ac-model-trigger-name { font-size: 13px; font-weight: 600; color: #1a202c; }
  .ac-model-trigger-sub  { font-size: 11px; color: #9ca3af; margin-top: 1px; }
  .ac-token-trigger {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 7px;
    background: #fff; cursor: pointer; transition: border-color 0.15s; min-height: 38px;
  }
  .ac-token-trigger:hover { border-color: #2a3b4d; }
  .ac-token-trigger-icon { color: #2a3b4d; flex-shrink: 0; }
  .ac-token-trigger-info { flex: 1; min-width: 0; }
  .ac-token-trigger-name { font-size: 13px; font-weight: 600; color: #1a202c; display: flex; align-items: center; gap: 6px; }
  .ac-token-trigger-sub  { font-size: 11px; color: #9ca3af; margin-top: 1px; }
  .ac-token-dot {
    width: 7px; height: 7px; border-radius: 50%; background: #22c55e; flex-shrink: 0;
  }
  .ac-btn-cancel {
    padding: 7px 18px; border-radius: 7px; border: 1px solid #d1d5db;
    background: #fff; color: #6b7280; font-size: 13px;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
  }
  .ac-btn-cancel:hover { border-color: #e53e3e; color: #e53e3e; background: #fff5f5; }
  .ac-btn-create {
    padding: 7px 22px; border-radius: 7px; border: none;
    background: #2a3b4d; color: #fff; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.15s; font-family: inherit;
  }
  .ac-btn-create:hover { background: #1e2d3d; }
  .ac-modal-mask {
    position: fixed; inset: 0; z-index: 1000;
    background: rgba(0,0,0,0.25);
    display: flex; align-items: center; justify-content: center;
  }
  .ac-modal {
    background: #fff; border-radius: 12px;
    width: 480px; max-width: 95vw;
    box-shadow: 0 8px 32px rgba(0,0,0,0.14);
    display: flex; flex-direction: column; overflow: hidden; max-height: 80vh;
  }
  .ac-modal-head {
    padding: 14px 18px; border-bottom: 1px solid #f0f0f0;
    display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  }
  .ac-modal-title { font-size: 14px; font-weight: 700; color: #1a202c; }
  .ac-modal-close {
    cursor: pointer; color: #9ca3af; display: flex; align-items: center;
    background: none; border: none; padding: 2px; transition: color 0.15s;
  }
  .ac-modal-close:hover { color: #374151; }
  .ac-modal-body { flex: 1; overflow-y: auto; padding: 10px 14px; }
  .ac-modal-item {
    display: flex; align-items: center; gap: 14px;
    padding: 9px 12px; border-radius: 8px; cursor: pointer;
    border: 1.5px solid #e5e7eb; transition: all 0.15s; margin-bottom: 7px; background: #fff;
  }
  .ac-modal-item:last-child { margin-bottom: 0; }
  .ac-modal-item:hover { border-color: #2a3b4d; background: #f5f7fa; }
  .ac-modal-item.selected { border-color: #2a3b4d; background: #2a3b4d08; }
  .ac-modal-check {
    width: 18px; height: 18px; border-radius: 50%; flex-shrink: 0;
    border: 1.5px solid #d1d5db; display: flex; align-items: center; justify-content: center;
    transition: all 0.15s;
  }
  .ac-modal-item.selected .ac-modal-check { background: #2a3b4d; border-color: #2a3b4d; }
  .ac-modal-item-info { flex: 1; min-width: 0; }
  .ac-modal-item-name {
    font-size: 13px; font-weight: 600; color: #1a202c; margin-bottom: 2px;
    display: flex; align-items: center; gap: 6px;
  }
  .ac-modal-item-cat {
    font-size: 11px; padding: 1px 7px; border-radius: 4px;
    background: #f3f4f6; color: #6b7280; font-weight: 400;
  }
  .ac-modal-item-desc { font-size: 12px; color: #9ca3af; line-height: 1.5; }
  .ac-modal-foot {
    padding: 12px 18px; border-top: 1px solid #f0f0f0;
    display: flex; align-items: center; justify-content: space-between; flex-shrink: 0;
  }
  .ac-modal-selected-tip { font-size: 12px; color: #9ca3af; }
  .ac-modal-foot-btns { display: flex; gap: 8px; }
  .ac-modal-btn-cancel {
    padding: 7px 18px; border-radius: 7px; border: 1px solid #d1d5db;
    background: #fff; color: #6b7280; font-size: 13px;
    cursor: pointer; transition: all 0.15s; font-family: inherit;
  }
  .ac-modal-btn-cancel:hover { background: #f3f4f6; }
  .ac-modal-btn-confirm {
    padding: 7px 20px; border-radius: 7px; border: none;
    background: #2a3b4d; color: #fff; font-size: 13px; font-weight: 600;
    cursor: pointer; transition: background 0.15s; font-family: inherit;
  }
  .ac-modal-btn-confirm:hover { background: #1e2d3d; }
  .ac-modal-btn-confirm:disabled { background: #9ca3af; cursor: not-allowed; }
  .tk-modal { width: 500px; }
  .tk-section-title {
    font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase;
    letter-spacing: 0.05em; padding: 10px 14px 6px;
  }
  .tk-input-area { padding: 4px 14px 14px; display: flex; flex-direction: column; gap: 10px; }
  .tk-input-row { display: flex; flex-direction: column; gap: 4px; }
  .tk-input-label { font-size: 11px; font-weight: 600; color: #374151; }
  .tk-token-wrap { position: relative; display: flex; align-items: center; }
  .tk-token-input {
    width: 100%; padding: 7px 72px 7px 10px; font-size: 12px;
    border: 1px solid #d1d5db; border-radius: 7px;
    outline: none; color: #111827; background: #fff;
    box-sizing: 'border-box'; transition: border-color 0.15s;
    font-family: "Courier New", monospace; letter-spacing: 0.03em;
  }
  .tk-token-input:focus { border-color: #2a3b4d; }
  .tk-token-actions {
    position: absolute; right: 6px; display: flex; align-items: center; gap: 4px;
  }
  .tk-icon-btn {
    display: flex; align-items: center; justify-content: center;
    width: 26px; height: 26px; border-radius: 5px;
    border: none; background: none; cursor: pointer; color: #9ca3af;
    transition: color 0.15s, background 0.15s;
  }
  .tk-icon-btn:hover { color: #2a3b4d; background: #f3f4f6; }
  .tk-divider { height: 1px; background: #f0f0f0; margin: 4px 0; }
  .cm-modal { width: 880px; }
  .cm-body  { display: flex; flex-direction: column; gap: 0; overflow: hidden; }
  .cm-two-cols {
    display: flex; flex-direction: row; flex: 1; min-height: 0; overflow: hidden;
  }
  .cm-col-models {
    width: 380px; flex-shrink: 0; border-right: 1px solid #f0f0f0;
    overflow-y: auto; display: flex; flex-direction: column;
  }
  .cm-col-params {
    flex: 1; min-width: 0; overflow-y: auto; display: flex; flex-direction: column;
  }
  .cm-section-title {
    font-size: 11px; font-weight: 700; color: #9ca3af; text-transform: uppercase;
    letter-spacing: 0.05em; padding: 10px 14px 6px; flex-shrink: 0;
  }
  .cm-preset-list { padding: 0 14px 14px; }
  .cm-preset-item {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 10px 12px; border-radius: 8px; cursor: pointer;
    border: 1.5px solid #e5e7eb; transition: all 0.15s; margin-bottom: 7px; background: #fff;
  }
  .cm-preset-item:last-child { margin-bottom: 0; }
  .cm-preset-item:hover { border-color: #2a3b4d; background: #f5f7fa; }
  .cm-preset-item.selected { border-color: #2a3b4d; background: #2a3b4d08; }
  .cm-preset-info { flex: 1; min-width: 0; }
  .cm-preset-name-row { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
  .cm-preset-name  { font-size: 13px; font-weight: 600; color: #1a202c; }
  .cm-preset-provider {
    font-size: 11px; padding: 1px 7px; border-radius: 4px;
    background: #f3f4f6; color: #6b7280;
  }
  .cm-preset-badge {
    font-size: 11px; padding: 1px 7px; border-radius: 4px; font-weight: 500;
  }
  .cm-preset-ctx  { font-size: 11px; color: #6b7280; margin-bottom: 3px; }
  .cm-preset-desc { font-size: 12px; color: #9ca3af; line-height: 1.5; }
  .cm-params-grid {
    display: grid; grid-template-columns: 1fr 1fr; gap: 12px; padding: 6px 16px 16px;
  }
  .cm-param-item { display: flex; flex-direction: column; gap: 4px; }
  .cm-param-label { font-size: 11px; font-weight: 600; color: #374151; }
  .cm-param-sub   { font-size: 10px; color: #9ca3af; margin-top: 1px; }
  .cm-params-empty {
    flex: 1; display: flex; align-items: center; justify-content: center;
    color: #c0c8d4; font-size: 13px; padding: 40px 20px;
  }
  @media (max-width: 960px) {
    .cm-modal { width: 95vw; }
    .cm-two-cols { flex-direction: column; }
    .cm-col-models { width: 100%; border-right: none; border-bottom: 1px solid #f0f0f0; }
    .cm-params-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (max-width: 760px) {
    .ac-cols { grid-template-columns: 1fr; overflow-y: auto; }
    .ac-scroll { overflow-y: auto; }
  }
  @media (max-width: 600px) {
    .ac-scroll { padding: 12px; }
    .ac-btn-cancel, .ac-btn-create { width: 100%; }
    .cm-params-grid { grid-template-columns: 1fr; }
  }
`;
