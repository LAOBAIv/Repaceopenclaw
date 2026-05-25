/**
 * AutoLLMApi — OpenAI-compatible streaming API 调用
 */
import https from "https";
import http from "http";
import { URL } from "url";
import { logger } from '../../../utils/logger';
import { getErrorMessage } from '../../../types/ilink';
import { REPACECLAW_MESSAGE_CHANNEL } from '../../../utils/openclawGateway';
import { isGatewayUrl } from './utils';

/**
 * 调用 OpenAI-compatible streaming API
 * 返回 Promise<number> 表示本次调用实际消耗的 token 数
 */
export function callOpenAIStream(
  baseUrl: string,
  apiKey: string,
  authType: string,
  modelId: string,
  systemPrompt: string,
  messages: Array<{ role: string; content: string }>,
  temperature: number,
  maxTokens: number,
  topP: number,
  frequencyPenalty: number,
  presencePenalty: number,
  onChunk: (chunk: string) => void,
  onComplete: (tokenCount: number) => void,
  signal: AbortController,
  gatewayUrl: string,
  gatewayToken: string
): Promise<number> {
  return new Promise((resolve, reject) => {
    const useGateway = isGatewayUrl(baseUrl, gatewayUrl);
    const actualUrl = new URL(useGateway ? `${gatewayUrl.replace(/\/$/, '')}/v1/chat/completions` : `${baseUrl.replace(/\/$/, '')}/chat/completions`);
    const actualModel = useGateway ? 'openclaw' : modelId;
    const actualAuth = useGateway ? `Bearer ${gatewayToken}` : (authType === "ApiKey" ? apiKey : `Bearer ${apiKey}`);

    if (useGateway) {
      logger.info(`[Auto→Gateway] Routing: ${modelId} → Gateway(openclaw)`);
    }

    const bodyObj: Record<string, unknown> = {
      model: actualModel,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      stream: false,
      temperature,
      max_tokens: maxTokens,
      frequency_penalty: frequencyPenalty,
      presence_penalty: presencePenalty,
    };
    if (!modelId.includes('claude') && !modelId.includes('Claude')) {
      bodyObj.top_p = topP;
    }
    const body = JSON.stringify(bodyObj);

    const options = {
      hostname: actualUrl.hostname,
      port: actualUrl.port || (actualUrl.protocol === "https:" ? 443 : 80),
      path: actualUrl.pathname + actualUrl.search,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
        Authorization: actualAuth,
        ...(useGateway ? { "x-openclaw-message-channel": REPACECLAW_MESSAGE_CHANNEL } : {}),
      },
    };

    Object.keys(options.headers).forEach(
      (k) => (options.headers as Record<string, unknown>)[k] === undefined && delete (options.headers as Record<string, unknown>)[k]
    );

    const lib = actualUrl.protocol === "https:" ? https : http;
    const req = lib.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        let errBody = "";
        res.on("data", (d: Buffer) => (errBody += d.toString()));
        res.on("end", () => reject(new Error(`HTTP ${res.statusCode}: ${errBody.slice(0, 200)}`)));
        return;
      }

      let body = "";
      res.on("data", (data: Buffer) => { body += data.toString(); });
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          const content = json.choices?.[0]?.message?.content || "";
          const totalTokens = json.usage?.total_tokens || 0;

          logger.info('[AutoLLM] Raw response: ' + JSON.stringify(json).substring(0, 300));
          logger.info(`[AutoLLM] Response: ${content.length} chars, ${totalTokens} tokens`);

          if (content) {
            const chunkSize = 20;
            for (let i = 0; i < content.length; i += chunkSize) {
              onChunk(content.substring(i, i + chunkSize));
            }
          }

          onComplete(totalTokens);
          resolve(totalTokens);
        } catch (e: unknown) {
          reject(new Error(`Response parse error: ${getErrorMessage(e)}. Body: ${body.slice(0, 200)}`));
        }
      });
      res.on("error", reject);
    });

    req.on("error", reject);
    signal.signal.addEventListener("abort", () => { req.destroy(); reject(new Error("Aborted")); });
    req.write(body);
    req.end();
  });
}
