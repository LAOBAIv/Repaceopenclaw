/**
 * DeleteConfirmDialog - 删除确认弹窗组件
 */
import { AlertTriangle } from 'lucide-react';
import type { Agent } from '@/types';

interface Props {
  agent: Agent;
  deleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmDialog({ agent, deleting, onConfirm, onCancel }: Props) {
  return (
    <div className="am-del-mask" onClick={onCancel}>
      <div className="am-del-dialog" onClick={e => e.stopPropagation()}>
        <div className="am-del-icon-wrap">
          <AlertTriangle size={22} color="#dc2626" />
        </div>
        <div className="am-del-title">确认删除智能体</div>
        <div className="am-del-desc">
          即将删除智能体 <strong>「{agent.name}」</strong>，删除后无法恢复，相关配置和数据将一并清除。
        </div>
        <div className="am-del-btns">
          <button className="am-del-btn-cancel" onClick={onCancel} disabled={deleting}>
            取消
          </button>
          <button className="am-del-btn-confirm" onClick={onConfirm} disabled={deleting}>
            {deleting ? '删除中...' : '确认删除'}
          </button>
        </div>
      </div>
    </div>
  );
}
