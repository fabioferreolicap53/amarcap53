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

// ---------------------------------------------------------------------------
// Filtros regionais Otimizados para pacientes
//
// Motivo: `unidade ~ "X%Y%"` vira LIKE '%X%Y%' no SQLite e faz FULL SCAN em
// ~129K registros (medido: 6-16s). Igualdade exata usa índice B-tree
// (medido: 60ms). O DB guarda unidade/equipe normalizadas SEM acento e com
// o mesmo valor da UI (inclui sufixo "AP 53"), então igualdade bate direto.
// ---------------------------------------------------------------------------

// Igualdade de equipe já normalizada para o formato do DB (sem acento,
// maiúsculo), cobrindo aliases. Ex: UI "TOPÁZIO" → `equipe = "TOPAZIO"`.
export const buildEquipeDbEqualityClause = (values: string[]): string => {
  const clauses = new Set<string>();
  values.forEach((v) => {
    getEquipeAliases(v).forEach((alias) => {
      const norm = normalizeEquipeKey(alias);
      if (norm) clauses.add(`equipe = "${escapeFilterValue(norm)}"`);
    });
  });
  const parts = [...clauses];
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `(${parts.join(' || ')})`;
};

// Igualdade de unidade normalizada (usa idx_am53_unidade).
export const buildUnidadeDbEqualityClause = (values: string[]): string => {
  const parts = [...new Set(
    values
      .map((v) => normalizeEquipeKey(v))
      .filter(Boolean)
      .map((norm) => `unidade = "${escapeFilterValue(norm)}"`)
  )];
  if (parts.length === 0) return '';
  if (parts.length === 1) return parts[0];
  return `(${parts.join(' || ')})`;
};

// Cláusula regional completa para pacientes: unidade + equipe + microárea,
// tudo por igualdade (usa índices). Aceita listas (filtros UI) ou unitário (role).
export const buildRegionalPatientFilter = (opts: {
  unidades?: string[];
  equipes?: string[];
  microareas?: (string | number)[];
}): string => {
  const clauses: string[] = [];
  if (opts.unidades && opts.unidades.length > 0) {
    const c = buildUnidadeDbEqualityClause(opts.unidades);
    if (c) clauses.push(c);
  }
  if (opts.equipes && opts.equipes.length > 0) {
    const c = buildEquipeDbEqualityClause(opts.equipes);
    if (c) clauses.push(c);
  }
  if (opts.microareas && opts.microareas.length > 0) {
    const ma = opts.microareas
      .map((m) => Number(m))
      .filter((n) => Number.isFinite(n))
      .map((n) => `microarea = ${n}`);
    if (ma.length > 0) clauses.push(`(${ma.join(' || ')})`);
  }
  return clauses.join(' && ');
};

// ---------------------------------------------------------------------------
// Abreviações de exibição (mobile/tablet)
// ---------------------------------------------------------------------------

// Siglas de unidade para células estreitas. Todo o banco é "SMS ... AP 53",
// então removemos esses prefixos/sufixos repetidos e guardamos a forma curta.
// Chave = unidade normalizada (sem acento, maiúsculo).
const UNIDADE_CURTAS: Record<string, string> = {
  'SMS CF ALICE DE JESUS REGO AP 53': 'CF ALICE DE JESUS REGO',
  'SMS CF DEOLINDO COUTO AP 53': 'CF DEOLINDO COUTO',
  'SMS CF EDSON ABDALLA SAAD AP 53': 'CF EDSON ABDALLA SAAD',
  'SMS CF ERNANI DE PAIVA FERREIRA BRAGA AP 53': 'CF ERNANI BRAGA',
  'SMS CF HELANDE DE MELLO GONCALVES AP 53': 'CF HELANDE GONCALVES',
  'SMS CF ILZO MOTTA DE MELLO AP 53': 'CF ILZO MOTTA',
  'SMS CF JAMIL HADDAD AP 53': 'CF JAMIL HADDAD',
  'SMS CF JOAO BATISTA CHAGAS AP 53': 'CF JOAO B. CHAGAS',
  'SMS CF JOSE ANTONIO CIRAUDO AP 53': 'CF J. ANTONIO CIRAUDO',
  'SMS CF LENICE MARIA MONTEIRO COELHO AP 53': 'CF LENICE COELHO',
  'SMS CF LOURENCO DE MELLO AP 53': 'CF LOURENCO DE MELLO',
  'SMS CF SAMUEL PENHA VALLE AP 53': 'CF SAMUEL PENHA',
  'SMS CF SERGIO AROUCA AP 53': 'CF SERGIO AROUCA',
  'SMS CF VALERIA GOMES ESTEVES AP 53': 'CF VALERIA ESTEVES',
  'SMS CF WALDEMAR BERARDINELLI AP 53': 'CF WALDEMAR B.',
  'SMS CMS ADELINO SIMOES NOVA SEPETIBA AP 53': 'CMS ADELINO SEPETIBA',
  'SMS CMS ALOYSIO AMANCIO DA SILVA AP 53': 'CMS ALOYSIO SILVA',
  'SMS CMS CATTAPRETA AP 53': 'CMS CATTAPRETA',
  'SMS CMS CESARIO DE MELLO AP 53': 'CMS CESARIO DE MELLO',
  'SMS CMS CYRO DE MELLO MANGUARIBA AP 53': 'CMS CYRO MANGUARIBA',
  'SMS CMS DECIO AMARAL FILHO AP 53': 'CMS DECIO AMARAL',
  'SMS CMS EMYDIO CABRAL AP 53': 'CMS EMYDIO CABRAL',
  'SMS CMS FLORIPES GALDINO PEREIRA AP 53': 'CMS FLORIPES',
  'SMS CMS MARIA APARECIDA DE ALMEIDA AP 53': 'CMS MARIA APARECIDA',
  'SMS CMS SAVIO ANTUNES ANTARES AP 53': 'CMS SAVIO ANTARES',
};

// Unidade curta para exibição em telas estreitas. Remove "SMS" (presente em
// todas) e sufixo "AP 53" (todo o banco é AP 53), preservando o nome que
// identifica a unidade. Ex: "SMS CF EDSON ABDALLA SAAD AP 53" →
// "CF EDSON ABDALLA SAAD".
export const getShortUnidade = (unidade: unknown): string => {
  const raw = String(unidade ?? '').trim();
  if (!raw || raw === '--') return raw || '--';
  const normalized = normalizeEquipeKey(raw);
  if (UNIDADE_CURTAS[normalized]) return UNIDADE_CURTAS[normalized];
  return normalized
    .replace(/^SMS\s+/, '')
    .replace(/\s+AP\s+53$/, '')
    .trim() || raw;
};
