# Plano de Redesign UI/UX — DroneData Plataforma

**Data:** Abril 2026  
**Escopo:** Planejador de voo, layout geral, experiência tablet-first

---

## Visão geral

O problema central é que cada componente da interface se comporta de forma independente, sem consciência dos outros. O resultado são sobreposições, informações duplicadas, e um fluxo de uso confuso especialmente em tablets — o dispositivo principal dos usuários de campo.

Este plano organiza as mudanças em **fases**, da mais estrutural (layout) à mais refinada (UX de componentes individuais), permitindo implementação incremental sem quebrar o que funciona.

---

## Fase 1 — Sistema de Layout Consciente

**Objetivo:** Eliminar sobreposições de componentes de forma permanente, sem depender de valores fixos em pixels.

### 1.1 CSS Custom Properties para regiões ocupadas

**Onde:** `WorkspacePage.tsx`

Adicionar ao elemento raiz (`fixed inset-0`) as seguintes variáveis CSS que refletem o estado atual do layout:

```css
--right-panel-width: 0px    /* 0 quando painel recolhido, ~32rem quando aberto */
--left-sidebar-width: 3rem  /* largura da sidebar de ícones */
--topbar-height: 3.5rem     /* altura da navbar */
```

A variável `--right-panel-width` deve ser atualizada via `style` no elemento pai quando o painel abre/fecha (o estado `open` já existe em `WorkspaceLayoutPanel`). Expor esse estado via callback `onOpenChange` para o pai (`WorkspacePage`) poder setar a variável.

**Impacto:** Qualquer componente passa a poder usar `right: calc(var(--right-panel-width) + 0.75rem)` para se posicionar corretamente.

---

### 1.2 Mover WindIndicatorOverlay para fora do MapContainer

**Problema:** `WindIndicatorOverlay` está dentro do `<MapContainer>` do Leaflet (e no `MapboxMapView`), com `right: 0.75rem` fixo. O painel direito tem ~512px — o indicador some atrás.

**Solução:**

1. Remover `<WindIndicatorOverlay />` de `LeafletMapView.tsx` e `MapboxMapView.tsx`
2. Renderizá-lo em `WorkspacePage.tsx` como overlay independente, no mesmo nível da sidebar:

```tsx
{showPlanChrome ? (
  <div
    className="pointer-events-none absolute z-[44]"
    style={{
      right: "calc(var(--right-panel-width) + 0.75rem)",
      bottom: "max(6rem, calc(0.75rem + var(--safe-area-bottom, 0px)))",
    }}
  >
    <WindIndicatorOverlay />
  </div>
) : null}
```

3. O `WindIndicatorOverlay` deixa de ter posicionamento próprio — recebe apenas seu conteúdo visual.

---

### 1.3 Corrigir ResultsMapToolsOverlay

**Problema:** O painel de resultados de medição usa `right-3` fixo e fica atrás do painel direito quando aberto.

**Solução:** Usar `--right-panel-width`:

```tsx
// resultado de medição
style={{ right: "calc(var(--right-panel-width) + 0.75rem)", bottom: "0.75rem" }}
```

O controle de opacidade (`left-3 bottom-[50%]`) sai do overlay do mapa e vai para dentro do `ResultsWorkspacePanel` como um controle inline no painel — faz mais sentido conceitualmente.

---

### 1.4 Sidebar — limitar crescimento vertical

**Problema:** A `PlannerIconSidebar` pode ter 4 grupos simultâneos e crescer além do `bottom: 6rem`, cortando conteúdo.

**Solução:**

1. Adicionar `overflow-y: auto` no container da sidebar com `max-height` derivado das variáveis de layout:
   ```tsx
   style={{
     maxHeight: "calc(100dvh - var(--topbar-height) - 6rem)"
   }}
   ```
2. Mover "Grade de rota" da sidebar para o painel de configuração (ver Fase 3).

---

## Fase 2 — Navbar e Seleção de Projeto

**Objetivo:** Eliminar `<select>` nativo, uniformizar navegação, melhorar usabilidade em touch.

### 2.1 Substituir `<select>` de projeto por Combobox

**Onde:** `WorkspaceTopBar.tsx`

O seletor de projeto atual é um `<select>` nativo (`h-11 rounded-full`). Em tablet, isso abre o picker nativo do sistema — fora do design.

**Substituir por** um `Popover` (Radix ou solução própria) com:
- Botão trigger com aparência igual ao atual (pill estilo rounded-full)
- Dropdown customizado com lista de projetos + campo de busca
- Cada item com target de pelo menos 44px de altura
- Opção "Novo projeto" no rodapé do dropdown

---

### 2.2 Uniformizar "Fila ODM" na navbar

**Problema:** Os botões de navegação usam `button + setSearchParams`, mas "Fila ODM" é um `NavLink` que navega para outra rota. São dois padrões visuais idênticos mas comportamentos diferentes — confuso.

**Solução:** Dois caminhos possíveis:
- **Opção A:** Integrar "Fila ODM" como painel dentro do workspace (`panel: 'queue'`), sem sair da tela do mapa
- **Opção B:** Manter como link externo mas sinalizar visualmente (ícone de "abre em nova aba" ou separador visual antes dele)

Recomendação: **Opção A**, já que manter o mapa no fundo enquanto se monitora a fila é uma boa UX.

---

## Fase 3 — Planejador de Voo: Modo Compacto

**Objetivo:** O painel lateral mostra apenas o necessário para tomar decisões rápidas no campo.

### 3.1 Nova estrutura do painel compacto

O `FlightPlannerConfigPanel` é reestruturado para exibir apenas o essencial:

```
┌─────────────────────────────────────────┐
│  DRONE SELECIONADO                       │
│  [imagem] Mini 5 Pro                    │
│           36min · 50MP · 8.8mm          │
│           [Trocar drone ›]              │
├─────────────────────────────────────────┤
│  PERFIL DE QUALIDADE                    │
│  [Rascunho] [Equilibrado] [Alta qual.] │
├─────────────────────────────────────────┤
│  ALTITUDE  [−] [145 m] [+]             │
│  GSD estimado: ~2,57 cm/px             │
├─────────────────────────────────────────┤
│  CLIMA  🟢 Condições adequadas          │
│  Vento: 3,2 m/s · Temp: 22°C           │
├─────────────────────────────────────────┤
│  RESUMO DA MISSÃO                       │
│  [📐 3,4 ha] [📸 312 fotos]            │
│  [⏱ 18 min] [🔋 2 baterias]           │
│  [GSD 2,57 cm/px] [↗ 4,2 km]          │
├─────────────────────────────────────────┤
│  [Salvar plano]  [↓ Baixar KMZ]        │
│                                         │
│  [⛶ Abrir planejador completo]         │
└─────────────────────────────────────────┘
```

**O que sai do painel compacto:**
- Seção "Início da rota" (vai para modal expandido, tab "Missão")
- Sobreposição frontal/lateral (vai para modal, tab "Missão")
- Rotação da grade (vai para modal, tab "Missão")
- Velocidade (vai para modal, tab "Missão")
- Terrain following (vai para modal, tab "Missão")
- POI (vai para modal, tab "Missão")
- Visibilidade de camadas (vai para modal, tab "Missão")
- Solar / janela de voo (vai para modal, tab "Clima")
- Clima detalhado com tabela horária (vai para modal, tab "Clima")
- Voo de calibração completo (vai para modal, tab "Calibração")
- FlightQualityScoreBadge (vai para o topo do modal expandido ou inline no resumo)
- "Pular revisão Antes de voar" checkbox (vai para modal, tab "Exportar")

**Estado vazio (sem polígono desenhado):**

```
┌─────────────────────────────────────────┐
│  [imagem] Mini 5 Pro                    │
│           36min · 50MP · 8.8mm          │
│           [Trocar drone ›]              │
├─────────────────────────────────────────┤
│  ✏ Desenhe a área de voo no mapa       │
│  para começar o planejamento.           │
└─────────────────────────────────────────┘
```

---

### 3.2 Resumo da missão sempre visível (MissionSummaryBar)

Criar um componente `MissionSummaryBar` com os 6 stats principais (área, fotos, tempo, baterias, GSD, distância). Ele fica fixo no painel — não vai embora quando o usuário sobe/desce no painel compacto. Em estados de loading, mostra skeletons.

---

### 3.3 Status de clima como badge clicável

O clima no painel compacto é um badge colorido (verde/âmbar/vermelho) com uma linha de texto. Clicar nele abre o modal expandido direto na tab "Clima". Isso cria uma relação visual clara entre o badge e os detalhes.

---

## Fase 4 — Drone Picker

**Objetivo:** Substituir `<select>` por uma experiência de seleção visual, touchfriendly.

### 4.1 DronePicker — bottom sheet / modal

Quando o usuário toca no drone card, abre um **bottom sheet** (em telas < 1024px) ou um **modal compacto** (desktop) com:

```
┌─────────────────────────────────────────┐
│  Selecionar drone              [✕]      │
├─────────────────────────────────────────┤
│  MODELOS PADRÃO                         │
│  ┌──────────┐  ┌──────────┐            │
│  │ [img]    │  │ [img]    │            │
│  │ Mini 4 Pro│  │ Mini 5 Pro│           │
│  │ ✓ selecionado│ │          │          │
│  └──────────┘  └──────────┘            │
│                                         │
│  MEUS MODELOS                          │
│  ┌──────────┐                          │
│  │ [+]      │                          │
│  │ Adicionar │                          │
│  └──────────┘                          │
│                                         │
│  [Gerenciar frota →] (abre Config)     │
└─────────────────────────────────────────┘
```

Cada card de drone tem:
- Imagem (ou ilustração SVG)
- Nome
- Specs resumidas (bateria, MP, focal)
- Estado visual de "selecionado" (borda verde, checkmark)
- Touch target de pelo menos 80×80px

---

### 4.2 DroneModelManager → Config page

O `DroneModelManager` sai completamente do planejador.

1. Adicionar sub-seção "Frota de drones" em `SettingsForm.tsx` (já existe em Config)
2. O `DroneModelManager` renderiza lá — com espaço real, sem as restrições de largura do painel
3. No DronePicker, o link "Gerenciar frota →" faz `navigate('?panel=settings')` e foca na seção de drones

---

## Fase 5 — Modal Expandido do Planejador

**Objetivo:** Interface completa de configuração com espaço real, sem cobrir todo o mapa.

### 5.1 Componente FlightPlannerExpandedModal

**Comportamento:**
- Abre via botão "Abrir planejador completo" no painel compacto
- Posição: sheet lateral de `min(90vw, 720px)` ancorado à direita, **não** cobre o mapa todo
- Em tablet portrait (< 768px): bottom sheet de ~80% da altura da tela
- Fundo do mapa permanece visível e interativo (o modal não bloqueia o mapa)
- Animação: slide da direita (desktop) / slide de baixo (tablet)

**Estrutura com tabs:**

```
┌─────────────────────────────────────────────────────────┐
│  Planejador — Projeto X              [⛶ Compactar] [✕] │
│  [FlightQualityScoreBadge]                               │
├──────────────────────────────────────────────────────────┤
│  [Missão] [Clima & Solar] [Calibração] [Exportar]       │
├──────────────────────────────────────────────────────────┤
│                                                          │
│  (conteúdo da tab ativa — scrollável)                   │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Tab Missão:**
- Início da rota (GPS)
- Altitude (Range com +/−)
- Sobreposição frontal / lateral
- Rotação da grade + botão Auto-rotação
- Velocidade
- Terrain following (toggle switch — não checkbox)
- POI (altitude AMSL)
- Visibilidade de camadas (MapRouteDeckVisibilityToggles)
- Estatísticas detalhadas (grid 2 colunas com precisão estimada)

**Tab Clima & Solar:**
- WeatherHero (visual de condição atual)
- Badge go/no-go
- Issues e warnings
- Grid de stats meteorológicos
- Tabela de previsão horária (24h)
- SolarArc illustration
- Linhas de contexto solar

**Tab Calibração:**
- Explicação do voo de calibração
- Stats da missão de calibração
- Botões (Executar/Confirmar, Sair da pré-visualização)
- Histórico de sessões (com targets de toque maiores — min 44px por item)
- Botões "Enviar fotos (EXIF)" e "Atualizar lista"
- Banner de calibração desatualizada

**Tab Exportar:**
- FlightQualityScoreBadge (resumo)
- Botões: Salvar plano, Baixar KMZ, Enviar ao DJI (Android)
- Checkbox "Pular revisão Antes de voar"
- Mensagens de erro de clima

---

### 5.2 Persistência do estado do modal

O estado "expandido/compacto" do planejador fica em `localStorage` (ou no store Zustand), para que ao reabrir o planejador ele apareça no estado que o usuário deixou.

---

## Fase 6 — Sidebar Simplificada

**Objetivo:** Máximo 2 grupos dinâmicos, sem popovers conflitantes, sem "Grade de rota".

### 6.1 Nova estrutura da PlannerIconSidebar

**Grupo 1 — Ferramentas do mapa** (sempre visível):
```
[✋ Navegar]
[───────────]
[✏ Desenhar]
[───────────]
[🗺 Estilo do mapa]  → popover à direita (sem mudança)
[🌤 Clima]           → popover à direita (sem mudança)
```

**Grupo 2 — Contexto de missão** (aparece com polígono ou draft):
```
[◎ POI]
[───────────]  (se draft)
[⬡ Fechar área]
[↩ Desfazer]
[🗑 Limpar]
```

"Grade de rota" **remove** daqui — o controle de rotação, direção e início da rota vai para a tab "Missão" do modal expandido, onde pertence conceptualmente.

O hint `[ / ] rot.` na base da sidebar é removido — confuso e difícil de ler.

---

### 6.2 Grupos colapsam/somem com AnimatePresence — sem mudança de comportamento

O comportamento de aparecimento contextual dos grupos permanece. Apenas o grupo de rota some.

---

## Fase 7 — Componentes de Input

**Objetivo:** Todos os inputs críticos são touch-friendly e consistentes.

### 7.1 Terrain following: Toggle Switch

**Onde:** `FlightPlannerConfigPanel.tsx`

Substituir:
```tsx
<input type="checkbox" ... />
```
Por um `<Switch>` do Radix UI — target mínimo de 44px, visual mais claro, já disponível no ecossistema.

---

### 7.2 Confirmações: AlertDialog ao invés de `window.confirm()`

**Onde:** `FlightPlannerConfigPanel.tsx` (deletar sessão de calibração)

Substituir `window.confirm(...)` por `AlertDialog` do Radix UI (padrão já usado no projeto com `Modal.tsx`).

```tsx
<AlertDialog
  title="Remover sessão?"
  description="Os dados e fotos associados deixam de estar disponíveis."
  confirmLabel="Remover"
  onConfirm={() => deleteSession(id)}
/>
```

---

### 7.3 Itens do histórico de calibração — targets maiores

Cada item na lista de sessões atualmente tem botões pequenos (`h-7`). Aumentar para `min-h-[44px]` e espaçamento mais generoso.

---

## Fase 8 — Resultados (ajustes)

**Objetivo:** Overlays de resultados cientes do painel direito.

### 8.1 ResultsMapToolsOverlay usa --right-panel-width

O bloco de resultado de medição (`bottom-3 right-3`) passa a usar:
```tsx
style={{
  right: "calc(var(--right-panel-width) + 0.75rem)",
  bottom: "0.75rem"
}}
```

### 8.2 Controle de opacidade sai do mapa

O slider vertical de opacidade (`left-3 bottom-[50%]`) é removido do `ResultsMapToolsOverlay`. Um controle de opacidade vai para dentro do `ResultsWorkspacePanel`, como um slider inline antes do seletor de camadas. Mais natural, menos floating.

---

## Ordem de implementação recomendada

| # | O que | Arquivo(s) principal(is) | Impacto |
|---|-------|--------------------------|---------|
| 1 | CSS vars de layout + WindIndicator | `WorkspacePage.tsx`, `LeafletMapView.tsx`, `MapboxMapView.tsx`, `WindIndicatorOverlay.tsx` | Elimina sobreposição do indicador de vento |
| 2 | ResultsMapToolsOverlay ciente do painel | `ResultsMapToolsOverlay.tsx` | Elimina sobreposição em resultados |
| 3 | Sidebar simplificada (remover "Grade de rota") | `PlannerIconSidebar.tsx` | Reduz complexidade da sidebar |
| 4 | Painel compacto reestruturado | `FlightPlannerConfigPanel.tsx` | Clareza imediata no planejamento |
| 5 | MissionSummaryBar | novo componente | Resumo sempre visível |
| 6 | DronePicker (bottom sheet / modal) | novo `DronePicker.tsx` | Substitui `<select>` de drone |
| 7 | DroneModelManager → Config | `SettingsForm.tsx`, `DroneModelSection.tsx` | Remove CRUD do planejador |
| 8 | FlightPlannerExpandedModal (estrutura + tabs) | novo `FlightPlannerExpandedModal.tsx` | Modal com conteúdo detalhado |
| 9 | Migrar seções para o modal expandido | `FlightPlannerConfigPanel.tsx` | Move conteúdo para o local certo |
| 10 | Terrain toggle switch + AlertDialog | `FlightPlannerConfigPanel.tsx` | Melhora touch UX |
| 11 | WorkspaceTopBar: Combobox de projeto | `WorkspaceTopBar.tsx` | Melhora seleção de projeto em tablet |
| 12 | Opacidade inline no painel de resultados | `ResultsWorkspacePanel.tsx`, `ResultsMapToolsOverlay.tsx` | Limpa o mapa |

---

## Considerações de tablet-first

Todas as mudanças acima devem seguir estas regras não negociáveis:

- **Touch targets mínimos:** 44×44px para qualquer elemento interativo
- **Sem `<select>` nativo** para escolhas visuais/importantes (drone, projeto)
- **Sem `window.confirm()`** — sempre AlertDialog customizado
- **Bottom sheets em vez de dropdowns** para `< 1024px`
- **Sem tooltips hover-only** — informações de contexto devem ser visíveis sem hover
- **Scroll inercial** (`overscroll-behavior: contain`) em todos os painéis scrolláveis (já presente em vários lugares, verificar consistência)
- **Safe area insets** respeitados em todos os novos elementos posicionados

---

## O que NÃO muda

- Lógica de cálculo de waypoints, GSD, calibração — sem toque
- Store Zustand (`useFlightStore`) — sem mudança de estado/estrutura
- Hooks de clima, geolocalização, terrain — sem toque
- Backend — nenhuma mudança necessária para esta fase
- Componentes `Range` (já são touch-friendly com botões +/−)
- `PreFlightChecklistModal` — já é um modal Radix bem estruturado
- `CalibrationUploadDialog` — já é um modal Radix bem estruturado
- Lógica de exportação KMZ

---

## Arquivos novos a criar

| Arquivo | Descrição |
|---------|-----------|
| `app/src/features/flight-planner/components/FlightPlannerExpandedModal.tsx` | Modal expandido com tabs |
| `app/src/features/flight-planner/components/DronePicker.tsx` | Picker visual de drone (bottom sheet / modal) |
| `app/src/features/flight-planner/components/MissionSummaryBar.tsx` | Barra de resumo sempre visível |
| `app/src/features/flight-planner/components/PlannerMissionTab.tsx` | Conteúdo da tab Missão no modal |
| `app/src/features/flight-planner/components/PlannerWeatherTab.tsx` | Conteúdo da tab Clima & Solar no modal |
| `app/src/features/flight-planner/components/PlannerCalibrationTab.tsx` | Conteúdo da tab Calibração no modal |
| `app/src/features/flight-planner/components/PlannerExportTab.tsx` | Conteúdo da tab Exportar no modal |
| `app/src/context/PlannerLayoutContext.tsx` | (opcional) Context para `--right-panel-width` se preferir React state ao invés de CSS var direta |
