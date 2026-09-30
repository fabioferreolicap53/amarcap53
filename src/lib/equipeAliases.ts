// Tratamento de aliases de equipe: perfis usam nome "bonito" (UI) e o banco
// PocketBase guarda forma abreviada/sem acento. Ex: perfil "PARQUE SÃO PAULO"
// vs banco "SAO PAULO". O filtro `equipe ~ X` nunca casaria — aqui expandimos
// os valores equivalentes antes de montar o filtro.

// Chave = nome normalizado (sem acento, maiúsculo, espaços simples)
// Valor = aliases que existem no banco para essa mesma equipe
const EQUIPE_ALIASES: Record<string, string[]> = {
  'PARQUE SAO PAULO': ['SAO PAULO'],
};

export const stripAccents = (v: unknown): string =>
  String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

export const normalizeEquipeKey = (v: unknown): string =>
  stripAccents(v).toUpperCase().replace(/\s+/g, ' ').trim();

const escapeFilterValue = (v: string): string =>
  v.replace(/\\/g, '\\\\').replace(/"/g, '\\"');

// Todos os nomes equivalentes da equipe (nome original + aliases do banco)
export const getEquipeAliases = (equipe: unknown): string[] => {
  const key = normalizeEquipeKey(equipe);
  if (!key) return [];
  const aliases = EQUIPE_ALIASES[key] || [];
  const all = [String(equipe ?? ''), key, ...aliases];
  const seen = new Set<string>();
  return all.filter((v) => {
    const t = normalizeEquipeKey(v);
    if (!t || seen.has(t)) return false;
    seen.add(t);
    return true;
  });
};

// Cláusula PocketBase que casa a equipe com todos os aliases + variação com
// espaços (mesmo padrão `~ %X%` já usado no projeto). Ex:
// (equipe ~ "%PARQUE%SAO%PAULO%" || equipe ~ "%SAO%PAULO%")
export const buildEquipeMatchClause = (equipe: unknown): string => {
  const aliases = getEquipeAliases(equipe);
  if (aliases.length === 0) return 'equipe != ""';
  const parts = aliases.map((a) => `equipe ~ "%${escapeFilterValue(a).replace(/\s+/g, '%')}%"`);
  return `(${parts.join(' || ')})`;
};

// Igualdade com aliases (para checagem de duplicidade de usuários). Ex:
// (equipe = "PARQUE SÃO PAULO" || equipe = "PARQUE SAO PAULO" || equipe = "SAO PAULO")
export const buildEquipeEqualityClause = (equipe: unknown): string => {
  const aliases = getEquipeAliases(equipe);
  if (aliases.length === 0) return 'equipe = ""';
  const parts = aliases.map((a) => `equipe = "${escapeFilterValue(a)}"`);
  return `(${parts.join(' || ')})`;
};

// Mesma coisa para listas (filtros UI): OR das cláusulas de cada valor
export const buildEquipeFilterClause = (values: string[]): string => {
  const parts = values.map((v) => buildEquipeMatchClause(v)).filter((c) => c.length > 0);
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `(${parts.join(' || ')})`;
};

// Comparação acento/case-insensitive considerando aliases (para checks em JS)
export const isSameEquipe = (a: unknown, b: unknown): boolean => {
  const ka = normalizeEquipeKey(a);
  const kb = normalizeEquipeKey(b);
  if (!ka || !kb) return false;
  if (ka === kb) return true;
  return getEquipeAliases(a).some((x) => normalizeEquipeKey(x) === kb) ||
    getEquipeAliases(b).some((x) => normalizeEquipeKey(x) === ka);
};
