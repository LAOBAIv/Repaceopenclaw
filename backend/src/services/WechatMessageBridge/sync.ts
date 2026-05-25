import fs from 'fs';
import path from 'path';
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../types/ilink';

const BRIDGE_STATE_DIR = '/root/.openclaw/workspace/RepaceClaw/backend/data/wechat-bridge';

export interface SyncState {
  ilinkUserId: string;
  getUpdatesBuf: string;
  lastSyncAt: string;
  conversationId: string;
}

export function loadSyncState(): Map<string, SyncState> {
  const states = new Map<string, SyncState>();
  try {
    if (!fs.existsSync(BRIDGE_STATE_DIR)) return states;
    const files = fs.readdirSync(BRIDGE_STATE_DIR);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const data = JSON.parse(fs.readFileSync(path.join(BRIDGE_STATE_DIR, file), 'utf8'));
        if (data.ilinkUserId) states.set(data.ilinkUserId, data);
      } catch { /* skip */ }
    }
  } catch { /* skip */ }
  return states;
}

export function saveSyncState(state: SyncState): void {
  try {
    if (!fs.existsSync(BRIDGE_STATE_DIR)) fs.mkdirSync(BRIDGE_STATE_DIR, { recursive: true });
    const file = path.join(BRIDGE_STATE_DIR, `${state.ilinkUserId}.json`);
    fs.writeFileSync(file, JSON.stringify(state, null, 2));
  } catch (err: unknown) {
    logger.warn('[WechatBridge] Failed to save sync state', { error: getErrorMessage(err) });
  }
}
