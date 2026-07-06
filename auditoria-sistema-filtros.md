# Auditoria Completa do Sistema de Filtros — AmarCap53

**Data:** 06/07/2026
**Escopo:** Fluxo de dados, lógica de filtragem e sincronização entre páginas

---

## 1. Mapeamento do Funcionamento Atual

### 1.1 Arquitetura Geral

O sistema possui duas páginas principais com filtros sincronizados:

| Página | Arquivo | Responsabilidade |
|--------|---------|-----------------|
| Resumo (Dashboard) | `src/screens/DashboardScreen.tsx` | Cartões numéricos, gráficos, filtros regionais |
| Pacientes (Tabela) | `src/screens/PacientesScreen.tsx` | Tabela nominal, filtros avançados, paginação |

### 1.2 Fluxo de Dados

```
PocketBase API (centraldedados.dev.br)
        │
        ▼
┌─────────────────────────────────────────────┐
│  DashboardScreen.tsx                        │
│                                             │
│  Query Leve (~100ms) ──► filteredGroupCounts│
│  fetchStats (300-800ms) ──► stats, grupos,  │
│                              alerts          │
│  Acompanhamento query ──► comBuscaMap       │
│                           filteredComBusca  │
│                                             │
│  localStorage cache (30min TTL)             │
│    ├── dash_stats_cache_{userId}            │
│    └── dash_acomp_cache_{userId}            │
└─────────────────────────────────────────────┘
        │
        │  localStorage.setItem('dashboard:pendingFilter')
        ▼
┌─────────────────────────────────────────────┐
│  PacientesScreen.tsx                        │
│                                             │
│  Lê pendingFilter ──► inicializa filtros    │
│  Constrói filterParts[] (server-side)       │
│  pb.collection('amarcap53_pacientes')       │
│    .getList(page, pageSize, { filter })     │
│                                             │
│  localStorage cache (5min TTL)              │
│    └── patient_list_cache_{userId}          │
└─────────────────────────────────────────────┘
```

### 1.3 Sistemas de Filtro

#### A. Filtros Regionais (ambas as páginas)
- Unidade, Equipe, Microárea
- Server-side via PocketBase `filter` com normalização de acentos (`normalizeText()`)
- DashboardScreen: debounce 300ms
- PacientesScreen: sem debounce (aplica no clique "Aplicar")

#### B. Filtros de Grupo Prioritário (Dashboard → Pacientes)
- **Dashboard**: `PRIORITY_GROUPS` array com 4 cards (30-49, 50-64, 30-49 independente, 25-29)
- Card 3º usa `reuseFrom: 0` para herdar `gruposDB` do card 1º
- Count: `filteredGroupCounts[g]` — pacientes **SEM** cito/HPV
- **Botão "Ir para listagem"**: salva `dashboard:pendingFilter` com `filterGrupo` + filtros SIM/NÃO + buscaAtiva
- **PacientesScreen**: lê pendingFilter, aplica `grupo = "X" && cito_pep = "" && ...`

#### C. Filtros de Busca Ativa (Dashboard → Pacientes)
- Dashboard: `filteredComBuscaMap` — pacientes com acompanhamento nos últimos 12 meses
- Botões "Sem Busca" / "Com Busca": enviam `filterBuscaAtiva = false/true`
- PacientesScreen: busca IDs de pacientes com acompanhamento, filtra por IDs

#### D. Filtros de Status (Dashboard → Pacientes)
- Cards de status (COLETA_MOLECULAR, NAO_IDENTIFICADO, etc.)
- Clique envia `filterStatus: ['key']` via pendingFilter
- PacientesScreen: lógica mutualmente exclusiva de status

#### E. Filtros Regionais da UI
- MultiSelect component para Unidade/Equipe/Microárea
- **Dashboard**: equipes são filtradas pela unidade selecionada (encadeado)
- **PacientesScreen**: filtros regionais são independentes (sem cascata)

---

## 2. Pontos Fortes (O Que Deu Certo)

### 2.1 Query Leve para Contagens (arquitetura de dupla velocidade)
**Arquivo:** `DashboardScreen.tsx` linhas 316-370

A separação entre "query leve" (100ms, contagens por grupo) e "fetchStats" (300-800ms, dados completos) é uma boa escolha arquitetural. A query leve:
- Usa `getList(1,1)` — retorna só `totalItems`, sem transferir registros
- Executa 4 queries paralelas (uma por faixa etária)
- Popula `filteredGroupCounts` antes do fetch completo terminar
- Fonte única de verdade para contagens dos cartões

**Manter:** Esta dual-speed architecture é eficiente e deve ser preservada.

### 2.2 Race Condition Protection
**Arquivo:** `DashboardScreen.tsx` linhas 120-121, 398, 453

O uso de `fetchVersionRef` + `cancelled` flag em todos os useEffects que fazem fetch é uma boa prática:
```tsx
const version = ++fetchVersionRef.current;
// ... fetch ...
if (!cancelled && fetchVersionRef.current === version) { setState(); }
```
Previne que respostas antigas sobrescrevam dados novos.

### 2.3 Lazy Loading de Acompanhamentos
**Arquivo:** `DashboardScreen.tsx` linhas 673-730

O acompanhamento é carregado de forma lazy — só consulta a coleção `amarcap53_acompanhamentos` quando o Dashboard termina de carregar os dados principais. Evita sobrecarga na carga inicial.

### 2.4 Cache com TTL
**Arquivo:** `DashboardScreen.tsx` linhas 52-86

O sistema de cache com 30 minutos de TTL + version key (v4) permite:
- Carregamento instantâneo na segunda visita
- Migração entre versões (limpa cache antigo)
- Cache por usuário (`${userId}`)

### 2.5 Skeleton Loading Granular
**Arquivo:** `DashboardScreen.tsx` linhas 1129-1180

Skeleton loading apenas nos valores numéricos (não no cartão inteiro) é uma boa UX. O `isLoadingPrioCounts` controla o skeleton, e os cartões reais sempre ficam visíveis.

### 2.6 `pendingFilter` via localStorage
**Arquivo:** `DashboardScreen.tsx` linhas 1344-1364, `PacientesScreen.tsx` linhas 250-272

A transferência de filtros entre páginas via `localStorage.setItem` / `getItem` + `removeItem` é simples e eficiente. A leitura síncrona no `PacientesScreen` (IIFE) evita race conditions — o estado é inicializado com os valores corretos antes do primeiro render.

### 2.7 Botão "Ir para listagem" SEMPRE envia filtros cito/dna
**Arquivo:** `DashboardScreen.tsx` linhas 1348-1355

Todos os cards de grupo prioritário (incluindo o 3º "independente") SEMPRE enviam filtros `cito_pep = NÃO`, `dna_hpv_pep = NÃO`, etc. Isso garante que a tabela nominal mostre apenas pacientes sem rastreamento, consistente com o count do card.

### 2.8 `buildSelectFilter` com aliases
**Arquivo:** `src/constants/followUpOptions.ts`

A função `buildSelectFilter` que gera filtros com todas as aliases possíveis (ex: "1 - AGENDAMENTO APÓS CONTATO DIRETO" e "AGENDAMENTO APÓS CONTATO DIRETO") é uma solução robusta para lidar com dados reais que têm variações de formato.

---

## 3. Pontos de Atenção (O Que Não Deu Certo)

### 3.1 🔴 CRÍTICO: Cache expirado usado como fallback

**Arquivo:** `DashboardScreen.tsx` linhas 72-81

```tsx
const _acOld = localStorage.getItem('dash_acomp_cache_user123');
const _scOld = localStorage.getItem('dash_stats_cache_user123');
```

Se o cache formatado (`getCache()`) expirou, o código lê o localStorage **diretamente** (bypass do TTL). Isso significa que:
- Dados de 6 horas atrás podem ser exibidos como "carregados"
- A migration v4 pode não funcionar corretamente se o cache antigo não tem versão
- O `filteredGroupCounts` do cache antigo é usado → cartões mostram valores desatualizados

**Correção sugerida:** Se `_sc = null` (cache expirado), usar `_scOld = null` também. Nunca ler cache expirado.

### 3.2 🔴 CRÍTICO: Regex 65+ inconsistente

Três regex diferentes para o mesmo grupo etário:

| Local | Regex | Grupo |
|-------|-------|-------|
| Query leve (linha 338) | `6[45]>\|65\\+\|6[45]\\+\|6[45]\\s*anos\|6[45]\\s*$\|6[45]\\s*\\)` | 65+ (ampla) |
| Cards JSX (linha 1170) | `6[45]>\|65\+\|6[45]\+\|6[45]\s*anos\|6[45]\s*$\|6[45]\s*\)` | 65+ (ampla) |
| Scope query (linha 863) | `/64>\|65>/i` | 65+ (restritiva) |

Pacientes com grupo como "65 anos" seriam contados na query leve e nos cards, mas NÃO no scope query client-side → contagem divergente.

**Correção sugerida:** Extrair regex para constante compartilhada em `src/constants/priorityGroups.ts`.

### 3.3 🟡 MÉDIO: `filteredGroupCounts` fallback para total do grupo

**Arquivo:** `DashboardScreen.tsx` linha 1152

```tsx
return acc + (filteredGroupCounts?.[gName] ?? grpObj.count);
```

Se `filteredGroupCounts` não tem a chave (query leve ainda não retornou), usa `grpObj.count` (TOTAL do grupo). Isso mostra o número total no card (ex: 69.483) em vez do filtrado (36.433), causando flash de dados incorretos.

**Correção sugerida:** Esconder o count (mostrar skeleton) quando `filteredGroupCounts[gName] === undefined`.

### 3.4 🟡 MÉDIO: `filteredComBuscaMap` inicia do cache antigo

**Arquivo:** `DashboardScreen.tsx` linha 129

```tsx
const [filteredComBuscaMap, setFilteredComBuscaMap] = useState<Record<string, number>>(
  _acOld?.filteredComBuscaMap ?? {}
);
```

Enquanto `filteredGroupCounts` agora inicia vazio (correção recente), `filteredComBuscaMap` ainda inicia do cache. Isso pode causar mismatch temporário entre os valores de "Sem Busca" e "Com Busca".

**Correção sugerida:** Iniciar `filteredComBuscaMap` vazio também: `useState({})`.

### 3.5 🟡 MÉDIO: `normalizeText()` duplicado

**Arquivos:** `DashboardScreen.tsx` linhas 27-28, `PacientesScreen.tsx` linhas 51-52

A função de normalização de acentos está duplicada idêntica em dois arquivos. Se alguém alterar uma e não a outra, os filtros regionais ficam inconsistentes.

**Correção sugerida:** Extrair para `src/lib/normalizeText.ts` e importar em ambos.

### 3.6 🟡 MÉDIO: `filterBuscaAtiva = false` gera query gigante

**Arquivo:** `PacientesScreen.tsx` linhas 957-959

```tsx
const idFilter = acompPacIds.map(id => `id != "${id}"`).join(' && ');
```

Se há 50.000 pacientes com acompanhamentos, isso gera ~50.000 condições `id != "X"` em uma string. PocketBase/SQLite têm limites de tamanho de query — pode falhar silenciosamente ou retornar resultados incorretos.

**Correção sugerida:** Usar paginação via IDs ou usar `NOT IN` se o PocketBase suportar, ou limitar a 5000 IDs e usar paginação client-side.

### 3.7 🟡 MÉDIO: Duas queries separadas de acompanhamento

**Arquivo:** `PacientesScreen.tsx` linhas 821-968

Quando `hasAcompFilter` E `filterBuscaAtiva !== null` estão ambos ativos:
1. Query 1: busca IDs com filtros de acompanhamento (linhas 848-874)
2. Query 2: busca IDs para Busca Ativa (linhas 942-948)

São duas queries à mesma coleção com overlapping de lógica. Deveriam ser unificadas.

**Correção sugerida:** Combinar os filtros de acompanhamento e Busca Ativa em uma única query.

### 3.8 🟡 MÉDIO: `patientRegionFilterParts` duplicado

**Arquivo:** `PacientesScreen.tsx` linhas 788-818

A construção de filtros regionais para o escopo de acompanhamentos (`patientRegionFilterParts`) é quase idêntica à construção de `filterParts` para filtros regionais (linhas 755-786). Código completamente duplicado.

**Correção sugerida:** Extrair para função `buildRegionFilter(user, filterUnidade, filterEquipe, filterMicroarea)`.

### 3.9 🟡 MÉDIO: `buscaAtiva` inconsistente entre cards

**Arquivo:** `DashboardScreen.tsx` linhas 1420-1421

```tsx
// Card SEM busca: envia buscaAtiva = false
pending.buscaAtiva = false;
// Card COM busca: envia buscaAtiva = true
pending.buscaAtiva = true;
```

O card "NÃO IDENTIFICADO" envia `filterStatus: ['NAO_IDENTIFICADO']` + `buscaAtiva`, mas os cards de grupo prioritário enviam `filterGrupo` + `buscaAtiva`. O `PacientesScreen` precisa tratar ambos os casos, e o `filterBuscaAtiva` tem comportamento diferente dependendo do tipo de filtro ativo.

**Correção sugerida:** Documentar claramente a matriz de combinações de filtros.

### 3.10 🟢 BAIXO: `hasValue()` vs `!!String().trim()`

**Arquivos:** `DashboardScreen.tsx` linhas 148-151 vs 703

- `hasValue()`: retorna `false` para `'--'`, `null`, `undefined`, `''`
- `!!(p.cito_pep && String(p.cito_pep).trim())`: retorna `true` para `'--'`

Paciente com `cito_pep = '--'` é classificado como NAO_IDENTIFICADO por `hasValue()`, mas NÃO entra no `filteredComBuscaMap` porque `hasCito = true`. Inconsistência sutil.

**Correção sugerida:** Padronizar a definição de "tem valor" em uma função compartilhada.

### 3.11 🟢 BAIXO: Debounce inconsistente entre telas

| Filtro | DashboardScreen | PacientesScreen |
|--------|----------------|-----------------|
| Regionais | 300ms | Sem debounce |
| Datas | 500ms | Sem debounce |
| Busca texto | N/A | 400ms |

Diferentes tempos de debounce causam percepção de inconsistência na reatividade.

### 3.12 🟢 BAIXO: `loadedOnceRef` é dead code

**Arquivo:** `PacientesScreen.tsx` linha 742, 1038

```tsx
const loadedOnceRef = useRef(false);
// ...
loadedOnceRef.current = true;
```

Setado mas nunca lido. Pode ser removido.

### 3.13 🟢 BAIXO: Funções `calcularIdade` e `formatarData` duplicadas

**Arquivo:** `PacientesScreen.tsx`

Definidas como constantes module-level (linhas 191-222) E como funções locais dentro do componente (linhas 1220-1261). As locais shadow as module-level. Código duplicado que pode divergir.

### 3.14 🟢 BAIXO: `filterVersion` força re-fetch desnecessário

**Arquivo:** `PacientesScreen.tsx` linha 1538

Clicar "Aplicar Filtros" sempre incrementa `filterVersion`, mesmo que nenhum filtro tenha mudado. Força re-fetch completo desnecessário.

---

## 4. Matriz de Consistência Dashboard vs Pacientes

| Métrica | Dashboard Card | PacientesScreen | Consistente? |
|---------|---------------|-----------------|:------------:|
| Total grupo 30-49 (sem exames) | `filteredGroupCounts['30-49']` | `totalItems` com filtros equivalentes | ✅ |
| Total grupo 50-64 (sem exames) | `filteredGroupCounts['50-64']` | `totalItems` com filtros equivalentes | ✅ |
| Total grupo 30-49 "independente" | `filteredGroupCounts['30-49']` (mesmo grupo 1º) | `totalItems` com mesmos filtros | ⚠️ Depende de cache |
| Sem busca ativa | `semBusca = totalGrupo - comBusca` | `totalItems` com `filterBuscaAtiva=false` | ⚠️ Pode divergir por IDs |
| Com busca ativa | `comBusca = filteredComBuscaMap[g]` | `totalItems` com `filterBuscaAtiva=true` | ⚠️ Pode divergir |
| Status NAO_IDENTIFICADO | Contagem client-side | `filterStatus=['NAO_IDENTIFICADO']` | ⚠️ hasValue inconsistente |
| Total 65+ | Query leve regex ampla | Scope query regex restritiva | ❌ Divergente |

---

## 5. Prompt Guia para Projetos Futuros

### Prompt Otimizado e Reusável

```
## Contexto
Estou criando um sistema de dashboard com tabela nominal, onde cartões numéricos e gráficos
devem estar perfeitamente sincronizados com a tabela de detalhamento. O backend é PocketBase,
o frontend é React + TypeScript + Tailwind.

## Regras de Arquitetura de Filtros

### 1. Dupla Velocidade (Query Leve + Fetch Completo)
- Use queries leves (getList com page=1, perPage=1, fields='id') para obter contagens
  de forma rápida (~100ms) — retornam APENAS totalItems, sem transferir dados.
- Use fetch completo separado para dados de tabela, gráficos e detalhes.
- A query leve é a FONTE ÚNICA de verdade para contagens de cartões.
- NUNCA sobrescreva o resultado da query leve com dados do fetch completo.

### 2. Regra de Consistência: Card = Tabela
- O count exibido no card DEVE ser exatamente igual ao totalItems da tabela.
- Para garantir isso: o card e a tabela DEVEM usar o MESMO filtro server-side.
- Nunca compute contagens client-side quando uma query leve pode obter o valor correto.
- Se precisar de fallback, usar skeleton (não valor total do grupo).

### 3. Cache com TTL e Versionamento
- Cache sempre com TTL (recomendado: 30min para dados, 5min para listagens).
- Usar version key para invalidar cache entre deploys.
- NUNCA ler cache expirado como fallback — se expirou, considerar como vazio.
- Cache por usuário para evitar conflitos em multi-tenant.

### 4. Race Condition Protection
- Toda query async deve ter `cancelled` flag (AbortController ou ref boolean).
- Usar `fetchVersionRef` para garantir que respostas antigas não sobrescrevam dados novos.
- Template:
  ```tsx
  const fetchVersionRef = useRef(0);
  useEffect(() => {
    const version = ++fetchVersionRef.current;
    const cancelled = false;
    async function fetchData() {
      const data = await apiCall();
      if (!cancelled && fetchVersionRef.current === version) {
        setData(data);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [dependencies]);
  ```

### 5. Transferência entre Páginas
- Usar localStorage para transferir filtros entre páginas (simples, sem dependências).
- Padrão: setItem antes de navegar, getItem síncrono + removeItem no destino.
- inicializar estado do componente com valores do pendingFilter (não via useEffect).
- Limpar pendingFilter imediatamente após leitura.

### 6. Filtros Server-Side
- TODA filtragem deve ser server-side (PocketBase filter string).
- Usar `pb.filter()` com parâmetros nomeados para filtros dinâmicos.
- Normalizar acentos em todos os filtros de texto (`normalizeText()`).
- Usar `requestKey: null` em queries paralelas para evitar auto-cancellation do PocketBase.

### 7. Regex Compartilhada
- Se múltiplos componentes usam as mesmas regex, EXTRAIR para constante compartilhada.
- Nunca duplicar regex — é a causa #1 de bugs de consistência.
- Testar regex com casos de borda (acentos, espaços extras, formatos variados).

### 8. Skeleton Loading
- Skeleton APENAS nos campos de valor (não no cartão inteiro).
- Iniciar estados de loading como `true` quando não há cache.
- Usar `key` reativo para forçar remount com animação fade-in quando dados chegam.

### 9. Anti-Padrões a Evitar
- NÃO usar fallback de cache expirado (causa flash de dados errados).
- NÃO usar `grupoBreakdownRef` como fallback para `filteredGroupCounts` (são dados diferentes).
- NÃO gerar queries com milhares de cláusulas `id != "X"` (use paginação ou batch).
- NÃO duplicar funções de filtro em múltiplos arquivos.
- NÃO misturar "sem rastreamento" com "com acompanhamento" na mesma contagem.
- NÃO usar debounce diferente para o mesmo tipo de filtro em telas diferentes.

### 10. Padrão de Contagem de Status
- Definir claramente o que cada status significa:
  - NAO_IDENTIFICADO: campos de exame vazios ou '--'
  - COLETA_MOLECULAR: dna_hpv preenchido, cito vazio
  - COLETA_CITOLOGICA: cito preenchido, dna vazio
  - COMPLETO: ambos preenchidos
- Usar a MESMA função de classificação em todas as telas.
- Extrair para utilitário compartilhado: `src/lib/patientClassification.ts`.

### 11. Estrutura de Arquivos Recomendada
```
src/
  constants/
    priorityGroups.ts      # PRIORITY_GROUPS, regex, cores
    regionalData.ts         # UNIDADES_EQUIPES, MICROAREAS
    followUpOptions.ts      # buildSelectFilter, aliases
  lib/
    pocketbase.ts           # Instância PB, autoCancellation
    normalizeText.ts        # Normalização de acentos (único)
    patientClassification.ts # hasValue, getStatus, etc.
    cache.ts                # getCache, setCache com TTL
  hooks/
    useDebounce.ts          # Debounce genérico
    useFilteredCounts.ts    # Query leve para filteredGroupCounts
  screens/
    DashboardScreen.tsx     # Cartões, gráficos, filtros
    PacientesScreen.tsx     # Tabela nominal, filtros avançados
```

### 12. Checklist de QA para Sincronização
Antes de entregar, verificar:
- [ ] Card count === PacientesScreen totalItems (mesmos filtros)
- [ ] "Sem Busca" count + "Com Busca" count === card total
- [ ] Nenhum flash de dados errados (skeleton → dados corretos)
- [ ] Cache expirado não exibe dados antigos
- [ ] Race conditions testadas (clique rápido entre filtros)
- [ ] Todas as regex de grupo idênticas em todos os arquivos
- [ ] `normalizeText()` é única (não duplicada)
- [ ] Queries com muitos IDs não causam timeout
```

---

*Relatório gerado automaticamente via auditoria de código — 06/07/2026*
