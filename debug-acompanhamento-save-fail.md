[OPEN]

# Debug Session: acompanhamento-save-fail

## Sintoma
- Registro de acompanhamento falha ao salvar no PocketBase com erro `400`.
- Alert mostra `Invalid value` em campos `entraves_informado_por`, `situacao_pos_busca`, `tipo_busca`, `tipo_contato`.

## Hipóteses
1. App manda valor de `Select` diferente do schema real do PocketBase.
2. Campo `entraves_identificados` chega em formato incompatível com tipo da coleção.
3. Algumas opções no PocketBase exigem prefixo numérico e app manda variante sem prefixo.
4. Componente visual usa `label`, mas payload usa `value` divergente.
5. Existe campo obrigatório extra na coleção não enviado no payload.

## Plano
1. Ligar Debug Server.
2. Instrumentar submit de criação/edição.
3. Reproduzir erro.
4. Ler evidências.
5. Aplicar correção mínima.

## Evidências
- Pendente coleta.
