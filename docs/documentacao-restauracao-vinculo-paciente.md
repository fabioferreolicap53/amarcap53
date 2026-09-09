# Documentacao: Restauracao de Vinculo Paciente-Acompanhamento via CNS

## Resumo do Problema

Quando o banco de dados de pacientes (`amarcap53_pacientes`) e excluido e reimportado com os mesmos pacientes, os registros de acompanhamento (`amarcap53_acompanhamentos`) perdem a referencia do campo `paciente` (ID). Isso acontece porque:

1. O campo `paciente` nos acompanhamentos armazena o **ID interno** do PocketBase, que **muda** a cada reimportacao.
2. O PocketBase gera IDs novos para os mesmos pacientes ao inseri-los novamente.
3. Resultado: todos os acompanhamentos ficam com `paciente = ''` ou `paciente = <ID_antigo_que_nao_existe_mais>`.

O usuario ve "PACIENTE DESCONHECIDO" na tela de acompanhamentos.

---

## Solucao Implementada

A solucao usa o **CNS (Cartao Nacional de Sauude)** como chave de correspondencia, pois:

- O CNS e **unico** por paciente.
- O CNS e **estavel** entre importacoes (mesmo paciente = mesmo CNS).
- O campo `cns` existe nas duas colecoes.

---

## Arquitetura: Rede de Seguranca em 4 Camadas

```
CAMADA 1 - Pre-Delecao (Frontend)
    |
    |--> Backend salva CNS nos acompanhamentos (rota migrate-acompanhamento-cns)
    |
CAMADA 2 - Hook de Delecao (Backend)
    |
    |--> hook onRecordBeforeDeleteRequest copia CNS do paciente para acompanhamentos
    |
CAMADA 3 - Importacao (Frontend + Backend)
    |
    |--> Backend importa pacientes com INSERT direto (gera novos IDs)
    |--> Frontend chama rota fix-relink-cns apos importar
    |
CAMADA 4 - Re-Vinculacao (Backend)
    |
    |--> Rota fix-relink-cns compara CNSs e atualiza campo paciente
    |
CAMADA 5 - Botao Manual (Frontend)
    |
    |--> Botao "Re-vincular por CNS" permite correcao manual a qualquer momento
```

---

## Estrutura das Colecoes (PocketBase)

### amarcap53_pacientes

| Campo           | Tipo   | Descricao                          |
|-----------------|--------|------------------------------------|
| `id`            | Text   | ID interno gerado pelo PocketBase  |
| `cns`           | Text   | Cartao Nacional de Saude (unico)   |
| `nome`          | Text   | Nome completo do paciente          |
| `unidade`       | Text   | Unidade de saude                   |
| `equipe`        | Text   | Equipe de saude                    |
| `microarea`     | Number | Microarea                          |
| `data_nascimento`| Date  | Data de nascimento                 |
| `idade`         | Number | Idade                              |
| `grupo`         | Text   | Faixa etaria                       |
| `created`       | Date   | Data de criacao                    |
| `updated`       | Date   | Data de atualizacao                |

### amarcap53_acompanhamentos

| Campo                    | Tipo   | Descricao                                |
|--------------------------|--------|------------------------------------------|
| `id`                     | Text   | ID interno gerado pelo PocketBase        |
| `paciente`               | Rel    | **ID do paciente** (chave FK)            |
| `cns`                    | Text   | **CNS do paciente** (chave de restauracao)|
| `profissional`           | Rel    | ID do profissional                       |
| `data_busca`             | Date   | Data da busca ativa                      |
| `tipo_busca`             | Text   | Tipo de busca                            |
| `tipo_contato`           | Text   | Tipo de contato                          |
| `situacao_pos_busca`     | Text   | Situacao pos busca                       |
| `data_do_agendamento`    | Date   | Data do agendamento                      |
| `entraves_identificados` | Text   | Entraves identificados                   |
| `entraves_informado_por` | Text   | Informado por                            |
| `observacoes`            | Text   | Observacoes                              |

**Ponto critico:** O campo `paciente` e uma referencia ao `id` da colecao `amarcap53_pacientes`. Quando o paciente e deletado e recriado, seu `id` muda, mas seu `cns` permanece igual.

---

## Detalhamento das Camadas

### Camada 1: Backup de CNS no Frontend (antes da delecao)

**Arquivo:** `src/screens/SettingsScreen.tsx`
**Funcao:** `handlePasswordSubmit` (bloco que inicia a exclusao)

**O que faz:**
Antes de comecar a exclusao dos pacientes, captura todos os pares `ID -> CNS` e salva em `localStorage`.

```typescript
// Capturar mapa oldPacienteId -> cns ANTES de deletar
var allPacs = await pb.collection('amarcap53_pacientes').getFullList({ fields: 'id,cns' });
var mapCaptured: Record<string, string> = {};
for (var p of allPacs) {
  var cnsVal = (p as any).cns || '';
  if (p.id && cnsVal) mapCaptured[p.id] = String(cnsVal);
}
oldPatientCnsMapRef.current = mapCaptured;
localStorage.setItem('amarcap53_old_patient_cns_map', JSON.stringify(mapCaptured));
```

**Por que `localStorage`:** Se o usuario der F5 no meio do processo, o mapa ainda esta disponivel na camada 4.

---

### Camada 2: Sincronizacao CNS via Rota Backend (antes da delecao em massa)

**Arquivo:** `pb_hooks/main.pb.js`
**Rota:** `POST /api/custom/migrate-acompanhamento-cns`

**O que faz:**
Para CADA acompanhamento que tenha um paciente valido E cujo campo `cns` esteja vazio, copia o CNS do paciente para o acompanhamento usando subquery SQL.

```sql
UPDATE amarcap53_acompanhamentos
SET cns = (SELECT cns FROM amarcap53_pacientes
           WHERE id = amarcap53_acompanhamentos.paciente)
WHERE (cns = '' OR cns IS NULL)
  AND paciente IN (SELECT id FROM amarcap53_pacientes)
```

**Chamado em:** `SettingsScreen.tsx` logo no inicio do `handlePasswordSubmit`:

```typescript
setDeleteStatus({ message: 'Sincronizando CNS nos acompanhamentos...', type: 'deleting' });
await pb.send('/api/custom/migrate-acompanhamento-cns', { method: 'POST' });
```

**Importancia:** Garante que TODOS os acompanhamentos tenham o campo `cns` preenchido ANTES de qualquer delecao. E a ultima chance de copiar o CNS enquanto o paciente ainda existe.

---

### Camada 3: Hook de Delecao (Backend - backup por registro)

**Arquivo:** `pb_hooks/main.pb.js`
**Hook:** `onRecordBeforeDeleteRequest` na colecao `amarcap53_pacientes`

**O que faz:**
Quando UM paciente e deletado (individualmente ou em massa via API), antes de executar a delecao, copia o CNS desse paciente para todos os seus acompanhamentos que ainda nao tenham CNS.

```javascript
onRecordBeforeDeleteRequest(function(e) {
  try {
    var db = $app.db();
    var pacId = e.record.id;
    var cns = e.record.get('cns');
    if (pacId && cns) {
      db.newQuery(
        "UPDATE amarcap53_acompanhamentos SET cns = '" + cns + "' " +
        "WHERE paciente = '" + pacId + "' AND (cns = '' OR cns IS NULL)"
      ).execute();
    }
  } catch(err) {
    console.error('[paciente_delete] Sync CNS error:', err);
  }
  e.next();  // Permite que a delecao prossiga normalmente
}, 'amarcap53_pacientes');
```

**Por que e necessario:** A Camada 2 e chamada pelo frontend antes do loop de delecao. Mas se a delecao for feita direto pelo Painel Admin do PocketBase, esse hook garante o backup mesmo assim. E uma camada de seguranca redundante.

---

### Camada 4: Re-Vinculacao via Rota Backend (pos-importacao)

**Arquivo:** `pb_hooks/main.pb.js`
**Rota:** `POST /api/custom/fix-relink-cns`

Este e o **coracao** da solucao. Executa todo o processo de restauracao em SQL puro no servidor.

#### Passo 1: Mapear pacientes atuais

```sql
SELECT id, cns FROM amarcap53_pacientes
WHERE cns != '' AND cns IS NOT NULL
```

Constroi um dicionario em memoria: `CNS_normalizado -> novo_ID`.

#### Passo 2: Identificar acompanhamentos com CNS mas vinculo invalido

```sql
SELECT id, cns, paciente FROM amarcap53_acompanhamentos
WHERE cns != '' AND cns IS NOT NULL
```

Para cada resultado, verifica se o campo `paciente` aponta para um ID que **existe** na tabela de pacientes:

```sql
SELECT 1 FROM amarcap53_pacientes WHERE id = '<paciente_id>'
```

Se nao existir, o vinculo e considerado **invalido**.

#### Passo 3: Atualizar o vinculo

```sql
UPDATE amarcap53_acompanhamentos
SET paciente = '<novo_id>'
WHERE id = '<acompanhamento_id>'
```

#### Codigo completo da rota:

```javascript
routerAdd('POST', '/api/custom/fix-relink-cns', function(c) {
  var result = { ok: false, relinked: 0, scanned: 0, err: '' };
  try {
    var db = $app.db();

    // Mapear CNS -> novo ID
    var pacMap = {};
    var pacRows = db.newQuery(
      "SELECT id, cns FROM amarcap53_pacientes WHERE cns != '' AND cns IS NOT NULL"
    ).all();
    for (var i = 0; i < pacRows.length; i++) {
      var row = pacRows[i];
      var cns = String(row.cns || (row.get ? row.get('cns') : '') || '')
                  .replace(/\D/g, '').trim();  // Remove nao-numericos
      var id = String(row.id || (row.get ? row.get('id') : '') || '').trim();
      if (cns && id) pacMap[cns] = id;
    }

    // Buscar todos acompanhamentos com CNS
    var acompRows = db.newQuery(
      "SELECT id, cns, paciente FROM amarcap53_acompanhamentos WHERE cns != '' AND cns IS NOT NULL"
    ).all();
    result.scanned = acompRows.length;

    for (var j = 0; j < acompRows.length; j++) {
      var aRow = acompRows[j];
      var aId = String(aRow.id || (aRow.get ? aRow.get('id') : '') || '');
      var aCns = String(aRow.cns || (aRow.get ? aRow.get('cns') : '') || '')
                  .replace(/\D/g, '').trim();
      var currentPac = String(aRow.paciente || (aRow.get ? aRow.get('paciente') : '') || '');

      // Verificar se vinculo atual e invalido
      var isInvalid = !currentPac;
      if (currentPac) {
        try {
          var exists = db.newQuery(
            "SELECT 1 FROM amarcap53_pacientes WHERE id = '" + currentPac + "'"
          ).all();
          if (!exists || exists.length === 0) isInvalid = true;
        } catch(e) { isInvalid = true; }
      }

      // Re-vincular se invalido
      if (isInvalid) {
        var newPacId = pacMap[aCns];
        if (aId && newPacId) {
          db.newQuery(
            "UPDATE amarcap53_acompanhamentos SET paciente = '" + newPacId +
            "' WHERE id = '" + aId + "'"
          ).execute();
          result.relinked++;
        }
      }
    }

    result.ok = true;
    return c.json(200, result);
  } catch(err) {
    result.err = String(err);
    return c.json(500, result);
  }
});
```

---

### Camada 5: Botao Manual no Frontend

**Arquivo:** `src/screens/SettingsScreen.tsx`
**Funcao:** `handleManualRelink`

Permite ao usuario forcar a re-vinculacao a qualquer momento, sem precisar importar novamente.

```typescript
const handleManualRelink = async () => {
  if (!window.confirm('Deseja executar a re-vinculacao manual?')) return;
  try {
    setDeleteStatus({ message: 'Re-vinculando acompanhamentos...', type: 'deleting' });
    const res = await pb.send('/api/custom/fix-relink-cns', { method: 'POST' });
    alert(`Processo concluido: ${res.relinked} registros re-vinculados.`);
    setDeleteStatus({ message: '', type: 'idle' });
  } catch (err: any) {
    alert('Erro: ' + (err.message || 'Falha na comunicacao'));
    setDeleteStatus({ message: '', type: 'idle' });
  }
};
```

**Posicao na UI:** Botao com icone de sincronismo na secao "Historico" das Configuracoes.

---

## Fluxo Completo: Passo a Passo

```
1. USUARIO clica "Excluir Base" nas Configuracoes
   |
2. Frontend captura mapa ID -> CNS e salva em localStorage
   |  (Camada 1)
   |
3. Frontend chama POST /api/custom/migrate-acompanhamento-cns
   |  (Camada 2)
   |  --> Todos os acompanhamentos ganham campo CNS preenchido
   |
4. Frontend inicia loop de delecao em pagina (100 por vez)
   |  Cada DELETE dispara hook onRecordBeforeDeleteRequest
   |  (Camada 3)
   |  --> Backup redundante de CNS por registro individual
   |
5. Base de pacientes esvaziada
   |  Acompanhamentos continuam existindo com campo "cns" preenchido
   |  Campo "paciente" agora aponta para IDs que nao existem
   |
6. USUARIO importa novo CSV
   |
7. Frontend importa pacientes via SDK do PocketBase
   |  PocketBase gera NOVOS IDs para os mesmos pacientes
   |  CNS dos pacientes e o MESMO da importacao anterior
   |
8. Frontend chama POST /api/custom/fix-relink-cns
   |  (Camada 4)
   |
   |  Passo 4a: SELECT todos pacientes atuais -> dicionario CNS -> NovoID
   |  Passo 4b: SELECT todos acompanhamentos com CNS
   |  Passo 4c: Para cada acompanhamento:
   |            - Verificar se campo paciente aponta para ID valido
   |            - Se INVALIDO: buscar NovoID pelo CNS no dicionario
   |            - UPDATE amarcap53_acompanhamentos SET paciente = NovoID
   |
9. Acompanhamentos vinculados novamente
   |  Frontend exibe nome do paciente ao inves de "PACIENTE DESCONHECIDO"
```

---

## Hooks e Endpoints Necessarios

### Hooks PocketBase (pb_hooks/main.pb.js)

| Hook/Endpoint | Tipo | Quando Executa |
|---|---|---|
| `onRecordCreate` (acompanhamentos) | Hook | Ao criar acompanhamento: copia CNS do paciente se vazio |
| `onRecordBeforeDeleteRequest` (pacientes) | Hook | Ao deletar paciente: copia CNS para acompanhamentos |
| `POST /api/amar/migrate-acompanhamento-cns` | Rota | Antes de delecao em massa: sync CNS em lote |
| `POST /api/amar/fix-relink-cns` | Rota | Pos-importacao: re-vincula acompanhamentos por CNS |
| `POST /api/amar/delete-all` | Rota | Exclusao via API: sync CNS antes de deletar |

### Frontend (SettingsScreen.tsx)

| Funcao | Quando Executa |
|---|---|
| `handlePasswordSubmit` | Inicia exclusao: salva mapa, chama sync CNS, deleta em lote |
| `handleFileUpload` | Importa CSV + chama fix-relink-cns apos importacao |
| `handleManualRelink` | Botao manual: chama fix-relink-cns sob demanda |

---

## Normalizacao do CNS

Em todos os pontos de comparacao, o campo CNS e normalizado:

```javascript
cns = String(valor).replace(/\D/g, '').trim();
```

Isso remove espacos, hifens, pontos e outros caracteres nao numericos, garantindo que `"708.500.370.253.472"` e `"708500370253472"` sejam considerados iguais.

O CNS e sempre normalizado para 15 caracteres com zeros a esquerda:

```javascript
cns = String(r.cns || '').replace(/\D/g, '').padStart(15, '0').slice(-15);
```

---

## Importacao SQL Direta vs SDK

### Por que SQL direto no backend?

O endpoint de importacao (`/api/custom/import-pacientes`) usa `INSERT INTO` direto no SQLite ao inves do SDK do PocketBase:

```sql
INSERT INTO amarcap53_pacientes
  (id, created, updated, unidade, equipe, microarea, cns, nome, data_nascimento, idade, grupo)
VALUES
  ('<id_gerado>', '<timestamp>', '<timestamp>', ...);
```

**Motivo:** Ao usar SQL direto, controlamos o `id` gerado e os campos `created`/`updated`. O SDK do PocketBase gera IDs automaticamente e gerencia timestamps internamente, o que em operacoes de importacao em massa pode causar overhead desnecessario.

**O ID gerado segue o padrao PocketBase:**
```javascript
var id = Math.random().toString(36).substring(2, 10) +
         Math.random().toString(36).substring(2, 9);
id = id.substring(0, 15);  // 15 caracteres alfanumericos
```

---

## Casos de Borda Considerados

| Caso | Solucao |
|---|---|
| CNS com caracteres especiais (`.`, `-`, espacos) | `replace(/\D/g, '')` em todos os pontos |
| Acompanhamento sem campo CNS preenchido | Nao e re-vinculado (requer CNS para identificacao) |
| Paciente duplicado com mesmo CNS | Ultimo inserido vence no mapa (dicionario JS) |
| Delecao feita pelo Painel Admin (fora do frontend) | Hook `onRecordBeforeDeleteRequest` garante backup |
| F5 durante processo de exclusao | Mapa salvo em `localStorage` sobrevive ao refresh |
| Acompanhamento ja com paciente valido | Ignorado (nao e modificado) |

---

## Como Implementar em Outro Sistema

### Requisitos

1. **Colecao "Fonte"** com campo unico estavel (ex: CPF, CNS, email, UUID externo).
2. **Colecao "Destino"** com campo de referencia (FK) para a colecao fonte.
3. **PocketBase** com `pb_hooks` habilitado.

### Passos de Implementacao

#### 1. Adicionar campo de chave estavel na colecao destino

Na colecao de acompanhamentos (ou equivalente), adicione um campo que armazene a chave estavel da colecao fonte:

- Campo: `cns` (ou `cpf`, `email`, etc.)
- Tipo: Text
- Indexado: Recomendado para performance

#### 2. Hook: Preencher chave estavel ao criar registro

```javascript
// No pb_hooks/main.pb.js
onRecordCreate(function(e) {
  var rec = e.record;
  var fonteId = rec.get('paciente');  // FK para colecao fonte
  var currentChave = rec.get('chave_estavel');  // Campo unico

  if (currentChave && String(currentChave).trim() !== '') return e.next();

  if (fonteId) {
    try {
      var fonte = $app.findRecordById('colecao_fonte', fonteId);
      if (fonte) {
        var chave = fonte.get('cpf');  // Ou o campo unico que usar
        if (chave) rec.set('chave_estavel', chave);
      }
    } catch(err) {}
  }
  e.next();
}, 'colecao_destino');
```

#### 3. Hook: Backup de chave estavel antes de deletar fonte

```javascript
onRecordBeforeDeleteRequest(function(e) {
  try {
    var db = $app.db();
    var fonteId = e.record.id;
    var chave = e.record.get('cpf');
    if (fonteId && chave) {
      db.newQuery(
        "UPDATE colecao_destino SET chave_estavel = '" + chave + "' " +
        "WHERE paciente = '" + fonteId + "' AND (chave_estavel = '' OR chave_estavel IS NULL)"
      ).execute();
    }
  } catch(err) {}
  e.next();
}, 'colecao_fonte');
```

#### 4. Rota: Sync de chave estavel em lote

```javascript
routerAdd('POST', '/api/custom/sync-chave-estavel', function(c) {
  try {
    var db = $app.db();
    db.newQuery(
      "UPDATE colecao_destino " +
      "SET chave_estavel = (SELECT cpf FROM colecao_fonte WHERE id = colecao_destino.paciente) " +
      "WHERE (chave_estavel = '' OR chave_estavel IS NULL) " +
      "AND paciente IN (SELECT id FROM colecao_fonte)"
    ).execute();
    return c.json(200, { success: true });
  } catch(err) {
    return c.json(500, { message: String(err) });
  }
});
```

#### 5. Rota: Re-vinculacao por chave estavel

```javascript
routerAdd('POST', '/api/custom/relink-por-chave', function(c) {
  var result = { ok: false, relinked: 0, scanned: 0, err: '' };
  try {
    var db = $app.db();

    // 1. Mapear fonte: chave_estavel -> novo_id
    var fonteMap = {};
    var fonteRows = db.newQuery(
      "SELECT id, cpf FROM colecao_fonte WHERE cpf != '' AND cpf IS NOT NULL"
    ).all();
    for (var i = 0; i < fonteRows.length; i++) {
      var row = fonteRows[i];
      var chave = String(row.cpf || (row.get ? row.get('cpf') : '') || '')
                    .replace(/\D/g, '').trim();
      var id = String(row.id || (row.get ? row.get('id') : '') || '').trim();
      if (chave && id) fonteMap[chave] = id;
    }

    // 2. Buscar registros destino com chave
    var destRows = db.newQuery(
      "SELECT id, chave_estavel, paciente FROM colecao_destino " +
      "WHERE chave_estavel != '' AND chave_estavel IS NOT NULL"
    ).all();
    result.scanned = destRows.length;

    // 3. Re-vincular registros invalidos
    for (var j = 0; j < destRows.length; j++) {
      var dRow = destRows[j];
      var dId = String(dRow.id || (dRow.get ? dRow.get('id') : '') || '');
      var dChave = String(dRow.chave_estavel || (dRow.get ? dRow.get('chave_estavel') : '') || '')
                     .replace(/\D/g, '').trim();
      var currentFk = String(dRow.paciente || (dRow.get ? dRow.get('paciente') : '') || '');

      var isInvalid = !currentFk;
      if (currentFk) {
        try {
          var exists = db.newQuery(
            "SELECT 1 FROM colecao_fonte WHERE id = '" + currentFk + "'"
          ).all();
          if (!exists || exists.length === 0) isInvalid = true;
        } catch(e) { isInvalid = true; }
      }

      if (isInvalid) {
        var newId = fonteMap[dChave];
        if (dId && newId) {
          db.newQuery(
            "UPDATE colecao_destino SET paciente = '" + newId +
            "' WHERE id = '" + dId + "'"
          ).execute();
          result.relinked++;
        }
      }
    }

    result.ok = true;
    return c.json(200, result);
  } catch(err) {
    result.err = String(err);
    return c.json(500, result);
  }
});
```

#### 6. Frontend: Chamar rotas no momento correto

```typescript
// ANTES de excluir base:
await pb.send('/api/custom/sync-chave-estavel', { method: 'POST' });

// DEPOIS de importar nova base:
await pb.send('/api/custom/relink-por-chave', { method: 'POST' });
```

---

## Notas de Implementacao

- **Performance:** Para bases grandes (+50k registros), considere processar em lotes de 500-1000 registros por query.
- **Seguranca:** As rotas customizadas nao tem autenticacao por padrao. Adicione validacao de `c.auth` conforme necessario.
- **Backup:** Implemente backup do banco SQLite (`pb_data/data.db`) antes de operacoes de exclusao em massa.
- **Logs:** Registre operacoes de delecao e re-vinculacao para auditoria.
- **Teste:** Sempre teste com uma base pequena (10-20 registros) antes de executar em producao.
