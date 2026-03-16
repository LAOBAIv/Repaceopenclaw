/**
 * 轻量 Toast 通知工具
 *
 * 使用方式：
 *   import { showToast } from '@/components/Toast';
 *   showToast('操作成功', 'success');
 *   showToast('请填写名称', 'warning');
 *   showToast('保存失败', 'error');
 */

type ToastType = 'info' | 'success' | 'warning' | 'error';

const TYPE_STYLES: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
  info:    { bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8', icon: 'ℹ' },
  success: { bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d', icon: '✓' },
  warning: { bg: '#fffbeb', border: '#fde68a', color: '#b45309', icon: '⚠' },
  error:   { bg: '#fef2f2', border: '#fecaca', color: '#b91c1c', icon: '✕' },
};

let container: HTMLDivElement | null = null;

function getContainer(): HTMLDivElement {
  if (!container || !document.body.contains(container)) {
    container = document.createElement('div');
    container.style.cssText = [
      'position:fixed',
      'bottom:24px',
      'right:24px',
      'z-index:99999',
      'display:flex',
      'flex-direction:column',
      'gap:8px',
      'pointer-events:none',
      'font-family:"Microsoft YaHei","Segoe UI",sans-serif',
    ].join(';');
    document.body.appendChild(container);
  }
  return container;
}

/**
 * 显示一条 Toast 通知
 * @param message 通知内容
 * @param type    类型：'info' | 'success' | 'warning' | 'error'
 * @param duration 自动消失毫秒数，默认 2800ms
 */
export function showToast(message: string, type: ToastType = 'info', duration = 2800) {
  const c = getContainer();
  const s = TYPE_STYLES[type];

  const el = document.createElement('div');
  el.style.cssText = [
    `background:${s.bg}`,
    `border:1px solid ${s.border}`,
    `color:${s.color}`,
    'border-radius:10px',
    'padding:10px 16px 10px 12px',
    'font-size:13px',
    'font-weight:500',
    'display:flex',
    'align-items:center',
    'gap:8px',
    'box-shadow:0 4px 16px rgba(0,0,0,0.10)',
    'pointer-events:auto',
    'max-width:340px',
    'word-break:break-all',
    'line-height:1.5',
    'transform:translateX(120%)',
    'transition:transform 0.25s cubic-bezier(0.34,1.56,0.64,1),opacity 0.25s',
    'opacity:0',
  ].join(';');

  el.innerHTML = `
    <span style="font-size:15px;font-weight:700;flex-shrink:0">${s.icon}</span>
    <span>${message}</span>
  `;

  c.appendChild(el);

  // 入场动画
  requestAnimationFrame(() => {
    el.style.transform = 'translateX(0)';
    el.style.opacity = '1';
  });

  // 自动消失
  setTimeout(() => {
    el.style.transform = 'translateX(120%)';
    el.style.opacity = '0';
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 280);
  }, duration);
}
