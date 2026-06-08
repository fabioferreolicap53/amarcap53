# [OPEN] Debug Session: favorites-sync-devices

## Bug
- Favoritos nao refletem em todos os dispositivos logados.

## Hypotheses
- H1: Campo `favoritos` nao existe ou nao aceita update no auth collection.
- H2: Subscribe realtime do registro do usuario nao recebe evento `update`.
- H3: Outro dispositivo recebe evento, mas estado local/AuthStore nao atualiza.
- H4: `FavoritesScreen` nao reage corretamente quando `user.favoritos` muda remotamente.
- H5: Regra de acesso do auth collection bloqueia update/subscribe.

## Plan
- Instrumentar AuthContext e telas de favoritos.
- Coletar evidencias runtime.
- Confirmar hipotese.
- Corrigir com menor diff possivel.

## Status
- Instrumentacao pendente.
