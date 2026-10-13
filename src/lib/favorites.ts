import { pb } from './pocketbase';

/**
 * Favoritos guardam o CNS (Cartão Nacional de Saúde) do paciente — a chave
 * natural — em vez do `id` do registro no PocketBase.
 *
 * Motivo: ao excluir e reimportar a base de pacientes os IDs são regerados.
 * Qualquer vínculo salvo por `id` fica órfão. O CNS não muda, então o favorito
 * sobrevive ao ciclo excluir/importar.
 */

// CNS válido = exatamente 15 dígitos.
export const isCns = (value: string): boolean => /^\d{15}$/.test(String(value ?? '').trim());

export interface FavoritesMigration {
  favorites: string[];
  changed: boolean;
}

/**
 * Converte favoritos legados (gravados como `id`) para CNS.
 *
 * Regras de segurança:
 * - Entradas que já são CNS são mantidas.
 * - IDs legados são resolvidos via consulta em `amarcap53_pacientes`.
 * - Se nenhum ID resolver (ex.: base vazia durante o ciclo excluir/importar),
 *   nada é alterado — evita apagar favoritos por engano.
 */
export async function migrateFavoritesToCns(raw: string[]): Promise<FavoritesMigration> {
  const entries = Array.from(new Set((raw || []).map(v => String(v ?? '').trim()).filter(Boolean)));
  const cnsList = entries.filter(isCns);
  const legacyIds = entries.filter(e => !isCns(e));

  if (legacyIds.length === 0) {
    return { favorites: entries, changed: false };
  }

  let mapped: string[] = [];
  try {
    const filter = legacyIds.map(id => `id = "${id.replace(/"/g, '')}"`).join(' || ');
    const records = await pb.collection('amarcap53_pacientes').getFullList({
      filter,
      fields: 'id,cns',
      requestKey: null,
    });
    const idToCns = new Map<string, string>();
    records.forEach(r => idToCns.set(r.id, String(r.cns ?? '').trim()));
    mapped = legacyIds.map(id => idToCns.get(id) ?? '').filter(isCns);
  } catch {
    mapped = [];
  }

  // Base vazia / nada resolveu: não destrói os favoritos legados.
  if (mapped.length === 0) {
    return { favorites: entries, changed: false };
  }

  return { favorites: Array.from(new Set([...cnsList, ...mapped])), changed: true };
}
