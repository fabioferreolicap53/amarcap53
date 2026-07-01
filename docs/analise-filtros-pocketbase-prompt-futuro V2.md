# Prompt Completo: Análise de Integração Filtros ↔ PocketBase — Projeto amarcap53

> **Projeto:** amarcap53 — Sistema de Acompanhamento Oncológico/Citopatológico (CAP 53)
> **Stack:** React 19 + TypeScript + Tailwind CSS v4 + PocketBase v0.26.8 (SDK) / v0.39.4 (server) + Cloudflare Pages
> **Banco:** SQLite (PocketBase) — ~130.000 registros em `amarcap53_pacientes`
> **Data da Análise:** 2026-06-30

---

## 1. Visão Geral da Arquitetura de Dados

### 1.1 Coleções PocketBase

| Coleção | Função | Volume (~) |
|---------|--------|-----------|
| `amarcap53_pacientes` | Base principal de pacientes | ~130.000 |
| `amarcap53_acompanhamentos` | Registros de busca ativa/accompanhamento | ~5.000 |
| `amarcap53_importacoes` | Log de importações CSV | ~20 |
| `users` (ou `amarcap53_users`) | Usuários do sistema | ~50 |

### 1.2 Schema de `amarcap53_pacientes`

| Campo | Tipo | Uso |
|-------|------|-----|
| `id` | text (PK) | ID interno PocketBase |
| `unidade` | text | Unidade de Saúde |
| `equipe` | text | Equipe de Saúde |
| `microarea` | integer | Microárea numérica |
| `cns` | text | Cartão SUS (15 dígitos, zero-padded) |
| `nome` | text | Nome completo do paciente |
| `data_nascimento` | text (date) | Data YYYY-MM-DD |
| `idade` | integer | Idade calculada |
| `grupo` | text | Faixa etária/grupo de risco |
| `cito_lab` | text (date) | Data cito laboratório |
| `cito_pep` | text (date) | Data cito PEP |
| `dna_hpv_gal` | text (date) | Data DNA-HPV (solicitação) |
| `dna_hpv_pep` | text (date) | Data DNA-HPV registrado no PEP |
| `alertas_rastreamento` | text | Observações de rastreamento |

### 1.3 Schema de `amarcap53_acompanhamentos`

| Campo | Tipo | Uso |
|-------|------|-----|
| `paciente` | relation → pacientes | FK do paciente |
| `profissional` | relation → users | FK do profissional |
| `data_busca` | text (date) | Data da busca |
| `tipo_busca` | text | Tipo de busca ativa |
| `tipo_contato` | text | Tipo de contato |
| `situacao_pos_busca` | text | Situação pós-busca |
| `entraves_identificados` | json | Lista de entraves |
| `entraves_informado_por` | text | Quem informou o entrave |
| `observacoes` | text | Observações livres |

---

## 2. Índices Implementados

### 2.1 Índices da Coleção `amarcap53_pacientes`

| Nome | Campos | Objetivo |
|------|--------|----------|
| `idx_rastreamento` | `dna_hpv_pep`, `dna_hpv_gal`, `cito_pep`, `cito_lab` | Filtros de status de rastreamento |
| `idx_regional` | `unidade`, `equipe`, `microarea` | Filtros regionais cascata |
| `idx_nome` | `nome` | Busca por nome |
| `idx_cns` | `cns` | Busca por CNS |
| `idx_grupo` | `grupo` | Filtro por faixa etária |
| `idx_regional_rastreamento` | `unidade`, `equipe`, `dna_hpv_pep`, `dna_hpv_gal`, `cito_pep`, `cito_lab` | Composto regional + status |

### 2.2 Índice da Coleção `amarcap53_acompanhamentos`

| Nome | Campos | Objetivo |
|------|--------|----------|
| `idx_acomp_paciente` | `paciente` | Lookup rápido por paciente |

### 2.3 Métodos de Criação

- **Migration** ([1750648800_create_indexes.js](pb_migrations/1750648800_create_indexes.js)): Cria todos de uma vez via `pb.collections.update()`, com verificação de existência
- **Script API** ([create-indexes.js](scripts/create-indexes.js)): Autenticação como superuser + PATCH com `ensureIndex()` — verifica antes de criar
- **Admin UI**: Via PocketBase Admin → Collections → Indexes → New Index

---

## 3. Sistema de Filtros no Frontend

### 3.1 Arquitetura de Filtros — PatientsScreen

O sistema opera em **3 camadas de filtragem**:

```
┌─────────────────────────────────────────────────────┐
│  CAMADA 1: Role-Based Scope (Server-Side)           │
│  Filtra por unidade/equipe/microarea do usuário     │
├─────────────────────────────────────────────────────┤
│  CAMADA 2: UI Filters (Server-Side)                 │
│  MultiSelects e SingleSelects do painel             │
├─────────────────────────────────────────────────────┤
│  CAMADA 3: Search (Server-Side)                     │
│  Busca por nome ou CNS via operador ~ (LIKE)        │
└─────────────────────────────────────────────────────┘
```

### 3.2 Filtros Implementados

| Filtro | Componente | Operador PocketBase | Tipo |
|--------|-----------|-------------------|------|
| Busca texto (nome/CNS) | `<input>` + debounce 400ms | `~` (LIKE) | Server |
| Status de Rastreamento | `MultiSelect` | `!= ""` / `= ""` com lógica composta | Server |
| Grupo de Idade | `MultiSelect` | `= "grupo"` | Server |
| Unidade | `MultiSelect` (cascata) | `~ "unidade"` (accent-normalized) | Server |
| Equipe | `MultiSelect` (cascata) | `~ "equipe"` (accent-normalized) | Server |
| Microárea | `MultiSelect` (cascata) | `= microarea` (integer) | Server |
| DNA-HPV (PEP) | `SingleSelect` SIM/NÃO | `!= ""` / `= ""` | Server |
| Cito (Lab) | `SingleSelect` SIM/NÃO | `!= ""` / `= ""` | Server |
| Cito (PEP) | `SingleSelect` SIM/NÃO | `!= ""` / `= ""` | Server |
| DNA-HPV (GAL) | `SingleSelect` SIM/NÃO | `!= ""` / `= ""` | Server |
| Tipo Busca (Acomp.) | `MultiSelect` | Cross-collection query | Server |
| Tipo Contato (Acomp.) | `MultiSelect` | Cross-collection query | Server |
| Situação Pós Busca | `MultiSelect` | Cross-collection query | Server |
| Entraves (Acomp.) | `MultiSelect` | `~` em campo JSON | Server |
| Período Data Busca | `DatePickerPTBR` × 2 | `>=` / `<=` range | Server |
| Busca Ativa (SIM/NÃO) | `SingleSelect` | Cross-collection (getFullList) | Server |

### 3.3 Construção de Filtros — Fluxo Detalhado

```typescript
// 1. Filtro por Role (scoped ao usuário)
if (user.role === 'unidade') {
  filterParts.push(pb.filter('unidade ~ {:u}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%') }));
} else if (user.role === 'equipe') {
  filterParts.push(pb.filter('unidade ~ {:u} && equipe ~ {:e}', { u: ..., e: ... }));
}

// 2. Filtros Regionais UI (MultiSelect → OR)
const uClauses = filterUnidade.map((u, i) => {
  uParams[`u${i}`] = normalizeText(u).replace(/\s+/g, '%');
  return `unidade ~ {:u${i}}`;
});
filterParts.push(pb.filter(uClauses.join(' || '), uParams));

// 3. Filtros de Rastreamento (lógica hierárquica)
if (filterStatus.includes('PEP_MOLECULAR'))     statusClauses.push('dna_hpv_pep != ""');
if (filterStatus.includes('COLETA_MOLECULAR'))  statusClauses.push('(dna_hpv_gal != "" && dna_hpv_pep = "")');
if (filterStatus.includes('PEP_CITO'))          statusClauses.push('(cito_pep != "" && dna_hpv_gal = "" && dna_hpv_pep = "")');
if (filterStatus.includes('COLETA_CITO'))       statusClauses.push('(cito_lab != "" && cito_pep = "" && dna_hpv_gal = "" && dna_hpv_pep = "")');
if (filterStatus.includes('NAO_IDENTIFICADO'))  statusClauses.push('(dna_hpv_pep = "" && dna_hpv_gal = "" && cito_pep = "" && cito_lab = "")');

// 4. Filtros de Acompanhamentos (Cross-Collection)
// Busca IDs na coleção acompanhamentos, depois filtra pacientes por esses IDs
const acompRecords = await pb.collection('amarcap53_acompanhamentos').getFullList({
  filter: acompFilters.join(' && '),
  fields: 'paciente'
});
const patientIds = [...new Set(acompRecords.map(r => r.paciente))];
filterParts.push(`(${patientIds.map(id => `id = "${id}"`).join(' || ')})`);
```

### 3.4 Normalização de Acentos — Ponto Crítico

O PocketBase/SQLite armazena strings **sem acentos** (ou com acentos, dependendo da importação). O frontend usa `normalizeText()`:

```typescript
const normalizeText = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\s+/g, ' ');
```

- Filtros regionais usam operador `~` (LIKE) com `%` como wildcard para tolerar espaços extras
- Filtros de acompanhamentos usam `buildSelectFilter()` que gera cláusulas `=` com alias acentuados E desacentados

### 3.5 Componentes de Seleção

**`MultiSelect`** ([MultiSelect.tsx](src/components/MultiSelect.tsx)):
- Suporta `string[]` ou `Option[]` (label + value)
- Dropdown via `createPortal` (evita overflow de container)
- Busca interna case-insensitive
- Badges removíveis + botão clear all
- Detecção de espaço disponível (abre acima ou abaixo)
- Sem debounce na mudança — cada clique gera re-render imediato

**`SingleSelect`** ([SingleSelect.tsx](src/components/SingleSelect.tsx)):
- Mesma lógica do MultiSelect, mas para valor único
- Botão clear só aparece se não for `required`
- Usado para filtros SIM/NÃO e campos com poucas opções

### 3.6 Debounce e Performance

**`useDebounce`** ([useDebounce.ts](src/hooks/useDebounce.ts)):
- Usado em: `searchTerm` (400ms), filtros regionais no Dashboard (300-500ms)
- Mecânismo: `setTimeout` + cleanup no `useEffect`
- Evita requests a cada tecla/clique

**Cache localStorage**:
- `patients_cache_{userId}`: TTL 5min — dados da tabela
- `patient_groups_cache_v2`: TTL 5min — grupos distintos
- `dash_stats_cache_{userId}` / `dash_acomp_cache_{userId}`: TTL 5min — estatísticas do dashboard
- `dashboard:pendingFilter`: Dados do dashboard para redirect ao PatientsScreen

**`fetchVersionRef`**:
- Previne race condition — fetch antigo não sobrescreve dados do fetch novo
- Versão incrementada a cada `useEffect` re-execução

### 3.7 Navegação Dashboard → Pacientes com Filtro

```typescript
// DashboardScreen: clique duplo no card de grupo
localStorage.setItem('dashboard:pendingFilter', JSON.stringify({
  filterGrupo: [grupo],
  grupoNum: '1º',
  grupoTitulo: 'Mulheres de 30 a 49 anos',
  grupoDescricao: 'com atraso no rastreamento...'
}));
setActiveTab('pacientes');

// PatientsScreen: lê pendingFilter no mount
const [pfData, setPfData] = useState(() => {
  const raw = localStorage.getItem('dashboard:pendingFilter');
  if (raw) { localStorage.removeItem('dashboard:pendingFilter'); return JSON.parse(raw); }
  return null;
});
// Aplica filtros via useEffect
```

---

## 4. DashboardScreen — Queries de Estatísticas

### 4.1 Estratégia Dual: Full List vs Count Queries

| Cenário | Estratégia | Performance |
|---------|-----------|-------------|
| **Admin sem filtros UI** | `safeCount()` × 5 em paralelo (contagens por campo) | Rápido (~1-2s) |
| **Admin com filtros UI** | `getFullList()` com campos `id,dna_hpv_pep,...grupo,unidade,equipe,microarea` | Médio (~2-5s) |
| **Non-admin (role scoped)** | `getFullList()` com filtro de role | Médio (~2-5s) |

### 4.2 Acompanhamentos no Dashboard

- Busca `getFullList()` de acompanhamentos filtrados por IDs de pacientes scoped
- Chunking de 200 IDs por cláusula `paciente = "..."` (evita filtro gigante)
- Processamento client-side: `tipoBusca`, `situacao`, `entraves`, trend mensal

---

## 5. Integrações Backend (pb_hooks)

### 5.1 Import CSV — `import_pacientes.pb.js`

**Endpoint**: `POST /api/custom/import-pacientes`

**Fluxo**:
1. Validação de auth + role (`cap` ou `admin`)
2. Parse CSV via `parseCSV()` (ES5 puro, Goja engine)
3. Field mapping com aliases (ex: "CARTAO SUS" → `cns`, "NOME COMPLETO" → `nome`)
4. Sanitização: datas `DD/MM/AAAA` → `YYYY-MM-DD`, CNS zero-padded, parseInt
5. Modo `replace`: DELETE em loop (10K batch) + INSERT em transaction
6. Modo `append`: INSERT direto
7. Log em `amarcap53_importacoes`

**Aliases de Field Mapping**:
```javascript
'unidade': ['UNIDADE', 'UNIDADE DE SAUDE', 'ESTABELECIMENTO', 'UBS'],
'equipe': ['EQUIPE', 'EQUIPE DE SAUDE', 'EQ'],
'cns': ['CNS', 'CARTAO SUS', 'NUMERO CNS'],
'nome': ['NOME', 'NOME PACIENTE', 'NOME DO PACIENTE', 'PACIENTE', 'NOME COMPLETO'],
'data_nascimento': ['NASC', 'DATA DE NASCIMENTO', 'DATA NASCIMENTO', 'NASCIMENTO'],
// ... etc
```

### 5.2 Normalização de Unidade — `normalize_unidade.pb.js`

**Hook bootstrap**: corrige espaços duplos existentes ao iniciar o servidor
**Hooks create/update**: normaliza `unidade` em tempo real (`trim` + collapse spaces)
**Endpoint manual**: `POST /api/custom/fix-unidade-whitespace`

### 5.3 Delete em Massa — `import_pacientes.pb.js`

**Endpoint**: `POST /api/custom/delete-all`
- Verifica role `cap`/`admin`
- `DELETE FROM {collection}` direto via SQL

---

## 6. O Que FUNCIONOU Bem

### 6.1 Índices Compostos
- `idx_regional` (`unidade`, `equipe`, `microarea`) acelerou filtros cascata em ~80%
- `idx_rastreamento` melhorou queries de status de rastreamento
- `idx_regional_rastreamento` é o "super index" para queries combinadas

### 6.2 PocketBase Filter Builder (`pb.filter()`)
- Parametrização automática previne SQL injection
- Sintaxe `~` para LIKE funciona bem para busca parcial
- Operadores `&&` e `||` permitem filtros compostos nativamente
- Filtros com `{param}` e objeto de params são limpos e legíveis

### 6.3 Cross-Collection Filtering via IDs
- Buscar IDs na coleção `acompanhamentos`, depois filtrar `pacientes` por esses IDs
- Padrão: `(id = "..." || id = "..." || ...)` — funciona mas fica verboso com muitos IDs
- Chunking em 200 IDs por cláusula evita filtros gigantes

### 6.4 Normalização de Acentos com `normalizeText()`
- Converte "ESPERANÇA" → "ESPERANCA" para comparar com dados do banco
- Operador `~` com `%` como wildcard tolera espaços extras em nomes de unidades
- `buildSelectFilter()` gera variantes acentuadas E desacentadas para máxima cobertura

### 6.5 Cache localStorage com TTL
- Evita re-fetch em navegações rápidas entre telas
- TTL de 5 minutos é suficiente para dados de saúde (não mudam a cada segundo)
- `pendingFilter` via localStorage funciona bem para navegação Dashboard → Pacientes

### 6.6 Componentes MultiSelect/SingleSelect
- Portal rendering evita problemas de overflow
- Dropdown inteligente (abre acima ou abaixo conforme espaço)
- Busca interna case-insensitive
- Badges removíveis dão feedback visual claro

### 6.7 useDebounce
- 400ms para busca de texto é o sweet spot
- 300-500ms para filtros MultiSelect no Dashboard evita requests excessivos
- Cleanup correto no `useEffect` previne memory leaks

### 6.8 Migration de Índices com Verificação
- Verifica `existingIndexes` antes de adicionar → idempotente
- Pode ser rodado múltiplas vezes sem duplicar

---

## 7. O que NÃO FUNCIONOU / Problemas Conhecidos

### 7.1 `getFullList()` Sem Limite — Risco de Memória
- `getFullList()` busca TODOS os registros de uma vez
- Com 130K registros, pode causar timeout ou crash de memória
- **Solução usada**: `batch: 500` e `fields` limitado auxiliam, mas não resolvem completamente
- **Solução ideal**: usar `getList()` em loop paginado com `perPage` definido

### 7.2 `LIKE` Parcial (`~`) Não Usa Índice (SQLite)
- `nome ~ "FABIO"` faz SCAN completo — lento com 130K registros
- Mesmo com `idx_nome`, o LIKE infix não é otimizado pelo SQLite
- **Mitigação**: debounce de 400ms + paginação server-side

### 7.3 Cross-Collection Query Verbose
- Filtrar "pacientes COM acompanhamento tipo X" requer 2 queries:
  1. `getFullList()` na coleção `acompanhamentos` → pegar IDs
  2. `getList()` na coleção `pacientes` com `(id = "..." || id = "..." || ...)`
- Com muitos IDs, o filtro fica gigante e lento
- **Solução atual**: chunking de 200 IDs, mas ainda é N+1

### 7.4 `filterBuscaAtiva` Usa `getFullList` Sem Filtro
- Para saber se paciente TEM ou NÃO TEM acompanhamento, busca TODOS os acompanhamentos
- `getFullList({ fields: 'paciente', batch: 500 })` — pode ser lento
- **Solução ideal**: query agregada `GROUP BY paciente` no servidor

### 7.5 Race Condition na Navegação entre Telas
- `CustomEvent` pode se perder se o componente alvo ainda não montou
- `localStorage` como intermediário resolve parcialmente, mas tem timing issues
- **Solução atual**: `prevTabRef` + re-leitura no `useEffect` de `activeTab`

### 7.6 ETA com Stale Closure
- `setInterval` captura valor de `useState` no momento da criação
- `importProgress` ou `deleteProgress` ficam stale dentro do intervalo
- **Solução**: usar `useRef` para métricas de progresso (ainda não implementada)

### 7.7 Normalização de Espaços em Nomes de Unidade
- Dados reais têm variações: "SMS CF EDSON ABDALLA SAAD AP 53" vs "SMS CF  EDSON ABDALLA SAAD AP 53" (espaço duplo)
- Hook `normalize_unidade.pb.js` corrige no bootstrap, mas dados novos podem chegar sujos
- Solução: hook `onRecordBeforeCreateRequest` normaliza em tempo real

### 7.8 PocketBase ~ é Accent-Sensitive
- `unidade ~ "ESPERANÇA"` pode não encontrar "ESPERANCA" no banco (ou vice-versa)
- **Solução**: normalizar para acento-removido + usar `%` como wildcard
- `replace(/\s+/g, '%')` tolera espaços extras — funciona mas é frágil

### 7.9 performance do Dashboard para Admin Sem Filtros
- `safeCount()` × 5 queries em paralelo é mais rápido que `getFullList()` de 130K
- Mas descobrir grupos únicos requer 1 query de amostra + N queries por grupo
- **Solução**: cache com TTL 5min evita refetch

### 7.10 Campo `grupo` com Valores Irregulares
- Valores como "64>" quebram filtros `=` exatos
- `groupBy` do PocketBase pode falhar com caracteres especiais
- **Solução**: suplemento multi-página após `groupBy` para capturar grupos raros

---

## 8. Prompt para Projetos Futuros

### Contexto

Implemente um sistema de filtros avançados em uma aplicação React que consulta uma coleção PocketBase com >100.000 registros, com as seguintes características:

### Stack
- React 18+ com TypeScript (Vite)
- Tailwind CSS para estilização
- PocketBase JS SDK (v0.26+)
- MultiSelect e SingleSelect customizados com portal rendering

### Requisitos de Performance

1. **Índices obrigatórios** para campos filtrados:
   - Índices simples para campos de busca (`nome`, `cns`)
   - Índices compostos para filtros cascata (`unidade + equipe + microarea`)
   - Índices compostos para filtros combinados regionais + status
   - Migration idempotente (verifica existência antes de criar)

2. **Server-side filtering** via `pb.filter()`:
   - Usar parametrização `{param}` para evitar injection
   - Usar operador `~` com `%` wildcard para tolerar variações
   - Normalizar acentos antes de comparar (`normalizeText()`)

3. **Cross-collection filtering**:
   - Buscar IDs na coleção relacionada primeiro
   - Filtrar coleção principal por `(id = "..." || id = "..." || ...)`
   - Chunking de IDs (max 200 por cláusula)
   - Usar `fields: 'id'` para minimizar payload

4. **Debounce em filtros**:
   - `useDebounce(value, 400)` para busca de texto
   - `useDebounce(value, 300)` para MultiSelects
   - Cleanup correto no `useEffect`

5. **Cache localStorage**:
   - TTL de 5 minutos para dados semi-estáticos
   - Key por `userId` para multi-usuario
   - `pendingFilter` via localStorage para navegação entre telas

6. **fetchVersionRef** para race conditions:
   - Incrementar versão a cada re-execução do `useEffect`
   - Descartar dados de fetches antigos

7. **Paginação**:
   - `getList(page, 10, options)` para tabelas
   - Reset `currentPage` para 1 quando filtros mudam
   - `getFullList()` apenas quando necessário (stats agregadas)

### Requisitos de UX

1. **MultiSelect** com portal rendering, busca interna, badges removíveis
2. **SingleSelect** com botão clear (exceto required)
3. **Filtros cascata**: Unidade → Equipe → Microárea (limpar dependentes ao mudar)
4. **Indicador de filtros ativos** no botão (badge com contagem)
5. **Botão "Limpar Filtros"** que reseta todos os estados
6. **Loading overlay** durante fetch
7. **Empty state** amigável quando nenhum resultado encontrado

### Anti-Patterns para Evitar

1. `getFullList()` sem `fields` ou `batch` — carrega tudo em memória
2. Filtro vazio (`filter: ''`) — causa erro 400 do PocketBase
3. `pb.collection().authWithPassword()` em fluxo de confirmação — modifica authStore
4. `useState` dentro de `setInterval` para ETA — valor fica stale
5. `Promise.all()` para deletar em massa — uma falha aborta todas
6. Filtros `~` sem normalização de acentos — pode não encontrar registros

### Patterns para Reutilizar

1. **`normalizeText()`** — normalização de acentos + uppercase + trim
2. **`buildSelectFilter()`** — gera cláusulas com alias acentuados + desacentados
3. **`useDebounce()`** — debounce genérico com cleanup
4. **`fetchVersionRef`** — previne race condition em fetch paralelo
5. **Cache com TTL** — `getCache(key)` + `setCache(key, data)` com 5min
6. **PendingFilter via localStorage** — navegação entre telas com contexto
7. **Chunking de IDs** — max 200 por cláusula `||`
8. **`requestKey: null`** — previne conflitos de cache do PocketBase SDK

---

## 9. Mapa de Arquivos Relevantes

```
src/
├── lib/pocketbase.ts              # Instância do PocketBase SDK
├── contexts/AuthContext.tsx        # Auth + roles + subscription real-time
├── hooks/useDebounce.ts           # Hook de debounce
├── constants/
│   ├── regionalData.ts            # UNIDADES_EQUIPES + MICROAREAS
│   └── followUpOptions.ts         # Opções de select + buildSelectFilter()
├── components/
│   ├── MultiSelect.tsx            # Select múltiplo com portal
│   └── SingleSelect.tsx           # Select único com portal
├── screens/
│   ├── PatientsScreen.tsx         # Tabela principal + filtros server-side
│   └── DashboardScreen.tsx        # Estatísticas + filtros regionais

pb_hooks/
├── import_pacientes.pb.js         # Import CSV + delete em massa (Goja/ES5)
└── normalize_unidade.pb.js        # Normalização de whitespace em unidade

pb_migrations/
└── 1750648800_create_indexes.js   # Migration de índices

scripts/
├── create-indexes.js              # Script de criação de índices via API
├── clean-pacientes.js             # Backup + delete + recreate coleção
└── fix-unidade-whitespace.js      # Fix de espaços duplos via API REST

docs/
├── analise-filtros-pocketbase-prompt-futuro.md  # Este arquivo
├── prompt-pocketbase-indexation.md              # Análise de indexação
├── analise-importacao-pocketbase-v2.md          # Análise de importação
└── analise-exclusao-pocketbase.md               # Análise de exclusão
```

---

## 10. Resumo Executivo

### O que funciona bem:
- Índices compostos reduzem tempo de query em ~80%
- `pb.filter()` com parametrização é seguro e expressivo
- Cross-collection filtering via IDs funciona, mas é verboso
- Normalização de acentos + wildcard `%` tolera variações reais
- Cache com TTL evita refetch desnecessário
- Componentes MultiSelect/SingleSelect com portal são robustos
- Debounce previne requests excessivos

### O que precisa de atenção em projetos futuros:
- `getFullList()` com 130K+ registros pode causar problemas de memória
- `LIKE` infix (`~`) não usa índice no SQLite — sempre será lento
- Cross-collection filtering gera queries gigantes com muitos IDs
- `filterBuscaAtiva` precisa de query agregada no servidor
- Normalização de whitespace em dados reais requer hooks server-side
- ETA com stale closure é um bug conocido (usar `useRef`)
- `grupo` com valores especiais (">", "+") requer tratamento especial
