import { QueryClient } from "@tanstack/react-query"

/** Dados estáticos de sessão (não mudam sem ação do usuário). */
export const SESSION_STABLE = {
  staleTime: Infinity,
  gcTime: 30 * 60_000,
} as const

/** Dados de usuário (mudam raramente, via mutações). */
export const USER_DATA = {
  staleTime: 10 * 60_000,
  gcTime: 60 * 60_000,
} as const

/** Detalhe de projeto (invalidação explícita + SSE). */
export const PROJECT_DATA = {
  staleTime: 5 * 60_000,
  gcTime: 15 * 60_000,
  refetchOnWindowFocus: false,
} as const

/** Status de processamento (SSE / fila — sem poll agressivo). */
export const PROCESSING_STATUS = {
  staleTime: Infinity,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
} as const

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
    mutations: {
      retry: 1,
    },
  },
})
