# Plano de Otimização Mobile — DroneData

**Data:** 2026-04-26  
**Contexto:** App Capacitor + React 19 + Vite rodando em WebView Android. O objetivo é reduzir jank, diminuir o bundle inicial, e melhorar a fluidez percebida especialmente em dispositivos mid-range.

---

## Diagnóstico Geral

### Pontos Fortes Existentes
- Device tier detection (`high` / `low` / `none`) já implementado em `MapEngineContext`
- Code splitting para providers de mapa (lazy + Suspense)
- Virtualização de listas longas com TanStack Virtual (`UploadProgressList`)
- 230+ instâncias de `useMemo` / `useCallback` no codebase
- `prefers-reduced-motion` respeitado no CSS
- PWA com workbox caching

### Problemas Identificados
- `FlightPlannerConfigPanel.tsx` com 2618 LOC — mega-componente sem separação de responsabilidades
- `backdrop-blur-xl` aplicado indiscriminadamente, sem considerar device tier
- Listener de `resize` / `orientationchange` sem debounce em `WorkspacePage.tsx`
- Modais montados no DOM mesmo quando fechados (305+ LOC cada)
- `@turf/turf` importado como bundle completo (~400KB)
- Nenhum uso de `useTransition` / `useDeferredValue` (React 19 disponível)
- Map event listeners recriados dentro de `useEffect` sem cache

---

## Fase 1 — Quick Wins (baixo risco, alto impacto imediato)

### 1.1 Condicionar `backdrop-blur` por Device Tier

**Arquivo:** `app/src/features/map-engine/MapEngineContext.tsx`  
**Impacto:** Fluidez imediata em dispositivos mid-range Android. `backdrop-blur` é uma das operações de composição mais pesadas para WebViews.

**O que fazer:**
1. Exportar `deviceTier` do `MapEngineContext` como valor acessível globalmente (já existe internamente, só expor).
2. Criar um hook utilitário `useDeviceTier()` que retorna o tier atual.
3. Criar uma função utilitária `glassClass(tier)` em `app/src/lib/deviceUtils.ts`:

```ts
// app/src/lib/deviceUtils.ts
export function glassClass(tier: 'high' | 'low' | 'none') {
  if (tier === 'high') return 'backdrop-blur-xl bg-black/40';
  return 'bg-neutral-900/85'; // sem blur em low/none
}
```

4. Substituir todas as ocorrências hardcoded de `backdrop-blur-xl` nos componentes de glass morphism (`glass-surface`, `glass-toolbar`, `glass-card` em `globals.css` e nos componentes `WorkspaceLayoutPanel`, `WorkspaceTopBar`, `FlightPlannerConfigPanel`) pela função utilitária.

**Arquivos afetados:**
- `app/src/styles/globals.css` — remover `backdrop-blur-xl` das classes `.glass-*`
- `app/src/components/layout/WorkspaceTopBar.tsx`
- `app/src/pages/WorkspacePage.tsx`
- `app/src/lib/deviceUtils.ts` (novo)

---

### 1.2 Debounce no Listener de Resize / Orientação

**Arquivo:** `app/src/pages/WorkspacePage.tsx`  
**Impacto:** Elimina dezenas de re-renders desnecessários durante rotação de tela e resize.

**O que fazer:**
1. O hook `useDebounce` já existe no projeto — usá-lo aqui.
2. Envolver o handler de orientação com `debounce` de 100ms:

```ts
// Antes
const handler = () => setIsLandscape(window.innerWidth > window.innerHeight);
window.addEventListener("resize", handler);
window.addEventListener("orientationchange", handler);

// Depois
import { useDebounce } from '@/hooks/useDebounce';

const handler = debounce(
  () => setIsLandscape(window.innerWidth > window.innerHeight),
  100
);
window.addEventListener("resize", handler);
window.addEventListener("orientationchange", handler);
```

3. Garantir que a função debounced seja referenciada de forma estável (criar fora do `useEffect` ou com `useRef`).

**Arquivos afetados:**
- `app/src/pages/WorkspacePage.tsx`

---

### 1.3 Tree-shaking do `@turf/turf`

**Impacto:** Redução estimada de ~200–250KB no bundle JavaScript.

**O que fazer:**
1. Mapear todas as importações de `@turf/turf` no codebase:
   ```
   grep -r "from '@turf" app/src --include="*.ts" --include="*.tsx"
   ```
2. Instalar apenas os pacotes individuais necessários:
   ```
   npm install @turf/area @turf/bbox @turf/center @turf/distance @turf/helpers @turf/intersect @turf/union @turf/buffer @turf/boolean-point-in-polygon
   ```
   (lista final depende do grep acima)
3. Substituir `import * as turf from '@turf/turf'` por imports individuais em cada arquivo.
4. Remover `@turf/turf` do `package.json` após migração.

**Arquivos afetados:**
- Todos os arquivos em `app/src/features/flight-planner/utils/`
- `app/src/features/map-engine/` (verificar)

---

### 1.4 Lazy Mount de Modais

**Impacto:** Remove ~2000 LOC de árvore React do reconciliador enquanto os modais estão fechados.

**O que fazer:**
Todos os modais devem retornar `null` quando `open === false`, em vez de renderizarem com `display: none` ou opacity 0:

```tsx
// Padrão a aplicar em todos os modais
export function CreateProjectModal({ open, onClose }: Props) {
  if (!open) return null; // ← adicionar
  return <Dialog open={open}>...</Dialog>
}
```

**Modais a corrigir:**
- `app/src/features/projects/components/CreateProjectModal.tsx`
- `app/src/features/projects/components/DeleteProjectModal.tsx`
- `app/src/features/projects/components/ProjectPurgeModal.tsx`
- `app/src/features/flight-planner/components/PreFlightChecklistModal.tsx` (605 LOC — maior impacto)
- `app/src/features/flight-planner/components/KmzTransferNative.tsx`

**Observação:** Confirmar que o Radix UI `Dialog` não gerencia o unmount internamente via `forceMount` — se sim, o unmount já é feito pelo Radix e não precisa do `if (!open) return null`.

---

## Fase 2 — Concurrent Rendering (React 19)

### 2.1 `useTransition` na Abertura de Painéis

**Arquivos:** `app/src/pages/WorkspacePage.tsx`, `app/src/components/layout/WorkspaceLayoutPanel.tsx`  
**Impacto:** Elimina jank ao abrir/fechar o painel lateral de flight planner. O React 19 marca a transição como não-urgente, mantendo o mapa e inputs responsivos durante a montagem.

**O que fazer:**
1. Em `WorkspacePage.tsx`, envolver o state de toggle do painel com `useTransition`:

```tsx
const [isPending, startTransition] = useTransition();

const handlePanelToggle = () => {
  startTransition(() => {
    setPanelOpen(prev => !prev);
  });
};
```

2. Usar `isPending` para mostrar um indicador visual sutil (ex: opacidade reduzida no botão) durante a transição.

**Arquivos afetados:**
- `app/src/pages/WorkspacePage.tsx`

---

### 2.2 `useDeferredValue` para Cálculos de Missão

**Arquivo:** `app/src/features/flight-planner/components/FlightPlannerCalculationBridge.tsx`  
**Impacto:** Cálculos de waypoints, área e tempo de voo são computacionalmente pesados. `useDeferredValue` permite que o mapa e o input do usuário permaneçam responsivos enquanto os cálculos são executados em background.

**O que fazer:**
1. Identificar os parâmetros de entrada dos cálculos (`polygon`, `overlap`, `altitude`, `drone specs`).
2. Aplicar `useDeferredValue` nos inputs que disparam recalculo:

```tsx
const deferredPolygon = useDeferredValue(polygon);
const deferredSettings = useDeferredValue(flightSettings);

// Usar deferredPolygon e deferredSettings no useMemo de cálculo
const waypoints = useMemo(() => calculateWaypoints(deferredPolygon, deferredSettings), [deferredPolygon, deferredSettings]);
```

**Arquivos afetados:**
- `app/src/features/flight-planner/components/FlightPlannerCalculationBridge.tsx`

---

## Fase 3 — Refatoração do Mega-Componente

### 3.1 Decomposição do `FlightPlannerConfigPanel.tsx`

**Arquivo:** `app/src/features/flight-planner/components/FlightPlannerConfigPanel.tsx` (2618 LOC)  
**Impacto:** O componente mais crítico. Qualquer mudança de estado rerenderiza 2618 LOC. Decomposição em sub-componentes com `React.memo` elimina a maioria dos re-renders desnecessários.

**Análise de responsabilidades atuais:**
1. Seleção de drone (`DronePicker`)
2. Configurações de missão (altitude, overlap, velocidade)
3. Configurações de clima / solar position
4. Presets de missão
5. Opções de grade / padrão de voo
6. KMZ export
7. Checklist de pré-voo (já em modal separado)
8. Sumário de missão (estatísticas)

**Estrutura de arquivos proposta:**
```
features/flight-planner/components/
├── FlightPlannerConfigPanel.tsx       ← shell principal (~200 LOC)
├── panels/
│   ├── MissionSettingsPanel.tsx       ← altitude, overlap, velocidade
│   ├── DroneSettingsPanel.tsx         ← drone picker + specs
│   ├── WeatherPanel.tsx               ← dados de clima + solar position
│   ├── FlightPatternPanel.tsx         ← grade, padrão, heading
│   ├── MissionPresetsPanel.tsx        ← presets
│   └── MissionSummaryBar.tsx          ← estatísticas de missão
```

**Passos de refatoração:**
1. Extrair `MissionSummaryBar` (estatísticas) — componente puramente display, mais simples de começar.
2. Extrair `WeatherPanel` — tem seu próprio fetch (useQuery), altamente isolável.
3. Extrair `DroneSettingsPanel` — já tem `DronePicker.tsx` separado, só consolidar.
4. Extrair `FlightPatternPanel` — lógica de grid/heading isolada.
5. Extrair `MissionSettingsPanel` — core dos inputs de missão.
6. Extrair `MissionPresetsPanel` — lógica de presets.
7. Envolver cada sub-componente com `React.memo` e verificar que os props passados são estáveis (via `useCallback`/`useMemo` no pai).

**Critérios de sucesso:**
- `FlightPlannerConfigPanel.tsx` com menos de 300 LOC
- Cada sub-componente com menos de 400 LOC
- Zero prop drilling desnecessário (usar Zustand store `useFlightStore` diretamente nos filhos quando necessário)

---

## Fase 4 — Deck.gl e Map Performance

### 4.1 Estabilizar Dados das Layers Deck.gl

**Arquivo:** `app/src/features/results/components/ResultsMapLayers.tsx`  
**Impacto:** Deck.gl reprocessa toda a geometria na GPU quando detecta que a referência do array de dados mudou. Arrays recriados em cada render causam re-uploads de geometria desnecessários.

**O que fazer:**
1. Auditar todos os props `data` das layers deck.gl no arquivo.
2. Garantir que arrays de dados são sempre wrapped em `useMemo` com deps estáveis:

```tsx
// Antes
<ScatterplotLayer data={photos.map(p => ({ position: [p.lon, p.lat] }))} />

// Depois
const scatterData = useMemo(
  () => photos.map(p => ({ position: [p.lon, p.lat] })),
  [photos]
);
<ScatterplotLayer data={scatterData} />
```

3. Verificar `DroneRouteLayer`, `WaypointLayer`, `PointCloudLayer` nas layers do flight planner.

**Arquivos afetados:**
- `app/src/features/results/components/ResultsMapLayers.tsx`
- `app/src/features/map-engine/layers/` (verificar cada layer)

---

### 4.2 Memoizar Map Event Handlers

**Arquivo:** `app/src/features/map-engine/providers/mapbox/MapboxMapView.tsx`, `GoogleMapsView.tsx`  
**Impacto:** Event listeners recriados a cada render causam `removeListener + addListener` desnecessários no mapa, gerando flicker e processamento extra.

**O que fazer:**
1. Envolver handlers de click/move/zoom em `useCallback` com deps corretas.
2. Para o Google Maps API (`map.addListener`), usar `useRef` para armazenar o listener e remover corretamente:

```tsx
const clickHandlerRef = useRef<google.maps.MapsEventListener | null>(null);

useEffect(() => {
  if (!map) return;
  if (clickHandlerRef.current) clickHandlerRef.current.remove();
  clickHandlerRef.current = map.addListener('click', handleClick);
  return () => clickHandlerRef.current?.remove();
}, [map, handleClick]); // handleClick memoizado com useCallback
```

**Arquivos afetados:**
- `app/src/features/map-engine/providers/mapbox/MapboxMapView.tsx`
- `app/src/features/map-engine/providers/google/GoogleMapsView.tsx` (estimado)

---

## Fase 5 — CSS e Composição

### 5.1 CSS Containment nos Painéis Laterais

**Impacto:** Impede que mudanças dentro do painel de flight planner disparem repaints na área do mapa. Particularmente relevante durante digitação nos inputs de configuração.

**O que fazer:**
Adicionar `contain: layout style` nos containers dos painéis:

```css
/* app/src/styles/globals.css */
.panel-container {
  contain: layout style;
}
```

```tsx
// WorkspaceLayoutPanel.tsx
<div className="panel-container ...">
  {children}
</div>
```

**Arquivos afetados:**
- `app/src/styles/globals.css`
- `app/src/components/layout/WorkspaceLayoutPanel.tsx`

---

### 5.2 `will-change` para Animações de Slide

**Impacto:** Cria camada de composição GPU antecipada para painéis animados, eliminando o custo de criação da camada no momento da animação.

**O que fazer:**
Adicionar `will-change: transform` nos elementos que animam com `slideIn`:

```css
/* globals.css — apenas nos elementos que de fato animam */
.panel-animated {
  will-change: transform;
}
```

**Observação importante:** `will-change` consome memória de GPU. Aplicar **apenas** em elementos que realmente animam e **remover** após a animação com `will-change: auto`. Com framer-motion, isso pode ser feito via `onAnimationComplete`.

**Arquivos afetados:**
- `app/src/styles/globals.css`
- `app/src/components/layout/WorkspaceLayoutPanel.tsx`

---

## Checklist de Implementação

### Fase 1 — Quick Wins
- [ ] 1.1 Condicionar `backdrop-blur` por device tier (`deviceUtils.ts` + componentes)
- [ ] 1.2 Debounce no resize/orientationchange em `WorkspacePage.tsx`
- [ ] 1.3 Tree-shaking do `@turf/turf` → imports individuais
- [ ] 1.4 Lazy mount de modais (retornar null quando fechados)

### Fase 2 — Concurrent Rendering
- [ ] 2.1 `useTransition` na abertura de painéis (`WorkspacePage.tsx`)
- [ ] 2.2 `useDeferredValue` para cálculos de missão (`FlightPlannerCalculationBridge.tsx`)

### Fase 3 — Mega-Componente
- [ ] 3.1a Extrair `MissionSummaryBar`
- [ ] 3.1b Extrair `WeatherPanel`
- [ ] 3.1c Extrair `DroneSettingsPanel`
- [ ] 3.1d Extrair `FlightPatternPanel`
- [ ] 3.1e Extrair `MissionSettingsPanel`
- [ ] 3.1f Extrair `MissionPresetsPanel`
- [ ] 3.1g Envolver sub-componentes com `React.memo`

### Fase 4 — Map/Deck.gl
- [ ] 4.1 Estabilizar referências de dados das layers deck.gl
- [ ] 4.2 Memoizar event handlers dos provedores de mapa

### Fase 5 — CSS
- [ ] 5.1 `contain: layout style` nos painéis laterais
- [ ] 5.2 `will-change: transform` nas animações de slide

---

## Estimativa de Impacto por Fase

| Fase | Esforço | Ganho de Bundle | Ganho de Runtime |
|------|---------|-----------------|-----------------|
| 1 — Quick Wins | 1–2 dias | ~250KB | Alto (fluidez visual) |
| 2 — Concurrent | 1 dia | 0 | Alto (responsividade) |
| 3 — Mega-componente | 3–5 dias | 0 | Médio-Alto (re-renders) |
| 4 — Map/Deck.gl | 1–2 dias | 0 | Médio (GPU) |
| 5 — CSS | 0.5 dia | 0 | Baixo-Médio (paint) |

**Ordem recomendada de execução:** Fase 1 → Fase 2 → Fase 4 → Fase 5 → Fase 3 (por risco crescente)
