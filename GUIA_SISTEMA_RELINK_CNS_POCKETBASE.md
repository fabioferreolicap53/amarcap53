# Sistema de Re-vínculo (Relink) por CNS (PocketBase) — Guia de Reimplementação

> Documento de referência para **replicar em outros projetos** o sistema de
> **re-vínculo de registros por chave natural (CNS)** entre duas coleções do
> PocketBase (projeto AMAR — AMARCAP53).
>
> - Coleção **de origem/dono dos dados de identificação**: `amarcap53_pacientes`
> - Coleção **dos registros a identificar**: `amarcap53_acompanhamentos`
> - Chave natural: **CNS** (Cartão Nacional de Saúde, 15 dígitos)
>
> Descreve o problema, o conceito, a arquitetura, o código completo
> (backend + frontend), as estratégias de execução, os cuidados de segurança,
> o passo a passo de implementação e os testes.

---

## 1. Objetivo

Manter o vínculo correto entre um **registro de acompanhamento** e o **paciente**
a que ele pertence, **mesmo quando os IDs dos pacientes mudam** (ex.: após
reimportar/substituir a coleção de pacientes).

O relink:

- **Identifica** o paciente correto de cada acompanhamento **pelo CNS**;
- **Redefine** o campo de relação (`paciente` = ID) apontando para o registro certo;
- É **idempotente** — pode ser executado repetidas vezes sem efeito colateral;
- Pode ser executado **a qualquer momento** após a reimportação da base.

### Problema que motivou o sistema

Toda coleção PocketBase usa um **ID artificial** (15 caracteres) como chave
primária da relação:

- `amarcap53_acompanhamentos.paciente` → guarda o **ID** do registro em `amarcap53_pacientes`.

Esse ID é **volátil**: quando a coleção de pacientes é **excluída e reimportada**
(ver os guias de importação/exclusão), o PocketBase gera IDs **novos** para os
mesmos pacientes. Resultado:

- os acompanhamentos continuam guardando os **IDs antigos**, que não existem mais;
- a relação `paciente` fica **órfã** → a lista de acompanhamentos perde o nome/CNS
  do paciente, os filtros e as exportações quebram.

**Solução:** usar uma **chave natural estável** — o **CNS** — como ponte de
re-vínculo. O CNS está presente nos **dois** lados:

- `amarcap53_pacientes.cns` (o dado canônico);
- `amarcap53_acompanhamentos.cns` (uma **cópia** do CNS do paciente, mantida
  mesmo quando o ID muda).

Com isso, o relink copia de volta o ID correto para cada acompanhamento.

---

## 2. Conceito: chave artificial vs. chave natural

| Tipo | Exemplo | Estável? | Papel |
|---|---|---|---|
| **Chave artificial (surrogate)** | `id` do PocketBase (15 chars) | ❌ Muda ao recriar a base | Usada nas relações/joins |
| **Chave natural (business key)** | **CNS** (15 dígitos), CPF, matrícula | ✅ Estável entre reimportações | Usada para **re-identificar** o vínculo |

> ⚠️ **Regra de ouro:** ao substituir/recriar a coleção "dona" dos dados, **sempre
> preserve a chave natural nos registros dependentes** (o CNS fica gravado no
> acompanhamento). Sem isso, o vínculo é irrecuperável — o ID antigo já não existe
> e não há como saber a quem o registro pertencia.

### Por que o CNS fica duplicado no acompanhamento?

Porque é a **âncora de recuperação**. Quando o ID muda, o CNS permanece
(copiado no momento em que o acompanhamento foi criado — ver item 5.1). Assim o
relink consegue remapear ID antigo → ID novo.

---

## 3. Arquitetura da Solução

O sistema de relink tem **três mecanismos complementares**:

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1) AUTO-CNS NO CREATE  (hook onRecordCreate em acompanhamentos)      │
│    Ao criar um acompanhamento, se 'cns' vier vazio, o hook preenche   │
│    automaticamente com pacientes.cns (do paciente vinculado).         │
│    → Garante que TODO acompanhamento novo já nasça com a chave natural│
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 2) BACKFILL DE CNS  (POST /api/amar/migrate-acompanhamento-cns)      │
│    Para acompanhamentos ANTIGOS/faltantes: copia pacientes.cns para   │
│    acompanhamentos.cns onde ainda estiver vazio.                      │
│    → Também roda automaticamente ANTES de delete/replace de pacientes │
└──────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 3) RELINK POR CNS  (POST /api/amar/fix-relink-cns)                   │
│    Redefine acompanhamentos.paciente = id do paciente cujo cns casa.  │
│    → Executado APÓS reimportar a base de pacientes. Idempotente.      │
└──────────────────────────────────────────────────────────────────────┘
```

### Fluxo completo (importação → relink)

```
pacientes (base antiga)  +  acompanhamentos (com CNS gravado)
        │
        │  mode=replace / delete-all  →  backup de CNS (mecanismo 2)  ✅
        ▼
pacientes apagados/zerados
        │
        │  reimportação do CSV  →  pacientes com IDs NOVOS            ✅
        ▼
acompanhamentos ainda apontam para IDs ANTIGOS (órfãos)
        │
        │  POST /api/amar/fix-relink-cns (mecanismo 3)
        ▼
acompanhamentos.paciente = ID NOVO correto (casado por CNS)           ✅
```

---

## 4. Pré-requisitos

| Item | Versão / Observação |
|---|---|
| PocketBase | **v0.40.4** (hooks JSVM baseados em goja) |
| Estrutura de hooks | pasta `pb_hooks/` na raiz do binário PocketBase |
| Arquivo de hooks | `pb_hooks/main.pb.js` (carregado no boot do PocketBase) |
| Frontend | React + TypeScript + Vite |
| SDK | `pocketbase` (JS SDK) — `pb.send`, `pb.collection().getFullList`, `.update` |
| Coleções | Uma "dona" (pacientes) com a chave natural, e uma "dependente" (acompanhamentos) com `paciente` (ID) + `cns` (chave natural) |

### Coleções e campos usados no AMAR (referência)

| Coleção | ID (exemplo real) | Campos relevantes |
|---|---|---|
| `amarcap53_pacientes` | `uvs7ykosz111bj6` | `id`, **`cns`**, `nome` |
| `amarcap53_acompanhamentos` | `nhgihg0719ibkb5` | `id`, **`paciente`** (relação → pacientes.id), **`cns`** (chave natural), `profissional`, `data_busca`, `tipo_busca`, `tipo_contato`, `situacao_pos_busca`, `data_do_agendamento`, `entraves_identificados`, `entraves_informado_por`, `observacoes` |

> **Regra de consistência de formato:** o CNS precisa estar no **mesmo formato** nos
> dois lados (idealmente **15 dígitos, só números, com zeros à esquerda**). Se um lado
> tiver máscara e o outro não, o `JOIN` por igualdade falha. Normalize **na escrita**:
> ```js
> cns = String(cns || '').replace(/\D/g, '').padStart(15, '0').slice(-15)
> ```

---

## 5. Backend — Hooks e Rotas (`pb_hooks/main.pb.js`)

### 5.1 Regra CRÍTICA do PocketBase v0.23+/v0.40: escopo isolado por handler

> Cada `routerAdd(...)`/`onRecord...(...)` é executado como um **programa separado**
> no pool de runtimes goja (ver `plugins/jsvm/jsvm.go`).
>
> **Consequência:** um handler **NÃO enxerga** funções/constantes declaradas no topo
> do arquivo. Se você usar um helper global, o PocketBase devolve um erro genérico
> (`ReferenceError: X is not defined` → resposta 400 "Something went wrong...").
>
> **Regra:** TODO helper/constante usado dentro de um handler deve ser declarado
> **dentro do próprio handler**.

### 5.2 Mecanismo 1 — Auto-CNS no create do acompanhamento

Garante que **todo acompanhamento novo já nasça com o CNS** (âncora de recuperação),
mesmo que o frontend não envie.

```js
var ACOMP_COLL = 'amarcap53_acompanhamentos'; // (variável de topo — usada como
                                              // argumento de registro do hook)

onRecordCreate(function(e) {
  try {
    var rec = e.record;
    var pacId = rec.get('paciente');
    var currentCns = rec.get('cns');

    // Se já tem CNS (enviado pelo frontend), não faz nada
    if (currentCns && String(currentCns).trim() !== '') {
      e.next();
      return;
    }

    // Senão, busca o paciente vinculado e copia o CNS dele
    if (pacId) {
      var pac = $app.findRecordById('amarcap53_pacientes', pacId);
      if (pac) {
        var cns = pac.get('cns');
        if (cns) rec.set('cns', cns);
      }
    }
  } catch (err) {
    console.error('[acompanhamento_cns] Hook error:', err);
  }
  e.next();
}, ACOMP_COLL);
```

> **Alternativa complementar (opcional):** manter o CNS sincronizado em **update** do
> acompanhamento (quando o usuário troca o paciente vinculado). Basta um
> `onRecordUpdate` com a mesma lógica.

### 5.3 Mecanismo 2 — Backfill de CNS (rota `migrate-acompanhamento-cns`)

Preenche `acompanhamentos.cns` a partir de `pacientes.cns` para registros **antigos**
que ainda não têm o CNS gravado.

```js
routerAdd('OPTIONS', '/api/amar/migrate-acompanhamento-cns', function(c) {
  c.response.header().set("Access-Control-Allow-Origin", "*");
  c.response.header().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.response.header().set("Access-Control-Allow-Headers", "*");
  return c.noContent(204);
});

routerAdd('POST', '/api/amar/migrate-acompanhamento-cns', function(c) {
  c.response.header().set("Access-Control-Allow-Origin", "*");
  c.response.header().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.response.header().set("Access-Control-Allow-Headers", "*");
  try {
    var db = $app.db();
    db.newQuery(
      "UPDATE amarcap53_acompanhamentos " +
      "SET cns = (SELECT cns FROM amarcap53_pacientes WHERE id = amarcap53_acompanhamentos.paciente) " +
      "WHERE (cns = '' OR cns IS NULL) " +
      "AND paciente IN (SELECT id FROM amarcap53_pacientes)"
    ).execute();
    return c.json(200, { success: true });
  } catch(err) {
    return c.json(500, { message: String(err) });
  }
});
```

**Leitura da query:** percorre os acompanhamentos **sem CNS** cujo `paciente` **ainda
existe**, e copia o CNS do paciente correspondente. É o "backup do vínculo" antes de
quebrar a relação.

### 5.4 Mecanismo 3 — Relink por CNS (rota `fix-relink-cns`)

O coração do sistema: redefine `paciente` para o **ID atual** do paciente cujo CNS casa.

```js
routerAdd('OPTIONS', '/api/amar/fix-relink-cns', function(c) {
  c.response.header().set("Access-Control-Allow-Origin", "*");
  c.response.header().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.response.header().set("Access-Control-Allow-Headers", "*");
  return c.noContent(204);
});

routerAdd('POST', '/api/amar/fix-relink-cns', function(c) {
  c.response.header().set("Access-Control-Allow-Origin", "*");
  c.response.header().set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  c.response.header().set("Access-Control-Allow-Headers", "*");
  var result = { ok: false, relinked: 0, scanned: 0, err: '' };
  try {
    var db = $app.db();

    // UPDATE direto (sem ler resultados). O paciente é redefinido pelo CNS.
    var queryStr = "UPDATE amarcap53_acompanhamentos " +
                   "SET paciente = (SELECT id FROM amarcap53_pacientes " +
                   "                WHERE amarcap53_pacientes.cns = amarcap53_acompanhamentos.cns LIMIT 1) " +
                   "WHERE cns != '' AND cns IS NOT NULL";

    db.newQuery(queryStr).execute();

    result.ok = true;
    result.relinked = 1;
    return c.json(200, result);
  } catch (err) {
    result.err = String(err);
    return c.json(400, result);
  }
});
```

**Leitura da query:** para cada acompanhamento que possui CNS, busca o paciente cujo
`cns` é **igual** e grava o `id` dele em `paciente`. É **idempotente**: rodar de novo
não muda o resultado (a linha já aponta para o ID certo e a subquery devolve o mesmo).

> ⚠️ **Ponto de atenção:** a query acima **sobrescreve `paciente` de TODOS** os
> acompanhamentos que têm CNS. Se um CNS **não existir** na base de pacientes, a
> subquery retorna `NULL` e o campo `paciente` fica **vazio** (acompanhamento órfão).
>
> **Melhoria recomendada** (relink seguro, só casa quem existe):
> ```js
> "UPDATE amarcap53_acompanhamentos " +
> "SET paciente = (SELECT id FROM amarcap53_pacientes " +
> "                WHERE amarcap53_pacientes.cns = amarcap53_acompanhamentos.cns LIMIT 1) " +
> "WHERE cns != '' AND cns IS NOT NULL " +
> "AND cns IN (SELECT cns FROM amarcap53_pacientes)"
> ```
> Assim, acompanhamentos com CNS sem correspondência ficam **intactos**.

### 5.5 API do PocketBase usada (referência)

| Chamada | O que faz |
|---|---|
| `routerAdd(method, path, handler)` | Registra uma rota HTTP customizada |
| `onRecordCreate(handler, collection)` | Hook executado antes de criar um registro |
| `e.record`, `e.next()` | Registro em edição e avanço da cadeia de hooks |
| `rec.get(campo)` / `rec.set(campo, valor)` | Lê/grava campos do registro no hook |
| `$app.findRecordById(collection, id)` | Busca um registro por ID (dentro do hook) |
| `c.requestInfo().body` | Body da requisição já desserializado |
| `c.json(status, data)` / `c.noContent(status)` | Resposta JSON / vazia |
| `c.response.header().set(k, v)` | Define header (CORS) |
| `$app.db().newQuery(sql).execute()` | Executa SQL cru (ignora as regras de API) |

---

## 6. Frontend — Relink manual (React/TypeScript)

Existem **duas formas** de executar o relink. O AMAR tem **as duas**:

- **6.1 Backend (SQL em lote)** — usado pelas rotas `fix-relink-cns` /
  `migrate-acompanhamento-cns`. Ideal para bases grandes.
- **6.2 Frontend (1-a-1 pela API padrão)** — o botão "Re-vincular por CNS" em
  Configurações. Dá feedback visual (progresso/contadores) e registra quais mudaram.

### 6.1 Chamada simples da rota de backend (SQL em lote)

```tsx
// Relink por CNS (backend, 1 sentença SQL — rápido e atômico)
await pb.send('/api/amar/fix-relink-cns', { method: 'POST' });
```

### 6.2 Relink manual com progresso (loop 1-a-1 pela API)

Útil quando se quer **mostrar progresso** e **contar** quantos foram realmente
alterados (o SQL em lote não devolve contagem).

```tsx
const [relinkStatus, setRelinkStatus] = useState<{
  active: boolean; phase: string; current: number; total: number;
  matched: number; updated: number; skipped: number;
}>({ active: false, phase: '', current: 0, total: 0, matched: 0, updated: 0, skipped: 0 });

const handleManualRelink = async () => {
  if (!window.confirm('Deseja executar a re-vinculação manual dos acompanhamentos por CNS?')) return;

  setRelinkStatus({ active: true, phase: 'carregando pacientes...', current: 0, total: 0, matched: 0, updated: 0, skipped: 0 });

  try {
    // 1. Busca todos os pacientes com CNS (só os campos necessários)
    setRelinkStatus(prev => ({ ...prev, phase: 'carregando pacientes...' }));
    const pacientes = await pb.collection('amarcap53_pacientes').getFullList({
      filter: 'cns != ""',
      fields: 'id,cns',
    });

    // Mapeia CNS -> ID
    const cnsMap: Record<string, string> = {};
    pacientes.forEach(p => {
      if (p.cns) cnsMap[String(p.cns).trim()] = p.id;
    });

    // 2. Busca acompanhamentos com CNS
    setRelinkStatus(prev => ({ ...prev, phase: 'carregando acompanhamentos...', matched: 0 }));
    const acompanhamentos = await pb.collection('amarcap53_acompanhamentos').getFullList({
      filter: 'cns != ""',
      fields: 'id,cns,paciente',
    });

    let updated = 0;
    let skipped = 0;

    setRelinkStatus(prev => ({ ...prev, phase: 'processando...', total: acompanhamentos.length }));

    // 3. Atualiza 1 a 1 via API padrão (só quando o vínculo está errado)
    for (let i = 0; i < acompanhamentos.length; i++) {
      const a = acompanhamentos[i];
      const aCns = String(a.cns || '').trim();
      const aPac = String(a.paciente || '').trim();
      const correctPacId = cnsMap[aCns];

      if (aCns && correctPacId && aPac !== correctPacId) {
        await pb.collection('amarcap53_acompanhamentos').update(a.id, {
          paciente: correctPacId,
        });
        updated++;
      } else {
        skipped++;
      }

      // Atualiza progresso a cada 5 registros para não sobrecarregar o React
      if ((i + 1) % 5 === 0 || i === acompanhamentos.length - 1) {
        setRelinkStatus(prev => ({
          ...prev,
          current: i + 1,
          matched: updated + skipped,
          updated,
          skipped,
          phase: `processando ${i + 1}/${acompanhamentos.length}...`,
        }));
      }
    }

    setRelinkStatus(prev => ({ ...prev, phase: 'concluído!', current: prev.total, active: false }));
    alert(`Processo concluído: ${updated} registros re-vinculados, ${skipped} já corretos.`);
    fetchStats();
  } catch (err: any) {
    console.error(err);
    setRelinkStatus({ active: false, phase: '', current: 0, total: 0, matched: 0, updated: 0, skipped: 0 });
    alert('Erro: ' + (err.message || 'Falha na comunicação'));
  }
};
```

### 6.3 Gravar o CNS na criação do acompanhamento (frontend)

Para o mecanismo 1 funcionar mesmo sem depender do hook, o frontend também envia o
CNS ao criar o acompanhamento:

```tsx
const data = {
  paciente: createSelectedPaciente.id,
  profissional: user.id,
  cns: (createSelectedPaciente as any).cns || '',   // cópia da chave natural
  data_busca: dataBuscaIso || createDate,
  tipo_busca: getSelectLabel(createTipoBusca, TIPO_BUSCA_OPTIONS),
  tipo_contato: getSelectLabel(createTipoContato, TIPO_CONTATO_OPTIONS),
  situacao_pos_busca: getSelectLabel(createSituacao, SITUACAO_POS_BUSCA_OPTIONS),
  data_do_agendamento: dataAgendamentoIso || createDataAgendamento,
  entraves_identificados: JSON.stringify(Array.isArray(createEntraves) ? createEntraves.filter(v => v) : []),
  entraves_informado_por: getSelectLabel(createEntravesInformadoPor, ENTRAVES_INFORMADO_POR_OPTIONS),
  observacoes: createObservacoes,
};

await pb.collection('amarcap53_acompanhamentos').create(data);
```

---

## 7. Estratégias de execução — qual usar?

| Estratégia | Como | Vantagens | Quando usar |
|---|---|---|---|
| **SQL em lote (backend)** | `POST /api/amar/fix-relink-cns` | 1 sentença, atômica, rapidíssima, não trafega dados | Bases grandes; CI/scripts; após reimportação |
| **Loop 1-a-1 (frontend)** | `getFullList` + `.update` por registro | Feedback visual, contadores de alterados/pulados | Bases pequenas/médias; quando o usuário quer acompanhar |
| **Hook automático** | `onRecordCreate` em acompanhamentos | Não depende do operador; garante CNS desde o início | Sempre (é a prevenção) |
| **Backfill** | `POST /api/amar/migrate-acompanhamento-cns` | Conserta registros legados sem CNS | Antes de delete/replace; dados antigos |

> **Recomendação:** use **hook automático + backfill** para manter o CNS sempre
> presente, e o **SQL em lote** para o relink em si (é o mais rápido e seguro).
> O loop 1-a-1 é opcional (UX).

### Índices (performance)

Para bases grandes, crie índices em `cns` nas duas coleções (o relink faz `JOIN`/`=`):

```sql
CREATE INDEX IF NOT EXISTS idx_pacientes_cns ON amarcap53_pacientes (cns);
CREATE INDEX IF NOT EXISTS idx_acomp_cns     ON amarcap53_acompanhamentos (cns);
CREATE INDEX IF NOT EXISTS idx_acomp_paciente ON amarcap53_acompanhamentos (paciente);
```

Pode ser feito via migration PocketBase (`pb_migrations/`) ou SQL cru.

---

## 8. Segurança — camadas e cuidados

| Camada | Onde | O que faz |
|---|---|---|
| **Consistência de formato** | Escrita (frontend + hooks) | CNS sempre 15 dígitos só números → garante o `=` do relink |
| **Idempotência** | Rota de relink | Rodar várias vezes não quebra nada |
| **Proteção contra órfãos** | Rota de relink | Recomendado `AND cns IN (SELECT cns FROM pacientes)` (item 5.4) |

> ⚠️ **Ponto de atenção (segurança):** as rotas `fix-relink-cns` e
> `migrate-acompanhamento-cns` **não checam `c.auth`** (mesmo padrão das rotas de
> importação/exclusão do AMAR). Para novos projetos, **adicione** a verificação:
>
> ```js
> var auth = c.auth;
> if (!auth) return c.json(401, { message: 'Nao autenticado' });
> // opcional: exigir papel
> // var role = auth.get('role');
> // if (role !== 'cap' && role !== 'admin') return c.json(403, { message: 'Sem permissao' });
> ```
>
> Lembre-se: `c.auth` é `null` para requisições de **superuser**.

> ⚠️ **Nunca** interpole valores do cliente na tabela/coluna do SQL. Aqui a tabela é
> **constante** e o casamento é feito por igualdade de colunas — não há entrada do
> usuário na query.

---

## 9. Passo a passo para reimplementar em outro projeto

### 9.1 Planejamento

1. Identifique a **coleção dona** (com os dados de identificação) e a **coleção
   dependente** (com o campo de relação que será redefinido).
2. Escolha a **chave natural** estável (CNS, CPF, matrícula, código externo…).
3. **Adicione um campo** na coleção dependente para guardar a chave natural
   (ex.: `cns`), caso ainda não exista.
4. Garanta que a chave natural está **normalizada** (mesmo formato nos dois lados).

### 9.2 Backend

5. Crie/edite `pb_hooks/main.pb.js`.
6. Adicione o **hook auto-CNS** (`onRecordCreate` na coleção dependente) — item 5.2.
7. Adicione as rotas do **backfill** (item 5.3) e do **relink** (item 5.4),
   trocando os nomes de coleção/campos:
   - `amarcap53_pacientes` → sua coleção dona;
   - `amarcap53_acompanhamentos` → sua coleção dependente;
   - `cns` → sua chave natural;
   - `paciente` → seu campo de relação.
8. **Reinicie o PocketBase** — hooks só carregam no boot:
   ```bash
   sudo systemctl restart pocketbase
   ```
9. Verifique a sintaxe (se tiver Node local):
   ```bash
   node --check pb_hooks/main.pb.js
   ```
   (valida só a sintaxe JS; `routerAdd`, `$app`, `c` só existem em runtime).

### 9.3 Frontend (opcional — relink com progresso)

10. Copie os estados e o `handleManualRelink` (item 6.2).
11. Ajuste os nomes das coleções, o campo da chave natural e o campo de relação.
12. Exiba o progresso (`relinkStatus`) e um botão "Re-vincular".

### 9.4 Ordem de operação recomendada

13. **Prevenção:** hook auto-CNS ativo + frontend gravando o CNS.
14. **Antes** de apagar/substituir a base dona: rode o **backfill**
    (`migrate-acompanhamento-cns`) para não perder vínculos sem CNS.
15. **Depois** de reimportar a base dona: rode o **relink**
    (`fix-relink-cns`) para religar os dependentes aos novos IDs.

---

## 10. Testes e Verificação

### 10.1 Teste do relink (PowerShell)

```powershell
$base = 'https://SEU-DOMINIO'
# 1) autentica (se a rota exigir auth)
$auth = @{ identity='SEU_EMAIL'; password='SUA_SENHA' } | ConvertTo-Json
$token = (Invoke-RestMethod "$base/api/collections/amarcap53_users/auth-with-password" `
          -Method POST -ContentType 'application/json' -Body $auth).token
$h = @{ Authorization = $token; 'Content-Type' = 'application/json' }

# 2) executa o relink
$r = Invoke-WebRequest "$base/api/amar/fix-relink-cns" -Method POST -Headers $h -SkipHttpErrorCheck
"STATUS=$($r.StatusCode) BODY=$($r.Content)"          # esperado: 200 {"ok":true,...}

# 3) executa o backfill de CNS
$r2 = Invoke-WebRequest "$base/api/amar/migrate-acompanhamento-cns" -Method POST -Headers $h -SkipHttpErrorCheck
"STATUS=$($r2.StatusCode) BODY=$($r2.Content)"        # esperado: 200 {"success":true}
```

### 10.2 Verificação por SQL (se tiver acesso ao banco)

```sql
-- Acompanhamentos com CNS cuja relação aponta para o paciente ERRADO (deve retornar 0):
SELECT COUNT(*) AS orfaos
FROM amarcap53_acompanhamentos a
JOIN amarcap53_pacientes p ON p.cns = a.cns
WHERE a.paciente IS NULL OR a.paciente != p.id;

-- Acompanhamentos sem CNS gravado (candidatos ao backfill):
SELECT COUNT(*) AS sem_cns
FROM amarcap53_acompanhamentos
WHERE cns IS NULL OR cns = '';
```

### 10.3 Checklist de testes

- [ ] Acompanhamento novo criado **sem** CNS → hook **preenche** o CNS automaticamente.
- [ ] Acompanhamento antigo sem CNS → **backfill** copia o CNS do paciente.
- [ ] Após reimportar a base de pacientes (IDs novos), rodar relink → relação restaurada.
- [ ] Rodar o relink **duas vezes** → resultado idêntico (idempotência).
- [ ] Acompanhamento cujo CNS **não existe** na base → **não** fica órfão (com a
      cláusula `AND cns IN (...)`; sem ela, documentar o comportamento).
- [ ] CNS com formatação diferente nos dois lados → normalizado antes de casar.
- [ ] Base grande (vários milhares) → relink via SQL em **segundos** e servidor responsivo.

---

## 11. Troubleshooting

| Sintoma | Causa provável | Solução |
|---|---|---|
| Relink não casa ninguém | Formato do CNS diferente nos dois lados (máscara vs. números) | Normalizar para 15 dígitos só números **na escrita** |
| Acompanhamento ficou **sem paciente** após relink | CNS não existe na base + query sem proteção | Adicionar `AND cns IN (SELECT cns FROM pacientes)` |
| `acompanhamentos.cns` sempre vazio | Hook não carregado / backfill não rodou | Reiniciar PocketBase; rodar `migrate-acompanhamento-cns` |
| `404` nas rotas | Hook não carregado | Reiniciar o PocketBase (hooks só no boot) |
| `Something went wrong...` / 400 genérico | Helper usado fora do escopo do handler | Declarar tudo **inline** dentro do handler |
| Relink lento | Sem índice em `cns` | Criar índices (`idx_pacientes_cns`, `idx_acomp_cns`) |
| Loop do frontend trava a UI | Atualizações de estado a cada item | Atualizar progresso a cada N itens (ex.: 5) |
| `c.auth` sempre null | Requisição de **superuser** | Usar auth de coleção (ou remover a checagem se for script) |

---

## 12. Resumo das decisões de projeto

| Decisão | Motivo |
|---|---|
| Re-vincular por **chave natural (CNS)**, não por ID | IDs mudam em reimportação; o CNS é estável |
| **CNS duplicado** no acompanhamento | Âncora de recuperação quando o ID muda |
| **Auto-CNS no create** (hook) | Garante o CNS desde o nascimento do registro |
| **Backfill** (`migrate-acompanhamento-cns`) | Conserta registros legados e é chamado antes de apagar/substituir a base |
| **Relink em SQL** (`fix-relink-cns`) | 1 sentença, atômico, rápido, ideal para base grande |
| **Relink idempotente** | Pode rodar a qualquer momento, sem risco |
| **Loop 1-a-1** (frontend) | Feedback visual/contadores para o operador |
| **CNS normalizado** (15 dígitos) | Garante o casamento por igualdade |
| Helpers **inline no handler** | Obrigatório no PocketBase v0.23+/v0.40 (escopo isolado) |

---

## 13. Arquivos de referência no projeto AMAR

| Arquivo | Conteúdo |
|---|---|
| `pb_hooks/main.pb.js` | Hook auto-CNS (`onRecordCreate` em acompanhamentos), rotas `fix-relink-cns`, `migrate-acompanhamento-cns` (+ import/delete) |
| `src/screens/SettingsScreen.tsx` | Botão "Re-vincular por CNS", `handleManualRelink`, `relinkStatus` (progresso) |
| `src/screens/FollowUpsScreen.tsx` | Criação de acompanhamento gravando `cns` do paciente selecionado |
| `src/lib/pocketbase.ts` | Inicialização do SDK (`pb`) |
| `docs/documentacao-restauracao-vinculo-paciente.md` | Documentação de apoio sobre restauração de vínculo |
| `docs/guia-re-vinculacao-cns-pocketbase.md` | Guia de apoio de re-vinculação por CNS |

### Documentos relacionados

| Arquivo | Conteúdo |
|---|---|
| `GUIA_SISTEMA_IMPORTACAO_DADOS_POCKETBASE.md` | **Importação** em massa (cria os pacientes com IDs novos) |
| `GUIA_SISTEMA_EXCLUSAO_DADOS_POCKETBASE.md` | **Exclusão** em massa (faz o backup do CNS antes de apagar) |

---

*Documento gerado como referência de reimplementação. Ajuste nomes de coleção,
campos, chave natural e a cláusula de proteção contra órfãos conforme o seu projeto
antes de usar.*
