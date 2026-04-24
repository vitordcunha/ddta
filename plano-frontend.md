# Plano de Implementação — Frontend (`app/`)

> Stack: **Vite + React + TailwindCSS + shadcn/ui + Capacitor**
> Premissa: Fases 1–6 são independentes de backend. Fase 7 em diante requer integração.
> Mobile-first: cada componente é projetado para mobile e expandido para desktop.

---

## Princípios, Pilares e Boas Práticas

### SOLID no React

| Princípio | Aplicação |
|-----------|-----------|
| **S** — Single Responsibility | Componente renderiza. Hook gerencia estado/lógica. Utils calculam. Styles exportam classes. Um arquivo = uma responsabilidade. |
| **O** — Open/Closed | Componentes extensíveis via `variant`, `className`, `children`, `as` — nunca editados para cada novo uso. |
| **L** — Liskov | Se dois componentes têm a mesma prop interface (`onPress`, `disabled`, `children`), são intercambiáveis sem quebrar o layout. |
| **I** — Interface Segregation | Props são mínimas e específicas. Nenhum componente recebe um objeto inteiro quando precisa de dois campos. |
| **D** — Dependency Inversion | Componentes dependem de hooks, não de `fetch` diretamente. Hooks dependem de serviços injetáveis, não de URLs hardcodadas. |

### Regras de Arquivo

- **Máximo 120 linhas** por componente ou hook. Se crescer, extraia.
- **Zero JSX em hooks** — hooks são TypeScript puro que retornam dados/callbacks.
- **Zero `fetch`/`axios` em componentes** — toda comunicação passa por `services/`.
- **Zero inline styles** — Tailwind classes ou arquivo `.styles.ts` do módulo.
- **Zero `any`** — tipagem explícita em todos os contratos públicos.

### Design System e UX (Base Supabase)

- **Fonte única de verdade**: o design system do app segue `app/DESIGN-supabase (1).md`. Qualquer novo componente deve respeitar esses tokens e princípios.
- **Dark-mode nativo**: superfícies principais em `#171717` e `#0f0f0f`, com profundidade por contraste de borda (`#242424` → `#2e2e2e` → `#363636`), sem dependência de sombra.
- **Accent minimalista**: verde (`#3ecf8e` / `#00c573`) usado de forma cirúrgica em links, highlights de marca e estados de foco/ação.
- **Tipografia por densidade**: prioridade para peso 400; peso 500 apenas em ações e navegação. Hierarquia por tamanho e ritmo, não por bold.
- **Radius semântico**: `6px` (controles pequenos), `8–16px` (cards/painéis), `9999px` (CTAs primárias e tabs pill).
- **Mobile-first**: media queries começam em `sm:` (640px). O layout base é sempre para telas de 360–390px.
- **Motion com propósito**: animações de entrada (`fade-up`), feedback de ação (`active:scale-95`), loading (`skeleton`, `pulse`). Nenhuma animação decorativa.
- **Estados completos**: todo componente orientado a dados implementa `idle`, `loading`, `error`, `empty`.
- **Acessibilidade mínima**: `aria-label` em ícones, `role` correto, `focus-visible` em todos os interativos.

---

## Estrutura de Pastas

```
app/
├── android/                          # Gerado pelo Capacitor — não editar manualmente
│   └── app/src/main/java/com/dronemapper/
│       ├── MainActivity.kt
│       └── DjiMissionPlugin.kt       # Plugin Kotlin para operações DJI
│
├── public/
│   ├── favicon.svg
│   └── icons/                        # PWA icons (192, 512)
│
├── src/
│   │
│   ├── assets/
│   │   ├── icons/                    # SVGs de drone, waypoint, etc.
│   │   └── images/                   # Logos, placeholders
│   │
│   ├── components/                   # Componentes genéricos reutilizáveis
│   │   │
│   │   ├── ui/                       # Design system base
│   │   │   ├── Button/
│   │   │   │   ├── Button.tsx
│   │   │   │   └── Button.styles.ts
│   │   │   ├── Card/
│   │   │   │   ├── Card.tsx
│   │   │   │   └── Card.styles.ts
│   │   │   ├── Badge/
│   │   │   │   ├── Badge.tsx
│   │   │   │   └── Badge.styles.ts
│   │   │   ├── Modal/
│   │   │   │   ├── Modal.tsx
│   │   │   │   └── Modal.styles.ts
│   │   │   ├── Slider/
│   │   │   │   ├── Slider.tsx
│   │   │   │   └── Slider.styles.ts
│   │   │   ├── Input/
│   │   │   │   ├── Input.tsx
│   │   │   │   └── Input.styles.ts
│   │   │   ├── Select/
│   │   │   │   ├── Select.tsx
│   │   │   │   └── Select.styles.ts
│   │   │   ├── ProgressBar/
│   │   │   │   ├── ProgressBar.tsx
│   │   │   │   └── ProgressBar.styles.ts
│   │   │   ├── Spinner/
│   │   │   │   └── Spinner.tsx
│   │   │   ├── Tooltip/
│   │   │   │   └── Tooltip.tsx
│   │   │   ├── Skeleton/
│   │   │   │   └── Skeleton.tsx
│   │   │   ├── EmptyState/
│   │   │   │   └── EmptyState.tsx
│   │   │   ├── Alert/
│   │   │   │   ├── Alert.tsx
│   │   │   │   └── Alert.styles.ts
│   │   │   ├── Tabs/
│   │   │   │   └── Tabs.tsx
│   │   │   ├── Stepper/
│   │   │   │   └── Stepper.tsx
│   │   │   └── index.ts              # Re-exporta todos os primitivos
│   │   │
│   │   └── layout/
│   │       ├── AppShell/
│   │       │   ├── AppShell.tsx      # Root layout: sidebar + main
│   │       │   └── AppShell.styles.ts
│   │       ├── Sidebar/
│   │       │   ├── Sidebar.tsx
│   │       │   ├── SidebarItem.tsx
│   │       │   └── Sidebar.styles.ts
│   │       ├── BottomNav/            # Navegação mobile (substitui sidebar)
│   │       │   ├── BottomNav.tsx
│   │       │   └── BottomNav.styles.ts
│   │       ├── TopBar/
│   │       │   ├── TopBar.tsx
│   │       │   └── TopBar.styles.ts
│   │       └── PageHeader/
│   │           └── PageHeader.tsx
│   │
│   ├── features/                     # Módulos por domínio (colocados)
│   │   │
│   │   ├── projects/
│   │   │   ├── components/
│   │   │   │   ├── ProjectCard.tsx
│   │   │   │   ├── ProjectCard.styles.ts
│   │   │   │   ├── ProjectGrid.tsx
│   │   │   │   ├── ProjectListItem.tsx    # Variante lista (mobile)
│   │   │   │   ├── ProjectStatusBadge.tsx
│   │   │   │   ├── CreateProjectModal.tsx
│   │   │   │   ├── DeleteProjectModal.tsx
│   │   │   │   └── ProjectEmptyState.tsx
│   │   │   ├── hooks/
│   │   │   │   └── useProjects.ts         # CRUD (localStorage → API na fase 7)
│   │   │   ├── utils/
│   │   │   │   └── projectHelpers.ts
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── flight-planner/
│   │   │   ├── components/
│   │   │   │   ├── FlightPlannerLayout.tsx     # Split-view desktop / tabs mobile
│   │   │   │   ├── FlightMap/
│   │   │   │   │   ├── FlightMap.tsx            # MapContainer + draw + waypoints
│   │   │   │   │   ├── FlightMap.styles.ts
│   │   │   │   │   ├── WaypointOverlay.tsx      # Polylines + markers do grid
│   │   │   │   │   ├── PolygonOverlay.tsx       # Polígono da AOI
│   │   │   │   │   └── MapControls.tsx          # Zoom, reset, geocoder
│   │   │   │   ├── FlightParams/
│   │   │   │   │   ├── FlightParamsPanel.tsx    # Container do painel
│   │   │   │   │   ├── DroneSelector.tsx        # Cards visuais de drone
│   │   │   │   │   ├── AltitudeSlider.tsx
│   │   │   │   │   ├── OverlapSliders.tsx       # Frontal + Lateral
│   │   │   │   │   ├── RotationSlider.tsx
│   │   │   │   │   └── SpeedSlider.tsx
│   │   │   │   ├── FlightStats/
│   │   │   │   │   ├── FlightStatsCard.tsx      # GSD, área, tempo, baterias...
│   │   │   │   │   ├── StatItem.tsx
│   │   │   │   │   └── FlightStatsCard.styles.ts
│   │   │   │   ├── WeatherPanel/
│   │   │   │   │   ├── WeatherWidget.tsx        # Go/No-Go + resumo condições
│   │   │   │   │   ├── GoNoGoBadge.tsx
│   │   │   │   │   ├── WeatherLayers.tsx        # Toggle de camadas OWM/RainViewer
│   │   │   │   │   ├── WindIndicator.tsx        # Rosa dos ventos
│   │   │   │   │   ├── WeatherAlerts.tsx        # Issues, warnings, tips
│   │   │   │   │   └── WeatherPanel.styles.ts
│   │   │   │   ├── KmzExport/
│   │   │   │   │   ├── KmzExportPanel.tsx       # Container export + transfer
│   │   │   │   │   ├── KmzDownloadButton.tsx    # Download web
│   │   │   │   │   └── KmzTransfer/
│   │   │   │   │       ├── KmzTransferNative.tsx  # Seletor de missão + push (app)
│   │   │   │   │       ├── KmzTransferWeb.tsx     # Guia manual (web)
│   │   │   │   │       └── TransferStepper.tsx    # Steps animados
│   │   │   │   └── SavePlanButton.tsx
│   │   │   ├── hooks/
│   │   │   │   ├── useFlightCalculator.ts  # Orquestra cálculos + debounce
│   │   │   │   ├── usePolygonDraw.ts       # Estado do polígono + handlers leaflet
│   │   │   │   ├── useKmzExport.ts         # Gera KMZ, retorna Blob + status
│   │   │   │   ├── useWeather.ts           # Busca clima (mock fase local, API fase 7)
│   │   │   │   └── useDjiMissions.ts       # Plugin nativo Capacitor
│   │   │   ├── utils/
│   │   │   │   ├── waypointCalculator.ts   # Funções puras: GSD, grid, serpentina
│   │   │   │   ├── kmzBuilder.ts           # Gera KMZ no browser com jszip
│   │   │   │   ├── droneSpecs.ts           # DRONE_SPECS constante
│   │   │   │   └── weatherHelpers.ts       # windDirToLabel, assessConditions (mock)
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   │
│   │   ├── upload/
│   │   │   ├── components/
│   │   │   │   ├── UploadLayout.tsx            # Layout da página de upload
│   │   │   │   ├── ImageDropzone.tsx            # Drag & drop zone
│   │   │   │   ├── ImageDropzone.styles.ts
│   │   │   │   ├── FileListItem.tsx             # Item individual com progress
│   │   │   │   ├── UploadProgressList.tsx       # Lista virtualizada
│   │   │   │   ├── UploadSummaryBar.tsx         # Total, progresso global
│   │   │   │   ├── GpsWarningBanner.tsx         # Alerta de imagens sem GPS
│   │   │   │   ├── FileCountBadge.tsx
│   │   │   │   └── UploadActionBar.tsx          # Botão iniciar + cancelar
│   │   │   ├── hooks/
│   │   │   │   ├── useFileQueue.ts              # Lista de arquivos + metadados
│   │   │   │   └── useUpload.ts                 # Lógica de upload (mock → real)
│   │   │   ├── utils/
│   │   │   │   ├── exifReader.ts                # Lê GPS do EXIF no browser
│   │   │   │   └── uploadHelpers.ts             # formatBytes, chunkFile
│   │   │   ├── types.ts
│   │   │   └── index.ts
│   │   │
│   │   └── results/
│   │       ├── components/
│   │       │   ├── ResultsLayout.tsx            # Mapa fullscreen + painel lateral
│   │       │   ├── MapViewer/
│   │       │   │   ├── ResultsMapContainer.tsx  # MapContainer configurado
│   │       │   │   ├── OrthophotoLayer.tsx      # TileLayer TiTiler COG
│   │       │   │   ├── DsmLayer.tsx
│   │       │   │   ├── DtmLayer.tsx
│   │       │   │   ├── ContoursLayer.tsx        # GeoJSON curvas de nível
│   │       │   │   ├── LayerSelector.tsx        # Toggle de camadas
│   │       │   │   ├── OpacityControl.tsx       # Slider de opacidade da layer
│   │       │   │   └── MeasurementTools/
│   │       │   │       ├── MeasurementToolbar.tsx  # Botões distância/área/cota
│   │       │   │       ├── DistanceTool.tsx
│   │       │   │       ├── AreaTool.tsx
│   │       │   │       └── ElevationTool.tsx
│   │       │   ├── Downloads/
│   │       │   │   ├── DownloadPanel.tsx        # Painel lateral com todos os assets
│   │       │   │   ├── DownloadCard.tsx         # Card individual de cada produto
│   │       │   │   └── DownloadCard.styles.ts
│   │       │   ├── Processing/
│   │       │   │   ├── ProcessingView.tsx       # Tela durante processamento
│   │       │   │   ├── ProcessingProgress.tsx   # Barra + etapa atual
│   │       │   │   ├── ProcessingLog.tsx        # Log de etapas em texto
│   │       │   │   └── StartProcessingPanel.tsx # Seletor de preset + iniciar
│   │       │   ├── Stats/
│   │       │   │   ├── ProcessingStatsGrid.tsx
│   │       │   │   └── StatCard.tsx
│   │       │   └── PointCloud/
│   │       │       └── PointCloudViewer.tsx     # Iframe Potree
│   │       ├── hooks/
│   │       │   └── useProjectStatus.ts          # SSE (mock → real)
│   │       ├── utils/
│   │       │   └── layerHelpers.ts
│   │       ├── types.ts
│   │       └── index.ts
│   │
│   ├── pages/                        # Thin wrappers de rota
│   │   ├── DashboardPage.tsx
│   │   ├── NewProjectPage.tsx
│   │   ├── FlightPlannerPage.tsx
│   │   ├── UploadPage.tsx
│   │   ├── ResultsPage.tsx
│   │   └── ProjectDetailPage.tsx     # Hub do projeto: tabs entre as páginas
│   │
│   ├── store/                        # Estado global (Zustand)
│   │   ├── useFlightStore.ts         # Polygon, params, waypoints, stats, weather
│   │   ├── useProjectStore.ts        # Projeto ativo, lista de projetos
│   │   └── useUiStore.ts             # Sidebar aberta, tema, modal ativo
│   │
│   ├── services/                     # Camada de comunicação com API
│   │   ├── http.ts                   # Axios com tratamento global de erro
│   │   ├── projectsService.ts
│   │   ├── flightPlanService.ts
│   │   ├── uploadService.ts
│   │   └── weatherService.ts        # Open-Meteo (chamada direta, sem backend)
│   │
│   ├── hooks/                        # Hooks genéricos globais
│   │   ├── useLocalStorage.ts
│   │   ├── useDebounce.ts
│   │   ├── useMediaQuery.ts          # isMobile, isTablet, isDesktop
│   │   ├── usePlatform.ts            # isNative (Capacitor), isAndroid, isIOS
│   │   └── useTheme.ts               # dark/light toggle
│   │
│   ├── lib/
│   │   ├── queryClient.ts            # React Query client
│   │   ├── leaflet.ts                # Fix de ícones + defaults do leaflet
│   │   └── capacitor.ts             # Capacitor isNativePlatform + guards
│   │
│   ├── constants/
│   │   ├── routes.ts                 # ROUTES object tipado
│   │   ├── config.ts                 # VITE_API_URL, VITE_OWM_KEY, etc.
│   │   └── motion.ts                 # Variantes framer-motion reutilizáveis
│   │
│   ├── types/
│   │   ├── project.ts
│   │   ├── flightPlan.ts
│   │   ├── weather.ts
│   │   └── api.ts
│   │
│   ├── styles/
│   │   └── globals.css               # Tailwind base + variáveis CSS + custom utilities
│   │
│   ├── App.tsx
│   ├── router.tsx
│   └── main.tsx
│
├── index.html
├── capacitor.config.ts
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── postcss.config.js
└── .env.example
```

---

## Estratégia Mobile-First e Responsividade

### Breakpoints (tailwind.config.ts)

```
mobile:  360–639px   → padrão (sem prefixo)
sm:      640–767px   → tablet portrait / grande mobile
md:      768–1023px  → tablet landscape
lg:      1024–1279px → desktop pequeno
xl:      1280px+     → desktop
```

### Layouts por breakpoint

| Tela | Navegação | Planejador de Voo | Dashboard |
|------|-----------|-------------------|-----------|
| Mobile | `BottomNav` (4 ícones fixos) | Tabs: Mapa / Parâmetros / Stats / Export | Lista vertical de cards |
| Tablet | `Sidebar` colapsada (só ícones) | Split 60/40 mapa/painel com painel scrollável | Grid 2 colunas |
| Desktop | `Sidebar` expandida com labels | Split 65/35 com painel fixo à direita | Grid 3 colunas |

### Regra de implementação
Todo componente começa com o layout mobile. Desktop é adicionado via `md:` e `lg:`. Jamais o contrário.

---

## Fases de Implementação

---

### Fase 1 — Fundação, Design System e Layout
> **Sem backend. ~3–4 dias.**
> Objetivo: aplicação rodando com design system completo, navegação e estrutura de páginas.

#### 1.1 Setup do projeto
- `npm create vite@latest app -- --template react-ts`
- TailwindCSS v3 + PostCSS + Autoprefixer
- shadcn/ui (`npx shadcn@latest init`) — tema dark, radius médio
- React Router v6 com layouts aninhados
- Path aliases: `@/` → `src/`
- ESLint + Prettier configurados
- `.env.example` com todas as vars necessárias

#### 1.2 tailwind.config.ts — Design Tokens (Supabase-first)
```ts
// Core palette (dark native)
background: {
  canvas: '#171717',
  elevated: '#0f0f0f',
}
foreground: {
  primary: '#fafafa',
  secondary: '#b4b4b4',
  muted: '#898989',
}
border: {
  subtle: '#242424',
  default: '#2e2e2e',
  strong: '#363636',
  stronger: '#393939',
}
brand: {
  primary: '#3ecf8e',
  interactive: '#00c573',
  accentBorder: 'rgba(62, 207, 142, 0.3)',
}
semantic: {
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#60A5FA',
}

// Status de projeto → semântica visual
status-created:    '#4d4d4d'
status-uploading:  '#00c573'
status-processing: '#F59E0B' // com pulse
status-completed:  '#3ecf8e'
status-failed:     '#EF4444'

// Tipografia
fontFamily: {
  sans: ['Circular', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
  mono: ['Source Code Pro', 'Menlo', 'monospace'],
}
fontWeight: { regular: 400, medium: 500 }
// mono usado para: coordenadas, GSD, distâncias e labels técnicas em uppercase

// Animações customizadas
animation: {
  'fade-in':   'fadeIn 0.2s ease-out',
  'fade-up':   'fadeUp 0.3s ease-out',
  'slide-in':  'slideIn 0.25s ease-out',
  'pulse-slow':'pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
}
```

#### 1.3 globals.css
```css
/* Scrollbar customizada (dark) */
/* Focus-visible ring consistente */
/* Map container reset (leaflet overflow) */
/* Skeleton animation */
/* Safe area insets para Capacitor (notch/home bar) */
:root {
  --safe-area-top: env(safe-area-inset-top);
  --safe-area-bottom: env(safe-area-inset-bottom);
}
```

#### 1.4 Componentes UI base (estilo Supabase)

**Button** — variants: `primary-pill | secondary-pill | ghost | danger | outline`; sizes: `sm | md | lg`; states: loading (spinner inline), disabled, `active:scale-95`
```tsx
// Exemplo de uso
<Button variant="primary-pill" size="md" loading={isSubmitting}>
  Criar Projeto
</Button>
```
Padrões visuais:
- `primary-pill`: `#0f0f0f` + texto `#fafafa`, borda clara, radius `9999px`
- `secondary-pill`: `#0f0f0f` + borda `#2e2e2e`, opacity levemente reduzida
- `ghost`: transparente, radius `6px`, foco com borda `rgba(62, 207, 142, 0.3)`

**Card** — com `CardHeader`, `CardBody`, `CardFooter`. Base: fundo `#171717`, borda `#2e2e2e`, sem box-shadow. Hover: `hover:border-[#363636] transition-colors`. Clickable variant com `cursor-pointer active:scale-[0.98]`.

**Badge** — variants por status de projeto (`created`, `uploading`, `processing` com pulse, `completed`, `failed`) com mapeamento semântico Supabase. Variants genéricos: `info`, `warning`, `success`, `error`.

**Modal** — overlay com `backdrop-blur-sm bg-black/60`, entrada com `animate-fade-up`, fechamento por ESC/click externo/X. Superfície com borda `#2e2e2e` e contraste por camada (sem sombra forte). Trap de foco via `@radix-ui/react-dialog`.

**Slider** — Tailwind styled sobre `<input type="range">`, com track, thumb customizados. Exibe valor atual + min/max. Suporte a label e hint.

**Input** — label, placeholder, error state (borda vermelha + mensagem), hint, ícone left/right opcional. Base visual: fundo `#0f0f0f`, texto `#fafafa`, borda `#2e2e2e`, focus `#00c573`.

**Select** — Radix Select com search opcional, grupos, itens com ícone.

**ProgressBar** — determinado (% fill com transição) e indeterminado (shimmer animado). Trilha escura + preenchimento principal em verde interactivo `#00c573`.

**Spinner** — SVG animado, sizes `sm`/`md`/`lg`. Usado em Button loading e telas de carregamento.

**Skeleton** — `animate-pulse` em tons próximos a `#242424/#2e2e2e` para manter contraste dark-mode-native.

**EmptyState** — ícone SVG grande, título, descrição, CTA opcional. Variantes: sem dados, erro, offline.

**Alert** — variants: `info | success | warning | error`. Com ícone, título, descrição, ação opcional. Fundo escuro, borda semântica e animação de entrada `slide-down`.

**Tabs** — Radix Tabs estilizado. Dois estilos: `underline` (páginas) e `pill` (inline switchers). Variante `pill` com borda `#2e2e2e`, active com accent verde.

**Stepper** — numerado vertical e horizontal. Cada step: pending, active (pulse), completed (check verde), error.

**Tooltip** — Radix Tooltip com delay 300ms. Posicionamento automático.

#### 1.4.1 Regras visuais obrigatórias
- Não usar `shadow-lg`, `shadow-xl` ou equivalentes para criar hierarquia.
- Não usar verde de marca como fundo amplo de seções/cards.
- Não usar peso 700 para forçar hierarquia tipográfica.
- Não quebrar o padrão de radius: `6px`, `8–16px`, `9999px`.
- Não introduzir paletas fora dos tokens definidos em `tailwind.config.ts`.

#### 1.5 Layout

**AppShell.tsx**
```tsx
// Desktop: flex-row → Sidebar fixa (240px) + main content
// Mobile: flex-col → main content + BottomNav fixo
// Aplica padding-bottom: safe-area-bottom para Capacitor
```

**Sidebar.tsx**
- Items: Dashboard, Projetos, Novo Projeto, Configurações
- Versão expandida (desktop): ícone + label
- Versão colapsada (tablet): só ícone com tooltip
- Indicador de item ativo: borda left + bg leve
- Animação de collapse: `transition-width 200ms`

**BottomNav.tsx**
- 4 ícones: Dashboard, Projetos, Novo, Configurações
- Item ativo: ícone preenchido + cor primária
- `position: fixed; bottom: 0; safe-area-bottom`
- Transição de cor ao trocar aba

**TopBar.tsx**
- Breadcrumb (clicável)
- Título da página
- Ações da página (botão direito)
- Em mobile: hambúrguer (abre drawer) + título

#### 1.6 Roteamento (router.tsx)
```
/                     → redirect para /dashboard
/dashboard            → DashboardPage (dentro do AppShell)
/projects/new         → NewProjectPage
/projects/:id         → ProjectDetailPage (hub com tabs)
/projects/:id/plan    → FlightPlannerPage
/projects/:id/upload  → UploadPage
/projects/:id/results → ResultsPage
```

#### 1.7 DashboardPage (mockada)
- Grid de 3 ProjectCards com dados hardcoded
- Botão "Novo Projeto" no TopBar
- Em mobile: lista (não grid)
- Sem lógica ainda — só layout

**Entregável:** App rodando em `localhost:5173`. Todas as páginas navegáveis com layout correto em mobile, tablet e desktop. Design system utilizável.

---

### Fase 2 — Gestão de Projetos (localStorage)
> **Sem backend. ~2 dias.**

#### 2.1 types/project.ts
```ts
type ProjectStatus = 'created' | 'uploading' | 'processing' | 'completed' | 'failed'

interface Project {
  id: string          // UUID gerado no browser
  name: string
  description: string
  status: ProjectStatus
  createdAt: string   // ISO
  updatedAt: string
  flightPlan: FlightPlan | null
  imageCount: number
  assets: ProjectAssets | null
}
```

#### 2.2 useProjects.ts (localStorage)
```ts
// Interface idêntica à futura versão com API (DIP):
interface UseProjectsReturn {
  projects: Project[]
  isLoading: boolean
  createProject(data: CreateProjectData): Project
  updateProject(id: string, data: Partial<Project>): void
  deleteProject(id: string): void
  getProject(id: string): Project | undefined
}
// Persiste no localStorage com chave 'dm_projects'
// Usa useLocalStorage.ts internamente
```

#### 2.3 Componentes
**ProjectCard.tsx** — mobile: largura total; desktop: card fixo. Contém:
- Thumbnail da área de voo (placeholder mapa ou polígono SVG se tiver coords)
- Badge de status animado
- Nome, data formatada, contador de imagens
- Menu de contexto (⋯): Editar, Excluir — com Sheet (mobile) ou Dropdown (desktop)

**ProjectStatusBadge.tsx**
- `created` → cinza · "Aguardando"
- `uploading` → azul pulsante · "Enviando imagens"
- `processing` → amarelo pulsante · "Processando"
- `completed` → verde · "Concluído"
- `failed` → vermelho · "Erro"

**ProjectGrid.tsx**
- Mobile: `flex flex-col gap-3`
- Tablet: `grid grid-cols-2 gap-4`
- Desktop: `grid grid-cols-3 gap-4`
- Animação stagger de entrada com framer-motion (cards aparecem em sequência)

**ProjectListItem.tsx** — alternativa de layout lista para mobile, mais compacto

**CreateProjectModal.tsx**
- Sheet (mobile, desliza de baixo) / Dialog (desktop)
- Campos: Nome (obrigatório, max 100), Descrição (opcional, max 500)
- Validação inline
- Botão cancelar + criar
- Animação de entrada

**DeleteProjectModal.tsx**
- Dialog de confirmação
- Nome do projeto em destaque
- Botão "Excluir" danger

**ProjectEmptyState.tsx**
- Ícone drone SVG
- "Nenhum projeto criado"
- Botão "Criar primeiro projeto"

#### 2.4 DashboardPage.tsx (revisado)
- Header com contador "N projetos"
- Search input para filtrar por nome (debounce 300ms)
- Toggle visualização: grid / lista
- Animação de filtro (framer-motion AnimatePresence)

**Entregável:** CRUD completo de projetos persistido localmente. Animações de entrada/saída de cards funcionando.

---

### Fase 3 — Planejador de Voo (100% client-side)
> **Sem backend. ~5–6 dias.**
> Toda a lógica de cálculo roda no browser: turf.js + jszip.

#### 3.1 utils/droneSpecs.ts
```ts
// DRONE_SPECS completo (Mini 4 Pro, Mini 5 Pro, Air 3, Mavic 3, Phantom 4)
// Interface DroneSpec { sensorWidthMm, sensorHeightMm, focalLengthMm,
//                       imageWidthPx, imageHeightPx, maxSpeedMs, batteryTimeMin }
// getDroneOptions(): SelectOption[]
// getDroneSpec(model: string): DroneSpec
```

#### 3.2 utils/waypointCalculator.ts (funções puras)
```ts
// calculateGsd(altitudeM, specs): number
// calculateFootprint(gsdM, specs): { widthM, heightM }
// calculateSpacings(footprint, forwardOverlap, sideOverlap): { sideSpacing, photoSpacing }
// generateFlightGrid(polygonGeoJSON, spacings, rotationDeg): Strip[]
//   → usa @turf/turf: turf.bbox, turf.transformRotate, turf.lineIntersect
//   → gera faixas em serpentina
// generateWaypoints(strips, altitudeM): Waypoint[]
// calculateStats(waypoints, polygon, specs, speedMs): FlightStats
//   → área: turf.area(polygon)
//   → distância total: soma turf.distance entre waypoints consecutivos
//   → tempo estimado, baterias, foto_count
// Nenhuma função tem efeito colateral. Todas são testáveis com jest.
```

#### 3.3 utils/kmzBuilder.ts
```ts
// buildTemplateKml(waypoints, params): string
// buildWaylinesWpml(waypoints, params): string
// generateKmz(waypoints, params): Promise<Blob>   — usa jszip
// Formato DJI WPML completo (template.kml + waylines.wpml)
```

#### 3.4 utils/weatherHelpers.ts (mock local)
```ts
// getMockWeather(lat, lon): WeatherData
//   → retorna dados realistas para desenvolvimento sem API
// windDegToCompass(deg): string  (0° → "N", 90° → "L", etc.)
// windSpeedToBeaufort(ms): number
// assessFlightConditions(weather, droneModel, altitudeM): FlightAssessment
//   → lógica de Go/No-Go toda no frontend (independente de backend)
```

#### 3.5 Hooks

**usePolygonDraw.ts**
```ts
// polygon: GeoJSON Feature<Polygon> | null
// handleCreated(e: LeafletEvent): void
// handleEdited(e: LeafletEvent): void
// handleDeleted(): void
// reset(): void
// hasPolygon: boolean
// polygonArea: number | null   (turf.area, atualizado reativamente)
```

**useFlightCalculator.ts**
```ts
// Recebe polygon + FlightParams
// Debounce de 400ms para não recalcular a cada keystroke no slider
// Retorna:
// { waypoints, stats, isCalculating }
// Memoiza resultado se polygon e params não mudaram
```

**useKmzExport.ts**
```ts
// generateAndDownload(waypoints, params): Promise<void>
//   → chama kmzBuilder.generateKmz
//   → cria URL.createObjectURL e dispara download
// status: 'idle' | 'generating' | 'done' | 'error'
// kmzBlob: Blob | null   (para uso pelo Capacitor plugin)
```

**useWeather.ts** (fase 3 = mock, fase 7 = API real)
```ts
// fetchWeather(lat, lon): Promise<void>
// weather: WeatherData | null
// assessment: FlightAssessment | null
// isLoading: boolean
// error: string | null
// Em fase 3: usa getMockWeather com delay simulado
```

#### 3.6 Componentes do Mapa

**FlightMap.tsx** — configuração do MapContainer:
- Tile base: Esri World Imagery (satélite)
- Tile alternativo: OpenStreetMap (mapa)
- Toggle de base layer
- `FeatureGroup` com `EditControl` (leaflet-draw)
  - Ferramentas ativas: Polygon + Rectangle
  - Ferramentas desativadas: Circle, Marker, Polyline
- Z-index e CSS isolados via `.leaflet-container` no globals.css

**MapControls.tsx**
- Zoom +/- (custom, não padrão do leaflet — estilizado com Tailwind)
- Reset view (volta ao polígono desenhado)
- Toggle base layer (satélite/mapa)
- Geocoder (busca de endereço)
  - Mobile: botão que expande campo de busca
  - Desktop: campo sempre visível

**WaypointOverlay.tsx**
- Renderiza `<Polyline>` para cada faixa de voo
- Renderiza `<CircleMarker>` para cada waypoint
- Animação de aparecimento: as faixas "crescem" progressivamente ao calcular
  (implementado via timeout sequencial adicionando faixas uma a uma)
- Tooltip ao hover no waypoint: lat, lon, altitude

**PolygonOverlay.tsx**
- Exibe o polígono AOI com fill semitransparente azul
- Borda pontilhada animada (css stroke-dashoffset)
- Exibe área no centroide do polígono

#### 3.7 Painel de Parâmetros

**FlightPlannerLayout.tsx**
```tsx
// Desktop: div flex-row, mapa ocupa 65%, painel 35% com scroll interno
// Tablet md: mapa ocupa 55%, painel 45%
// Mobile: Tabs component com abas: "Mapa" | "Parâmetros" | "Exportar"
//   - Ao trocar para "Mapa", o mapa ocupa 100% da tela
//   - FloatingButton sobre o mapa: "Ver Parâmetros →" (abre tab)
```

**DroneSelector.tsx**
- Grid 2x3 de cards clicáveis
- Cada card: ícone/imagem do drone, nome, sensor info
- Card ativo: borda azul + fundo leve
- Em mobile: horizontal scroll de cards menores

**Sliders** — cada um em arquivo separado para respeitar SRP:
- `AltitudeSlider` (30–300m, step 5)
- `OverlapSliders` (frontal 60–95%, lateral 60–90%)
- `RotationSlider` (0–180°, com rosa dos ventos indicando direção)
- `SpeedSlider` (3–15 m/s)
- Cada slider: label, track colorido, thumb grande (touch-friendly 44px), valor atual bold em fonte mono

**FlightStatsCard.tsx**
- Exibido abaixo dos sliders no painel
- Skeleton loading durante recálculo (debounce)
- Grid 2 colunas:
  - GSD: `X,X cm/px`
  - Área: `X,XX ha`
  - Waypoints: `NNN`
  - Faixas: `NN`
  - Fotos estimadas: `NNN`
  - Tempo de voo: `NN min`
  - Baterias: `N`
  - Distância: `X.X km`
- Valores com animação de contagem numérica ao atualizar (framer-motion)
- Alerta se baterias > 3 (warning badge)

#### 3.8 Weather Panel

**WeatherWidget.tsx**
- Ativado após polígono ser desenhado (busca clima do centroide)
- Header: Go/No-Go badge (verde ✓ / vermelho ✗) com animação de entrada
- Grid 2x2: Vento (velocidade + direção), Temperatura, Nuvens %, Chuva
- Valores de vento em altitude de voo (80m ou 120m)
- Expandível para ver issues, warnings e tips em accordion

**GoNoGoBadge.tsx**
- `go=true`: verde com ícone check + "Condições adequadas"
- `go=false`: vermelho pulsante + "Voo não recomendado"
- Animação: scale 0 → 1 com bounce ao aparecer

**WindIndicator.tsx**
- SVG de rosa dos ventos com seta rotacionada para direção do vento
- Velocidade em m/s em fonte mono
- Anel colorido: verde (seguro), amarelo (atenção), vermelho (acima do limite)

**WeatherAlerts.tsx**
- Lista de `issues` (ícone ✗ vermelho), `warnings` (⚠ amarelo), `tips` (💡 azul)
- Cada item expansível com texto completo
- Animação de entrada stagger

**WeatherLayers.tsx** (toggle de camadas no mapa)
- Barra de botões flutuante sobre o mapa (bottom-left no desktop, bottom-center no mobile)
- Botões: Vento | Nuvens | Chuva | Radar | Temperatura
- Camada ativa destacada
- Usa tiles OpenWeatherMap (OWM) + RainViewer

#### 3.9 KMZ Export

**KmzExportPanel.tsx**
- Aparece apenas se `hasPolygon && waypoints.length > 0`
- Mostra resumo: N waypoints, X km, N min
- Seção "Transferência para o drone" com dois comportamentos:
  - **App Android** (Capacitor): mostra `KmzTransferNative`
  - **Web browser**: mostra `KmzTransferWeb`

**KmzTransferWeb.tsx** — Guia manual:
- Stepper vertical de 7 passos animado
- Cada passo: ícone, título bold, detalhe em cinza colapsável
- Botão "Baixar KMZ" proeminente no topo
- Indicador de plataforma: Windows / Mac

**TransferStepper.tsx** — componente genérico de stepper animado (reusado no nativo)

**KmzDownloadButton.tsx**
- Estado idle: botão outline "Baixar KMZ"
- Estado generating: spinner + "Gerando arquivo…"
- Estado done: ícone check verde + "Baixado"
- Transição suave entre estados

#### 3.10 useFlightStore.ts (Zustand)
```ts
interface FlightStore {
  polygon: GeoJSON | null
  params: FlightParams
  waypoints: Waypoint[]
  stats: FlightStats | null
  weather: WeatherData | null
  assessment: FlightAssessment | null
  isCalculating: boolean
  // Actions
  setPolygon(polygon: GeoJSON | null): void
  setParams(params: Partial<FlightParams>): void
  setResult(waypoints, stats): void
  setWeather(weather, assessment): void
  resetPlan(): void
  savePlanToProject(projectId: string): void
}
```

#### 3.11 FlightPlannerPage.tsx
- Carrega projeto pelo ID da URL
- Inicializa store com plano salvo (se existir)
- Compõe `FlightPlannerLayout` com todos os sub-componentes
- Botão "Salvar Plano" persiste no projeto (localStorage)

**Entregável:** Fluxo completo sem backend: desenha polígono → configura drone/parâmetros → vê grid calculado animado no mapa → vê GSD/tempo/baterias atualizando em real-time → vê condições meteorológicas → baixa KMZ.

---

### Fase 4 — Upload de Imagens (UI completa)
> **Sem backend. ~3 dias.**
> Upload mockado com progresso simulado. Interface idêntica ao real.

#### 4.1 utils/exifReader.ts
```ts
// Usa a lib `exifr` (leve, browser-native)
// readGps(file: File): Promise<{lat, lon} | null>
// hasGpsData(file: File): Promise<boolean>
// generateThumbnail(file: File, size: 80): Promise<string>  (data URL)
// readAll(file: File): Promise<ExifData>
// Processa em paralelo (Promise.all) para não travar a UI
```

#### 4.2 utils/uploadHelpers.ts
```ts
// formatBytes(bytes): string   ("1.2 MB", "234 KB")
// chunkFile(file, chunkSize): Blob[]
// generateFileId(): string   (crypto.randomUUID)
// estimateUploadTime(totalBytes, speedKbps): string
```

#### 4.3 types/upload.ts
```ts
type UploadStatus = 'pending' | 'reading' | 'uploading' | 'done' | 'error'

interface FileQueueItem {
  id: string
  file: File
  status: UploadStatus
  progress: number        // 0–100
  hasGps: boolean | null  // null enquanto lê EXIF
  thumbnail: string | null
  errorMessage?: string
}
```

#### 4.4 useFileQueue.ts
```ts
// files: FileQueueItem[]
// addFiles(fileList: FileList | File[]): void
//   → gera IDs, adiciona com status pending
//   → dispara leitura de EXIF async para cada arquivo (atualiza hasGps + thumbnail)
// removeFile(id): void
// clearDone(): void
// stats: { total, pending, uploading, done, error, withGps, withoutGps }
```

#### 4.5 useUpload.ts (mock)
```ts
// uploadAll(): Promise<void>
//   → para cada arquivo: simula progresso 0→100% em ~3s com setTimeout
//   → respeita concorrência máxima de 3 simultâneos
// cancelAll(): void
// isUploading: boolean
// Interface futura idêntica (substituição cirúrgica na fase 7)
```

#### 4.6 Componentes

**ImageDropzone.tsx**
- Área grande com borda tracejada animada
- Ícone drone + "Arraste as fotos aqui"
- Subtext: "JPG, JPEG, TIF, TIFF · com metadados GPS (EXIF)"
- Estado idle: borda neutral-600
- Estado hover/drag: borda primary-500 pulsante + bg-primary-500/5
- Click também abre seletor de arquivo
- Em mobile: tap-friendly (44px+ de altura)

**FileListItem.tsx**
- Layout horizontal: thumbnail 56x56 arredondado
- Nome (truncado com ellipsis) + tamanho
- GPS badge: verde "GPS ✓" / vermelho "Sem GPS" / spinner enquanto lê
- ProgressBar individual (fica em 0% até iniciar upload)
- Botão ✕ para remover (só quando não estiver uploading)

**UploadProgressList.tsx**
- Lista virtualizada com `@tanstack/react-virtual` (suporta 1000+ arquivos sem lag)
- Header fixo com `UploadSummaryBar`
- Animação de entrada: novos itens deslizam de baixo

**UploadSummaryBar.tsx**
- "N arquivos · X MB total · N com GPS"
- ProgressBar global (média dos progresses individuais)
- Botão ação: "Iniciar upload" / "Cancelando…" / "Concluído ✓"

**GpsWarningBanner.tsx**
- Aparece se >10% dos arquivos não têm GPS
- "⚠ N imagens sem metadados GPS — o processamento pode falhar"
- Expandível: lista de arquivos sem GPS
- Link "Como garantir GPS nas fotos" (accordion com explicação)

**UploadActionBar.tsx** (fixo no bottom da página no mobile)
- Botão primário "Iniciar upload de N imagens"
- Botão secundário "Limpar lista"
- Em desktop: no final do painel

#### 4.7 UploadPage.tsx
- Zoneamento: dropzone no topo, lista abaixo
- Em mobile: dropzone compacta (não ocupa tela toda)
- Estado "upload concluído": banner verde + botão "Iniciar processamento →"

**Entregável:** Drag & drop com thumbnails, leitura de GPS do EXIF, lista virtualizada de arquivos, progress bars animadas, alertas de arquivos sem GPS.

---

### Fase 5 — Dashboard de Resultados
> **Sem backend. ~3–4 dias.**
> Dados mockados realistas. UI idêntica ao produto final.

#### 5.1 Mock de projeto completo
```ts
// src/features/results/mocks/completedProject.ts
// Projeto fictício com todos os assets disponíveis
// stats: { gsd: 2.4, area_ha: 4.2, image_count: 847, point_count: 12400000, ... }
// assets: { orthophoto, dsm, dtm, point_cloud, contours, report }
```

#### 5.2 useProjectStatus.ts (mock)
```ts
// Simula progresso de processamento com eventos realistas:
// 0% → "Iniciando processamento…"
// 15% → "Extraindo características (SIFT)…"
// 43% → "Correspondência de imagens…"
// 67% → "Reconstrução 3D (SfM)…"
// 84% → "Gerando ortomosaico…"
// 95% → "Convertendo para COG…"
// 100% → "Concluído"
// Interface futura: EventSource para SSE (substituição cirúrgica na fase 7)
```

#### 5.3 Componentes do Mapa de Resultados

**ResultsLayout.tsx**
- Desktop: mapa ocupa 100% da tela, painel desliza sobre o mapa (overlay right)
- Tablet: mapa 60%, painel 40%
- Mobile: painel é um bottom sheet deslizável sobre o mapa (peek 120px, expandível para 70vh)

**ResultsMapContainer.tsx**
- Tile base: Esri satélite
- Controles customizados: zoom, fullscreen, "fit to bounds"
- Em fullscreen: TopBar e BottomNav se ocultam com animação

**LayerSelector.tsx**
- Desktop: tabs horizontais sobre o mapa (top-left)
- Mobile: segmented control no topo do bottom sheet
- Tabs: Ortomosaico | MDS | MDT | Curvas de Nível
- Tab desabilitada se asset não disponível (com tooltip explicando)
- Transição de fade ao trocar de layer

**OpacityControl.tsx**
- Slider vertical flutuante à direita do mapa
- Controla opacidade da layer ativa (0–100%)
- Aparece com animação slide-in ao ativar uma layer

**OrthophotoLayer.tsx / DsmLayer.tsx / DtmLayer.tsx**
- TileLayer apontando para TiTiler (em mock: imagem estática tile)
- Props: `projectId`, `opacity`

**ContoursLayer.tsx**
- GeoJSON layer com curvas de nível
- Linha azul-claro com `weight: 1`, label de elevação nos paths
- Toggle de labels visíveis

#### 5.4 Ferramentas de Medição

**MeasurementToolbar.tsx**
- Flutuante sobre o mapa (bottom-left desktop, bottom-center mobile)
- 3 botões: Distância | Área | Cota (DTM)
- Botão ativo: bg primário
- Botão ESC / Limpar

**DistanceTool.tsx**
- Cliques adicionam pontos na polyline
- Label flutuante ao lado do cursor com distância acumulada
- Resultado: "X,XX m" ou "X,XXX km" em card fixo
- Pontos removíveis com clique direito

**AreaTool.tsx**
- Cliques formam polígono temporário
- Fill semitransparente azul com borda pontilhada
- Label central com área em m² e ha
- Mínimo 3 pontos para calcular

**ElevationTool.tsx**
- Modo de clique único
- Consulta ponto no TiTiler (mock: valor estático)
- Card resultado: "Cota: XXX,X m (datum WGS84)"

#### 5.5 Panel de Downloads

**DownloadPanel.tsx**
- Título "Produtos gerados"
- Lista de DownloadCards
- Seção de estatísticas abaixo

**DownloadCard.tsx**
- Ícone do tipo de arquivo (GeoTIFF, LAS, PDF, SHP)
- Nome do produto em português
- Descrição técnica (1 linha)
- Badge do formato + tamanho estimado
- Botão "Baixar" com estado loading e done
- Hover: elevação + borda primária

Produtos listados:
1. Ortomosaico (GeoTIFF COG) — "Imagem aérea georreferenciada"
2. MDS — Modelo Digital de Superfície (GeoTIFF)
3. MDT — Modelo Digital de Terreno (GeoTIFF)
4. Nuvem de Pontos (.LAS) — "Para AutoCAD Civil, software BIM"
5. Curvas de Nível (.SHP / .GeoJSON)
6. Relatório de Qualidade (.PDF)

#### 5.6 Processamento

**StartProcessingPanel.tsx**
- Aparece quando projeto está em status `uploading` com imagens enviadas
- Seletor de preset: Fast | Standard | Ultra (cards com descrição e tempo estimado)
- Informações do preset selecionado: GSD esperado, features, tempo estimado
- Botão "Iniciar processamento"

**ProcessingView.tsx**
- Tela intermediária (status `processing`)
- Animação de radar/ondas pulsando (CSS)
- ProgressBar com percentual
- Etapa atual em texto animado (typewriter effect)
- Tempo estimado restante
- Botão "Cancelar processamento" (danger, confirmação)

**ProcessingLog.tsx**
- Accordion expansível "Ver log detalhado"
- Lista de etapas concluídas com timestamps
- Última etapa destacada com animação pulse

#### 5.7 ProcessingStatsGrid.tsx
- Grid 2x3:
  - GSD: `X,X cm/px`
  - Área coberta: `X,XX ha`
  - Imagens processadas: `NNN`
  - Pontos na nuvem: `X,X M`
  - Resolução ortomosaico: `X,X cm/px`
  - Tempo de processamento: `X h YY min`

#### 5.8 PointCloudViewer.tsx
- Iframe para Potree 1.8.2
- Carrega sob demanda (lazy, não no carregamento inicial da página)
- Placeholder com animação enquanto carrega

#### 5.9 ProjectDetailPage.tsx (hub)
- TopBar com nome do projeto + status badge
- Tabs: "Planejamento" | "Upload" | "Resultados"
- Indicadores de progresso em cada tab (check se concluído)
- Em mobile: tabs no bottom (acima do BottomNav)

**Entregável:** Fluxo completo navegável fim-a-fim. Processamento mockado com log animado. Mapa com layers, ferramentas de medição e downloads.

---

### Fase 6 — Contexto da Aplicação (sem autenticação) e Configurações
> **Sem backend necessário para UI. ~2 dias.**
> Base single-tenant no frontend + página de configurações.

#### 6.1 useAppContext.ts
```ts
// Contexto temporário, alinhado ao backend:
// workspaceId: string (default = "default")
// setWorkspaceId(id: string): void
// Futuro: ponto de extensão para autenticação sem quebrar chamadas existentes
```

#### 6.2 SettingsPage.tsx
- Contexto: workspace atual (single-tenant; somente exibição por enquanto)
- Preferências: tema (dark/light/sistema), unidade de distância (m/ft)
- Chave da API OpenWeatherMap (campo password com show/hide)
- Seção "Sobre" com versão do app

**Entregável:** App sem login, com contexto base single-tenant e preferências locais funcionando.

---

### Fase 7 — ⚠️ INTEGRAÇÃO COM BACKEND
> **REQUER BACKEND FUNCIONANDO.**
> Substituição de mocks por chamadas reais. Nenhum componente visual muda.

#### 7.1 services/http.ts
```ts
// Axios instance com:
// - baseURL: import.meta.env.VITE_API_URL
// - header opcional X-Workspace-Id (default: "default"), sem JWT
// - interceptor request/response para normalizar erros de rede e 5xx
// - interceptor response: erros 5xx → toast de erro global
```

#### 7.2 useProjects.ts — substituição
```ts
// De: CRUD no localStorage
// Para: React Query + projectsService.ts
// useQuery(['projects'], projectsService.getAll)
// useMutation(projectsService.create)
// Interface do hook PERMANECE IDÊNTICA — zero mudança nos componentes
```

#### 7.3 useUpload.ts — substituição
```ts
// De: progresso mockado com setTimeout
// Para: chunked upload real via uploadService.ts
//   → CHUNK_SIZE = 5MB
//   → concorrência máxima = 3
//   → retry automático por chunk (3 tentativas)
//   → atualiza progress via callback por chunk
// Interface PERMANECE IDÊNTICA
```

#### 7.4 useProjectStatus.ts — substituição
```ts
// De: setTimeout com progresso simulado
// Para: EventSource → SSE endpoint /projects/:id/status/stream
//   → reconexão automática (nativo do EventSource)
//   → fecha ao receber status completed/failed
// Interface PERMANECE IDÊNTICA
```

#### 7.5 useWeather.ts — substituição
```ts
// De: getMockWeather (dados estáticos)
// Para: chamada direta à Open-Meteo (sem backend)
//   → Open-Meteo é gratuito e não precisa de proxy
//   → URL: https://api.open-meteo.com/v1/forecast
//   → o cálculo de Go/No-Go permanece no frontend (weatherHelpers.ts)
```

#### 7.6 Contexto de requisição alinhado ao backend
```ts
// Sem autenticação nesta etapa:
// - todas as chamadas seguem modo single-tenant
// - opcionalmente enviar X-Workspace-Id="default" em todas as requisições
// - manter camada http.ts pronta para futura evolução sem refatorar hooks/componentes
```

#### 7.7 Cálculo de waypoints — decisão
```
O cálculo pode permanecer 100% no frontend (turf.js) — é a opção recomendada.
Vantagem: funciona offline (modo campo no app Android).
O backend também expõe o endpoint caso seja necessário para dispositivos lentos.
useFlightCalculator.ts: toggle via feature flag VITE_USE_SERVER_CALC=false
```

**Entregável:** Plataforma completa integrada ao backend real.

---

### Fase 8 — Capacitor (Android)
> **Paralela ou após Fase 7. ~3–4 dias.**

#### 8.1 Setup Capacitor
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "DroneMapper" "com.dronemapper.app" --web-dir dist
npx cap add android
```

#### 8.2 capacitor.config.ts
```ts
{
  appId: 'com.dronemapper.app',
  appName: 'DroneMapper',
  webDir: 'dist',
  server: {
    // Em dev: aponta para o servidor local para hot reload
    url: 'http://192.168.x.x:5173',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: { launchShowDuration: 1000, backgroundColor: '#0a0a0a' },
    StatusBar: { style: 'Dark', backgroundColor: '#0a0a0a' },
  }
}
```

#### 8.3 Plugin nativo (Kotlin): DjiMissionPlugin.kt
Localização: `android/app/src/main/java/com/dronemapper/app/`

Métodos expostos ao JavaScript:
- `listMissions()` → lista KMZs do DJI Fly e DJI Pilot 2
- `replaceMission(kmzBase64, uuid?, app?)` → escreve KMZ no storage
- `requestAllFilesAccess()` → solicita MANAGE_EXTERNAL_STORAGE (Android 11+)

Suporte a dois apps DJI:
- `Android/data/dji.go.v5/files/waypoint/` — DJI Fly
- `Android/data/dji.pilot2/files/waypoint/` — DJI Pilot 2

#### 8.4 AndroidManifest.xml
```xml
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"/>
<uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
```

#### 8.5 hooks/usePlatform.ts
```ts
// isNative: Capacitor.isNativePlatform()
// isAndroid: Capacitor.getPlatform() === 'android'
// isIOS: Capacitor.getPlatform() === 'ios'
// isWeb: !isNative
```

#### 8.6 hooks/useDjiMissions.ts
```ts
// Registra plugin: registerPlugin<DjiMissionPlugin>('DjiMission')
// requestPermission(): Promise<boolean>
// listMissions(): Promise<DjiMission[]>
// pushKmzToController(kmzBytes, uuid?, app?): Promise<PushResult>
// Guarda se permissão foi concedida em localStorage
```

#### 8.7 KmzTransferNative.tsx
- Renderizado apenas quando `isNative = true`
- Ao abrir: chama `requestPermission()`
- Se não concedida: tela de instrução para conceder permissão nas configurações do Android
- Se concedida: lista de missões existentes (select) + botão "Criar nova missão"
- Botão "Enviar para DJI Fly" com estado: idle → enviando → sucesso → erro
- Sucesso: animação check verde + "Abra o DJI Fly para confirmar"

#### 8.8 Ajustes de UI para mobile nativo
- Safe area insets: `padding-top: env(safe-area-inset-top)` no TopBar
- `padding-bottom: env(safe-area-inset-bottom)` no BottomNav
- Teclado virtual: `resize: none` e ajuste de viewport com `@capacitor/keyboard`
- Splash screen escura (1s) → fade para o app
- Status bar escura (ícones brancos)
- Haptic feedback em ações críticas: `@capacitor/haptics`

#### 8.9 Modo offline (cálculo local)
- `waypointCalculator.ts` roda sem internet (turf.js bundlado)
- `kmzBuilder.ts` roda sem internet (jszip bundlado)
- `weatherHelpers.ts` tem fallback: se Open-Meteo falhar → exibe "Clima indisponível" + aviso
- Service Worker (PWA) via `vite-plugin-pwa` para cachear assets

#### 8.10 Build e distribuição
```bash
npm run build
npx cap sync android
npx cap open android
# No Android Studio: Build → Generate Signed APK
# Sideload no RC via ADB: adb install DroneMapper.apk
```

Distribuição:
- RC 2 / RC Pro: sideload via ADB (Android 10, sem restrições)
- Celular pessoal: sideload ou Play Store (MANAGE_EXTERNAL_STORAGE requer justificativa)
- iOS: apenas download manual (sandbox impede acesso a arquivos de outros apps)

**Entregável:** APK funcional. Planejamento completo, cálculo de waypoints e KMZ funcionando offline. Missões enviadas diretamente ao DJI Fly sem cabos.

---

## Dependências (package.json)

```json
{
  "dependencies": {
    "react": "^19",
    "react-dom": "^19",
    "react-router-dom": "^6",
    "react-leaflet": "^4",
    "leaflet": "^1.9",
    "leaflet-draw": "^1.0",
    "@turf/turf": "^6",
    "zustand": "^4",
    "@tanstack/react-query": "^5",
    "@tanstack/react-virtual": "^3",
    "axios": "^1",
    "jszip": "^3",
    "exifr": "^7",
    "react-dropzone": "^14",
    "framer-motion": "^11",
    "class-variance-authority": "^0.7",
    "clsx": "^2",
    "tailwind-merge": "^2",
    "zod": "^3",
    "@radix-ui/react-dialog": "^1",
    "@radix-ui/react-select": "^2",
    "@radix-ui/react-tabs": "^1",
    "@radix-ui/react-tooltip": "^1",
    "@radix-ui/react-slider": "^1",
    "@radix-ui/react-accordion": "^1",
    "@capacitor/core": "^6",
    "@capacitor/android": "^6",
    "@capacitor/haptics": "^6",
    "@capacitor/keyboard": "^6",
    "@capacitor/splash-screen": "^6",
    "@capacitor/status-bar": "^6"
  },
  "devDependencies": {
    "@types/react": "^19",
    "@types/leaflet": "^1",
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "vite-plugin-pwa": "^0.20",
    "tailwindcss": "^3",
    "autoprefixer": "^10",
    "postcss": "^8",
    "typescript": "^5",
    "eslint": "^9",
    "@typescript-eslint/parser": "^7"
  }
}
```

---

## Resumo das Fases

| Fase | Conteúdo | Backend? | Dias |
|------|----------|----------|------|
| 1 | Setup, Design System, Layout, Navegação | ❌ | 3–4 |
| 2 | CRUD de Projetos (localStorage) | ❌ | 2 |
| 3 | Planejador de Voo completo (cálculos, mapa, KMZ, clima) | ❌ | 5–6 |
| 4 | Upload de Imagens (UI completa, EXIF, GPS validation) | ❌ | 3 |
| 5 | Dashboard de Resultados (mockado, processamento, downloads, medições) | ❌ | 3–4 |
| 6 | Contexto single-tenant + Configurações | ❌ | 2 |
| **7** | **⚠️ Integração Backend (upload real, SSE, API sem auth)** | **✅** | 3–4 |
| 8 | Capacitor Android (plugin DJI, permissões, APK, offline) | opcional | 3–4 |
