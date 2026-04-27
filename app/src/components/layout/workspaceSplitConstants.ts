/** Largura inicial da coluna do planejador em split (tablet landscape). */
export const SPLIT_PANEL_DEFAULT_PX = 336;

/** Largura mínima do *conteúdo* do planejador; abaixo disso o layout interno não encolhe (clip). */
export const SPLIT_PANEL_MIN_CONTENT_PX = 280;

/**
 * Ao soltar o separador abaixo deste valor, o painel colapsa para a faixa fina
 * (estilo iPad: só a “barrinha” fica visível).
 */
export const SPLIT_PANEL_COLLAPSE_RELEASE_PX = 140;

/** Largura da faixa quando colapsado (área de arraste para reabrir). */
export const SPLIT_PANEL_COLLAPSED_PX = 14;

/** Largura máxima como fração da viewport. */
export const SPLIT_PANEL_MAX_VIEWPORT_FRACTION = 0.44;

/** Área de hit do separador (px), centrada na borda — caneta/dedo. */
export const SPLIT_SEP_HIT_PX = 20;

/** Movimento máximo em X (px) para contar como toque no separador com painel colapsado (abre em vez de só soltar). */
export const SPLIT_SEP_TAP_MAX_CLIENT_DX = 12;

export const SPLIT_WIDTH_STORAGE_KEY = "dd-workspace-split-width-v1";
export const SPLIT_DETACH_SESSION_KEY = "dd-workspace-split-detached";
