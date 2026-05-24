/**
 * ILink 协议类型定义
 *
 * ILink 是微信开放平台的中间件，负责微信消息的转发和处理。
 * 本文件定义了 ILink API 的请求/响应结构，消除 :any 滥用。
 */

// ─── 通用 HTTP 响应 ─────────────────────────────────────────────────────

/** 通用 HTTP 响应包装 */
export interface ILinkResponse<T = unknown> {
  status: number;
  data: T;
}

// ─── ILink 请求体 ───────────────────────────────────────────────────────

/** 获取更新请求体 */
export interface GetUpdatesRequest {
  bot_type: number;
  sync_buf?: string;
}

/** 发送消息请求体 */
export interface SendMessageRequest {
  bot_type: number;
  to_wxid: string;
  content: string;
  msg_type?: number;
  image_item?: MediaItem;
  voice_item?: MediaItem;
  file_item?: MediaItem;
  video_item?: MediaItem;
}

/** 多媒体消息附件 */
export interface MediaItem {
  md5?: string;
  file_id?: string;
  file_name?: string;
  file_size?: number;
  url?: string;
  thumb_url?: string;
}

// ─── ILink 消息结构 ─────────────────────────────────────────────────────

/** ILink 返回的单条消息 */
export interface ILinkMessage {
  msg_type: number;
  from_wxid: string;
  to_wxid: string;
  content: string;
  msg_source: number;
  create_time: number;
  is_sender: number;
  revokmsgid?: string;
  image_item?: MediaItem;
  voice_item?: MediaItem;
  file_item?: MediaItem;
  video_item?: MediaItem;
  link_item?: LinkItem;
  chatroom_member_list?: string[];
  chatroom_announcement?: string;
}

/** 链接消息（分享卡片） */
export interface LinkItem {
  title: string;
  desc: string;
  url: string;
  thumb_url: string;
}

/** ILink get_updates 响应 */
export interface GetUpdatesResponse {
  ret: number;
  errmsg: string;
  sync_buf: string;
  msg_list: ILinkMessage[];
}

// ─── ILink 二维码相关 ───────────────────────────────────────────────────

/** 获取二维码请求 */
export interface GetQRCodeRequest {
  bot_type: number;
}

/** 二维码响应 */
export interface QRCodeResponse {
  ret: number;
  errmsg: string;
  qrcode_url?: string;
  qrcode_base64?: string;
  qrcode_uuid?: string;
}

/** 扫码状态请求 */
export interface GetQRCodeStatusRequest {
  bot_type: number;
  uuid: string;
}

/** 扫码状态响应 */
export interface QRCodeStatusResponse {
  ret: number;
  errmsg: string;
  status: string;
  wxid?: string;
  nickname?: string;
  head_img_url?: string;
}

// ─── 错误类型守卫 ───────────────────────────────────────────────────────

/** 判断未知值是否为 Error 实例 */
export function isError(value: unknown): value is Error {
  return value instanceof Error;
}

/** 安全提取错误消息 */
export function getErrorMessage(err: unknown): string {
  if (isError(err)) return err.message;
  if (typeof err === 'string') return err;
  return String(err);
}
