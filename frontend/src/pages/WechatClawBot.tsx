import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageCircle, RefreshCw, QrCode, Wifi, WifiOff, CheckCircle, Clock, AlertTriangle, Activity, Radio, Trash2, Users, Copy, ExternalLink, Info, Smartphone } from 'lucide-react';

const API_BASE = '/api/wechat-clawbot';

type WsState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

interface StatusData {
  wsConnection: WsState;
  channelStatus: any;
  timestamp: string;
}

interface ScanStatus {
  status: 'wait' | 'scaned' | 'confirmed' | 'expired';
  credentials?: { bot_token: string; ilink_bot_id: string; ilink_user_id: string };
  baseurl?: string;
}

interface BoundAccount {
  accountId: string;
  userId: string;
  hasToken: boolean;
  savedAt: string;
}

interface SseEvent {
  type: string;
  data: any;
  time: string;
}

/** QR 码数据类型 */
type QrType = 'image_base64' | 'image_url' | 'web_link';

export function WechatClawBot() {
  const [wsState, setWsState] = useState<WsState>('disconnected');
  const [status, setStatus] = useState<StatusData | null>(null);
  const [qrUrl, setQrUrl] = useState('');
  const [qrOriginalUrl, setQrOriginalUrl] = useState('');
  const [qrType, setQrType] = useState<QrType>('web_link');
  const [qrToken, setQrToken] = useState('');
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [sseConnected, setSseConnected] = useState(false);
  const [events, setEvents] = useState<SseEvent[]>([]);
  const [showEvents, setShowEvents] = useState(false);
  const [boundAccounts, setBoundAccounts] = useState<BoundAccount[]>([]);
  const [showGuide, setShowGuide] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const hasAccountsRef = useRef(false);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(API_BASE + '/status');
      const json = await res.json();
      if (json.success) {
        setStatus(json.data);
        setWsState(json.data.wsConnection);
      }
    } catch { setWsState('disconnected'); }
  }, []);

  const fetchAccounts = useCallback(async () => {
    try {
      const res = await fetch(API_BASE + '/accounts');
      const json = await res.json();
      if (json.success) {
        const accounts = json.data.accounts || [];
        setBoundAccounts(accounts);
        hasAccountsRef.current = accounts.length > 0;
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const es = new EventSource(API_BASE + '/events');
    es.onopen = () => { setSseConnected(true); addEvent('system', { message: 'SSE 已连接' }); };
    es.onerror = () => { setSseConnected(false); addEvent('system', { message: 'SSE 断开，重连中...' }); };
    es.addEventListener('state', (e) => { try { setWsState(JSON.parse(e.data).state); } catch {} });
    es.addEventListener('connected', (e) => { try { addEvent('connected', JSON.parse(e.data)); fetchStatus(); } catch {} });
    es.addEventListener('disconnected', () => addEvent('disconnected', {}));
    es.addEventListener('gateway_event', (e) => { try { addEvent('gateway_event', JSON.parse(e.data)); } catch {} });
    eventSourceRef.current = es;
    return () => { es.close(); eventSourceRef.current = null; setSseConnected(false); };
  }, [fetchStatus]);

  function addEvent(type: string, data: any) {
    const evt: SseEvent = { type, data, time: new Date().toLocaleTimeString() };
    setEvents(prev => [evt, ...prev].slice(0, 50));
  }

  useEffect(() => {
    fetchStatus(); fetchAccounts();
    const timer = setInterval(() => { fetchStatus(); fetchAccounts(); }, 15000);
    return () => clearInterval(timer);
  }, [fetchStatus, fetchAccounts]);

  // 首次登录无账号时自动显示引导
  useEffect(() => {
    if (boundAccounts.length === 0 && !hasAccountsRef.current) {
      // 延迟一下避免闪烁
      const t = setTimeout(() => setShowGuide(true), 800);
      return () => clearTimeout(t);
    }
  }, [boundAccounts]);

  const requestQrCode = async () => {
    setScanLoading(true); setScanStatus(null);
    try {
      const res = await fetch(API_BASE + '/qrcode', { method: 'POST' });
      const json = await res.json();
      if (json.success && json.data?.qrcode_url) {
        setQrUrl(json.data.qrcode_url);
        setQrOriginalUrl(json.data.original_qrcode_url || json.data.qrcode_url);
        setQrType(json.data.qrcode_type || 'web_link');
        setQrToken(json.data.qrcode);
        setShowGuide(false);
        pollScanStatus(json.data.qrcode);
      } else addEvent('error', { message: '获取二维码失败', detail: json });
    } catch (err) { addEvent('error', { message: (err as Error).message }); }
    finally { setScanLoading(false); }
  };

  const pollScanStatus = (token: string) => {
    let attempts = 0;
    const poll = async () => {
      if (attempts >= 120) { setScanStatus({ status: 'expired' }); return; }
      attempts++;
      try {
        const res = await fetch(API_BASE + '/qrcode/status', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qrcode: token }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          const s = json.data.status || json.data;
          setScanStatus(s);
          if (s.status === 'confirmed') { setTimeout(() => { fetchStatus(); fetchAccounts(); }, 1000); return; }
          if (s.status === 'expired') return;
          setTimeout(poll, 2000);
        }
      } catch { setTimeout(poll, 3000); }
    };
    poll();
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!confirm(`确定删除账号 ${accountId}？`)) return;
    try {
      const res = await fetch(API_BASE + '/accounts/' + encodeURIComponent(accountId), { method: 'DELETE' });
      const json = await res.json();
      if (json.success) { fetchAccounts(); fetchStatus(); }
      else alert('删除失败：' + (json.error || '未知错误'));
    } catch (err) { alert('删除失败'); }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const stateIcon = wsState === 'connected' ? <Wifi className="w-3.5 h-3.5 text-emerald-500" />
    : wsState === 'connecting' || wsState === 'reconnecting' ? <Clock className="w-3.5 h-3.5 text-amber-500 animate-spin" />
    : <WifiOff className="w-3.5 h-3.5 text-red-400" />;
  const stateLabel = wsState === 'connected' ? '已连接' : wsState === 'connecting' || wsState === 'reconnecting' ? '连接中...' : '未连接';
  const stateBg = wsState === 'connected' ? 'bg-emerald-50 border-emerald-200' : wsState === 'connecting' || wsState === 'reconnecting' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
  const stateText = wsState === 'connected' ? 'text-emerald-700' : wsState === 'connecting' || wsState === 'reconnecting' ? 'text-amber-700' : 'text-red-700';

  const scanLabel = scanStatus?.status === 'wait' ? '等待扫码' : scanStatus?.status === 'scaned' ? '已扫码，等待确认'
    : scanStatus?.status === 'confirmed' ? '登录成功' : scanStatus?.status === 'expired' ? '二维码已过期' : '';
  const scanIcon = scanStatus?.status === 'wait' ? <Clock className="w-4 h-4 text-blue-500" /> : scanStatus?.status === 'scaned' ? <QrCode className="w-4 h-4 text-amber-500" />
    : scanStatus?.status === 'confirmed' ? <CheckCircle className="w-4 h-4 text-emerald-500" /> : scanStatus?.status === 'expired' ? <AlertTriangle className="w-4 h-4 text-red-500" /> : null;
  const scanBg = scanStatus?.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : scanStatus?.status === 'expired' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-blue-50 text-blue-700 border-blue-200';

  return (
    <div className="p-5 max-w-6xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">微信助手管理</h1>
            <p className="text-xs text-gray-400">WeChat Assistant · 管理员</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border ${sseConnected ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-gray-100 text-gray-400 border-gray-200'}`}>
            <Radio className={`w-3 h-3 ${sseConnected ? 'animate-pulse' : ''}`} /> SSE
          </div>
          <button onClick={() => setShowEvents(!showEvents)}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border transition ${showEvents ? 'bg-blue-50 text-blue-600 border-blue-200' : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'}`}>
            <Activity className="w-3 h-3" /> 事件
          </button>
        </div>
      </div>

      {/* Event Log */}
      {showEvents && (
        <div className="rounded-lg border border-gray-200 bg-gray-50/50">
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-medium text-gray-500">事件日志</span>
            <button onClick={() => setEvents([])} className="text-xs text-gray-400 hover:text-gray-600">清空</button>
          </div>
          <div className="max-h-40 overflow-y-auto p-2 font-mono text-[11px] space-y-0.5">
            {events.length === 0 ? <div className="text-gray-400 py-1">暂无事件</div>
              : events.map((evt, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-gray-400 shrink-0 w-16">{evt.time}</span>
                  <span className={evt.type === 'connected' ? 'text-emerald-600' : evt.type === 'error' || evt.type === 'disconnected' ? 'text-red-500' : 'text-gray-500'}>[{evt.type}]</span>
                  <span className="text-gray-600 truncate">{typeof evt.data === 'string' ? evt.data : JSON.stringify(evt.data)}</span>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Main Content: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Status + QR (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Connection Status */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-800">连接状态</h2>
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs border ${stateBg} ${stateText}`}>
                {stateIcon} {stateLabel}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3 p-4">
              <div className="rounded-md bg-gray-50 px-3 py-2.5">
                <div className="text-[11px] text-gray-400 mb-0.5">WebSocket</div>
                <div className="text-sm font-medium text-gray-700">{wsState}</div>
              </div>
              <div className="rounded-md bg-gray-50 px-3 py-2.5">
                <div className="text-[11px] text-gray-400 mb-0.5">通道</div>
                {status?.channelStatus?.active
                  ? <div className="text-sm font-medium text-emerald-600">✅ {status.channelStatus.accountCount} 个账号</div>
                  : <div className="text-sm text-gray-400">未配置</div>}
              </div>
              <div className="rounded-md bg-gray-50 px-3 py-2.5">
                <div className="text-[11px] text-gray-400 mb-0.5">更新</div>
                <div className="text-sm font-medium text-gray-700">{status?.timestamp ? new Date(status.timestamp).toLocaleTimeString() : '-'}</div>
              </div>
            </div>
            <div className="flex gap-2 px-4 pb-3">
              <button onClick={() => { fetchStatus(); fetchAccounts(); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-gray-100 hover:bg-gray-200 transition">
                <RefreshCw className="w-3 h-3" /> 刷新
              </button>
              <button onClick={async () => {
                if (!confirm('确定重置 IM 通道？')) return;
                try {
                  const res = await fetch(API_BASE + '/channel/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ channel_id: 'default' }) });
                  alert(JSON.stringify(await res.json()));
                } catch (e: any) { alert(e.message); }
              }} className="inline-flex items-center gap-1 px-3 py-1.5 text-xs rounded-md bg-red-50 text-red-600 hover:bg-red-100 transition">
                重置通道
              </button>
            </div>
          </div>

          {/* QR Code */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-800">扫码登录</h2>
              {qrOriginalUrl && qrType === 'web_link' && (
                <a href={qrOriginalUrl} target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-green-50 text-green-600 border border-green-200 hover:bg-green-100 transition">
                  <Smartphone className="w-3 h-3" /> 原生链接
                </a>
              )}
            </div>

            {/* 首次登录引导 */}
            {showGuide && boundAccounts.length === 0 && !qrUrl && (
              <div className="px-4 py-4 bg-gradient-to-r from-green-50 to-blue-50 border-b border-green-100">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
                    <Info className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-green-800 mb-1">首次使用微信助手？</h3>
                    <p className="text-xs text-green-700 mb-3">点击下方按钮生成登录二维码，用微信扫码即可绑定您的微信账号</p>
                    <div className="flex items-center gap-2 text-[11px] text-green-600">
                      <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-green-200 flex items-center justify-center text-[10px]">1</span> 生成二维码</span>
                      <span>→</span>
                      <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-green-200 flex items-center justify-center text-[10px]">2</span> 微信扫码</span>
                      <span>→</span>
                      <span className="inline-flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-green-200 flex items-center justify-center text-[10px]">3</span> 确认登录</span>
                    </div>
                  </div>
                  <button onClick={() => setShowGuide(false)} className="text-green-400 hover:text-green-600 shrink-0">✕</button>
                </div>
              </div>
            )}

            {!qrUrl ? (
              <div className="flex flex-col items-center justify-center py-12">
                <div className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mb-4">
                  <QrCode className="w-10 h-10 text-green-500" />
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  {boundAccounts.length === 0 ? '尚未绑定微信账号，请生成二维码进行登录' : '点击下方按钮生成新的登录二维码'}
                </p>
                <button onClick={requestQrCode} disabled={scanLoading}
                  className="inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition">
                  {scanLoading ? <><RefreshCw className="w-4 h-4 animate-spin" /> 生成中...</> : '生成二维码'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center py-6">
                {scanStatus && (
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs border mb-4 ${scanBg}`}>
                    {scanIcon} {scanLabel}
                  </div>
                )}

                {/* 二维码展示区 */}
                <div className="rounded-lg border border-gray-100 p-4 bg-white shadow-sm">
                  {qrType === 'image_base64' ? (
                    /* base64 图片直接展示 */
                    <img src={qrUrl} alt="微信登录二维码" className="w-64 h-64" />
                  ) : (
                    /* URL 类型（qrserver 代理图片或直接图片链接）*/
                    <img src={qrUrl} alt="微信登录二维码" className="w-64 h-64" style={{ imageRendering: 'pixelated' }}
                      onError={(e) => {
                        // 图片加载失败时，如果是 web_link 类型，降级显示原始链接
                        if (qrType === 'web_link' && qrOriginalUrl) {
                          (e.target as HTMLImageElement).style.display = 'none';
                          const parent = (e.target as HTMLImageElement).parentElement;
                          if (parent && !parent.querySelector('.qr-fallback')) {
                            const fallback = document.createElement('div');
                            fallback.className = 'qr-fallback flex flex-col items-center gap-2 py-8';
                            fallback.innerHTML = `
                              <p class="text-xs text-gray-500 mb-2">二维码图片加载失败，请点击下方原生链接</p>
                              <a href="${qrOriginalUrl}" target="_blank" class="text-sm text-green-600 underline break-all max-w-xs">${qrOriginalUrl}</a>
                            `;
                            parent.appendChild(fallback);
                          }
                        }
                      }} />
                  )}
                </div>

                <p className="text-xs text-gray-400 mt-3 text-center max-w-xs">用微信扫描此二维码登录</p>

                {/* 原生链接展示（web_link 类型） */}
                {qrType === 'web_link' && qrOriginalUrl && (
                  <div className="mt-3 w-full max-w-sm">
                    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] text-gray-400">原生链接</span>
                        <button onClick={() => copyToClipboard(qrOriginalUrl)}
                          className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-green-600 transition">
                          <Copy className="w-3 h-3" /> 复制
                        </button>
                      </div>
                      <a href={qrOriginalUrl} target="_blank" rel="noreferrer"
                        className="text-xs text-green-600 break-all hover:underline line-clamp-2">
                        {qrOriginalUrl}
                      </a>
                    </div>
                  </div>
                )}

                {scanStatus?.status === 'confirmed' && scanStatus.credentials && (
                  <div className="mt-4 w-full max-w-sm rounded-lg bg-emerald-50 border border-emerald-200 p-4">
                    <div className="text-sm font-medium text-emerald-800 mb-2">✅ 登录成功</div>
                    <div className="space-y-1 text-xs text-emerald-700 font-mono">
                      <div className="flex justify-between"><span>Bot ID</span><span>{scanStatus.credentials.ilink_bot_id}</span></div>
                      <div className="flex justify-between"><span>用户 ID</span><span>{scanStatus.credentials.ilink_user_id}</span></div>
                    </div>
                  </div>
                )}
                {scanStatus?.status === 'expired' && (
                  <button onClick={requestQrCode} className="mt-4 inline-flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg bg-green-600 text-white hover:bg-green-700 transition">
                    <RefreshCw className="w-4 h-4" /> 重新生成
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right: Accounts (1 col) */}
        <div className="space-y-4">
          {/* Bound Accounts */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-800 flex items-center gap-2">
                <Users className="w-4 h-4 text-gray-400" />
                已绑定账号
                {boundAccounts.length > 0 && <span className="text-xs bg-green-100 text-green-600 px-1.5 py-0.5 rounded-full">{boundAccounts.length}</span>}
              </h2>
            </div>

            {boundAccounts.length > 0 ? (
              <div className="divide-y divide-gray-100">
                {boundAccounts.map((acc) => (
                  <div key={acc.accountId} className="px-4 py-3 hover:bg-gray-50/50 transition group">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                          <span className="text-sm font-medium font-mono text-gray-800 truncate">{acc.accountId}</span>
                        </div>
                        <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
                          <span className="truncate">{acc.userId}</span>
                          <button onClick={() => copyToClipboard(acc.userId)} className="opacity-0 group-hover:opacity-100 transition" title="复制">
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <div className="text-[11px] text-gray-300 mt-0.5">{new Date(acc.savedAt).toLocaleDateString()}</div>
                      </div>
                      <button onClick={() => handleDeleteAccount(acc.accountId)}
                        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-gray-400 hover:text-red-500 transition shrink-0" title="删除">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                <Users className="w-8 h-8 mb-2 opacity-30" />
                <span className="text-xs">暂无绑定账号</span>
              </div>
            )}
          </div>

          {/* API Reference */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-medium text-gray-800">API 端点</h2>
            </div>
            <div className="p-3 space-y-1.5 text-[11px]">
              {[
                ['GET', '/events', 'SSE 实时事件'],
                ['POST', '/qrcode', '获取二维码'],
                ['POST', '/qrcode/status', '轮询扫码状态'],
                ['GET', '/accounts', '账号列表'],
                ['DELETE', '/accounts/:id', '删除账号'],
                ['GET', '/status', '连接状态'],
              ].map(([method, path, desc]) => (
                <div key={path} className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${method === 'GET' ? 'bg-emerald-50 text-emerald-600' : method === 'POST' ? 'bg-blue-50 text-blue-600' : 'bg-red-50 text-red-600'}`}>{method}</span>
                  <code className="text-gray-500 font-mono">{API_BASE}{path}</code>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
