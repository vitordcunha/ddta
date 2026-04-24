import axios from 'axios'

const baseURL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1'
const defaultWorkspaceId = import.meta.env.VITE_WORKSPACE_ID ?? 'default'

export const http = axios.create({
  baseURL,
  timeout: 30_000,
})

http.interceptors.request.use((config) => {
  const headers = config.headers
  if (!headers['X-Workspace-Id']) {
    headers['X-Workspace-Id'] = defaultWorkspaceId
  }
  return config
})

http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status >= 500) {
      console.error('Erro interno do servidor. Tente novamente em instantes.')
    } else if (!error.response) {
      console.error('Falha de rede ao conectar com a API.')
    }

    return Promise.reject(error)
  },
)
