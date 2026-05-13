import apiClient from "./client";

export interface TokenChannel {
  id: string;
  provider: string;
  modelName: string;
  baseUrl: string;
  apiKey: string;
  authType: 'Bearer' | 'ApiKey' | 'Basic';
  enabled: boolean;
  priority: number;
  isPreset?: boolean;
}

export const tokenChannelsApi = {
  list: async (): Promise<TokenChannel[]> => {
    const res = await apiClient.get("/token-channels");
    return res.data.data || [];
  },
  getPreset: async (): Promise<TokenChannel | null> => {
    const res = await apiClient.get("/token-channels/preset");
    return res.data.data || null;
  },
};
