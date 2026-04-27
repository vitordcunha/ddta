# Plano de Implementação — UX de Interação com o Mapa

> **Contexto:** Melhoria da experiência de usuário para interação com o mapa no flight planner, com foco em mobile landscape + suporte a caneta/stylus.  
> **Stack relevante:** Capacitor · Leaflet · Mapbox GL · Google Maps · deck.gl · Zustand

---

## Visão Geral dos Módulos

| # | Módulo | Prioridade | Complexidade |
|---|--------|------------|--------------|
| 1 | Controles 3D (pitch / bearing / zoom) | Alta | Média |
| 2 | Toolbar de desenho + banner de modo | Alta | Baixa |
| 3 | Crosshair toggle | Média | Baixa |
| 4 | Freehand com caneta (pen input) | Alta | Alta |
| 5 | Edição de polígono (handles) | Alta | Alta |
| 6 | Waypoints manuais no mapa | Alta | Alta |
| 7 | Haptics | Média | Baixa |
| 8 | Gesture lock no modo desenho | Alta | Baixa |

---

## Módulo 1 — Controles 3D (pitch / bearing / zoom)

### Comportamento
- Visível **somente** em modo 3D (Mapbox 3D ou Google Maps 3D) **e** em landscape
- Posicionamento: canto inferior direito, empilhado verticalmente **acima** do WindIndicatorOverlay
- Usa o mesmo padrão de posicionamento do vento: `right: calc(var(--right-panel-width) + 0.75rem)` e `bottom` dinâmico acima do wind indicator
- Z-index: `z-44` (mesmo nível do wind indicator)

### Botões (de cima para baixo)
```
[ ⟳ ]  Reset norte (bearing → 0°)
[ ▲ ]  Aumentar pitch (+15° por clique, max 60°)
[ ▼ ]  Diminuir pitch (-15° por clique, min 0°)
[ + ]  Zoom in
[ − ]  Zoom out
```

### Implementação

**Novo componente:** `app/src/features/map-engine/components/MapControls3D.tsx`

```tsx
// Props recebidas pelo contexto do mapa
interface MapControls3DProps {
  onBearingReset: () => void
  onPitchChange: (delta: number) => void
  onZoom: (delta: number) => void
  visible: boolean // só em 3D + landscape
}
```

**Integração por provider:**
- **Mapbox:** `map.easeTo({ bearing: 0 })` / `map.easeTo({ pitch: newPitch })` / `map.zoomIn()`
- **Google Maps 3D:** `map.setTilt()` / `map.setHeading()` / `map.setZoom()`

**Exposição via MapEngineContext:** adicionar callbacks `setBearing`, `setPitch`, `setZoom` no contexto para que o componente seja agnóstico ao provider.

### Posicionamento no WorkspacePage
O componente deve ser renderizado no mesmo nível do `WindIndicatorOverlay`, usando `bottom` calculado como `windIndicatorHeight + gap`:

```tsx
// Posição do cluster de controles
style={{
  position: 'fixed',
  right: `calc(var(--right-panel-width) + 0.75rem)`,
  bottom: `calc(max(6rem, 0.75rem + env(safe-area-inset-bottom)) + windIndicatorHeight + 0.5rem)`,
  zIndex: 44,
  display: isLandscape && is3DMode ? 'flex' : 'none',
  flexDirection: 'column',
  gap: '0.25rem',
}}
```

---

## Módulo 2 — Toolbar de Desenho + Banner de Modo

### Banner "MODO DESENHO"
- Aparece na TopBar (ou imediatamente abaixo dela) quando `plannerInteractionMode === 'draw'`
- Fundo colorido distinto (ex: azul `bg-blue-600`) para diferenciar visualmente do estado normal
- Texto: `"MODO DESENHO — Toque no mapa para adicionar vértices"`
- Desaparece ao sair do modo desenho

**Implementação:** modificar `WorkspaceTopBar.tsx` para renderizar um sub-banner condicional, ou adicionar um overlay fixo abaixo da topbar em `FlightPlannerMapContent.tsx`.

### Toolbar Flutuante de Desenho
- Aparece na parte inferior do mapa quando em modo desenho, **acima do safe area**
- Desaparece ao sair do modo desenho

**Layout:**
```
┌────────────────────────────────────────────┐
│  [← Desfazer]  [✕ Cancelar]  [✓ Concluir] │
└────────────────────────────────────────────┘
```

**Posicionamento:**
```tsx
style={{
  position: 'fixed',
  bottom: `max(1.5rem, env(safe-area-inset-bottom))`,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 55,
}}
```

**Novo componente:** `app/src/features/flight-planner/components/DrawingToolbar.tsx`

```tsx
interface DrawingToolbarProps {
  visible: boolean
  canUndo: boolean         // draftPoints.length > 0
  canComplete: boolean     // draftPoints.length >= 3
  onUndo: () => void       // removeLastDraftPoint()
  onCancel: () => void     // clearDraftPoints() + setMode('navigate')
  onComplete: () => void   // closeDraftToPolygon()
}
```

**Conectar ao store:** `useFlightStore` já tem `draftPoints` e `addDraftPoint` — adicionar `removeLastDraftPoint()` se não existir.

---

## Módulo 3 — Toggle Crosshair

### Comportamento
- Botão na `DrawingToolbar` ou na `PlannerIconSidebar` (ícone de mira)
- Estado salvo em `userPreferences` (persiste entre sessões)
- Quando ativo: exibe crosshair fixo no centro do mapa + botão "+" para confirmar vértice
- Quando inativo: comportamento padrão (tap direto no mapa)

### Crosshair UI
```
        |
   ─────●─────   ← ponto de referência
        |
```
- Overlay SVG absoluto, `pointer-events: none`, centralizado no mapa
- Botão "+" circular fixo abaixo do crosshair (ou na toolbar), `pointer-events: all`

**Novo componente:** `app/src/features/flight-planner/components/CrosshairOverlay.tsx`

```tsx
interface CrosshairOverlayProps {
  visible: boolean // só em draw mode + crosshair habilitado
  onAddVertex: () => void // usa centro atual do mapa como coordenada
}
```

**Obter centro do mapa:** cada provider expõe o centro atual:
- Leaflet: `map.getCenter()`
- Mapbox: `map.getCenter()`
- Google Maps: `map.getCenter().toJSON()`

Expor `getMapCenter(): [lat, lng]` no `MapEngineContext`.

### Preferência do usuário
Adicionar em `app/src/constants/userPreferences.ts`:
```ts
CROSSHAIR_DRAW_MODE: 'crosshairDrawMode' // boolean, default: false
```

---

## Módulo 4 — Freehand com Caneta (Pen Input)

### Detecção de caneta
Usar `PointerEvent.pointerType === 'pen'` para ativar automaticamente o modo freehand.

```ts
// Hook de detecção
function usePenInput() {
  const [isPenActive, setIsPenActive] = useState(false)
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (e.pointerType === 'pen') setIsPenActive(true)
      else setIsPenActive(false)
    }
    window.addEventListener('pointerdown', handler)
    return () => window.removeEventListener('pointerdown', handler)
  }, [])
  return isPenActive
}
```

### Fluxo do freehand
1. Usuário toca o mapa com caneta em draw mode → inicia captura de pontos brutos
2. Durante o arrasto: renderiza traçado bruto em cinza claro (`polyline` temporária)
3. **Pan do mapa é desabilitado** durante o desenho freehand (caneta não deve mover o mapa)
4. Ao soltar (`pointerup`):
   - Aplica **Ramer-Douglas-Peucker** com `epsilon` inicial (ex: `0.00005` graus, ~5m)
   - Fecha o polígono automaticamente (linha reta do último ponto ao primeiro)
   - Exibe o polígono simplificado como preview
5. Mostra controle de simplificação: `[− Menos vértices] [N vértices] [+ Mais vértices]`
   - Ajusta o `epsilon` e re-simplifica em tempo real
6. Botões `[✓ Aceitar]` e `[↺ Redesenhar]`

### Algoritmo de simplificação
Usar a lib `@turf/simplify` (já temos `@turf` no projeto):

```ts
import simplify from '@turf/simplify'

function simplifyFreehandPath(
  rawPoints: [number, number][],
  tolerance: number
): [number, number][] {
  const line = turf.lineString(rawPoints.map(([lat, lng]) => [lng, lat]))
  const simplified = simplify(line, { tolerance, highQuality: true })
  return simplified.geometry.coordinates.map(([lng, lat]) => [lat, lng])
}
```

### Inibir pan durante freehand
- Leaflet: `map.dragging.disable()` ao iniciar, `map.dragging.enable()` ao terminar
- Mapbox: `map.dragPan.disable()` / `map.dragPan.enable()`
- Expor `disableMapPan()` / `enableMapPan()` no `MapEngineContext`

### Novo componente
`app/src/features/flight-planner/components/FreehandDrawOverlay.tsx` — SVG overlay que captura os pointer events e renderiza o traçado em tempo real.

---

## Módulo 5 — Edição de Polígono (Handles de Vértice e Midpoint)

### Condição de ativação
- Handles visíveis **somente** quando o painel de configuração (FlightPlannerConfigPanel) está aberto
- Controlado pela variável `--right-panel-width > 0` ou estado `isPanelOpen` do store

### Tipos de handle
| Tipo | Aparência | Tamanho hit target | Ação |
|------|-----------|-------------------|------|
| Vértice | Círculo azul sólido | 44px (≈ 11mm) | Arrastar para mover |
| Midpoint | Círculo azul semi-transparente, menor | 36px | Arrastar para inserir vértice |

### Comportamento de drag
1. `pointerdown` no handle → inicia drag, inibe pan do mapa
2. `pointermove` → atualiza posição do vértice em tempo real (preview dashed)
3. `pointerup` → confirma nova posição, atualiza polígono no store, reativa pan

### Long press em vértice → deletar
- Pressionar e segurar vértice por 500ms → exibe mini-menu: `[🗑 Deletar vértice]`
- Validação: mínimo 3 vértices — se só tiver 3, mostrar `"Polígono precisa de pelo menos 3 vértices"`

### Implementação
**Novo componente:** `app/src/features/flight-planner/components/PolygonEditHandles.tsx`

```tsx
interface PolygonEditHandlesProps {
  polygon: Feature<Polygon> | null
  editable: boolean // isPanelOpen
  onVertexMove: (index: number, newLatLng: [lat, lng]) => void
  onVertexDelete: (index: number) => void
  onMidpointInsert: (afterIndex: number, newLatLng: [lat, lng]) => void
}
```

**Store:** adicionar actions em `useFlightStore`:
```ts
movePolygonVertex(index: number, latLng: [number, number]): void
deletePolygonVertex(index: number): void
insertPolygonVertex(afterIndex: number, latLng: [number, number]): void
```

**Renderização por provider:**
- Leaflet: usar `react-leaflet` `Marker` com `DivIcon` custom, `draggable`
- 3D (deck.gl): usar `ScatterplotLayer` com `pickable`, tratar drag via `onDrag` do deck.gl

---

## Módulo 6 — Waypoints Manuais no Mapa

### Adicionar waypoint via long press
1. Long press no mapa (500ms, sem movimento > 10px) em modo `navigate`
2. Feedback: círculo expansivo no ponto de toque durante o hold
3. Ao completar: insere waypoint naquela posição com altitude padrão (igual à média dos waypoints adjacentes)
4. Waypoint entra em estado "manual" (`isManual: true` no tipo `Waypoint`)

### Deletar waypoint via long press
1. Long press em waypoint existente → mini-menu: `[🗑 Deletar waypoint]`
2. Confirmação inline (não modal): `"Deletar este waypoint?"` `[Sim] [Não]`

### Drag de waypoint em 3D (deck.gl)
Deck.gl suporta drag via:
```ts
new ScatterplotLayer({
  ...
  onDragStart: (info) => { disableMapPan(); setDraggingWaypoint(info.object.id) },
  onDrag: (info) => { updateWaypointPosition(info.object.id, info.coordinate) },
  onDragEnd: (info) => { enableMapPan(); commitWaypointPosition() },
})
```

Expor `isDraggable` como prop configurável na `WaypointLayer`.

### Estado "modo manual"
Adicionar campo ao store:
```ts
hasManualWaypoints: boolean  // true quando qualquer waypoint tem isManual: true
```

**Banner no mapa** (abaixo da topbar, acima do conteúdo):
```
⚠ Plano modificado manualmente   [Recalcular]  [×]
```
- Cor: amarelo/âmbar
- Z-index: 55
- `[Recalcular]` abre dialog de confirmação
- `[×]` apenas fecha o banner (waypoints manuais persistem)

### Dialog de confirmação ao alterar parâmetros
Quando `hasManualWaypoints === true` e o usuário altera qualquer parâmetro de voo que dispara recálculo:

```
┌──────────────────────────────────────────────┐
│  Recalcular waypoints?                        │
│                                               │
│  Você alterou parâmetros de voo. Deseja       │
│  recalcular todos os waypoints?               │
│  As edições manuais serão perdidas.           │
│                                               │
│  [Manter edições manuais]   [Recalcular tudo] │
└──────────────────────────────────────────────┘
```

**Implementação:** interceptar o `useEffect` que observa mudanças de parâmetros em `FlightPlannerCalculationBridge.tsx` — antes de disparar o recálculo, checar `hasManualWaypoints` e exibir o dialog.

---

## Módulo 7 — Haptics

### Dependência
```bash
npm install @capacitor/haptics
```

### Mapeamento de eventos → feedback
| Evento | Haptic |
|--------|--------|
| Vértice adicionado (tap/caneta) | `ImpactStyle.Light` |
| Snap ao primeiro vértice (fechar polígono) | `ImpactStyle.Medium` |
| Polígono concluído | `NotificationType.Success` |
| Geometria inválida (auto-intersecção) | `NotificationType.Error` |
| Waypoint adicionado | `ImpactStyle.Light` |
| Waypoint deletado | `ImpactStyle.Medium` |
| Long press ativado (500ms) | `ImpactStyle.Heavy` |

### Utilitário
**Novo arquivo:** `app/src/utils/haptics.ts`

```ts
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()

export const haptic = {
  light: () => isNative && Haptics.impact({ style: ImpactStyle.Light }),
  medium: () => isNative && Haptics.impact({ style: ImpactStyle.Medium }),
  heavy: () => isNative && Haptics.impact({ style: ImpactStyle.Heavy }),
  success: () => isNative && Haptics.notification({ type: NotificationType.Success }),
  error: () => isNative && Haptics.notification({ type: NotificationType.Error }),
}
```

---

## Módulo 8 — Gesture Lock no Modo Desenho

### Problema
Em modo desenho, gestos de 2 dedos (rotate, tilt) conflitam com intenções do usuário.

### Solução
Ao entrar em `plannerInteractionMode === 'draw'`, desabilitar rotate e tilt em todos os providers:

| Provider | Disable rotate | Disable tilt |
|----------|---------------|--------------|
| Leaflet | N/A (sem rotate nativo) | N/A |
| Mapbox | `map.touchZoomRotate.disableRotation()` | `map.touchPitch.disable()` |
| Google Maps | `map.setOptions({ rotateControl: false, tiltInteractionEnabled: false })` | idem |

Ao sair do modo desenho: reabilitar tudo.

**Implementação:** adicionar `disableDrawConflictGestures()` / `enableDrawConflictGestures()` no `MapEngineContext` e chamar nos handlers de entrada/saída do modo desenho.

---

## Arquivos a Criar

| Arquivo | Descrição |
|---------|-----------|
| `components/map-engine/MapControls3D.tsx` | Cluster de botões pitch/bearing/zoom |
| `flight-planner/components/DrawingToolbar.tsx` | Toolbar inferior de desenho |
| `flight-planner/components/CrosshairOverlay.tsx` | Mira central + botão confirmar vértice |
| `flight-planner/components/FreehandDrawOverlay.tsx` | Captura e renderiza traçado freehand |
| `flight-planner/components/PolygonEditHandles.tsx` | Handles de vértice e midpoint |
| `utils/haptics.ts` | Wrapper de haptics |

## Arquivos a Modificar

| Arquivo | O que muda |
|---------|-----------|
| `MapEngineContext.tsx` | + `getMapCenter`, `disableMapPan/enable`, `disableDrawGestures/enable`, `setBearing/Pitch/Zoom` |
| `useFlightStore.ts` | + `removeLastDraftPoint`, `movePolygonVertex`, `deletePolygonVertex`, `insertPolygonVertex`, `hasManualWaypoints`, `isManual` em Waypoint |
| `FlightPlannerMapContent.tsx` | Integrar novos componentes, PolygonEditHandles, long press handlers |
| `FlightPlannerCalculationBridge.tsx` | Interceptar recálculo quando `hasManualWaypoints` |
| `WaypointLayer.ts` | Adicionar suporte a drag no deck.gl |
| `WorkspaceTopBar.tsx` ou `WorkspacePage.tsx` | Banner de modo desenho e banner de plano manual |
| `constants/userPreferences.ts` | + `crosshairDrawMode` |
| `AndroidManifest.xml` + `capacitor.config.ts` | Confirmar permissões para haptics (já deve estar OK) |

---

## Ordem de Implementação Sugerida

```
Fase 1 — Base (sem dependências entre si)
  ├── Módulo 7: Haptics (utilitário isolado, baixo risco)
  ├── Módulo 8: Gesture lock (pequena mudança no contexto)
  └── Módulo 2: Toolbar de desenho + banner (UI isolada)

Fase 2 — Interação com polígono
  ├── Módulo 3: Crosshair toggle
  ├── Módulo 5: Handles de edição de polígono
  └── Módulo 4: Freehand com caneta

Fase 3 — Waypoints e 3D
  ├── Módulo 6: Waypoints manuais
  └── Módulo 1: Controles 3D
```

---

## Notas de UX

- **Landscape only:** os controles 3D e toda a experiência avançada de desenho são otimizados para landscape. Portrait pode funcionar mas não é o foco.
- **Feedback visual sempre antes do háptico:** nunca confiar só no haptic — sempre ter um correspondente visual.
- **Nenhuma ação destrutiva sem confirmação:** deletar vértice, deletar waypoint, recalcular sobre edições manuais — todos pedem confirmação.
- **O modo freehand precisa ser excelente ou não deve existir:** se a simplificação não ficar boa, melhor não lançar. Testar com vários traçados reais antes de considerar pronto.
