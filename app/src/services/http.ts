import axios from "axios";

const baseURL =
  import.meta.env.VITE_API_URL ?? "http://192.168.1.39:8000/api/v1";
const defaultWorkspaceId = import.meta.env.VITE_WORKSPACE_ID ?? "default";

export const http = axios.create({
  baseURL,
  timeout: 30_000,
});

http.interceptors.request.use((config) => {
  const headers = config.headers;
  if (!headers["X-Workspace-Id"]) {
    let ws = defaultWorkspaceId;
    try {
      const fromStorage = localStorage.getItem("app:workspace-id")?.trim();
      if (fromStorage) ws = fromStorage;
    } catch {
      /* ignore */
    }
    headers["X-Workspace-Id"] = ws;
  }
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status >= 500) {
      console.error("Erro interno do servidor. Tente novamente em instantes.");
    } else if (!error.response) {
      console.error("Falha de rede ao conectar com a API.");
    }

    return Promise.reject(error);
  },
);
