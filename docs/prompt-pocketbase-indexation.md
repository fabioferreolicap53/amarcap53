# Prompt Detalhado: Indexação PocketBase para Performance de Filtros Frontend

> **Projeto:** amarcap53 — Sistema de Acompanhamento da Mulher (CAP 53)
> **Stack:** React + TypeScript + Tailwind CSS + PocketBase (v0.39.4) + Cloudflare Pages
> **Data:** 2026-06-22

---

## 1. Contexto do Problema

O sistema possui ~130.000 registros na coleção `amarcap53_pacientes`. Filtros server-side no PocketBase (via query params `filter`) estavam demorando significativamente para retornar resultados, causando experiência ruim no frontend ao navegar entre dashboards e listas filtradas.

---

## 2. Mapeamento Completo de Filtros Utilizados no Frontend

### 2.1 Filtros por Campo Individual (pacientes)

| Campo | Tipo | Operador(s) PocketBase | Uso no Frontend | Índice Aplicável |
|-------|------|----------------------|-----------------|------------------|
| `nome` | text | `~` (busca parcial LIKE) | Busca por nome | `idx_pac_nome` |
| `cns` | text | `~` (busca parcial LIKE) | Busca por CNS | `idx_pac_cns` |
| `unidade` | text | `~` (match parcial), `=` (igualdade) | Filtro por unidade | `idx_pac_unidade` |
| `equipe` | text | `~` (match parcial), `=` (igualdade) | Filtro por equipe | `idx_pac_unidade_equipe` |
| `microarea` | number | `=` (igualdade) | Filtro por microárea | `idx_pac_unidade_equipe_micro` |
| `grupo` | text | `=` (igualdade), `LIKE` | Filtro por grupo | `idx_pac_grupo` |
| `data_nascimento` | text | range `>=` / `<=` | Filtro por idade | Sem índice específico |
| `dna_hpv_pep` | text | `!= ""` / `= ""` | Status de rastreamento | `idx_rastreamento` |
| `dna_hpv_gal` | text | `!= ""` / `= ""` | Status de rastreamento | `idx_rastreamento` |
| `cito_pep` | text | `!= ""` / `= ""` | Status de rastreamento | `idx_rastreamento` |
| `cito_lab` | text | `!= ""` / `= ""` | Status de rastreamento | `idx_rastreamento` |

### 2.2 Filtros por Relação (acompanhamentos)

| Campo Relacionado | Coleção | Operador | Uso | Índice Aplicável |
|-------------------|---------|----------|-----|------------------|
| `paciente` | `amarcap53_acompanhamentos` | `=` (igualdade por ID) | Contagem de acompanhamentos por paciente | `idx_acomp_paciente` |
| `situacao_pos_busca` | `amarcap53_acompanhamentos` | `=` (igualdade) | Filtro de status de busca | Sem índice específico |
| `data_busca` | `amarcap53_acompanhamentos` | range | Busca por período | Sem índice específico |

### 2.3 Filtros Compostos (múltiplos campos simultaneamente)

| Composição | Índice Ideal |
|-----------|--------------|
| `unidade` + `equipe` + `microarea` + `dna_hpv_pep` + `dna_hpv_gal` + `cito_pep` + `cito_lab` | `idx_composto_regional_status` |

---

## 3. Índices Criados (PocketBase Admin)

### 3.1 Coleção `amarcap53_pacientes`

```sql
-- Busca por nome
CREATE INDEX `idx_pac_nome` ON `amarcap53_pacientes` (`nome`);

-- Busca por CNS
CREATE INDEX `idx_pac_cns` ON `amarcap53_pacientes` (`cns`);

-- Filtro por unidade
CREATE INDEX `idx_pac_unidade` ON `amarcap53_pacientes` (`unidade`);

-- Filtro por unidade + equipe
CREATE INDEX `idx_pac_unidade_equipe` ON `amarcap53_pacientes` (`unidade`, `equipe`);

-- Filtro por unidade + equipe + microárea
CREATE INDEX `idx_pac_unidade_equipe_micro` ON `amarcap53_pacientes` (`unidade`, `equipe`, `microarea`);

-- Filtro por grupo
CREATE INDEX `idx_pac_grupo` ON `amarcap53_pacientes` (`grupo`);

-- Status de rastreamento (4 campos de data)
CREATE INDEX `idx_rastreamento` ON `amarcap53_pacientes` (`dna_hpv_pep`, `dna_hpv_gal`, `cito_pep`, `cito_lab`);

-- Composto: regional + status
CREATE INDEX `idx_composto_regional_status` ON `amarcap53_pacientes` (`unidade`, `equipe`, `dna_hpv_pep`, `dna_hpv_gal`, `cito_pep`, `cito_lab`);
```

### 3.2 Coleção `amarcap53_acompanhamentos`

```sql
-- Lookup de acompanhamentos por paciente
CREATE INDEX `idx_acomp_paciente` ON `amarcap53_acompanhamentos` (`paciente`);
```

---

## 4. Métodos de Criação de Índices

### Método A — PocketBase Admin UI (Recomendado para Primeira Vez)

1. Acesse `https://<dominio>/_/`
2. Menu lateral → **Collections** → selecione a coleção
3. Role para baixo → aba **Indexes**
4. Clique **New Index** para cada índice
5. Preencha nome e campos
6. Clique **Save**

**Observação:** O PocketBase v0.39.4 armazena índices como strings SQL. O formato exato é:
```sql
CREATE INDEX `nome_indice` ON `nome_colecao` (`campo1`, `campo2`)
```

### Método B — Script API (Para Criação Programática)

Criar arquivo `scripts/create-indexes.js`:

```javascript
#!/usr/bin/env node
import PocketBase from 'pocketbase';

const PB_URL = 'https://<dominio>';
const COLLECTION = 'nome_colecao';

async function main() {
  const email = process.argv[2];
  const password = process.argv[3];
  if (!email || !password) {
    console.error('Uso: node scripts/create-indexes.js <email> <senha>');
    process.exit(1);
  }

  const pb = new PocketBase(PB_URL);
  await pb.collection('_superusers').authWithPassword(email, password);
  const token = pb.authStore.token;

  async function ensureIndex(collectionName, indexSql, checkStr) {
    const col = await pb.collections.getOne(collectionName);
    const existing = col.indexes || [];
    const exists = existing.some(i => typeof i === 'string' && i.includes(checkStr));
    if (exists) {
      console.log(`  ✓ ${checkStr} já existe`);
      return;
    }
    console.log(`  + Criando ${checkStr}...`);
    const resp = await fetch(`${PB_URL}/api/collections/${collectionName}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': token },
      body: JSON.stringify({ indexes: [...existing, indexSql] }),
    });
    const r = await resp.json();
    if (!resp.ok) { console.error(`  ✗ Erro: ${r.message}`); } else { console.log(`  ✓ Criado`); }
  }

  await ensureIndex(COLLECTION,
    "CREATE INDEX `idx_nome` ON `nome_colecao` (`nome`)", 'nome');

  // Adicionar mais índices...
}

main().catch(err => { console.error('Erro:', err?.message || err); process.exit(1); });
```

Executar:
```bash
node scripts/create-indexes.js "email@dominio.com" "senha"
```

### Método C — Migration PocketBase

Criar arquivo em `pb_migrations/<timestamp>_create_indexes.js`:

```javascript
export async function up(pb) {
  const collection = await pb.collections.getOne('nome_colecao');
  const existingIndexes = collection.indexes || [];

  const newIndexes = [
    "CREATE INDEX `idx_nome` ON `nome_colecao` (`nome`)",
    // mais índices...
  ];

  // Verificar quais já existem
  const toAdd = newIndexes.filter(sql =>
    !existingIndexes.some(existing =>
      typeof existing === 'string' && existing.includes(sql.split('`')[1])
    )
  );

  if (toAdd.length > 0) {
    await pb.collections.update('nome_colecao', {
      indexes: [...existingIndexes, ...toAdd],
    });
    console.log(`[migration] ${toAdd.length} indexes created`);
  }
}
```

Executar:
```bash
./pocketbase migrate up
```

---

## 5. O que Funcionou Bem

### 5.1 Filtros Server-Side
```typescript
// PocketBase aceita filtros complexos via query params
const options = { filter: 'dna_hpv_pep != "" && dna_hpv_gal = ""' };
const result = await pb.collection('amarcap53_pacientes').getList(page, perPage, options);
```
- Filtros exatos (`=`, `!= ""`) se beneficiam diretamente dos índices
- Query `LIKE` parcial (`~`) é lenta mesmo com índice (SQLite limitation)
- Composição de filtros com `&&` e `||` funciona nativamente

### 5.2 Contagem de Registros Relacionados
```typescript
// Buscar IDs únicos de acompanhamentos, depois filtrar por eles
const acompRecords = await pb.collection('amarcap53_acompanhamentos').getFullList({
  filter: '(paciente = "id1" || paciente = "id2" || ...)',
  fields: 'id,paciente',
});
const countMap = new Map();
acompRecords.forEach(r => countMap.set(r.paciente, (countMap.get(r.paciente) || 0) + 1));
```
- Índice `idx_acomp_paciente` torna essa query rápida
- Usar `fields` para limitar retorno apenas aos campos necessários

### 5.3 Navegação entre Telas com Filtro via localStorage
```typescript
// DashboardScreen.tsx — ao clicar card
localStorage.setItem('dashboard:pendingFilter', JSON.stringify({ filterStatus: [card.key] }));
setActiveTab('pacientes');

// PatientsScreen.tsx — no mount
const [filterStatus, setFilterStatus] = useState([]);
useEffect(() => {
  const raw = localStorage.getItem('dashboard:pendingFilter');
  if (raw) {
    const data = JSON.parse(raw);
    if (data?.filterStatus) setFilterStatus(data.filterStatus);
    localStorage.removeItem('dashboard:pendingFilter');
  }
}, []);
```
- Funciona porque `localStorage` persiste entre renders
- `useState` com `useEffect` é mais seguro que lazy initializer (evita race condition com HMR)

### 5.4 Queries Paralelas
```typescript
// Buscar pacientes + acompanhamentos ao mesmo tempo
const [resultList, acompResults] = await Promise.all([
  pb.collection('amarcap53_pacientes').getList(page, perPage, options),
  pb.collection('amarcap53_acompanhamentos').getFullList({ filter: ... }),
]);
```
- Reduz latência significativamente
- Usar `.catch()` em queries secundárias para não bloquear a principal

---

## 6. O que NÃO Funcionou / Cuidados

### 6.1 `getFullList` vs `getList` — Retorno Diferente
```typescript
// ❌ CUIDADO: getFullList retorna array direto
const records = await pb.collection('amarcap53_pacientes').getFullList(options);
// records = [{...}, {...}]  ← ARRAY DIRETO

// ✅ getList retorna objeto com .items
const result = await pb.collection('amarcap53_pacientes').getList(page, perPage, options);
// result = { items: [...], totalItems: 129475, ... }

// ❌ ERRO COMUM: acessar .items em getFullList
acompCounts.items.forEach(...)  // TypeError: Cannot read 'items' of undefined

// ✅ CORRETO: getFullList já é array
acompRecords.forEach(r => ...)  // Funciona diretamente
```

**Regra:** `getFullList` → array direto. `getList` → objeto `{ items, totalItems, ... }`.

### 6.2 Filtro vazio Causa Erro 400
```typescript
// ❌ PocketBase rejeita filtro vazio
const options = { filter: '' };  // ← ERRO 400

// ✅ Usar undefined quando não há filtro
const options = { filter: filterParts.length > 0 ? filterStr : undefined };
```

### 6.3 `LIKE` Parcial Não Usa Índice (SQLite)
```typescript
// Filtro com ~ faz SCAN completo (SQLite limitation)
filter: `nome ~ "FABIO"`  // ← LENTO com 130K registros

// Alternativa: usar prefixo (usa índice)
filter: `nome ~ "FABIO*"`  // ← Mais rápido (usa idx_pac_nome)

// Melhor: busca server-side com paginação + cache client-side
```

### 6.4 Race Condition na Navegação entre Telas
```typescript
// ❌ CustomEvent perde-se se PatientsScreen ainda não montou
window.dispatchEvent(new CustomEvent('dashboard:navigate', { detail: {...} }));
setActiveTab('pacientes');  // PatientsScreen pode não estar montado ainda

// ✅ localStorage persiste entre renders — mais confiável
localStorage.setItem('dashboard:pendingFilter', JSON.stringify({...}));
setActiveTab('pacientes');
```

### 6.5 `removeChild` Error (React DOM)
```typescript
// Erro: NotFoundError: Failed to execute 'removeChild' on 'Node'
// Causa: React tenta desmontar componente enquanto animações CSS rodam

// ✅ CORREÇÃO: adicionar key único a cada screen
{activeTab === 'resumo' && <DashboardScreen key="resumo" ... />}
{activeTab === 'pacientes' && <PatientsScreen key="pacientes" ... />}
```

### 6.6 Porta Ocupada no Desenvolvimento
```json
// ❌ package.json com --strictPort trava se porta ocupada
"dev": "vite --port=3000 --host=0.0.0.0 --strictPort"

// ✅ Remover --strictPort, usar vite.config.ts
// vite.config.ts
server: { strictPort: false }
```

### 6.7 `package-lock.json` Dessincronizado no Deploy
```bash
# Cloudflare Pages: npm ci falha se lock file não bate com node_modules
# ✅ CORREÇÃO:
rm package-lock.json
npm install
git add package-lock.json && git commit && git push
```

---

## 7. Checklist de Implementação (Para Novos Projetos)

### Fase 1 — Análise
- [ ] Mapear TODOS os campos usados em filtros server-side no frontend
- [ ] Identificar campos usados em queries `LIKE` vs queries exatas
- [ ] Listar relações entre coleções (campos que referenciam IDs de outras coleções)
- [ ] Contar volume de registros por coleção

### Fase 2 — Criação de Índices
- [ ] Criar índices para campos com filtros exatos (`=`, `!= ""`)
- [ ] Criar índices compostos para combinações frequentes de filtros
- [ ] Criar índices em campos de relação (FK entre coleções)
- [ ] Não criar índices para campos com apenas `LIKE` parcial (ineficaz no SQLite)
- [ ] Verificar formato SQL correto: `` CREATE INDEX `nome` ON `colecao` (`campo`) ``

### Fase 3 — Frontend (React/TypeScript)
- [ ] Usar `fields` em queries PocketBase para limitar retorno
- [ ] Usar `getFullList` com `batch: 500` para listas grandes
- [ ] Usar `getList` com paginação para listas com muitos registros
- [ ] Proteger filtros contra string vazia (`filter: str || undefined`)
- [ ] Usar `Promise.all` para queries independentes
- [ ] Usar `.catch()` em queries secundárias
- [ ] Usar `requestKey: null` para evitar conflitos de cache interno do PocketBase
- [ ] Usar `localStorage` para navegação entre telas com filtros
- [ ] Adicionar `key` único a cada screen para evitar `removeChild` error

### Fase 4 — Deploy
- [ ] Manter `package-lock.json` sincronizado
- [ ] Usar `strictPort: false` no `vite.config.ts`
- [ ] Verificar build local antes de push

---

## 8. Script Completo de Criação de Índices

```javascript
#!/usr/bin/env node
/**
 * Script de criação de índices PocketBase via API.
 * Uso: node create-indexes.js <email> <senha>
 *
 * Adapte as definições abaixo para sua coleção.
 */
import PocketBase from 'pocketbase';

const PB_URL = 'https://seu-dominio.com';

const INDEXES = {
  'nome_colecao': [
    { name: 'idx_nome', sql: "CREATE INDEX `idx_nome` ON `nome_colecao` (`nome`)", check: 'nome' },
    { name: 'idx_status', sql: "CREATE INDEX `idx_status` ON `nome_colecao` (`status`)", check: 'status' },
    { name: 'idx_composto', sql: "CREATE INDEX `idx_composto` ON `nome_colecao` (`campo1`, `campo2`)", check: 'campo1' },
  ],
  'colecao_relacao': [
    { name: 'idx_fk', sql: "CREATE INDEX `idx_fk` ON `colecao_relacao` (`fk_campo`)", check: 'fk_campo' },
  ],
};

async function main() {
  const [email, password] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Uso: node create-indexes.js <email> <senha>');
    process.exit(1);
  }

  const pb = new PocketBase(PB_URL);
  await pb.collection('_superusers').authWithPassword(email, password);
  const token = pb.authStore.token;

  for (const [collection, indexes] of Object.entries(INDEXES)) {
    console.log(`\n--- ${collection} ---`);
    const col = await pb.collections.getOne(collection);
    const existing = col.indexes || [];

    for (const idx of indexes) {
      const exists = existing.some(i => typeof i === 'string' && i.includes(idx.check));
      if (exists) {
        console.log(`  ✓ ${idx.name} já existe`);
        continue;
      }
      console.log(`  + Criando ${idx.name}...`);
      const resp = await fetch(`${PB_URL}/api/collections/${collection}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': token },
        body: JSON.stringify({ indexes: [...existing, idx.sql] }),
      });
      const r = await resp.json();
      if (!resp.ok) {
        console.error(`  ✗ Erro: ${r.message}`);
      } else {
        console.log(`  ✓ Criado com sucesso`);
        // Atualizar referência local para próximo índice
        existing.push(idx.sql);
      }
    }
  }

  console.log('\nConcluído.');
}

main().catch(err => { console.error('Erro:', err?.message || err); process.exit(1); });
```

---

## 9. Referências Rápidas

| Necessidade | Solução |
|-------------|---------|
| Filtro exato rápido | Criar índice no campo |
| Busca parcial (`~`) | Índice ajuda apenas com prefixo (`termo*`) |
| Contagem por relação | Buscar IDs com `getFullList`, contar client-side |
| Navegação com filtro | `localStorage.setItem` + `useEffect` no mount |
| Query grande sem filtro | Usar `getFullList` com `batch: 500` e `fields` limitado |
| Query paginada | Usar `getList(page, perPage, options)` |
| Erro 400 no filtro | Verificar `filter: str \|\| undefined` |
| Erro `removeChild` React | Adicionar `key` único ao componente |
| Erro porta ocupada | `strictPort: false` no vite.config.ts |
| Deploy Cloudflare falha | Regenerar `package-lock.json` |
