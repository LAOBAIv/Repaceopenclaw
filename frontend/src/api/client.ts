import axios from "axios";

const BASE_URL = "/api";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 10000,
});

// 自动注入 JWT token
apiClient.interceptors.request.use((config) => {
  const raw = localStorage.getItem("repaceclaw-auth");
  if (raw) {
    try {
      const state = JSON.parse(raw);
      const token = state?.state?.token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {}
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error("[API Error]", err.response?.data || err.message);
    if (err.response?.status === 401) {
      localStorage.removeItem("repaceclaw-auth");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export default apiClient;
