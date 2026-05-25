/**
 * ILinkMonitor Poll — Long-poll 主循环、状态管理
 */
import { logger } from '../../utils/logger';
import { getErrorMessage } from '../../types/ilink';
import { ILinkConfig, loadConfig, loadSyncBuf, saveSyncBuf } from './config';
import { getUpdates } from './api';
import { handleIncomingMessage } from './handler';

const LONG_POLL_TIMEOUT_MS = 35000;
const MAX_CONSECUTIVE_FAILURES = 5;
const BACKOFF_DELAY_MS = 30000;
const RETRY_DELAY_MS = 2000;

let isRunning = false;
let abortController: AbortController | null = null;

// 状态跟踪
let lastPollAt = '';
let pollMessageCount = 0;
let pollCycleCount = 0;
let lastMessageAt = '';
let lastError = '';
let startedAt = '';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function startILinkMonitor(): Promise<void> {
  if (isRunning) { logger.info('[iLink] Monitor already running'); return; }

  const config = loadConfig();
  if (!config) { logger.error('[iLink] Config not found, monitor not started'); return; }

  isRunning = true;
  startedAt = new Date().toISOString();
  abortController = new AbortController();
  let syncBuf = loadSyncBuf();
  let consecutiveFailures = 0;

  logger.info(`[iLink] Monitor started (baseUrl=${config.baseUrl})`);

  while (isRunning && !abortController.signal.aborted) {
    try {
      logger.info(`[iLink] Polling... (syncBuf=${syncBuf ? syncBuf.length + 'chars' : 'empty'})`);
      const resp = await getUpdates(config, syncBuf) as Record<string, unknown>;

      if (resp.get_updates_buf) {
        syncBuf = resp.get_updates_buf as string;
        saveSyncBuf(syncBuf);
      }

      consecutiveFailures = 0;

      const messages = (resp.msgs as Array<Record<string, unknown>>) || [];
      logger.info(`[iLink] Poll returned: ${messages.length} messages`);
      updatePollStatus(messages.length);
      for (const msg of messages) {
        const fromId = msg.from_user_id as string | undefined;
        if (fromId && fromId.includes('@im.bot')) continue;
        await handleIncomingMessage(config, msg);
      }

      await sleep(100);
    } catch (e: unknown) {
      if (getErrorMessage(e) === 'TIMEOUT') {
        logger.info('[iLink] Poll timeout, retrying...');
        continue;
      }

      consecutiveFailures++;
      lastError = getErrorMessage(e);
      logger.error(`[iLink] Poll error (${consecutiveFailures}/${MAX_CONSECUTIVE_FAILURES}): ${getErrorMessage(e)}`);

      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        logger.error(`[iLink] Too many failures, backing off ${BACKOFF_DELAY_MS}ms`);
        await sleep(BACKOFF_DELAY_MS);
        consecutiveFailures = 0;
      } else {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  logger.info('[iLink] Monitor stopped');
  isRunning = false;
}

export function stopILinkMonitor(): void {
  isRunning = false;
  if (abortController) { abortController.abort(); abortController = null; }
}

export function getILinkStatus() {
  return {
    running: isRunning, startedAt, lastPollAt, lastMessageAt,
    pollMessageCount, pollCycleCount, lastError,
  };
}

export function updatePollStatus(messageCount: number) {
  lastPollAt = new Date().toISOString();
  pollCycleCount++;
  pollMessageCount += messageCount;
  if (messageCount > 0) lastMessageAt = lastPollAt;
}
