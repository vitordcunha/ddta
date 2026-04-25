import { create } from 'zustand'

interface CalibrationStore {
  /** Slot clicado no mapa (abre inspector lateral). */
  selectedSlotId: string | null
  /** Slots destacados por uma recomendação ativa (borda pulsante). */
  highlightedSlotIds: string[]
  /** ID da recomendação cujos slots estão sendo destacados. */
  highlightedRecommendationId: string | null

  setSelectedSlotId: (id: string | null) => void
  setHighlightedSlotIds: (ids: string[]) => void
  setHighlightedRecommendationId: (id: string | null) => void
  /**
   * Ativa o destaque de uma recomendação e limpa o slot selecionado
   * (para não conflitar visualmente com o inspector).
   */
  activateRecommendation: (recId: string, slotIds: string[]) => void
  /** Limpa destaque de recomendação sem fechar o inspector. */
  clearHighlight: () => void
  /** Reseta todo o estado de calibração (troca de sessão). */
  reset: () => void
}

export const useCalibrationStore = create<CalibrationStore>((set) => ({
  selectedSlotId: null,
  highlightedSlotIds: [],
  highlightedRecommendationId: null,

  setSelectedSlotId: (id) => set({ selectedSlotId: id }),
  setHighlightedSlotIds: (ids) => set({ highlightedSlotIds: ids }),
  setHighlightedRecommendationId: (id) => set({ highlightedRecommendationId: id }),

  activateRecommendation: (recId, slotIds) =>
    set({ highlightedRecommendationId: recId, highlightedSlotIds: slotIds, selectedSlotId: null }),

  clearHighlight: () =>
    set({ highlightedRecommendationId: null, highlightedSlotIds: [] }),

  reset: () =>
    set({ selectedSlotId: null, highlightedSlotIds: [], highlightedRecommendationId: null }),
}))
