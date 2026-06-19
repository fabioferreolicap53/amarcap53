# Relatório: Importação CSV + Deletar/Substituir — PocketBase v0.39.4

## Resumo

Sistema de upload de CSV para coleção PocketBase com opção de **deletar registros existentes** antes de importar. Tudo via SDK no frontend, sem endpoints customizados.

**Stack:** React + TypeScript + PocketBase JS SDK + PapaParse
**Status:** Funcional (testado em 19/06/2026 — upload + delete confirmados)

***

## 1. Arquitetura Final

```
CSV → PapaParse (parse no frontend) → limpeza/conversão → [OPCIONAL] Deletar antigos → SDK PocketBase.create() → Promise.allSettled
```

**O que NÃO usar:**

- Endpoint customizado em `pb_hooks` (Goja v0.39.4 tem bugs de hoisting)
- Batch API do PocketBase (`/api/batch`) — pode retornar 403
- `requestKey: null` em operações de delete (silencia erros sem logar)
- `Promise.allSettled` para deletes (silencia falhas silenciosamente)

**O que funciona:**

- Parse do CSV 100% no frontend com PapaParse
- Delete sequencial 1 por 1 (estável, com logs de erro)
- Envio via `pb.collection().create()` com `Promise.allSettled`

***

## 2. Dependências

```bash
npm install papaparse pocketbase
npm install -D @types/papaparse
```

***

## 3. Código Base Reutilizável

### 3.1 Conversão de Datas

```typescript
const convertDateToISO = (value: string): string => {
  if (!value || value === '--' || value.trim() === '') return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
  const parts = value.split('/');
  if (parts.length === 3) {
    let [d, m, y] = parts;
    if (y.length === 2) y = '20' + y;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return value;
};
```

### 3.2 Parse do CSV com PapaParse

```typescript
const parsed = Papa.parse(csvText, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h: string) => h.replace(/,+$/, '').trim(),
});
const allRecords = parsed.data.filter((r: any) => r.nome && r.nome.trim());
```

### 3.3 Limpeza dos Records

```typescript
const DATE_FIELDS = ['data_nascimento', 'cito_lab', 'cito_pep', 'dna_hpv_gal'];

const cleanedRecords = allRecords.map((r: any) => {
  const record: Record<string, any> = {};
  for (const key in r) {
    if (r.hasOwnProperty(key) && key) record[key] = r[key];
  }
  DATE_FIELDS.forEach(f => {
    if (record[f]) record[f] = convertDateToISO(record[f]);
  });
  if (record.cns) record.cns = String(record.cns).replace(/\D/g, '').padStart(15, '0').slice(-15);
  if (record.idade) record.idade = parseInt(record.idade, 10) || 0;
  if (record.microarea !== undefined && record.microarea !== '') {
    record.microarea = parseInt(record.microarea, 10) || 0;
  }
  return record;
});
```

### 3.4 Deletar Registros Existentes (OPCIONAL)

**Otimizado:** Deletar em paralelo, lotes de 50, página de 200. Rápido e com logs de falha.

```typescript
if (shouldReplace) {
  let page = 1;
  let totalDeleted = 0;
  let totalFailed = 0;

  while (true) {
    const pageResult = await pb.collection('SUA_COLECAO').getList(page, 200);
    if (pageResult.items.length === 0) break;

    const ids = pageResult.items.map(r => r.id);

    // Deleta em paralelo, lotes de 50
    for (let di = 0; di < ids.length; di += 50) {
      const chunk = ids.slice(di, di + 50);
      const results = await Promise.allSettled(
        chunk.map(id => pb.collection('SUA_COLECAO').delete(id))
      );
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') totalDeleted++;
        else {
          totalFailed++;
          console.warn(`Falha delete ${chunk[idx]}:`, r.reason?.message || r.reason);
        }
      });
    }

    if (pageResult.items.length < 200) break;
    page++;
  }

  console.log(`Deletados ${totalDeleted} registros antigos (${totalFailed} falhas)`);
  if (totalDeleted > 0) await new Promise(r => setTimeout(r, 300));
}
```

**Por que sequencial e não paralelo?**

- `Promise.allSettled` silencia erros (retorna `rejected` mas não para)
- `requestKey: null` impede o SDK de cancelar/retry, mascarando falhas
- Deletar 1 por 1 com `try/catch` dá visibilidade completa dos erros

### 3.5 Envio em Lotes

```typescript
const BATCH_SIZE = 500;
const chunks: any[][] = [];
for (let i = 0; i < cleanedRecords.length; i += BATCH_SIZE) {
  chunks.push(cleanedRecords.slice(i, i + BATCH_SIZE));
}

let totalSuccess = 0;
let totalErrors = 0;

for (let i = 0; i < chunks.length; i++) {
  const promises = chunks[i].map((rec) =>
    pb.collection('SUA_COLECAO').create(rec, { requestKey: null })
  );

  const results = await Promise.allSettled(promises);
  results.forEach((r) => {
    if (r.status === 'fulfilled') totalSuccess++;
    else {
      totalErrors++;
      if (totalErrors <= 3) console.warn(`Lote ${i + 1}:`, r.reason?.message || r.reason);
    }
  });
}
```

***

## 4. Erros Encontrados e Soluções

| Erro                                   | Causa                                                      | Solução                                                 |
| -------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| `parseCSV is not defined`              | Goja v0.39.4 não hoista `function` declarations            | Não usar endpoints customizados em pb\_hooks            |
| `handleLegacyBody is not defined`      | Mesmo problema de hoisting                                 | Usar SDK direto no frontend                             |
| `Batch requests are not allowed` (403) | `/api/batch` desabilitado                                  | Usar `Promise.allSettled` com `create()`                |
| Header CSV com trailing comma          | Excel salva coluna vazia no final                          | `transformHeader: (h) => h.replace(/,+$/, '').trim()`   |
| Records com chaves vazias              | PapaParse gera `""` para colunas ausentes                  | `for (const key in r) if (key) record[key] = r[key]`    |
| Datas `DD/MM/YYYY` rejeitadas          | PocketBase espera `YYYY-MM-DD`                             | `convertDateToISO()` antes do envio                     |
| Delete não funciona (sem erro)         | `requestKey: null` + `Promise.allSettled` silenciam falhas | Deletar sequencialmente 1 por 1 SEM `requestKey: null`  |
| Delete não funciona (sem erro 2)       | `getList` com `fields: 'id'` pode retornar vazio           | Usar `getList` sem `fields` (retorna registro completo) |

***

## 5. Regras Críticas do PocketBase v0.39.4

### Para CREATE (inserir):

- `pb.collection('x').create(rec, { requestKey: null })` — funciona
- `Promise.allSettled` — funciona (erros individuais não param o processo)

### Para DELETE (remover):

- `pb.collection('x').delete(id)` — funciona (SEM `requestKey: null`)
- Deletar **sequencialmente** 1 por 1 — funciona
- `Promise.allSettled` para deletes — **NÃO usar** (silencia erros)
- `requestKey: null` em deletes — **NÃO usar** (silencia erros)

### Para LIST (buscar):

- `pb.collection('x').getList(page, perPage)` — funciona
- `getList(page, 500, { fields: 'id' })` — pode falhar silenciosamente

### NÃO usar:

- `pb.send('/api/batch', ...)` — retorna 403
- Endpoints customizados em pb\_hooks (Goja bugado)
- `function nome() {}` em pb\_hooks — não é hoistada

***

## 6. Fluxo Completo

```
1. Usuário clica "Importar CSV"
2. Seleciona arquivo
3. PapaParse faz parse (transformHeader limpa headers)
4. Preview: primeiros 5 registros + total
5. Usuário escolhe: substituir existentes (toggle) ou adicionar
6. Se "Substituir": deleta 1 por 1 sequencialmente (logs no console)
7. Envio: chunks de 500 → Promise.allSettled → progress bar
8. Resultado: X inseridos, Y erros
```

***

## 7. Checklist para Próximos Aplicativos

- [ ] `papaparse` + `@types/papaparse` instalados
- [ ] Parse com `transformHeader` para limpar trailing commas
- [ ] Records filtrados para remover chaves vazias (`for...in` + `if (key)`)
- [ ] Datas convertidas para ISO antes do envio
- [ ] Chunking com `BATCH_SIZE = 500`
- [ ] Envio via `Promise.allSettled` com `create()` (NÃO batch API)
- [ ] `requestKey: null` em `create()` (evita auto-cancel do SDK)
- [ ] Delete sequencial 1 por 1 SEM `requestKey: null` e SEM `Promise.allSettled`
- [ ] Logs no console para debug (`console.warn` para erros individuais)
- [ ] Pausa de 300ms entre delete e inserção
- [ ] Progress bar mostrando lote atual / total

***

## 8. Arquivos de Referência

- `src/screens/SettingsScreen.tsx` — Upload via drag-and-drop (Página Configurações)
- `src/screens/PatientsScreen.tsx` — Upload via modal (Página Pacientes)
- `src/lib/pocketbase.ts` — Instância do SDK

***

## 9. Padrões de Código para Copiar

### Toggle "Substituir existentes" (JSX)

```tsx
<label className="flex items-center gap-3 cursor-pointer select-none">
  <div className="relative">
    <input
      type="checkbox"
      checked={replaceExisting}
      onChange={(e) => setReplaceExisting(e.target.checked)}
      disabled={isUploading}
      className="sr-only peer"
    />
    <div className="w-10 h-6 bg-slate-200 rounded-full peer-checked:bg-red-500 transition-colors shadow-inner"></div>
    <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform peer-checked:translate-x-4"></div>
  </div>
  <span className="text-xs font-bold text-slate-600">Substituir existentes</span>
  {replaceExisting && (
    <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded text-[10px] font-bold">
      Dados atuais serão deletados
    </span>
  )}
</label>
```

### State do toggle

```typescript
const [replaceExisting, setReplaceExisting] = useState(false);
```

