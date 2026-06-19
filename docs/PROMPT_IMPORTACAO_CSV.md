# Prompt: Importação CSV para PocketBase v0.39.4

Cole este prompt ao AI assistant ao criar funcionalidade de importação CSV.

---

## O Prompt

```
Implemente upload de CSV para coleção PocketBase com chunking de 500 registros.

## Stack obrigatória
- React + TypeScript
- PocketBase JS SDK (`pocketbase`)
- PapaParse (`papaparse` + `@types/papaparse`)

## Regras CRÍTICas do PocketBase v0.39.4 (testadas e validadas)

### O QUE FUNCIONA:
- `pb.collection('X').create(rec, { requestKey: null })` — INSERT
- `pb.collection('X').delete(id)` — DELETE (SEM requestKey: null)
- `pb.collection('X').getList(page, perPage)` — LIST
- `Promise.allSettled` para creates (erros individuais não param o processo)

### O QUE NÃO FUNCIONA (NÃO USE):
- `pb.send('/api/batch', ...)` — retorna 403 (desabilitado)
- Endpoints customizados em `pb_hooks/*.pb.js` — Goja v0.39.4 tem bug de hoisting (funções declaradas com `function nome(){}` não são hoistadas para dentro de `routerAdd`)
- `requestKey: null` em operações de DELETE — silencia erros silenciosamente
- `Promise.allSettled` para DELETE — silencia falhas sem logar

## Código obrigatório para usar (copiar e colar)

### 1. Conversão de datas (DD/MM/YYYY → YYYY-MM-DD)
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

### 2. Parse do CSV (limpa trailing commas do Excel)
```typescript
const parsed = Papa.parse(csvText, {
  header: true,
  skipEmptyLines: true,
  transformHeader: (h: string) => h.replace(/,+$/, '').trim(),
});
const allRecords = parsed.data.filter((r: any) => r.nome && r.nome.trim());
```

### 3. Limpeza dos records (remove chaves vazias do PapaParse)
```typescript
const cleanedRecords = allRecords.map((r: any) => {
  const record: Record<string, any> = {};
  for (const key in r) {
    if (r.hasOwnProperty(key) && key) record[key] = r[key];
  }
  // Converter datas
  DATE_FIELDS.forEach(f => { if (record[f]) record[f] = convertDateToISO(record[f]); });
  // Limpar CNS
  if (record.cns) record.cns = String(record.cns).replace(/\D/g, '').padStart(15, '0').slice(-15);
  // Converter números
  if (record.idade) record.idade = parseInt(record.idade, 10) || 0;
  if (record.microarea !== undefined && record.microarea !== '') record.microarea = parseInt(record.microarea, 10) || 0;
  return record;
});
```

### 4. DELETE otimizado (paralelo, lotes de 50)
```typescript
if (shouldReplace) {
  let page = 1;
  let totalDeleted = 0;
  let totalFailed = 0;
  while (true) {
    const pageResult = await pb.collection('SUA_COLECAO').getList(page, 200);
    if (pageResult.items.length === 0) break;
    const ids = pageResult.items.map(r => r.id);
    for (let di = 0; di < ids.length; di += 50) {
      const chunk = ids.slice(di, di + 50);
      const results = await Promise.allSettled(
        chunk.map(id => pb.collection('SUA_COLECAO').delete(id))
      );
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') totalDeleted++;
        else { totalFailed++; console.warn(`Falha delete ${chunk[idx]}:`, r.reason?.message || r.reason); }
      });
    }
    if (pageResult.items.length < 200) break;
    page++;
  }
  console.log(`Deletados ${totalDeleted} registros (${totalFailed} falhas)`);
  if (totalDeleted > 0) await new Promise(r => setTimeout(r, 300));
}
```

### 5. INSERT em lotes de 500
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

### 6. Toggle "Substituir existentes" (JSX + state)
```typescript
const [replaceExisting, setReplaceExisting] = useState(false);
```
```tsx
<label className="flex items-center gap-3 cursor-pointer select-none">
  <div className="relative">
    <input type="checkbox" checked={replaceExisting}
      onChange={(e) => setReplaceExisting(e.target.checked)}
      disabled={isUploading} className="sr-only peer" />
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

## Fluxo completo
1. Usuário seleciona CSV
2. PapaParse faz parse (transformHeader limpa headers)
3. Preview: primeiros 5 registros + total
4. Usuário escolhe: substituir existentes ou adicionar
5. Se "Substituir": DELETE paralelo (lotes de 50, página de 200)
6. INSERT: chunks de 500 → Promise.allSettled
7. Progress bar mostrando lote atual / total
8. Resultado: X inseridos, Y erros

## UI obrigatória
- Botão "Importar CSV" (visível para admin/CAP)
- Modal com: seleção de arquivo, preview, toggle "Substituir existentes", barra de progresso, resultado
- Desabilitar toggle durante upload

## Erros conhecidos (NÃO repetir)
- Goja PB v0.39.4: `function nome(){}` não é hoistada → usar SDK frontend
- Batch API: 403 → usar Promise.allSettled
- `requestKey: null` em delete: silencia erros → não usar
- CSV Excel: trailing comma no header → transformHeader remove
- PapaParse: gera chaves vazias → filtrar com `for...in` + `if (key)`

## O que NÃO criar
- NÃO criar endpoints em pb_hooks
- NÃO usar /api/batch
- NÃO usar requestKey: null em deletes
- NÃO deletar sequencialmente 1 por 1 (lento demais)
```

---

## Como usar

1. Copie tudo entre as crases duplas acima
2. Cole no prompt do AI assistant
3. Substitua `SUA_COLECAO` pelo nome da coleção
4. Substitua `DATE_FIELDS` pelos campos de data da sua coleção
5. Adicione campos específicos na limpeza (CNS, idade, etc.)

## Exemplo de uso rápido

```
[Colar o prompt acima]

Minha coleção: "minha_colecao"
Campos: nome, cpf, data_nascimento, endereco, telefone
Campos de data: data_nascimento
```
