# Plano de Implementação — Dronedata Platform

> Foco: UI/UX para tablet/touch, micro-interações, performance  
> Data: 2026-04-27  
> Status: planejado

---

## Princípios Transversais

Três decisões arquiteturais que afetam todas as fases:

1. **Gesture Priority System** — Todos os gestos customizados passam por um `GestureManager` centralizado que conhece o estado atual do mapa e decide qual handler tem precedência. Isso resolve conflitos entre gestos customizados e controles nativos do Mapbox/Leaflet.
2. **Motion Tokens** — Durações e easings vivem em um único arquivo `motionTokens.ts`. Nada hardcoded nos componentes.
3. **Tablet Breakpoint** — Adicionamos `tablet` como tier entre `mobile` e `desktop` (`768–1279px`). Todas as decisões de layout passam por `useBreakpoint()` em vez de `useMediaQuery` direto.

---

## Phase 0 — Foundation

> Prerequisite para todas as fases. Sem essa base, as demais não podem ser implementadas de forma consistente.

---

### 0-A: Motion Token System

**Arquivo:** `app/src/lib/motionTokens.ts`

```ts
export const motion = {
  duration: {
    instant: 0,
    micro: 80,
    fast: 160,
    base: 240,
    slow: 380,
    enter: 480,
    route: 920,
  },
  easing: {
    standard: "cubic-bezier(0.25, 0.1, 0.25, 1)",
    decelerate: "cubic-bezier(0, 0, 0.2, 1)", // elementos entrando
    accelerate: "cubic-bezier(0.4, 0, 1, 1)", // elementos saindo
    spring: { type: "spring", damping: 38, stiffness: 280 },
    cinematic: "cubic-bezier(0.45, 0, 0.55, 1)", // transições de câmera
    bounce: "cubic-bezier(0.22, 1, 0.36, 1)", // dialogs
  },
} as const;
```

Todos os arquivos com durações hardcoded (`POLYGON_FADE_MS=480`, `ROUTE_DRAW_MS=920`, etc.) são migrados para importar daqui. O `globals.css` usa `@property` para as custom properties de animação.

---

### 0-B: Breakpoint System

**Arquivo:** `app/src/hooks/useBreakpoint.ts`

```ts
type Breakpoint = "mobile" | "tablet" | "desktop";

const BREAKPOINTS = {
  tablet: 768,
  desktop: 1280, // mudança de 1024 → 1280 — iPad Pro landscape fica no tier tablet
} as const;

export function useBreakpoint(): Breakpoint;
export function useIsDesktop(): boolean;
export function useIsTablet(): boolean;
export function useIsMobile(): boolean;
export function useIsTouchPrimary(): boolean; // tablet || mobile
```

`WorkspacePage`, `WorkspaceLayoutPanel`, `DialogPanel` e todos os componentes que hoje usam `useMediaQuery('(min-width: 1024px)')` migram para `useBreakpoint()`.

**Por que 1280?** O iPad Pro 12.9" em landscape é 1366px — atualmente recebe layout de desktop. Com 1280 como threshold de desktop, todos os iPads ficam no tier `tablet` e recebem layout dedicado.

---

### 0-C: React Query Cache Strategy

**Arquivo:** `app/src/lib/queryClient.ts` (modificar existente)

**Problema atual:** `staleTime: 15_000` global faz refetch de projetos e drone models a cada navegação entre painéis. `gcTime` não configurado explicitamente — dados sumem após 5 min em background.

**Estratégia por categoria:**

```ts
// Dados estáticos de sessão (não mudam sem ação do usuário)
const SESSION_STABLE = {
  staleTime: Infinity,
  gcTime: 30 * 60_000, // 30 min em memória
};

// Dados de usuário (mudam raramente, via mutações)
const USER_DATA = {
  staleTime: 10 * 60_000, // 10 min
  gcTime: 60 * 60_000, // 1h em memória
};

// Dados de projeto (mudam via mutações — invalidação explícita)
const PROJECT_DATA = {
  staleTime: 5 * 60_000,
  gcTime: 15 * 60_000,
  refetchOnWindowFocus: false,
};

// Status de processamento (controlado pelo SSE stream — não precisa de poll)
const PROCESSING_STATUS = {
  staleTime: Infinity,
  gcTime: 5 * 60_000,
  refetchOnWindowFocus: false,
};
```

**Mapeamento de queries existentes:**

| Query key                   | Atual              | Novo                                           |
| --------------------------- | ------------------ | ---------------------------------------------- |
| `['drone-models']`          | 5 min stale        | `SESSION_STABLE` — não muda na sessão          |
| `['projects']`              | 15s stale          | `USER_DATA` — invalidado por mutações          |
| `['project', id]`           | 15s stale          | `PROJECT_DATA` — invalidado por mutações + SSE |
| `['map-api-keys']`          | padrão (15s)       | `SESSION_STABLE`                               |
| `['processing-status', id]` | controlado por SSE | `PROCESSING_STATUS`                            |

**Prefetch inteligente:** Quando o usuário seleciona um projeto no `WorkspaceProjectPicker`, fazer `queryClient.prefetchQuery(['project', id])` antes de navegar ao painel. Elimina o spinner na primeira visualização.

```ts
// Em WorkspaceProjectPicker — no onSelect:
onSelect: (projectId) => {
  queryClient.prefetchQuery({
    queryKey: ["project", projectId],
    queryFn: () => projectsService.getProject(projectId),
    staleTime: PROJECT_DATA.staleTime,
  });
  setActiveProject(projectId);
};
```

**Invalidação cirúrgica:** As mutações existentes chamam `invalidateQueries(['projects'])`. Migrar para invalidar apenas `['project', id]` quando possível, evitando refetch da lista inteira.

---

### 0-D: Gesture Manager

**Arquivo:** `app/src/features/map-engine/gestures/GestureManager.ts`

Este é o arquivo mais crítico do plano. Centraliza a lógica de gestos e resolve conflitos.

**Problema atual:** `disableDrawConflictGestures()` / `enableDrawConflictGestures()` existem no `MapImperativeApi` mas a lógica de "quem tem controle" está espalhada. O diretório `gestures/` está vazio — a lógica é inline em cada componente.

**Arquitetura:**

```ts
type GestureContext =
  | "map-idle" // mapa livre, sem interação ativa
  | "draw-polygon" // usuário desenhando com 1 dedo/pen
  | "edit-vertex" // arrastando vértice
  | "edit-polygon-move" // movendo polígono inteiro
  | "pen-freehand" // stylus em modo freehand
  | "panel-scroll"; // painel de config com scroll ativo

type GestureHandler = {
  id: string;
  priority: number; // maior = tem precedência
  context: GestureContext[]; // contextos em que o handler está ativo
  fingers: number | "any";
  onActivate: () => void;
  onDeactivate: () => void;
};

class GestureManager {
  private context: GestureContext = "map-idle";
  private handlers: Map<string, GestureHandler>;
  private activeHandlerId: string | null = null;

  setContext(ctx: GestureContext): void;
  getContext(): GestureContext;
  register(handler: GestureHandler): () => void; // retorna unregister

  // Chamado por qualquer touchstart com nFingers
  resolve(nFingers: number): GestureHandler | null;
}
```

**Tabela de prioridades:**

| Handler                   | Priority | Context           | Fingers      |
| ------------------------- | -------- | ----------------- | ------------ |
| Mapbox native pinch-zoom  | 0        | map-idle          | 2            |
| 2-finger pan durante draw | 10       | draw-polygon      | 2            |
| Undo/redo                 | 8        | any               | 2–3          |
| Polygon move              | 15       | edit-polygon-move | 2            |
| Panel swipe dismiss       | 5        | map-idle          | 2 (vertical) |

**Regra anti-conflito fundamental:** Quando `GestureManager.resolve()` retorna um handler com `priority > 0`, chama `disableDrawConflictGestures()` **antes** de ativar o handler. Quando o handler termina, chama `enableDrawConflictGestures()`. O Mapbox nunca recebe os eventos enquanto um handler customizado está ativo.

**Exposição via contexto:**

```ts
// Adição ao MapEngineContextValue:
gestureManager: GestureManager;
```

O `GestureManager` é instanciado como singleton no `MapEngineContext` e exposto para os componentes filhos via contexto.

---

## Phase 1 — Quick Wins

> Alto impacto, sem risco de conflito. Pode ser desenvolvido em paralelo.

---

### 1-A: Haptic Choreography

**Arquivo:** `app/src/lib/haptics.ts` (novo — wrappa o Capacitor existente)

```ts
type HapticLevel =
  | "light"
  | "medium"
  | "heavy"
  | "success"
  | "warning"
  | "error";

export const haptic = {
  light: () => triggerHaptic("light"), // tocar vértice, foco em botão
  medium: () => triggerHaptic("medium"), // snap, inserção de vértice, arrastar waypoint
  heavy: () => triggerHaptic("heavy"), // ação destrutiva, long-press confirm
  success: () => triggerHaptic("success"), // polígono fechado, plano salvo
  warning: () => triggerHaptic("warning"), // validação falhou
  error: () => triggerHaptic("error"), // erro de rede
};
```

**Pontos de integração:**

| Evento                             | Haptic    | Arquivo                                                  |
| ---------------------------------- | --------- | -------------------------------------------------------- |
| Tocar vértice (pointerdown)        | `light`   | `PolygonEditHandles.tsx`                                 |
| Vértice snapping                   | `medium`  | `PolygonEditHandles.tsx`                                 |
| Polígono fechado (draft → polygon) | `success` | `FreehandDrawOverlay.tsx`, `FlightPlannerMapContent.tsx` |
| Waypoint adicionado manualmente    | `light`   | `FlightPlannerMapContent.tsx`                            |
| Long-press confirmado (500ms)      | `medium`  | `mapLongPress.ts`                                        |
| Deletar vértice/waypoint           | `heavy`   | `PolygonEditHandles.tsx`                                 |
| Erro de cálculo de rota            | `error`   | `FlightPlannerCalculationBridge`                         |
| Plano salvo com sucesso            | `success` | `useProjects.ts` mutation onSuccess                      |

---

### 1-B: Skeleton Loading

Substituir `<Spinner>` nos Suspense boundaries dos painéis por skeletons contextuais.

**Arquivo:** `app/src/components/ui/Skeleton.tsx`

```tsx
// Primitivo base
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-md bg-white/5", className)}
      style={{ animation: "dd-skeleton-shimmer 1.8s ease-in-out infinite" }}
    />
  );
}

// Skeletons compostos por painel
export function FlightConfigSkeleton(); // 3 seções de inputs
export function ProjectListSkeleton(); // grid de 6 cards
export function ResultsPanelSkeleton(); // status + seção de download
```

```css
/* globals.css */
@keyframes dd-skeleton-shimmer {
  0% {
    background: rgba(255, 255, 255, 0.04);
  }
  50% {
    background: rgba(255, 255, 255, 0.09);
  }
  100% {
    background: rgba(255, 255, 255, 0.04);
  }
}
```

---

### 1-C: Animated Stats Counters

Quando os stats de missão mudam (área, waypoints, tempo estimado), os números animam em vez de piscar.

**Arquivo:** `app/src/hooks/useAnimatedNumber.ts`

```ts
function useAnimatedNumber(
  value: number,
  options?: { duration?: number; decimals?: number },
): number;
```

Implementação com `requestAnimationFrame` e interpolação linear — sem dependência externa. Integrado nos valores de `stats.area`, `stats.waypointCount`, `stats.estimatedDurationMin` no summary bar do `FlightPlannerConfigPanel`.

**Condição:** Só anima se a diferença for > 5% do valor anterior. Mudanças de float por ruído não ativam animação.

---

### 1-D: Progress Ring

**Arquivo:** `app/src/components/ui/ProgressRing.tsx`

```tsx
type ProgressRingProps = {
  progress: number; // 0–100
  size?: number; // px, default 40
  strokeWidth?: number; // default 3
  color?: string; // default #3ecf8e
  animated?: boolean; // SVG stroke-dashoffset animation
  label?: string; // texto central opcional
};
```

SVG com `stroke-dashoffset` animado via CSS transition. O `ProjectStatusBadge` existente é substituído por `ProgressRing` quando `status === 'processing'`.

```css
/* transição suave do progresso */
.progress-ring__circle {
  transition: stroke-dashoffset 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);
  transform: rotate(-90deg);
  transform-origin: 50% 50%;
}
```

**Integrações:**

- `app/src/features/projects/components/ProjectStatusBadge.tsx` — ProgressRing pequeno (32px) inline no card
- `app/src/features/results/components/ResultsWorkspacePanel.tsx` — ProgressRing grande (64px) no topo do painel, mostrando `progress` do `useProjectStatus`

---

### 1-E: Drag Handle "Breathe" Animation

O handle do bottom sheet atual tem 3px de altura — imperceptível. Comunicar melhor que o painel é arrastável.

**Modificação:** `app/src/components/layout/WorkspaceLayoutPanel.tsx`

```tsx
// Antes:
<div className="w-12 h-[3px] rounded-full bg-white/20 mx-auto" />

// Depois:
<div className="w-10 h-1 rounded-full bg-white/25 mx-auto
               transition-all duration-200
               motion-safe:animate-[dd-handle-breathe_3s_ease-in-out_infinite]
               active:w-14 active:bg-white/50" />
```

```css
/* globals.css */
@keyframes dd-handle-breathe {
  0%,
  100% {
    opacity: 0.35;
    transform: scaleX(1);
  }
  50% {
    opacity: 0.6;
    transform: scaleX(1.08);
  }
}
```

---

## Phase 2 — Gesture System

> Depende do `GestureManager` (Phase 0-D). Implementar em ordem: 2-A → 2-B → 2-C → 2-D.

### 2-B: Long-Press Contextual — Radial Menu

Inspiração: DJI Ground Station Pro — long-press em área vazia do mapa abre um radial menu com os modos de interação disponíveis no contexto atual.

**Arquivo novo:** `app/src/features/map-engine/components/MapContextMenu.tsx`

```tsx
type MapContextAction = {
  id: string;
  label: string;
  icon: LucideIcon;
};

type MapContextMenuProps = {
  position: { x: number; y: number }; // pixel coords no container do mapa
  lngLat: [number, number]; // coordenadas geográficas
  actions: MapContextAction[];
  onSelect: (action: MapContextAction) => void;
  onDismiss: () => void;
};
```

**Ações disponíveis por contexto:**

| Contexto               | Long-press em | Ações                                                     |
| ---------------------- | ------------- | --------------------------------------------------------- |
| `plan`, área vazia     | fundo do mapa | Adicionar waypoint, Definir POI, Definir decolagem, Medir |
| `plan`, sobre waypoint | marcador      | Definir como decolagem, Deletar, Editar altitude          |
| `results`              | fundo do mapa | Medir distância, Medir área, Adicionar anotação           |

**Visual — Radial Menu:** Não um menu tradicional. São 4–5 botões circulares (48px) dispostos em arco acima do ponto de toque. Aparecem com animação escalonada a partir do ponto de contato.

```css
@keyframes dd-radial-item-in {
  from {
    transform: scale(0.4) translateY(8px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}
/* Cada item: animation-delay = index * 40ms */
```

**Integração com `mapLongPress.ts` existente:** O `attachHoldStillLongPressToElement()` existente é reutilizado sem modificações. O `FlightPlannerMapContent` já usa long-press para waypoints — o contexto determina se abre o radial menu (área vazia) ou o menu de waypoint (sobre marcador).

---

### 2-C: Undo/Redo com 2/3 Dedos

**Gesto:** 2 dedos swipe esquerda = undo | 3 dedos swipe esquerda = redo (ou 2 dedos direita = redo)

**Arquivo novo:** `app/src/features/map-engine/gestures/handlers/undoRedoGestureHandler.ts`

```ts
// Threshold: 40px deslocamento horizontal, < 20px vertical
// Velocity mínima: 0.3px/ms (swipe rápido, não arrasto)

export function createUndoRedoHandler(
  onUndo: () => void,
  onRedo: () => void,
): GestureHandler;
```

**Adição ao `useFlightStore`:**

```ts
// Novos campos:
undoStack: PersistedFlightPlan[]   // max 20 estados
redoStack: PersistedFlightPlan[]

// Novas actions:
undo: () => void
redo: () => void
// Toda action que modifica polygon/waypoints faz push no undoStack e limpa redoStack
```

**Feedback visual:** Toast não-intrusivo no canto superior do mapa por 1.2s.

- Undo: `"↩ Desfeito"`
- Redo: `"↪ Refeito"`

Toast usa animação `dd-dialog-mobile-in` adaptada (slide de cima para baixo, 200ms).

## Phase 3 — Stylus & Pen

---

### 3-A: Pressure Indicator

Quando uma stylus está em contato com a tela, mostrar um indicador visual de pressão no cursor — inspirado no Procreate.

**Arquivo novo:** `app/src/features/flight-planner/components/StylusPressureIndicator.tsx`

```tsx
type StylusPressureIndicatorProps = {
  containerRef: RefObject<HTMLElement>;
  visible: boolean; // só renderiza em pen-freehand mode
};

// Usa pointermove com pointerType === 'pen'
// Acessa event.pressure (0–1, normalizado pelo browser)
```

**Visual:** Canvas 2D com `position: absolute, pointer-events: none` sobreposto ao mapa. Dois círculos concêntricos centrados no ponto de contato:

- Círculo interno (4px): sempre visível, indica posição exata
- Círculo externo (8–18px, escala com pressão): `opacity = 0.2 + pressure * 0.6`

**Integração:** Montado no mesmo portal do `FreehandDrawOverlay`, visível apenas quando `plannerInteractionMode === 'draw'`. O `FreehandDrawOverlay` já filtra `pointerType === 'pen'` — reutilizar mesma lógica.

---

### 3-B: Stroke Smoothing Visual Feedback

O `FreehandDrawOverlay` atual mostra raw stroke (cinza) + simplified (azul tracejado) como dois paths estáticos.

**Melhoria:** Enquanto o usuário desenha, animar a simplificação em tempo real com 200ms de delay (não bloqueia o desenho). O path simplificado aparece em verde brand (`#3ecf8e`) com lag visual, criando a impressão de refinamento progressivo.

**Ao aceitar o polígono:** O path executa `dd-polygon-fill-in` (300ms) antes de se converter em polígono editável.

```css
@keyframes dd-polygon-fill-in {
  from {
    fill-opacity: 0;
    stroke-opacity: 0.4;
  }
  to {
    fill-opacity: 0.2;
    stroke-opacity: 1;
  }
}
```

---

## Phase 4 — Layout & Tablet

---

### 4-A: Split View para Tablet Landscape

**Quando:** `useBreakpoint() === 'tablet'` E orientação landscape (via `screen.orientation.type`).

**Arquivo:** `app/src/pages/WorkspacePage.tsx` (modificação)

```
Layout atual (mapa ocupa 100%, painel flutua por cima):
┌─────────────────────────┐
│                         │
│          Mapa           │
│    ┌──────────────┐     │
│    │   Config     │     │
│    └──────────────┘     │
└─────────────────────────┘

Novo em tablet landscape (split view):
┌─────────────────────┬──────────────┐
│                     │              │
│    Mapa (flex: 1)   │  Config Panel│
│                     │   (320px)    │
│                     │              │
└─────────────────────┴──────────────┘
```

O `WorkspaceLayoutPanel` recebe novo modo `'split'` além de `'desktop'` e `'mobile'`. Em `split`:

- Painel não é overlay — é coluna lateral com `width: 320px` e `flex-shrink: 0`
- Mapa recebe `flex: 1` e ocupa espaço restante
- Bottom sheet e FAB são ocultados

**Transição portrait → landscape:** Animada com Framer Motion — o painel desliza de bottom sheet para lateral em 350ms com `easing.decelerate`.

---

### 4-B: Floating Contextual Toolbar para Waypoints

Quando `selectedWaypointId !== null`, um toolbar bolha aparece próximo ao waypoint no mapa com as ações disponíveis, sem precisar ir ao sidebar.

**Arquivo novo:** `app/src/features/flight-planner/components/WaypointContextToolbar.tsx`

```tsx
type WaypointContextToolbarProps = {
  waypoint: Waypoint;
  mapPosition: { x: number; y: number }; // pixel coords via map.latLngToContainerPoint()
  onSetHome: () => void;
  onDelete: () => void;
  onEditAltitude: () => void;
};
```

**Visual:** `position: absolute` no container do mapa. 3 botões de 44px (tablet: 48px) em linha horizontal. Aparece com `dd-wp-entra` acima do waypoint. Desaparece quando o usuário toca em outro lugar.

**Por que não Leaflet Popup:** Popups do Leaflet têm z-index problemático, animação ruim em touch e são difíceis de estilizar. Um `div` absoluto com coordenadas convertidas via `map.latLngToContainerPoint()` é mais controlável.

---

### 4-C: Ajustes de Touch Target por Breakpoint

```ts
// app/src/lib/deviceUtils.ts — nova função:
export function touchTargetClass(breakpoint: Breakpoint): string {
  if (breakpoint === "desktop") return "min-h-9 min-w-9"; // 36px
  if (breakpoint === "tablet") return "min-h-12 min-w-12"; // 48px — stylus-friendly
  return "min-h-11 min-w-11"; // 44px mobile
}
```

**Prioridade:** Os controles 3D em `MapControls3D.tsx` são os mais críticos — botões `w-9 h-9` (36px) que ficam abaixo do ideal para stylus. Em tablet ficam `w-12 h-12` (48px).

---

## Phase 5 — Animations & Polish

---

### 5-A: Parameter Visual Preview (Strips em Tempo Real)

Quando o usuário muda altitude/overlap/speed no `FlightPlannerConfigPanel`, os strips no mapa atualizam com animação em vez de piscar.

**Mudanças em `PlanLeafletPathAnimations.tsx`:**

Ao detectar que `strips` do store mudaram:

1. Fade out dos strips antigos: 120ms `opacity → 0`
2. Fade in dos strips novos (stagger de 28ms por strip) via `runPolylineDrawReveal()` existente

**Stats no painel:** Valores de `stats.area`, `stats.waypointCount`, `stats.estimatedDurationMin` usam `useAnimatedNumber` (Phase 1-C) — números rolam suavemente.

**Indicador de cálculo inline:** Durante `isCalculating === true`, uma barra de progresso fina (2px) percorre a borda inferior do `FlightPlannerConfigPanel` com animação indeterminate. Sem spinners grandes.

```css
@keyframes dd-calc-progress {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(200%);
  }
}

.calc-progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 2px;
  width: 40%;
  background: var(--brand-green);
  animation: dd-calc-progress 1.2s ease-in-out infinite;
}
```

---

### 5-B: Mission Preview Flythrough

Antes de executar a missão, o usuário pode assistir a uma simulação animada do percurso do drone — inspirado no DroneDeploy.

**Arquivo novo:** `app/src/features/flight-planner/components/MissionPreviewPlayer.tsx`

```tsx
type MissionPreviewPlayerProps = {
  waypoints: Waypoint[];
  onClose: () => void;
};
```

**Implementação:**

1. **Câmera:** Usa `setBearing`, `changePitch`, `fitBounds`, `changeZoom` do `MapImperativeApi`. Câmera segue o drone com pitch 45° e bearing apontando para o próximo waypoint.

2. **Posição do drone:** Loop `requestAnimationFrame` interpolando entre waypoints. Velocidade proporcional à `params.speedMs` escalada 30× para visualização.

3. **Marcador do drone:** `DivIcon` do Leaflet com seta SVG rotacionada (bearing atual) + sombra suave. Entrada com `dd-wp-entra`.

4. **Camera frustum:** O `FrustumLayer` existente (Deck.gl) acompanha a posição interpolada — mostrando o footprint da câmera no terreno em tempo real.

5. **UI de controle:** Botões Play/Pause/Stop + slider de velocidade (1×, 2×, 4×). Flutuantes no canto inferior do mapa, sem sobrepor o painel.

6. **Transição de entrada:** A câmera "voa" do ponto de vista atual até o primeiro waypoint com animação cinematográfica (easing `cinematic`, 1200ms).

**Ponto de entrada:** Botão "Pré-visualizar missão" no `PreFlightChecklistModal` existente, antes do botão de execução.

---

### 5-C: Transição Plan → Results (Shared Element)

Quando o usuário troca de `panel="plan"` para `panel="results"`, o polígono no mapa persiste visualmente em vez de desaparecer e reaparecer.

**Implementação:**

O polígono do plano e o polígono dos resultados usam o mesmo GeoJSON. Durante a transição:

1. `WorkspacePage` detecta mudança de panel via `useTransition` (já existente)
2. Durante `transitionPending === true`, o `FlightPlannerMapContent` mantém o polígono visível — não desmonta
3. O painel de configuração faz `opacity: 1 → 0` enquanto o de resultados faz `0 → 1`
4. O polígono no mapa permanece estático durante toda a transição — ilusão de continuidade

Essa abordagem é não-intrusiva: usa `transitionPending` prop que já existe em `WorkspaceLayoutPanel`.

---

### 5-D: Transição 2D → 3D Cinematográfica

A troca de modo 2D/3D atualmente acontece de forma instantânea (corte).

**Modificação:** `app/src/features/map-engine/MapEngineContext.tsx`

```ts
// Nova função no MapEngineContextValue:
setModeAnimated: (mode: MapMode) => Promise<void>;
```

**Sequência ao ir para 3D (800ms total):**

1. `changeZoom(-1)` com easing `cinematic` — zoom out ligeiro para "abrir perspectiva"
2. `changePitch(+45)` com easing `cinematic`, 800ms
3. Rotação suave de 10° no bearing para sensação de "levantar voo"

**Sequência ao voltar para 2D:**

1. `setBearing(0)` — retorna ao norte
2. `changePitch(-pitch_atual)` — achata para 0°
3. `changeZoom(+1)` — zoom back in

---

## Phase 6 — Performance

---

### 6-A: Web Worker para Cálculos Turf.js

Os cálculos de waypoints usam `@turf/area`, `@turf/bearing`, `@turf/distance`, `@turf/line-intersect` na thread principal, causando jank visível em polígonos grandes.

**Arquivo novo:** `app/src/workers/flightCalculation.worker.ts`

```ts
import * as Comlink from 'comlink'   // comunicação tipada com o worker

type WorkerInput = {
  polygon:         Feature<Polygon>
  params:          FlightParams
  terrainProfile?: TerrainPoint[]
}

type WorkerOutput =
  | { ok: true;  waypoints: Waypoint[]; strips: Strip[]; stats: FlightStats }
  | { ok: false; error: string }

const api = {
  calculate: async (input: WorkerInput): Promise<WorkerOutput> => { ... }
}

Comlink.expose(api)
```

**Integração:** O `FlightPlannerCalculationBridge` passa a usar o worker. O estado `isCalculating` no store continua funcionando — agora representa o tempo de round-trip com o worker.

**Vite config:** `import FlightWorker from './workers/flightCalculation.worker?worker'`

**Fallback:** Feature detect `typeof Worker !== 'undefined'` — cálculo inline se worker não disponível (ex.: alguns contextos Android Capacitor).

---

### 6-B: Virtual List para Waypoints

O `WaypointEditorPanel` renderiza todos os waypoints. Missões de área grande têm 300–500 waypoints, causando rerender pesado.

**Modificação:** `app/src/features/flight-planner/components/WaypointEditorPanel.tsx`

Usar `@tanstack/react-virtual`:

```tsx
const virtualizer = useVirtualizer({
  count: waypoints.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 56, // altura estimada de cada row
  overscan: 5,
});

return (
  <div ref={parentRef} style={{ overflow: "auto", height: "100%" }}>
    <div
      style={{
        height: `${virtualizer.getTotalSize()}px`,
        position: "relative",
      }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => (
        <div
          key={virtualRow.key}
          style={{ position: "absolute", top: virtualRow.start, width: "100%" }}
        >
          <WaypointRow waypoint={waypoints[virtualRow.index]} />
        </div>
      ))}
    </div>
  </div>
);
```

---

### 6-C: Canvas para Route Preview em Dispositivos Low-Tier

Em `deviceTier === 'low'`, o `DroneRouteLayer` (Deck.gl PathLayer) causa jank. Substituir por Canvas 2D.

**Arquivo novo:** `app/src/features/map-engine/layers/RouteCanvas.tsx`

```tsx
// Usa react-leaflet useMap() para obter instância Leaflet
// Registra L.Canvas renderer personalizado para o Polyline da rota
// Mais performático que WebGL para geometrias simples (linha única)
// Só ativo quando deviceTier === 'low' || deviceTier === 'none'
```

**Seleção de renderer:**

```ts
// No FlightPlannerMapContent ou MapboxPlanOverlays:
const { deviceTier } = useMapEngine();
const RouteRenderer = deviceTier === "low" ? RouteCanvas : DroneRouteDeckLayer;
```

---

### 6-D: Service Worker — Tile Caching Offline

O `vite-plugin-pwa` já está instalado. Configurar estratégias de cache por tipo de recurso.

**Arquivo:** `app/vite.config.ts` (modificação) + `app/src/sw-custom.ts` (novo)

**Estratégias por tipo:**

| Tipo                              | Estratégia   | Quota     | TTL             |
| --------------------------------- | ------------ | --------- | --------------- |
| Tiles de satélite (Mapbox/Google) | CacheFirst   | 500 tiles | 7 dias          |
| Dados de API (projetos, status)   | NetworkFirst | —         | 1h stale        |
| Weather tiles                     | NetworkOnly  | —         | —               |
| Assets estáticos da app           | CacheFirst   | —         | versão do build |

**Cache warming:** Quando um plano de voo é salvo, fazer prefetch dos tiles na bbox do polígono para zoom levels 14–17 (cobertura adequada para campo).

```ts
// Em useProjects.ts — após saveFlightPlan mutation onSuccess:
await warmTileCache(polygon, { zoomLevels: [14, 15, 16, 17] });
```

**UI:** Indicador "X tiles em cache" no painel de configuração com botão "Cachear área" manual. Verificar quota disponível via `navigator.storage.estimate()` antes de iniciar o cache.

---

## Sequência de Implementação

```
Semana 1   Phase 0 completo (motionTokens + breakpoints + queryClient + GestureManager)
           Phase 1 completo (todas as quick wins em paralelo)

Semana 2   Phase 2-A (2-finger pan) + Phase 3 (stylus)

Semana 3   Phase 2-B e 2-C (radial menu + undo/redo) + Phase 4-A (split view)

Semana 4   Phase 4-B e 4-C (contextual toolbar + touch targets) + Phase 5-A (parameter preview)

Semana 5   Phase 5-B (mission preview) + Phase 5-C e 5-D (transições)

Semana 6   Phase 6 completo (worker + virtual list + canvas + service worker)
```

---

## Riscos e Mitigações

| Risco                                         | Mitigação                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Gestos conflitando com Mapbox/Leaflet         | GestureManager sempre chama `disableDrawConflictGestures()` antes de ativar handler customizado. Handlers com `priority > 0` sempre ganham. |
| Web Worker incompatível em Capacitor/Android  | Feature detect `typeof Worker !== 'undefined'` — fallback para cálculo inline na thread principal                                           |
| Split view quebrando em orientação portrait   | `useBreakpoint` + `screen.orientation.type` combinados — split view só ativa em `tablet + landscape`                                        |
| Virtual list com altura variável por waypoint | `estimateSize` conservador + `measureElement` para rows com conteúdo expandido                                                              |
| Tile cache consumindo storage excessivo       | Quota de 50MB com LRU eviction — verificar `navigator.storage.estimate()` antes de cachear                                                  |
| Radial menu sobreposto por outros elementos   | z-index dedicado (`z-[9999]`) com backdrop invisível para capturar tap-fora e chamar `onDismiss`                                            |
| Transição cinematográfica 2D→3D em low-tier   | Verificar `deviceTier` — em `low` usar transição instant (0ms) em vez da animação                                                           |

---

## Arquivos Novos a Criar

```
app/src/lib/motionTokens.ts
app/src/lib/haptics.ts
app/src/hooks/useBreakpoint.ts
app/src/hooks/useAnimatedNumber.ts
app/src/components/ui/Skeleton.tsx
app/src/components/ui/ProgressRing.tsx
app/src/features/map-engine/gestures/GestureManager.ts
app/src/features/map-engine/gestures/handlers/twoFingerPanHandler.ts
app/src/features/map-engine/gestures/handlers/undoRedoGestureHandler.ts
app/src/features/map-engine/components/MapContextMenu.tsx
app/src/features/map-engine/layers/RouteCanvas.tsx
app/src/features/flight-planner/components/StylusPressureIndicator.tsx
app/src/features/flight-planner/components/WaypointContextToolbar.tsx
app/src/features/flight-planner/components/MissionPreviewPlayer.tsx
app/src/workers/flightCalculation.worker.ts
app/src/sw-custom.ts
```

## Arquivos a Modificar

```
app/src/lib/queryClient.ts                        (0-C: cache strategy)
app/src/lib/deviceUtils.ts                        (4-C: touchTargetClass)
app/src/styles/globals.css                        (motion tokens + novas keyframes)
app/src/hooks/useBreakpoint.ts                    (substituir useMediaQuery nos componentes)
app/src/features/map-engine/MapEngineContext.tsx  (0-D: expor GestureManager + setModeAnimated)
app/src/components/layout/WorkspaceLayoutPanel.tsx (1-E, 2-D: handle + swipe dismiss + split mode)
app/src/features/flight-planner/stores/useFlightStore.ts (2-C: undo/redo stack)
app/src/features/flight-planner/components/PolygonEditHandles.tsx (1-A: haptics)
app/src/features/flight-planner/components/FreehandDrawOverlay.tsx (1-A, 3-A, 3-B: haptics + stylus)
app/src/features/flight-planner/components/FlightPlannerMapContent.tsx (2-A, 2-B: gestures)
app/src/features/flight-planner/map/planMapLeafletPathEffects.ts (5-A: param preview)
app/src/features/projects/components/ProjectStatusBadge.tsx (1-D: progress ring)
app/src/features/results/components/ResultsWorkspacePanel.tsx (1-D: progress ring grande)
app/src/features/flight-planner/components/WaypointEditorPanel.tsx (6-B: virtual list)
app/src/pages/WorkspacePage.tsx                   (4-A: split view + 5-C: shared transition)
app/vite.config.ts                                (6-D: service worker config)
```
