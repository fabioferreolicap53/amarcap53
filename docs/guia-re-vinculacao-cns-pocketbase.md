# Guia: Re-vinculação por CNS no PocketBase

## Contexto

Quando o banco de dados de pacientes é excluído e reimportado (mesmos pacientes), os IDs do PocketBase mudam. Registros de acompanhamentos ficam órfãos (campo `paciente` vazio). Solução: usar campo `cns` (estável) para restaurar vínculo.

---

## O que NÃO funcionou

### 1. SQL direto via `$app.db().newQuery()` no JSVM

**Erro:** `TypeError: Object has no member 'dao'` / `400 Bad Request` / Panic no servidor

```javascript
// NÃO FUNCIONA no PocketBase JSVM:
$app.db().newQuery(
  "UPDATE amarcap53_acompanhamentos SET paciente = " +
  "(SELECT id FROM amarcap53_pacientes WHERE cns = amarcap53_acompanhamentos.cns LIMIT 1)"
).execute();
```

**Motivo:** O JSVM do PocketBase (Goja engine) não expõe `$app.db()` da mesma forma que o Go. A interface de queries SQL é limitada e inconsistente entre versões (v0.22+). Subqueries no `SET` causam panic ou erro 400.

### 2. `$app.findRecordsByFilter()` no JSVM

**Erro:** `panic` fatal no servidor → PocketBase morre → 502 Bad Request

```javascript
// NÃO FUNCIONA — gera panic no Goja:
var rows = $app.findRecordsByFilter('amarcap53_pacientes', 'cns != ""', '-created', 5000, 0);
```

**Motivo:** Função não existe ou tem assinatura diferente no JSVM. O Goja engine do PocketBase não suporta a mesma API de `dao.FindRecordsByFilter` do Go.

### 3. Rotas customizadas com `$apis.requireAdminOrRecordAuth()`

**Erro:** `TypeError: Object has no member 'requireAdminOrRecordAuth'`

```javascript
// NÃO FUNCIONA em todas as versões:
routerAdd('POST', '/api/custom/fix-relink', handler, $apis.requireAdminOrRecordAuth());
```

**Motivo:** `$apis` não está disponível no scope global do Goja em versões antigas do PocketBase.

### 4. Hooks `onRecordBeforeDeleteRequest` / `onRecordBeforeDelete`

**Erro:** `ReferenceError: onRecordBeforeDelete is not defined`

```javascript
// NÃO FUNCIONA:
onRecordBeforeDelete(function(e) { ... }, 'amarcap53_pacientes');
```

**Motivo:** Nome do evento varia entre versões. Não há garantia de que o hook exista.

### 5. Conflito de rotas em `pb_hooks/`

**Erro:** `panic: pattern conflicts` → PocketBase não inicia

**Motivo:** Múltiplos arquivos `.pb.js` na pasta `pb_hooks` registrando a mesma rota (ex: `/api/custom/fix-relink-cns`). O PocketBase carrega todos os arquivos `.pb.js` na pasta.

**Solução parcial:** Usar prefixo de rota único (ex: `/api/amar/`) para evitar conflito com outros sistemas no mesmo servidor.

### 6. INSERT via SQL no JSVM

**Erro:** Registros criados não aparecem na API

```javascript
// NÃO FUNCIONA:
$db.newQuery("INSERT INTO amarcap53_pacientes (id, cns, nome) VALUES ('abc', '123', 'Fulano')").execute();
```

**Motivo:** O PocketBase mantém campos internos (`created`, `updated`, `collectionId`, etc.) que não são preenchidos pelo INSERT SQL direto. Registros ficam invisíveis para a API REST.

---

## O que FUNCIONOU (100%)

### Solução: 100% Frontend via SDK oficial do PocketBase

**Arquivo:** `SettingsScreen.tsx`

```typescript
const handleManualRelink = async () => {
  if (!window.confirm('Deseja executar a re-vinculação manual dos acompanhamentos por CNS?')) return;
  
  // 1. Busca todos os pacientes com CNS
  const pacientes = await pb.collection('amarcap53_pacientes').getFullList({
    filter: 'cns != ""',
    fields: 'id,cns'
  });
  
  // 2. Mapeia CNS -> ID
  const cnsMap: Record<string, string> = {};
  pacientes.forEach(p => {
    if (p.cns) cnsMap[String(p.cns).trim()] = p.id;
  });
  
  // 3. Busca acompanhamentos com CNS
  const acompanhamentos = await pb.collection('amarcap53_acompanhamentos').getFullList({
    filter: 'cns != ""',
    fields: 'id,cns,paciente'
  });
  
  let count = 0;
  
  // 4. Atualiza 1 a 1 via API padrão
  for (const a of acompanhamentos) {
    const aCns = String(a.cns || '').trim();
    const aPac = String(a.paciente || '').trim();
    const correctPacId = cnsMap[aCns];
    
    if (aCns && correctPacId && aPac !== correctPacId) {
      await pb.collection('amarcap53_acompanhamentos').update(a.id, {
        paciente: correctPacId
      });
      count++;
    }
  }

  alert(`Processo concluído: ${count} registros re-vinculados.`);
};
```

### Por que funcionou

| Aspecto | Detalhe |
|---------|---------|
| **SDK oficial** | Usa `pb.collection().getFullList()` e `pb.collection().update()` — API REST documentada e estável |
| **Zero SQL cru** | Não depende do JSVM do PocketBase para queries complexas |
| **Zero hooks** | Não depende de hooks que variam entre versões |
| **Zero conflito** | Não adiciona rotas no backend → sem conflito com outros `.pb.js` |
| **Processamento em JS** | Lógica de cruzamento CNS→ID feita em memória no frontend (JavaScript puro, sem limitações) |
| **Funciona em qualquer versão** | Usa apenas endpoints REST (`/api/collections/...`) que existem desde a v0.1+ |

---

## Fluxo Completo que Funcionou

```
1. Usuário clica "Re-vincular por CNS" (SettingsScreen.tsx)
   ↓
2. Frontend busca: GET /api/collections/amarcap53_pacientes/records?filter=cns!=""
   ↓
3. Frontend mapeia em memória: { "708500370253472": "h3amvywaw4vo89v" }
   ↓
4. Frontend busca: GET /api/collections/amarcap53_acompanhamentos/records?filter=cns!=""
   ↓
5. Para cada acompanhamento:
   - Compara cns do acompanhamento com o mapa
   - Se paciente_id diferente → PUT /api/collections/amarcap53_acompanhamentos/records/{id}
   ↓
6. Alert: "X registros re-vinculados"
```

---

## Pré-requisitos

1. Campo `cns` deve existir na coleção `amarcap53_acompanhamentos`
2. Ao criar acompanhamento, o campo `cns` deve ser preenchido com o CNS do paciente
3. CNS deve ser único e normalizado (remover espaços, caracteres especiais)

---

## Regra de Ouro

> **NUNCA usar SQL cru ou hooks JSVM no PocketBase para operações de dados complexas.**
> 
> Sempre usar o SDK/frontend com endpoints REST nativos. É mais lento (iteração 1 a 1), mas funciona em 100% das versões do PocketBase sem causar panics, erros 400, ou conflitos de rotas.
