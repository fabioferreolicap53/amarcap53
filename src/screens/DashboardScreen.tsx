import React, { useState, useEffect, useRef } from 'react';
import { Users, Clock, AlertTriangle, Calendar, BadgeCheck, LayoutDashboard, Filter, CheckCircle, X, TestTube2, CircleOff, Search, Activity, ArrowRightCircle } from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement
} from 'chart.js';
import { Header } from '../components/Header';
import { DatePickerPTBR } from '../components/DatePickerPTBR';
import { MultiSelect } from '../components/MultiSelect';
import { Footer } from '../components/Footer';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useAuth } from '../contexts/AuthContext';
import { pb } from '../lib/pocketbase';
import { useDebounce } from '../hooks/useDebounce';
import { UNIDADES_EQUIPES, MICROAREAS } from '../constants/regionalData';
import { getCanonicalValue } from '../constants/followUpOptions';

// Remove acentos via Unicode NFD decomposition (ex: "ESPERANÇA" → "ESPERANCA")
const normalizeText = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\s+/g, ' ');

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement
);

interface DashboardScreenProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// Helper Components
export const DashboardScreen: React.FC<DashboardScreenProps> = ({ activeTab, setActiveTab }) => {
  const { user, isAdmin } = useAuth();

  // Cache localStorage (evita full table scan repetido)
  const STATS_CACHE_TTL = 30 * 60 * 1000; // 30 minutos (evita flash ao recarregar)
  const getCache = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (Date.now() - cached.ts > STATS_CACHE_TTL) return null;
      return cached.data;
    } catch { return null; }
  };
  const setCache = (key: string, data: any) => {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
  };
  const STATS_CACHE_KEY = `dash_stats_cache_${user?.id}`;
  const ACOMP_CACHE_KEY = `dash_acomp_cache_${user?.id}`;

  // Inicializa estados do cache de forma síncrona (sem useEffect)
  const _ac = user?.id ? getCache(ACOMP_CACHE_KEY) : null;
  const _sc = user?.id ? getCache(STATS_CACHE_KEY) : null;

  // Se cache expirou, usa valores antigos do localStorage como fallback
  const _acOld = _ac ?? (() => { try { const raw = localStorage.getItem(ACOMP_CACHE_KEY); return raw ? JSON.parse(raw)?.data ?? null : null; } catch { return null; } })();
  const _scOld = _sc ?? (() => { try { const raw = localStorage.getItem(STATS_CACHE_KEY); return raw ? JSON.parse(raw)?.data ?? null : null; } catch { return null; } })();

  // Migração: descarta cache antigo (chaves de filteredGroupCounts mudaram de padrão para nome real)
  const CACHE_VERSION_KEY = 'dash_cache_version';
  const CURRENT_CACHE_VERSION = 4;
  const storedVersion = (() => { try { return Number(localStorage.getItem(CACHE_VERSION_KEY)) || 0; } catch { return 0; } })();
  if (storedVersion < CURRENT_CACHE_VERSION) {
    localStorage.setItem(CACHE_VERSION_KEY, String(CURRENT_CACHE_VERSION));
    if (_acOld) _acOld.filteredGroupCounts = {};
    if (_ac) _ac.filteredGroupCounts = {};
    if (_scOld) _scOld.filteredGroupCounts = {};
    if (_sc) _sc.filteredGroupCounts = {};
  }

  const [stats, setStats] = useState(_scOld ?? _sc ?? {
    totalPacientes: 0,
    coletasAtrasadas: 0,
    examesEmDia: 0,
    resultadosAlterados: 0,
    coberturaPercent: 0,
    pepMol: 0,
    coltMol: 0,
    pepCito: 0,
    coltCito: 0,
    alertBreakdown: {} as Record<string, number>,
    grupoBreakdown: {} as Record<string, number>,
    examVolume: { cito: 0, hpv: 0, pendente: 0 },
    examTrend: [] as { month: string; cito: number; hpv: number }[],
    acompTrend: [] as { month: string; total: number }[],
    comBuscaMap: {} as Record<string, number>
  });

  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');
  const [filterUnidade, setFilterUnidade] = useState<string[]>([]);
  const [filterEquipe, setFilterEquipe] = useState<string[]>([]);
  const [filterMicroarea, setFilterMicroarea] = useState<string[]>([]);
  // Debounce filtros regionais (MultiSelect) — evitam request a cada clique
  const debouncedFilterUnidade = useDebounce(filterUnidade, 300);
  const debouncedFilterEquipe = useDebounce(filterEquipe, 300);
  const debouncedFilterMicroarea = useDebounce(filterMicroarea, 300);
  // Datas também têm debounce (evita request ao digitar data manualmente)
  const debouncedFilterDataInicio = useDebounce(filterDataInicio, 500);
  const debouncedFilterDataFim = useDebounce(filterDataFim, 500);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [selectedGrupo, setSelectedGrupo] = useState<string | null>(null);
  const [selectedPrioIdx, setSelectedPrioIdx] = useState<number | null>(null);
  const [filterBuscaAtiva, setFilterBuscaAtiva] = useState<boolean | undefined>(undefined);
  const [grupoDataInicio, setGrupoDataInicio] = useState('');
  const [grupoDataFim, setGrupoDataFim] = useState('');
  const [grupoBuscaStats, setGrupoBuscaStats] = useState<{ comBusca: number; semBusca: number } | null>(null);
  const [isLoadingPrioCounts, setIsLoadingPrioCounts] = useState(true);
  const grupoContainerRef = useRef<HTMLDivElement>(null);
  const loadedRecordsRef = useRef<any[]>([]);
  const comBuscaMapRef = useRef<Record<string, number>>(_acOld?.comBuscaMap ?? {});
  const comBuscaAlertMapRef = useRef<Record<string, number>>({});
  const selectedGruposDBRef = useRef<string[]>([]);
  const [filteredComBuscaMap, setFilteredComBuscaMap] = useState<Record<string, number>>(_acOld?.filteredComBuscaMap ?? {});
  const [filteredComBuscaMapIndep, setFilteredComBuscaMapIndep] = useState<Record<string, number>>(_acOld?.filteredComBuscaMapIndep ?? {});
  const grupoBreakdownRef = useRef<Record<string, number>>(_scOld?.grupoBreakdown ?? {});
  const [filteredGroupCounts, setFilteredGroupCounts] = useState<Record<string, number>>({});
  const [filteredGroupCountsIndep, setFilteredGroupCountsIndep] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [acompStats, setAcompStats] = useState(_acOld?.acompStats ?? {
    total: 0,
    alertComBusca: {} as Record<string, number>,
    sucesso: 0,
    contatos: 0,
    tipoBusca: {} as Record<string, number>,
    situacao: {} as Record<string, number>,
    entraves: {} as Record<string, number>,
    unidadeBreakdown: {} as Record<string, number>,
    equipeBreakdown: {} as Record<string, number>,
    microareaBreakdown: {} as Record<string, number>
  });


  const formatEnumLabel = (value?: string) => value || '';
  const hasValue = (value: any) => value !== undefined && value !== null && value !== '' && value !== '--';

  const displayStats = stats;

  // Lógica de dois cliques nos cards de grupo
  const selectedIsIndependenteRef = useRef<boolean>(false);

  const handleGrupoClick = (prioIdx: number | string, gruposDB: string[], isIndependente = false) => {
      const numIdx = typeof prioIdx === 'string' ? parseInt(prioIdx) : prioIdx;
      const key = String(numIdx);
      if (selectedGrupo === key) { setSelectedGrupo(null); setSelectedPrioIdx(null); return; }
      setSelectedGrupo(key);
      setSelectedPrioIdx(numIdx);
      selectedGruposDBRef.current = gruposDB;
      selectedIsIndependenteRef.current = isIndependente;
      setFilterBuscaAtiva(undefined);
      setGrupoBuscaStats(null);
    };

  // Debounce datas do card de grupo
  const debouncedGrupoDataInicio = useDebounce(grupoDataInicio, 500);
  const debouncedGrupoDataFim = useDebounce(grupoDataFim, 500);

  // Stats de busca por grupo: instantâneo via refs, ou query leve com datas
  const hasOneDateOnly = (debouncedGrupoDataInicio && !debouncedGrupoDataFim) || (!debouncedGrupoDataInicio && debouncedGrupoDataFim);
  useEffect(() => {
    if (!selectedGrupo) { setGrupoBuscaStats(null); return; }

    // APENAS 1 campo data preenchido → espera (skeleton)
    if (hasOneDateOnly) {
      setGrupoBuscaStats(null);
      return;
    }

    // SEM datas custom → computa imediatamente dos dados já carregados
    if (!debouncedGrupoDataInicio && !debouncedGrupoDataFim) {
      const grupos = selectedGruposDBRef.current;
      if (grupos.length === 0) return;

      const isIndependente = selectedIsIndependenteRef.current;
      const sourceCounts = isIndependente ? filteredGroupCountsIndep : filteredGroupCounts;
      const sourceComBusca = isIndependente ? filteredComBuscaMapIndep : filteredComBuscaMap;

      // Se dados ainda não carregaram, espera (skeleton)
      const hasFilteredCounts = grupos.some(g => sourceCounts?.[g] !== undefined);
      if (!hasFilteredCounts) return;

      let totalGrupo = 0;
      let comBusca = 0;

      grupos.forEach(g => {
        const groupTotal = sourceCounts?.[g] ?? 0;
        totalGrupo += groupTotal;
        comBusca += (sourceComBusca?.[g] ?? 0);
      });

      setGrupoBuscaStats({ comBusca, semBusca: Math.max(totalGrupo - comBusca, 0) });
      return;
    }

    // COM datas custom → busca robusta: 1) todos acompanhamentos 2) cruza com pacientes do grupo
    let cancelled = false;
    setGrupoBuscaStats(null); // mantém skeleton
    const fetchWithDates = async () => {
      try {
        const dInicio = debouncedGrupoDataInicio || '';
        const dFim = debouncedGrupoDataFim || '';

        // Helper: extrair YYYY-MM-DD de qualquer formato
        const toISODate = (val: string): string => {
          if (!val) return '';
          const m = val.match(/^(\d{4}-\d{2}-\d{2})/);
          return m ? m[1] : '';
        };

        // Helper: verificar se paciente pertence ao grupo etário
        const isInGrupo = (pac: any): boolean => {
          return selectedGruposDBRef.current.includes(pac.grupo);
        };

        // Helper: busca paginada robusta (igual paginatedFetch do fetchStats)
        const paginatedFetch = async (collection: string, fields: string, filter?: string): Promise<any[]> => {
          const results: any[] = [];
          let page = 1;
          const perPage = 500;
          let hasMore = true;
          while (hasMore && !cancelled) {
            try {
              const opts: any = { page, perPage, fields, requestKey: null, batch: perPage };
              if (filter) opts.filter = filter;
              const result = await pb.collection(collection).getList(page, perPage, opts);
              results.push(...result.items);
              hasMore = page < result.totalPages;
              page++;
            } catch { hasMore = false; }
          }
          return results;
        };

        // 1. Buscar TODOS acompanhamentos (~5K, leve)
        const allAcomp = await paginatedFetch('amarcap53_acompanhamentos', 'paciente,data_busca');
        if (cancelled) return;

        // 2. Filtrar por data no intervalo + extrair IDs únicos
        const pacIdsNoPeriodo = new Set<string>();
        for (const r of allAcomp) {
          if (!r.paciente) continue;
          const dataBusca = toISODate(r.data_busca || '');
          if (dInicio && dataBusca < dInicio) continue;
          if (dFim && dataBusca > dFim) continue;
          pacIdsNoPeriodo.add(r.paciente);
        }

        if (pacIdsNoPeriodo.size === 0) {
          if (!cancelled) {
            const grupos = selectedGruposDBRef.current;
            const totalGrupo = grupos.reduce((acc, g) => acc + (filteredGroupCounts?.[g] ?? 0), 0);
            setGrupoBuscaStats({ comBusca: 0, semBusca: totalGrupo });
          }
          return;
        }

        // 3. IDs únicos de pacientes com acompanhamento no período
        const pacIdsComBusca = [...pacIdsNoPeriodo];

        // 4. Buscar esses pacientes em batch para verificar grupo + cito
        const pacMap = new Map<string, any>();
        const batchSize = 200;
        for (let i = 0; i < pacIdsComBusca.length && !cancelled; i += batchSize) {
          const chunk = pacIdsComBusca.slice(i, i + batchSize);
          const idFilter = `(${chunk.map(id => `id = "${id}"`).join(' || ')})`;
          try {
            const pacs = await paginatedFetch('amarcap53_pacientes', 'id,grupo,cito_pep,cito_lab', idFilter);
            pacs.forEach(p => pacMap.set(p.id, p));
          } catch { /* skip batch */ }
        }
        if (cancelled) return;

        // 5. Filtrar: só pacientes do grupo (com regras de cito/dna)
        const comBuscaSet = new Set<string>();
        const isIndependenteDates = selectedIsIndependenteRef.current;
        for (const pacId of pacIdsComBusca) {
          const pac = pacMap.get(pacId);
          if (!pac || !isInGrupo(pac)) continue;
          // 3º card independente: só conta se DNA não foi feito
          if (isIndependenteDates) {
            const hasDna = !!(pac.dna_hpv_pep && String(pac.dna_hpv_pep).trim());
            const hasDnaGal = !!(pac.dna_hpv_gal && String(pac.dna_hpv_gal).trim());
            if (hasDna || hasDnaGal) continue;
          }
          comBuscaSet.add(pacId);
        }

        // 6. Total do grupo (consistente com a contagem exibida no card)
        const grupos = selectedGruposDBRef.current;
        const sourceCountsDates = isIndependenteDates ? filteredGroupCountsIndep : filteredGroupCounts;
        const totalGrupo = grupos.reduce((acc, g) => acc + (sourceCountsDates?.[g] ?? 0), 0);
        if (!cancelled) setGrupoBuscaStats({ comBusca: comBuscaSet.size, semBusca: Math.max(totalGrupo - comBuscaSet.size, 0) });
      } catch { if (!cancelled) setGrupoBuscaStats(null); }
    };
    fetchWithDates();
    return () => { cancelled = true; };
  }, [selectedGrupo, debouncedGrupoDataInicio, debouncedGrupoDataFim, stats, filteredGroupCounts, filteredGroupCountsIndep, filteredComBuscaMap, filteredComBuscaMapIndep]);

  // Click fora do container de grupos → cancela seleção
  useEffect(() => {
    if (!selectedGrupo) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // Ignora clicks na portal do datepicker
      if (target.closest('.datepicker-portal-content')) return;
      // Ignora clicks dentro do container de grupos (cards, inputs, botões)
      if (grupoContainerRef.current && grupoContainerRef.current.contains(target)) return;
      // Ignora clicks em qualquer input/button/label/svg (datepickers, ícones, etc)
      if (target.closest('input, button, label, svg, [role="button"]')) return;
      setSelectedGrupo(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedGrupo]);

  // Queries leves: popula grupoBreakdown + filteredGroupCounts RAPIDAMENTE (3 queries ~100ms cada)
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    // Filtro base por role (mesmo lógico do fetchStats)
    const fp: string[] = [];
    if (!isAdmin) {
      if (user.role === 'unidade') fp.push(pb.filter('unidade ~ {:u}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%') }));
      else if (user.role === 'equipe') fp.push(pb.filter('unidade ~ {:u} && equipe ~ {:e}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%'), e: normalizeText(user.equipe).replace(/\s+/g, '%') }));
      else if (user.role === 'microarea') {
        fp.push(pb.filter('unidade ~ {:u} && equipe ~ {:e}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%'), e: normalizeText(user.equipe).replace(/\s+/g, '%') }));
        fp.push(`microarea = ${Number(user.microarea)}`);
      }
    }
    const bf = fp.length > 0 ? fp.join(' && ') : '';

    const prio = [
      { g: '30-49', cf: "cito_pep = '' && cito_lab = '' && dna_hpv_pep = '' && dna_hpv_gal = ''" },
      { g: '50-64', cf: "cito_pep = '' && cito_lab = '' && dna_hpv_pep = '' && dna_hpv_gal = ''" },
      { g: '25-29', cf: "cito_pep = '' && cito_lab = '' && dna_hpv_pep = '' && dna_hpv_gal = ''" },
      { g: '6[45]>|65\\+|6[45]\\+|6[45]\\s*anos|6[45]\\s*$|6[45]\\s*\\)', cf: "cito_pep = '' && cito_lab = '' && dna_hpv_pep = '' && dna_hpv_gal = ''" },
    ];

    (async () => {
      // 1 query leve: descobre nomes reais dos grupos (500 registros, campo reduzido)
      const groupNames = new Set<string>();
      try {
        const sample = await pb.collection('amarcap53_pacientes').getList(1, 500, {
          filter: bf || undefined, fields: 'grupo', requestKey: null,
        });
        sample.items.forEach((r: any) => { if (r.grupo) groupNames.add(r.grupo); });
      } catch { return; }
      if (cancelled) return;

      // Para cada grupo prioritário, conta filtrado (em paralelo) usando nome REAL
      const counts: Record<string, number> = {};
      const countsIndep: Record<string, number> = {};
      await Promise.all([...groupNames].map(async (g) => {
        const matchedPrio = prio.find(p => new RegExp(p.g.replace('-', '.*'), 'i').test(g));
        if (!matchedPrio) return;
        try {
          const fF = bf ? `${bf} && grupo = "${g}" && ${matchedPrio.cf}` : `grupo = "${g}" && ${matchedPrio.cf}`;
          const rF = await pb.collection('amarcap53_pacientes').getList(1, 1, { filter: fF, fields: 'id', requestKey: null });
          counts[g] = rF.totalItems;
        } catch { /* ignora */ }
        // 3º card: "independente" — DNA não feito (sem DNA mas com cito registrado)
        try {
          const fI = bf
            ? `${bf} && grupo = "${g}" && dna_hpv_pep = '' && dna_hpv_gal = ''`
            : `grupo = "${g}" && dna_hpv_pep = '' && dna_hpv_gal = ''`;
          const rI = await pb.collection('amarcap53_pacientes').getList(1, 1, { filter: fI, fields: 'id', requestKey: null });
          countsIndep[g] = rI.totalItems;
        } catch { /* ignora */ }
      }));
      if (!cancelled) {
        if (Object.keys(counts).length > 0) setFilteredGroupCounts(counts);
        if (Object.keys(countsIndep).length > 0) setFilteredGroupCountsIndep(countsIndep);
        setIsLoadingPrioCounts(false);
      }
    })();

    return () => { cancelled = true; };
  }, [user?.id, user?.role, user?.unidade_saude, user?.equipe, user?.microarea, isAdmin]);

  const toValidDate = (value: any) => {
    if (!hasValue(value)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getLastSixMonths = () => {
    const months: { key: string; label: string }[] = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: date.toLocaleDateString('pt-BR', { month: 'short' })
      });
    }
    return months;
  };

  const getAcompanhamentoMetodo = (record: any) => {
    if (record.tipo_busca) return formatEnumLabel(record.tipo_busca);
    if (record.tipo_contato) return formatEnumLabel(record.tipo_contato);
    return '';
  };

  useEffect(() => {
    let cancelled = false;
    const fetchStats = async () => {
      if (!user) return;
      try {
        const patientFilterParts: string[] = [];

        // Base filters from user role (normalize accents: DB stores unaccented)
        if (!isAdmin) {
          if (user.role === 'unidade') {
            patientFilterParts.push(pb.filter('unidade ~ {:u}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%') }));
          } else if (user.role === 'equipe') {
            patientFilterParts.push(pb.filter('unidade ~ {:u} && equipe ~ {:e}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%'), e: normalizeText(user.equipe).replace(/\s+/g, '%') }));
          } else if (user.role === 'microarea') {
            patientFilterParts.push(pb.filter('unidade ~ {:u} && equipe ~ {:e}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%'), e: normalizeText(user.equipe).replace(/\s+/g, '%') }));
            patientFilterParts.push(`microarea = ${Number(user.microarea)}`);
          }
        }

        // Applied UI filters (normalize accents)
        if (filterUnidade.length > 0) {
          const uParams: Record<string, string> = {};
          const uClauses = filterUnidade.map((u, i) => {
            uParams[`u${i}`] = normalizeText(u).replace(/\s+/g, '%');
            return `unidade ~ {:u${i}}`;
          });
          patientFilterParts.push(pb.filter(uClauses.join(' || '), uParams));
        }
        if (filterEquipe.length > 0) {
          const eParams: Record<string, string> = {};
          const eClauses = filterEquipe.map((e, i) => {
            eParams[`e${i}`] = normalizeText(e).replace(/\s+/g, '%');
            return `equipe ~ {:e${i}}`;
          });
          patientFilterParts.push(pb.filter(eClauses.join(' || '), eParams));
        }
        if (filterMicroarea.length > 0) {
          patientFilterParts.push(`(${filterMicroarea.map(m => `microarea = ${Number(m)}`).join(' || ')})`);
        }

        // Build filter strings
        const patientFilter = patientFilterParts.join(' && ');

        // Build acomp filters (only acomp-specific fields, not role/regional — handled via patient IDs below)
        const acompFilterParts: string[] = [];
        if (filterDataInicio) {
          acompFilterParts.push(`data_busca >= "${filterDataInicio}"`);
        }
        if (filterDataFim) {
          acompFilterParts.push(`data_busca <= "${filterDataFim} 23:59:59"`);
        }

        // Parallel queries
        const hasUIFilters = filterUnidade.length > 0 || filterEquipe.length > 0 || filterMicroarea.length > 0 || filterDataInicio || filterDataFim;
        const isScopeQuery = !isAdmin || hasUIFilters;
        const lastSixMonths = getLastSixMonths();
        const emptyAcompTrend = lastSixMonths.map(month => ({ month: month.label, total: 0 }));
        const emptyExamTrend = lastSixMonths.map(month => ({ month: month.label, cito: 0, hpv: 0 }));
        let regionalUnidade: Record<string, number> = {};
        let regionalEquipe: Record<string, number> = {};
        let regionalMicroarea: Record<string, number> = {};
        let scopedPatientIds: string[] = [];
        let loadedRecords: any[] = [];

        // Helper: paginated fetch genérico
        const paginatedFetch = async (collection: string, fields: string, filter?: string, extraOpts?: any): Promise<any[]> => {
          const results: any[] = [];
          let page = 1;
          const perPage = 500;
          let hasMore = true;
          while (hasMore && !cancelled) {
            try {
              const opts: any = { page, perPage, fields, requestKey: null, batch: perPage, ...extraOpts };
              if (filter) opts.filter = filter;
              const result = await pb.collection(collection).getList(page, perPage, opts);
              results.push(...result.items);
              hasMore = page < result.totalPages;
              page++;
            } catch { hasMore = false; }
          }
          return results;
        };

        if (isScopeQuery) {
          // Non-CAP or CAP with UI filters: paginated fetch (evita getFullList com 130K)
          loadedRecords = await paginatedFetch('amarcap53_pacientes', 'id,dna_hpv_pep,dna_hpv_gal,cito_pep,cito_lab,grupo,unidade,equipe,microarea', patientFilter || undefined);
          if (cancelled) return;
          loadedRecordsRef.current = loadedRecords;
          scopedPatientIds = loadedRecords.map(p => p.id).filter(Boolean);

          const totalPacientes = loadedRecords.length;
          const alerts: Record<string, number> = {};
          const groups: Record<string, number> = {};

          loadedRecords.forEach(p => {
            let status: string;
            if (hasValue(p.dna_hpv_pep)) {
              status = 'PEP_MOLECULAR';
            } else if (hasValue(p.dna_hpv_gal)) {
              status = 'COLETA_MOLECULAR';
            } else if (hasValue(p.cito_pep)) {
              status = 'PEP_CITO';
            } else if (hasValue(p.cito_lab)) {
              status = 'COLETA_CITO';
            } else {
              status = 'NAO_IDENTIFICADO';
            }
            alerts[status] = (alerts[status] || 0) + 1;
            groups[p.grupo || 'NÃO INFORMADO'] = (groups[p.grupo || 'NÃO INFORMADO'] || 0) + 1;
          });

          const pepMolCount = alerts['PEP_MOLECULAR'] || 0;
          const coltMolCount = alerts['COLETA_MOLECULAR'] || 0;
          const pepCitoCount = alerts['PEP_CITO'] || 0;
          const coltCitoCount = alerts['COLETA_CITO'] || 0;
          const atrasadas = alerts['NAO_IDENTIFICADO'] || 0;
          const alterados = pepMolCount + coltMolCount + pepCitoCount + coltCitoCount;
          const emDia = Math.max(totalPacientes - atrasadas, 0);
          grupoBreakdownRef.current = groups;

          // filteredGroupCounts já setado pela query leve — não sobrescrever

          setStats(prev => ({
            ...prev,
            totalPacientes,
            coletasAtrasadas: atrasadas,
            examesEmDia: emDia,
            resultadosAlterados: alterados,
            coberturaPercent: totalPacientes > 0 ? Math.round((emDia / totalPacientes) * 100) : 0,
            pepMol: pepMolCount,
            coltMol: coltMolCount,
            pepCito: pepCitoCount,
            coltCito: coltCitoCount,
            alertBreakdown: alerts,
            grupoBreakdown: groups,
            examVolume: { cito: pepCitoCount + coltCitoCount, hpv: pepMolCount + coltMolCount, pendente: atrasadas },
            examTrend: emptyExamTrend,
            acompTrend: emptyAcompTrend
          }));
          setCache(STATS_CACHE_KEY, {
            totalPacientes, coletasAtrasadas: atrasadas, examesEmDia: emDia, resultadosAlterados: alterados,
            coberturaPercent: totalPacientes > 0 ? Math.round((emDia / totalPacientes) * 100) : 0,
            pepMol: pepMolCount, coltMol: coltMolCount, pepCito: pepCitoCount, coltCito: coltCitoCount,
            alertBreakdown: alerts, grupoBreakdown: groups,
            filteredGroupCounts,
            examVolume: { cito: pepCitoCount + coltCitoCount, hpv: pepMolCount + coltMolCount, pendente: atrasadas }
          });
        } else {
          // CAP without UI filters: pure count-based queries (instant)
          const baseFilter = patientFilter || '';
          // Mostra cache imediatamente (instantaneo)
          const cached = getCache(STATS_CACHE_KEY);
          if (cached) {
            setStats(prev => ({ ...prev, ...cached, examTrend: emptyExamTrend, acompTrend: emptyAcompTrend }));
            if (cached.filteredGroupCounts) setFilteredGroupCounts(cached.filteredGroupCounts);
          }

          const safeCount = async (field?: string, label?: string): Promise<number> => {
            try {
              const f = field
                ? (baseFilter ? `${baseFilter} && ${field}` : field)
                : baseFilter || '';
              const res = await pb.collection('amarcap53_pacientes').getList(1, 1, {
                filter: f,
                fields: 'id',
                requestKey: null,
              });
              return res.totalItems;
            } catch (err: any) {
              console.warn(`[count] ${label || field || 'total'} failed:`, err?.message || err);
              return 0;
            }
          };

          const [totalPacientes, pepMol, coltMol, pepCito, coltCito] = await Promise.all([
            safeCount(undefined, 'total'),
            safeCount("dna_hpv_pep != ''", 'dna_hpv_pep'),
            safeCount("dna_hpv_gal != '' && dna_hpv_pep = ''", 'dna_hpv_gal'),
            safeCount("cito_pep != '' && dna_hpv_gal = '' && dna_hpv_pep = ''", 'cito_pep'),
            safeCount("cito_lab != '' && cito_pep = '' && dna_hpv_gal = '' && dna_hpv_pep = ''", 'cito_lab'),
          ]);
          if (cancelled) return;

          const groups: Record<string, number> = {};
          try {
            const sample = await pb.collection('amarcap53_pacientes').getList(1, 500, {
              fields: 'grupo',
              requestKey: null,
              filter: baseFilter || undefined,
            });
            if (!cancelled) {
              const uniqueGrupos = [...new Set(sample.items.map((r: any) => r.grupo).filter(Boolean))];
              const countPromises = uniqueGrupos.map(async (g) => {
                if (g === '--' || g === 'NÃO INFORMADO') return;
                const cnt = await safeCount(`grupo = "${g}"`, `grupo_${g}`);
                if (cnt > 0 && !cancelled) groups[g] = cnt;
              });
              await Promise.all(countPromises);
              // filteredGroupCounts já setado pela query leve — não sobrescrever
            }
          } catch (err) {
            console.warn('[grupo] discover error:', err);
          }

          const withExam = pepMol + coltMol + pepCito + coltCito;
          const atrasadas = Math.max(totalPacientes - withExam, 0);
          grupoBreakdownRef.current = groups;

            setStats(prev => ({
              ...prev,
              totalPacientes,
              coletasAtrasadas: atrasadas,
              examesEmDia: withExam,
              resultadosAlterados: withExam,
              coberturaPercent: totalPacientes > 0 ? Math.round((withExam / totalPacientes) * 100) : 0,
              pepMol,
              coltMol,
              pepCito,
              coltCito,
              alertBreakdown: {
                NAO_IDENTIFICADO: atrasadas,
                PEP_MOLECULAR: pepMol,
                COLETA_MOLECULAR: coltMol,
                PEP_CITO: pepCito,
                COLETA_CITO: coltCito
              },
              grupoBreakdown: groups,
              examVolume: { cito: pepCito + coltCito, hpv: pepMol + coltMol, pendente: atrasadas },
              examTrend: emptyExamTrend,
              acompTrend: emptyAcompTrend
            }));
            setCache(STATS_CACHE_KEY, {
              totalPacientes,
              coletasAtrasadas: atrasadas,
              examesEmDia: withExam,
              resultadosAlterados: withExam,
              coberturaPercent: totalPacientes > 0 ? Math.round((withExam / totalPacientes) * 100) : 0,
              pepMol,
              coltMol,
              pepCito,
              coltCito,
              alertBreakdown: { NAO_IDENTIFICADO: atrasadas, PEP_MOLECULAR: pepMol, COLETA_MOLECULAR: coltMol, PEP_CITO: pepCito, COLETA_CITO: coltCito },
              grupoBreakdown: groups,
              filteredGroupCounts,
              examVolume: { cito: pepCito + coltCito, hpv: pepMol + coltMol, pendente: atrasadas }
            });
          }
        // Cache de acompanhamentos: renderiza instantâneo, busca em background
        const aCached = getCache(ACOMP_CACHE_KEY);
        if (aCached && !cancelled && aCached.acompStats?.total > 0) {
          setAcompStats(aCached.acompStats);
        }

        // Acompanhamentos
        let acompRecords: any[] = [];

        if (scopedPatientIds.length > 0) {
          // Com escopo: busca todos acompanhamentos paginados e filtra por IDs do scope no client
          const scopedSet = new Set(scopedPatientIds);
          const baseFilter = acompFilterParts.join(' && ').trim();
          try {
            const allAcomp = await paginatedFetch('amarcap53_acompanhamentos', 'situacao_pos_busca,tipo_contato,entraves_identificados,data_busca,created,paciente', baseFilter || undefined);
            // Filtra no client: só registros de pacientes dentro do scope
            acompRecords = allAcomp.filter((r: any) => scopedSet.has(r.paciente));
          } catch { /* fallback vazio */ }
        } else if (!cancelled) {
          // Admin sem filtros: busca acompanhamentos → IDs únicos → busca só esses pacientes (eficiente)
          try {
            // 1. Busca todos acompanhamentos (~5K, leve)
            const baseFilter = acompFilterParts.join(' && ').trim();
            acompRecords = await paginatedFetch('amarcap53_acompanhamentos', 'situacao_pos_busca,tipo_contato,entraves_identificados,data_busca,created,paciente', baseFilter || undefined);
            if (cancelled) return;

            // 2. Extrai IDs únicos dos pacientes com acompanhamento (~2K)
            const comBuscaPacIds = [...new Set(acompRecords.map((r: any) => r.paciente).filter(Boolean))];

            // 3. Busca APENAS esses pacientes com id+grupo+campos de status (~2K registros, não 130K)
            if (comBuscaPacIds.length > 0) {
              const comBuscaMap: Record<string, number> = {};
              const comBuscaAlerts: Record<string, number> = {};
              const filteredComBusca: Record<string, number> = {};
              const filteredComBuscaIndep: Record<string, number> = {};
              const batchSize = 200;
              for (let i = 0; i < comBuscaPacIds.length && !cancelled; i += batchSize) {
                const chunkIds = comBuscaPacIds.slice(i, i + batchSize);
                const idFilter = `(${chunkIds.map(id => `id = "${id}"`).join(' || ')})`;
                try {
                  const pacs = await pb.collection('amarcap53_pacientes').getFullList({
                    filter: idFilter,
                    fields: 'id,grupo,cito_pep,cito_lab,dna_hpv_pep,dna_hpv_gal',
                    batch: 500,
                    requestKey: null,
                  });
                  pacs.forEach((p: any) => {
                    // Determinar status do paciente para o card
                    let status: string;
                    if (hasValue(p.dna_hpv_pep)) status = 'PEP_MOLECULAR';
                    else if (hasValue(p.dna_hpv_gal)) status = 'COLETA_MOLECULAR';
                    else if (hasValue(p.cito_pep)) status = 'PEP_CITO';
                    else if (hasValue(p.cito_lab)) status = 'COLETA_CITO';
                    else status = 'NAO_IDENTIFICADO';

                    comBuscaAlerts[status] = (comBuscaAlerts[status] || 0) + 1;

                    if (p.grupo) {
                      comBuscaMap[p.grupo] = (comBuscaMap[p.grupo] || 0) + 1;
                      // filteredComBusca: pacientes com acompanhamento E que atendem filtro rastreamento
                      const hasCito = !!(p.cito_pep && String(p.cito_pep).trim());
                      const hasCitoLab = !!(p.cito_lab && String(p.cito_lab).trim());
                      const hasDna = !!(p.dna_hpv_pep && String(p.dna_hpv_pep).trim());
                      const hasDnaGal = !!(p.dna_hpv_gal && String(p.dna_hpv_gal).trim());
                      const isP3049 = /30.*49/i.test(p.grupo);
                      const isP5064 = /50.*6[0-4]|6[0-4].*50/i.test(p.grupo);
                      const isP2529 = /25.*29|29.*25/i.test(p.grupo);
                      const isP65plus = /6[45]>|65\+|6[45]\+|6[45]\s*anos|6[45]\s*$|6[45]\s*\)/i.test(p.grupo);
                      if ((isP3049 || isP5064 || isP2529 || isP65plus) && !hasCito && !hasCitoLab && !hasDna && !hasDnaGal) {
                        filteredComBusca[p.grupo] = (filteredComBusca[p.grupo] || 0) + 1;
                      }
                      // 3º card: DNA não feito (sem DNA mas com ou sem cito)
                      if ((isP3049 || isP5064 || isP2529 || isP65plus) && !hasDna && !hasDnaGal) {
                        filteredComBuscaIndep[p.grupo] = (filteredComBuscaIndep[p.grupo] || 0) + 1;
                      }
                    }
                  });
                } catch { /* batch falha, continua */ }
              }
              comBuscaMapRef.current = comBuscaMap;
              comBuscaAlertMapRef.current = comBuscaAlerts;
              setFilteredComBuscaMap(filteredComBusca);
              setFilteredComBuscaMapIndep(filteredComBuscaIndep);

              if (!cancelled) {
                setStats(prev => ({ ...prev, comBuscaMap }));
                const existingCache = getCache(ACOMP_CACHE_KEY) || {};
                setCache(ACOMP_CACHE_KEY, { ...existingCache, comBuscaMap, filteredComBuscaMap: filteredComBusca, filteredComBuscaMapIndep: filteredComBuscaIndep });
              }
            }
          } catch (e) {
            if (!cancelled) console.warn('[admin comBuscaMap] failed:', e);
          }
        }
        if (cancelled) return;

        // Regional breakdown — use already-loaded records (skip extra 130K query)
        const regionalSource = loadedRecords.length > 0 ? loadedRecords : [];
        regionalSource.forEach((p: any) => {
          if (p.unidade) regionalUnidade[p.unidade] = (regionalUnidade[p.unidade] || 0) + 1;
          if (p.equipe) regionalEquipe[p.equipe] = (regionalEquipe[p.equipe] || 0) + 1;
          if (p.microarea !== undefined && p.microarea !== null && p.microarea !== '') {
            const maKey = p.equipe ? `${p.equipe}/${p.microarea}` : String(p.microarea);
            regionalMicroarea[maKey] = (regionalMicroarea[maKey] || 0) + 1;
          }
        });

        // Só processa stats/acompTrend/comBuscaMap se tiver acompRecords de verdade
        if (scopedPatientIds.length > 0 || loadedRecords.length > 0 || acompRecords.length > 0) {
          // Process Acompanhamentos — contagem por paciente único (consistente com PatientsScreen)
          const uniqueAcompPacIds = new Set(acompRecords.map((r: any) => r.paciente).filter(Boolean));

          // Se for scope query, calcula alertComBusca a partir de loadedRecords
          if (isScopeQuery && loadedRecords.length > 0) {
            const alerts: Record<string, number> = {};
            loadedRecords.forEach(p => {
              if (uniqueAcompPacIds.has(p.id)) {
                let status: string;
                if (hasValue(p.dna_hpv_pep)) status = 'PEP_MOLECULAR';
                else if (hasValue(p.dna_hpv_gal)) status = 'COLETA_MOLECULAR';
                else if (hasValue(p.cito_pep)) status = 'PEP_CITO';
                else if (hasValue(p.cito_lab)) status = 'COLETA_CITO';
                else status = 'NAO_IDENTIFICADO';
                alerts[status] = (alerts[status] || 0) + 1;
              }
            });
            comBuscaAlertMapRef.current = alerts;
          }

          const aStats = {
            total: uniqueAcompPacIds.size,
            alertComBusca: comBuscaAlertMapRef.current,
            sucesso: acompRecords.filter(r => {
              const val = String(r.situacao_pos_busca || '').toLowerCase();
              return val && val.includes('agendamento');
            }).length,
            contatos: acompRecords.filter(r => {
              const val = String(r.tipo_contato || '').toLowerCase();
              return val && !val.includes('não houve contato');
            }).length,
            tipoBusca: {} as Record<string, number>,
            situacao: {} as Record<string, number>,
            entraves: {} as Record<string, number>,
            unidadeBreakdown: regionalUnidade,
            equipeBreakdown: regionalEquipe,
            microareaBreakdown: regionalMicroarea
          };

          const acompTrendMap2 = Object.fromEntries(lastSixMonths.map(month => [month.key, 0])) as Record<string, number>;
          const trendComContato = Object.fromEntries(lastSixMonths.map(month => [month.key, 0])) as Record<string, number>;
          const trendSemContato = Object.fromEntries(lastSixMonths.map(month => [month.key, 0])) as Record<string, number>;
          acompRecords.forEach(r => {
            const metodo = getAcompanhamentoMetodo(r);
            if (metodo) aStats.tipoBusca[metodo] = (aStats.tipoBusca[metodo] || 0) + 1;

            const canonicalSituacao = getCanonicalValue('situacao_pos_busca', r.situacao_pos_busca || '');
            if (canonicalSituacao) {
              aStats.situacao[canonicalSituacao] = (aStats.situacao[canonicalSituacao] || 0) + 1;
            }

            const entravesList = Array.isArray(r.entraves_identificados)
              ? r.entraves_identificados
              : r.entraves_identificados ? [r.entraves_identificados] : [];
            entravesList.forEach(val => {
              const cleanVal = val.replace(/^\d+\s*-\s*/, '');
              if (cleanVal) {
                aStats.entraves[cleanVal] = (aStats.entraves[cleanVal] || 0) + 1;
              }
            });

            const date = toValidDate(r.data_busca) || toValidDate(r.created);
            if (!date) return;
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (key in acompTrendMap2) acompTrendMap2[key] = (acompTrendMap2[key] || 0) + 1;

            const valContato = String(r.tipo_contato || '').toLowerCase();
            const temContato = valContato && !valContato.includes('não houve contato');
            if (key in trendComContato) {
              if (temContato) trendComContato[key]++;
              else trendSemContato[key]++;
            }
          });

          const acompTrendFinal = lastSixMonths.map(month => ({ month: month.label, total: acompTrendMap2[month.key] || 0 }));
          const examTrendFinal = lastSixMonths.map(month => ({ month: month.label, cito: trendComContato[month.key] || 0, hpv: trendSemContato[month.key] || 0 }));

          // Calcula comBuscaMap: contagem de pacientes COM acompanhamento por grupo (só pra scoped, admin já calculou)
          let scopedFilteredComBusca: Record<string, number> = {};
          let scopedFilteredComBuscaIndep: Record<string, number> = {};
          let scopedFilteredGroupCounts: Record<string, number> = {};
          let scopedFilteredGroupCountsIndep: Record<string, number> = {};
          if (loadedRecords.length > 0) {
            const pacComBusca = new Set(acompRecords.map((r: any) => r.paciente).filter(Boolean));
            const comBuscaMap: Record<string, number> = {};
            const filteredComBusca: Record<string, number> = {};
            const filteredComBuscaIndepLocal: Record<string, number> = {};
            loadedRecords.forEach((p: any) => {
              if (p.grupo && pacComBusca.has(p.id)) {
                comBuscaMap[p.grupo] = (comBuscaMap[p.grupo] || 0) + 1;
                const hasCito = !!(p.cito_pep && String(p.cito_pep).trim());
                const hasCitoLab = !!(p.cito_lab && String(p.cito_lab).trim());
                const hasDna = !!(p.dna_hpv_pep && String(p.dna_hpv_pep).trim());
                const hasDnaGal = !!(p.dna_hpv_gal && String(p.dna_hpv_gal).trim());
                const isP3049 = /30.*49/i.test(p.grupo);
                const isP5064 = /50.*6[0-4]|6[0-4].*50/i.test(p.grupo);
                const isP2529 = /25.*29|29.*25/i.test(p.grupo);
                const isP65plus = /6[45]>|65\+|6[45]\+|6[45]\s*anos|6[45]\s*$|6[45]\s*\)/i.test(p.grupo);
                const isPrioritario = isP3049 || isP5064 || isP2529 || isP65plus;
                if (isPrioritario && !hasCito && !hasCitoLab && !hasDna && !hasDnaGal) {
                  filteredComBusca[p.grupo] = (filteredComBusca[p.grupo] || 0) + 1;
                }
                // 3º card: comBusca sem DNA (inclui quem já tem cito)
                if (isPrioritario && !hasDna && !hasDnaGal) {
                  filteredComBuscaIndepLocal[p.grupo] = (filteredComBuscaIndepLocal[p.grupo] || 0) + 1;
                }
              }
            });
            comBuscaMapRef.current = comBuscaMap;
            setFilteredComBuscaMap(filteredComBusca);
            setFilteredComBuscaMapIndep(filteredComBuscaIndepLocal);
            scopedFilteredComBusca = filteredComBusca;
            scopedFilteredComBuscaIndep = filteredComBuscaIndepLocal;

            // Calcula filteredGroupCounts + filteredGroupCountsIndep a partir de loadedRecords
            const filteredGroupCountsLocal: Record<string, number> = {};
            const filteredGroupCountsIndepLocal: Record<string, number> = {};
            loadedRecords.forEach((p: any) => {
              const g = p.grupo || 'NÃO INFORMADO';
              const hasCito = !!(p.cito_pep && String(p.cito_pep).trim());
              const hasCitoLab = !!(p.cito_lab && String(p.cito_lab).trim());
              const hasDna = !!(p.dna_hpv_pep && String(p.dna_hpv_pep).trim());
              const hasDnaGal = !!(p.dna_hpv_gal && String(p.dna_hpv_gal).trim());
              const is3049 = /30.*49/i.test(g);
              const is5064 = /50.*6[0-4]|6[0-4].*50/i.test(g);
              const is2529 = /25.*29|29.*25/i.test(g);
              const is65plus = /6[45]>|65\+|6[45]\+|6[45]\s*anos|6[45]\s*$|6[45]\s*\)/i.test(g);
              const isPrioritario = is3049 || is5064 || is2529 || is65plus;
              if (isPrioritario && !hasCito && !hasCitoLab && !hasDna && !hasDnaGal) {
                filteredGroupCountsLocal[g] = (filteredGroupCountsLocal[g] || 0) + 1;
              }
              // 3º card: DNA não feito (cito irrelevante)
              if (isPrioritario && !hasDna && !hasDnaGal) {
                filteredGroupCountsIndepLocal[g] = (filteredGroupCountsIndepLocal[g] || 0) + 1;
              }
            });
            setFilteredGroupCounts(filteredGroupCountsLocal);
            setFilteredGroupCountsIndep(filteredGroupCountsIndepLocal);
            scopedFilteredGroupCounts = filteredGroupCountsLocal;
            scopedFilteredGroupCountsIndep = filteredGroupCountsIndepLocal;
          }

          if (!cancelled) {
            setStats(prev => ({ ...prev, examTrend: examTrendFinal, acompTrend: acompTrendFinal, comBuscaMap: comBuscaMapRef.current }));
            setAcompStats(aStats);
            setCache(ACOMP_CACHE_KEY, { acompStats: aStats, comBuscaMap: comBuscaMapRef.current, filteredComBuscaMap: scopedFilteredComBusca, filteredComBuscaMapIndep: scopedFilteredComBuscaIndep, filteredGroupCounts: scopedFilteredGroupCounts, filteredGroupCountsIndep: scopedFilteredGroupCountsIndep });
          }
        }
      } catch (error: any) {
        if (error?.isAbort) return;
        console.error('Erro ao buscar estatísticas:', error);
      } finally {
        setIsFilterLoading(false);
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchStats();
    return () => { cancelled = true; };
  }, [user?.id, user?.role, user?.unidade_saude, user?.equipe, user?.microarea, isAdmin, debouncedFilterDataInicio, debouncedFilterDataFim, debouncedFilterUnidade, debouncedFilterEquipe, debouncedFilterMicroarea]);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <Header 
        title="Resumo" 
        pageTitle="Resumo" 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 no-scrollbar relative">
        <div className="max-w-[1600px] mx-auto space-y-8 md:space-y-10">
          
          <div className="flex flex-col gap-6 mb-8 items-center lg:items-stretch justify-center">
            {/* Card Principal de Boas-vindas */}
            <div className="w-full bg-gradient-to-br from-[#001b3d] to-[#002b5c] p-4 md:p-10 rounded-2xl md:rounded-[2.5rem] text-white relative overflow-hidden group shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 md:gap-10 text-center md:text-left">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>

              <div className="relative z-10 flex-1 max-w-[80%]">
                <div className="flex items-center justify-center md:justify-start gap-3">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-white/10 backdrop-blur-md rounded-2xl md:rounded-3xl flex items-center justify-center ring-1 ring-white/20 shadow-inner">
                    <LayoutDashboard className="w-8 h-8 md:w-10 md:h-10 text-blue-300" />
                  </div>
                  <h1 className="text-2xl md:text-[2.5rem] font-black tracking-tight uppercase leading-none">Resumo <span className="text-blue-300 opacity-50">Geral</span></h1>
                </div>
              </div>

              {/* Total de Pacientes */}
              <div className="relative z-10 md:-ml-[10%] flex flex-col items-center">
                <span className="text-[10px] md:text-xs font-black text-white/40 uppercase tracking-[0.3em] mb-1">Total de Pacientes</span>
                <span className="text-4xl md:text-5xl font-black text-white leading-none tracking-tighter tabular-nums">
                  {displayStats.totalPacientes.toLocaleString('pt-BR')}
                </span>
              </div>

              {/* Botão de Filtro */}
              <div className="relative z-10">
                <button
                  onClick={() => setIsFilterVisible(!isFilterVisible)}
                  className={`flex items-center gap-2 md:gap-3 px-4 md:px-8 h-12 md:h-14 rounded-2xl text-[10px] md:text-sm font-black uppercase tracking-widest transition-all duration-500 border ${
                    isFilterVisible || filterUnidade.length > 0 || filterEquipe.length > 0 || filterMicroarea.length > 0 || filterDataInicio || filterDataFim
                      ? 'bg-primary text-white border-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]'
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  <Filter className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="hidden sm:inline">Filtros</span>
                  {(filterUnidade.length > 0 || filterEquipe.length > 0 || filterMicroarea.length > 0 || filterDataInicio || filterDataFim) && (
                    <div className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center bg-white text-primary text-[9px] md:text-[10px] rounded-full font-black animate-pulse">
                      {[filterUnidade, filterEquipe, filterMicroarea].filter(f => f.length > 0).length + (filterDataInicio || filterDataFim ? 1 : 0)}
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Painel de Filtros Avançados - Colapsável */}
            {isFilterVisible && (
              <div className="w-full bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-primary/5 relative animate-in slide-in-from-top-6 fade-in duration-500">
                <div className="flex items-center justify-between gap-4 mb-6 w-full">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/5 rounded-xl text-primary">
                      <Filter className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-black text-primary uppercase tracking-tighter">Filtros Avançados</h2>
                  </div>
                  <button 
                    onClick={() => setIsFilterVisible(false)}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="md:col-span-2 space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                      <Calendar className="w-3.5 h-3.5" />
                      Período de Referência
                    </label>
                    <div className="flex gap-4">
                      <DatePickerPTBR 
                        placeholder="Início"
                        value={filterDataInicio}
                        onChange={setFilterDataInicio}
                      />
                      <DatePickerPTBR 
                        placeholder="Fim"
                        value={filterDataFim}
                        onChange={setFilterDataFim}
                      />
                    </div>
                  </div>

                  {(isAdmin || user?.role === 'cap') && (
                    <div className="space-y-3">
                      <MultiSelect 
                        label="Unidades"
                        placeholder="Todas as Unidades"
                        options={Object.keys(UNIDADES_EQUIPES)}
                        value={filterUnidade}
                        onChange={(val) => {
                          setFilterUnidade(val);
                          setFilterEquipe([]);
                          setFilterMicroarea([]);
                        }}
                      />
                    </div>
                  )}

                  {(isAdmin || user?.role === 'cap' || user?.role === 'unidade') && (
                    <div className="space-y-3">
                      <MultiSelect 
                        label="Equipes"
                        placeholder="Todas as Equipes"
                        options={
                          filterUnidade.length > 0 
                            ? Array.from(new Set(filterUnidade.flatMap(u => UNIDADES_EQUIPES[u] || [])))
                            : user?.role === 'unidade' 
                              ? UNIDADES_EQUIPES[user.unidade_saude] || []
                              : []
                        }
                        value={filterEquipe}
                        onChange={(val) => {
                          setFilterEquipe(val);
                          setFilterMicroarea([]);
                        }}
                        disabled={filterUnidade.length === 0 && user?.role === 'cap'}
                      />
                    </div>
                  )}

                  {(isAdmin || user?.role === 'cap' || user?.role === 'unidade' || user?.role === 'equipe') && (
                    <div className="space-y-3">
                      <MultiSelect 
                        label="Microáreas"
                        placeholder="Todas as Microáreas"
                        options={MICROAREAS.map(ma => ma.toString())}
                        value={filterMicroarea}
                        onChange={setFilterMicroarea}
                        disabled={filterEquipe.length === 0 && user?.role === 'cap'}
                      />
                    </div>
                  )}

                  <div className={`flex items-end gap-4 ${
                    // Se apenas o período estiver visível (2 colunas), botões ocupam as outras 2 colunas
                    !(isAdmin || user?.role === 'cap' || user?.role === 'unidade' || user?.role === 'equipe') 
                    ? 'md:col-span-2' 
                    : 'md:col-span-2 lg:col-span-4'
                  }`}>
                    <button 
                      onClick={() => { 
                        setFilterDataInicio(''); 
                        setFilterDataFim('');
                        setFilterUnidade([]);
                        setFilterEquipe([]);
                        setFilterMicroarea([]);
                        localStorage.removeItem('dashboard:pendingFilter');
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-4 bg-rose-50 text-rose-600 text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-rose-100 transition-all border border-rose-100"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Limpar
                    </button>
                    <button
                      onClick={() => { setIsFilterVisible(false); setIsFilterLoading(true); }}
                      className="flex-1 py-4 bg-primary text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                    >
                      Aplicar Filtros
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        {/* SELECIONE O GRUPO PRIORITÁRIO */}
          {(() => {
            const PRIORITY_GROUPS = [
              { num: '1º', titulo: 'Mulheres de 30 a 49 anos', desc: 'em atraso no rastreamento com exame e, também, ainda não realizaram o teste de DNA-HPV citopatológico (mais de 3 anos sem rastreio)', pattern: /30.*49/i, color: 'purple', gradient: 'from-purple-600 to-purple-400', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', ring: 'ring-purple-400/30', glow: 'shadow-purple-500/25', hoverGlow: 'hover:shadow-purple-500/40', hoverBorder: 'hover:border-purple-400', numBg: 'bg-purple-600', numText: 'text-white', iconColor: 'text-purple-500' },
              { num: '2º', titulo: 'Mulheres de 50 a 64 anos', desc: 'em atraso no rastreamento com exame e, também, ainda não realizaram o teste de DNA-HPV citopatológico (mais de 3 anos sem rastreio)', pattern: /50.*6[0-4]|6[0-4].*50|50.*65(?![0-9])|50.*65$/i, color: 'fuchsia', gradient: 'from-fuchsia-600 to-fuchsia-400', bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-700', ring: 'ring-fuchsia-400/30', glow: 'shadow-fuchsia-500/25', hoverGlow: 'hover:shadow-fuchsia-500/40', hoverBorder: 'hover:border-fuchsia-400', numBg: 'bg-fuchsia-600', numText: 'text-white', iconColor: 'text-fuchsia-500' },
              { num: '3º', titulo: 'Mulheres de 30 a 49 anos', desc: 'citopatológico e, também, ainda não realizaram o teste de DNA-HPV', pattern: /30.*49/i, color: 'violet', gradient: 'from-violet-600 to-violet-400', bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', ring: 'ring-violet-400/30', glow: 'shadow-violet-500/25', hoverGlow: 'hover:shadow-violet-500/40', hoverBorder: 'hover:border-violet-400', numBg: 'bg-violet-600', numText: 'text-white', iconColor: 'text-violet-500' },
              { num: '4º', titulo: 'Mulheres de 25 a 29 anos', desc: 'que nunca fizeram o rastreamento com o exame citopatológico e, também, ainda não realizaram o teste de DNA-HPV', pattern: /25.*29|29.*25/i, color: 'brown', gradient: 'from-[#92400e] to-[#b45309]', bg: 'bg-[#faf7f2]', border: 'border-[#e9e0d2]', text: 'text-[#78350f]', ring: 'ring-[#92400e]/30', glow: 'shadow-[#92400e]/25', hoverGlow: 'hover:shadow-[#92400e]/40', hoverBorder: 'hover:border-[#92400e]', numBg: 'bg-[#92400e]', numText: 'text-white', iconColor: 'text-[#92400e]' },
            ];
            const gb = Object.keys(grupoBreakdownRef.current).length > 0 ? grupoBreakdownRef.current : stats.grupoBreakdown;
            if (!gb || Object.keys(gb).length === 0) {
              if (!isLoading) return null;
              // Loading: mostra 4 cartões reais com skeleton apenas nos números
              return (
                <div className="mb-8 md:mb-12">
                  <div className="text-center mb-8">
                    <h2 className="text-xs md:text-sm font-black text-primary/40 uppercase tracking-[0.25em]">Selecione o Grupo Prioritário</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                    {PRIORITY_GROUPS.slice(0, 4).map((c, i) => (
                      <div key={i} className={`group relative bg-white rounded-2xl border-2 ${c.border} shadow-lg ${c.glow}`}>
                        <div className={`h-1 w-full bg-gradient-to-r ${c.gradient} opacity-70`} />
                        <div className="p-5 md:p-6 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${c.numBg} ${c.numText} text-xs font-black shadow-md ring-2 ${c.ring}`}>
                                  {c.num}
                                </span>
                                <span className={`text-[7px] font-black ${c.text} uppercase tracking-widest leading-none opacity-60`}>Grupo</span>
                              </div>
                              <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center ring-1 ${c.ring}`}>
                                <Users className={`w-4 h-4 ${c.iconColor}`} />
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="skeleton-scan inline-block h-6 w-16 shadow-sm" />
                              <span className="skeleton-scan inline-block h-2.5 w-8 mt-0.5 shadow-xs" />
                            </div>
                          </div>
                          <h3 className={`text-sm md:text-base font-black ${c.text} uppercase tracking-wide leading-snug`}>{c.titulo}</h3>
                          <p className="text-[10px] md:text-[11px] font-medium text-slate-500 leading-relaxed">{c.desc}</p>
                          <div className="mt-1 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full bg-gradient-to-r ${c.gradient} rounded-full w-0 transition-all duration-700`} />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }
            const EXTRA_COLORS = ['indigo', 'slate', 'cyan', 'amber', 'teal', 'pink', 'rose', 'orange'];
            const extraColorMap: Record<string, { gradient: string; bg: string; border: string; text: string; ring: string; glow: string; hoverGlow: string; hoverBorder: string; numBg: string; numText: string; iconColor: string }> = {
              indigo: { gradient: 'from-indigo-600 to-indigo-400', bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', ring: 'ring-indigo-400/30', glow: 'shadow-indigo-500/25', hoverGlow: 'hover:shadow-indigo-500/40', hoverBorder: 'hover:border-indigo-400', numBg: 'bg-indigo-600', numText: 'text-white', iconColor: 'text-indigo-500' },
              slate: { gradient: 'from-slate-600 to-slate-400', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', ring: 'ring-slate-400/30', glow: 'shadow-slate-500/25', hoverGlow: 'hover:shadow-slate-500/40', hoverBorder: 'hover:border-slate-400', numBg: 'bg-slate-600', numText: 'text-white', iconColor: 'text-slate-500' },
              cyan: { gradient: 'from-cyan-600 to-cyan-400', bg: 'bg-cyan-50', border: 'border-cyan-200', text: 'text-cyan-700', ring: 'ring-cyan-400/30', glow: 'shadow-cyan-500/25', hoverGlow: 'hover:shadow-cyan-500/40', hoverBorder: 'hover:border-cyan-400', numBg: 'bg-cyan-600', numText: 'text-white', iconColor: 'text-cyan-500' },
              amber: { gradient: 'from-amber-600 to-amber-400', bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', ring: 'ring-amber-400/30', glow: 'shadow-amber-500/25', hoverGlow: 'hover:shadow-amber-500/40', hoverBorder: 'hover:border-amber-400', numBg: 'bg-amber-600', numText: 'text-white', iconColor: 'text-amber-500' },
              teal: { gradient: 'from-teal-600 to-teal-400', bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', ring: 'ring-teal-400/30', glow: 'shadow-teal-500/25', hoverGlow: 'hover:shadow-teal-500/40', hoverBorder: 'hover:border-teal-400', numBg: 'bg-teal-600', numText: 'text-white', iconColor: 'text-teal-500' },
              pink: { gradient: 'from-pink-600 to-pink-400', bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', ring: 'ring-pink-400/30', glow: 'shadow-pink-500/25', hoverGlow: 'hover:shadow-pink-500/40', hoverBorder: 'hover:border-pink-400', numBg: 'bg-pink-600', numText: 'text-white', iconColor: 'text-pink-500' },
              rose: { gradient: 'from-rose-600 to-rose-400', bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', ring: 'ring-rose-400/30', glow: 'shadow-rose-500/25', hoverGlow: 'hover:shadow-rose-500/40', hoverBorder: 'hover:border-rose-400', numBg: 'bg-rose-600', numText: 'text-white', iconColor: 'text-rose-500' },
              orange: { gradient: 'from-orange-600 to-orange-400', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', ring: 'ring-orange-400/30', glow: 'shadow-orange-500/25', hoverGlow: 'hover:shadow-orange-500/40', hoverBorder: 'hover:border-orange-400', numBg: 'bg-orange-600', numText: 'text-white', iconColor: 'text-orange-500' },
            };

            const allGroups = Object.entries(gb)
              .filter(([k]) => k !== 'NÃO INFORMADO' && k !== '--')
              .map(([k, v]) => ({ grupo: k, count: Number(v) || 0 }));

            // Refatoração: Agrupar por cartão de prioridade (sumarizando se múltiplos grupos DB baterem no mesmo card)
            const matched: { count: number; titulo: string; desc: string; num: string; priority: typeof PRIORITY_GROUPS[0]; prioIdx: number; gruposDB: string[] }[] = [];
            
            PRIORITY_GROUPS.forEach((pg, prioIdx) => {
              let gruposDB: string[];
              if ('reuseFrom' in pg && typeof (pg as any).reuseFrom === 'number') {
                gruposDB = matched[(pg as any).reuseFrom]?.gruposDB ?? [];
              } else {
                gruposDB = allGroups.filter(g => pg.pattern.test(g.grupo)).map(g => g.grupo);
              }

              if (gruposDB.length > 0) {
                const isIndependente = 'reuseFrom' in pg && typeof (pg as any).reuseFrom === 'number';
                const totalCount = gruposDB.reduce((acc, gName) => {
                  const grpObj = allGroups.find(g => g.grupo === gName);
                  if (!grpObj) return acc;
                  const baseCount = filteredGroupCounts?.[gName] ?? grpObj.count;
                  return acc + (isIndependente ? (filteredGroupCountsIndep?.[gName] ?? baseCount) : baseCount);
                }, 0);

                matched.push({
                  count: totalCount,
                  titulo: pg.titulo,
                  desc: pg.desc,
                  num: pg.num,
                  priority: pg,
                  prioIdx,
                  gruposDB
                });
              }
            });

            // Grupos que não bateram em nenhum card de prioridade (exclui grupos de idade acima de 64)
            const matchedGroupsSet = new Set(matched.flatMap(m => m.gruposDB));
            const unmatched = allGroups
              .filter(g => !matchedGroupsSet.has(g.grupo) && !/6[45]>|65\+|6[45]\+|6[45]\s*anos|6[45]\s*$|6[45]\s*\)/i.test(g.grupo))
              .map((g, idx) => ({
                grupo: g.grupo,
                count: g.count,
                titulo: `Mulheres de ${g.grupo} anos`,
                num: `${matched.length + idx + 1}º`,
                gruposDB: [g.grupo]
              }));

            const totalPct = (v: number) => stats.totalPacientes > 0 ? Math.round((v / stats.totalPacientes) * 100) : 0;

            return (
              <div ref={grupoContainerRef} className="mb-8 md:mb-12">
                <div className="text-center mb-8">
                  <h2 className="text-xs md:text-sm font-black text-primary/40 uppercase tracking-[0.25em]">Selecione o Grupo Prioritário</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                  {/* Priority matched cards */}
                  {matched.map((item) => {
                    const c = item.priority;
                    const pct = totalPct(item.count);
                    const isSelected = selectedPrioIdx === item.prioIdx;
                    return (
                      <div
                        key={item.prioIdx}
                        onClick={() => handleGrupoClick(item.prioIdx, item.gruposDB, 'reuseFrom' in (item.priority as any) && typeof (item.priority as any).reuseFrom === 'number')}
                        className={`group relative bg-white rounded-2xl border-2 ${isSelected ? `${c.border} ring-4 ${c.ring} shadow-xl` : `${c.border} ${c.hoverBorder} shadow-lg ${c.glow} ${c.hoverGlow}`} hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1 transition-all duration-500 cursor-pointer ${isSelected ? '' : 'overflow-hidden'}`}
                      >
                        <div className={`h-1 w-full bg-gradient-to-r ${c.gradient} ${isSelected ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'} transition-opacity`} />
                        <div className="p-5 md:p-6 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${isSelected ? `${c.numBg} animate-pulse` : c.numBg} ${c.numText} text-xs font-black shadow-md ring-2 ${c.ring}`}>
                                  {c.num}
                                </span>
                                <span className={`text-[7px] font-black ${c.text} uppercase tracking-widest leading-none opacity-60`}>Grupo</span>
                              </div>
                              <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center ring-1 ${c.ring}`}>
                                <Users className={`w-4 h-4 ${c.iconColor}`} />
                              </div>
                            </div>
                            <div className="text-right">
                              {isLoadingPrioCounts ? (
                                <span className="skeleton-scan inline-block h-6 w-16 shadow-sm" />
                              ) : (
                                <span className="text-lg md:text-xl font-black text-slate-800 tabular-nums animate-fade-in">{item.count.toLocaleString('pt-BR')}</span>
                              )}
                              {isLoadingPrioCounts ? (
                                <span className="skeleton-scan inline-block h-2.5 w-8 mt-0.5 shadow-xs" />
                              ) : (
                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest animate-fade-in">{pct}%</span>
                              )}
                            </div>
                          </div>
                          <h3
                            onClick={(e) => { e.stopPropagation(); handleGrupoClick(item.prioIdx, item.gruposDB, 'reuseFrom' in (item.priority as any) && typeof (item.priority as any).reuseFrom === 'number'); }}
                            className={`text-sm md:text-base font-black ${c.text} uppercase tracking-wide leading-snug cursor-pointer`}
                          >{c.titulo}</h3>
                          <p className="text-[10px] md:text-[11px] font-medium text-slate-500 leading-relaxed">{c.desc}</p>
                          <div className="mt-1 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full bg-gradient-to-r ${c.gradient} rounded-full transition-all duration-700`} style={{ width: `${Math.max(pct, 3)}%` }} />
                          </div>
                          {/* Conteúdo expandido quando selecionado */}
                          {isSelected && (
                            <div className={`relative flex flex-col gap-3 mt-1 animate-fade-in-up`} onClick={(e) => e.stopPropagation()}>
                              {/* Datas */}
                              <div className="flex gap-3" onMouseDown={(e) => e.stopPropagation()}>
                                <div className="flex-1 min-w-0">
                                  <label className={`text-[8px] font-black ${c.text} uppercase tracking-widest mb-1.5 block`}>Data Inicial</label>
                                  <DatePickerPTBR placeholder="Início" value={grupoDataInicio} onChange={setGrupoDataInicio} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <label className={`text-[8px] font-black ${c.text} uppercase tracking-widest mb-1.5 block`}>Data Final</label>
                                  <DatePickerPTBR placeholder="Fim" value={grupoDataFim} onChange={setGrupoDataFim} />
                                </div>
                              </div>
                              {/* Contadores Sem Busca / Com Busca */}
                              {hasOneDateOnly && selectedGrupo ? (
                                <div className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-amber-300/80 bg-amber-50/50" onMouseDown={(e) => e.stopPropagation()}>
                                  <Calendar className="w-4 h-4 text-amber-500" />
                                  <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Preencha ambos os campos de data</span>
                                </div>
                              ) : (isLoadingPrioCounts || !grupoBuscaStats) && selectedGrupo ? (
                                <div className="grid grid-cols-2 gap-2" onMouseDown={(e) => e.stopPropagation()}>
                                  <div className="rounded-xl p-3 border-2 border-rose-200/80 shadow-sm shadow-rose-100/40">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <span className="skeleton-scan skeleton-scan-rose w-3.5 h-3.5 !rounded-full shadow-sm" />
                                      <span className="skeleton-scan skeleton-scan-rose h-2 w-12 !rounded-sm" />
                                    </div>
                                    <div className="flex items-end justify-between">
                                      <span className="skeleton-scan skeleton-scan-rose h-4 w-10 shadow-sm" />
                                      <span className="skeleton-scan skeleton-scan-rose h-2 w-6 !rounded-sm shadow-xs" />
                                    </div>
                                  </div>
                                  <div className="rounded-xl p-3 border-2 border-emerald-200/80 shadow-sm shadow-emerald-100/40">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <span className="skeleton-scan skeleton-scan-emerald w-3.5 h-3.5 !rounded-full shadow-sm" />
                                      <span className="skeleton-scan skeleton-scan-emerald h-2 w-12 !rounded-sm" />
                                    </div>
                                    <div className="flex items-end justify-between">
                                      <span className="skeleton-scan skeleton-scan-emerald h-4 w-10 shadow-sm" />
                                      <span className="skeleton-scan skeleton-scan-emerald h-2 w-6 !rounded-sm shadow-xs" />
                                    </div>
                                  </div>
                                </div>
                              ) : grupoBuscaStats ? (
                                <div className="grid grid-cols-2 gap-2" onMouseDown={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFilterBuscaAtiva(prev => (prev === false ? undefined : false));
                                    }}
                                    className={`rounded-xl p-3 border-2 shadow-sm transition-all duration-300 cursor-pointer text-left group/btn ${
                                      filterBuscaAtiva === false
                                        ? 'bg-gradient-to-br from-rose-100 to-rose-200/80 border-rose-400 shadow-md shadow-rose-200/50 ring-2 ring-rose-300/50 scale-[1.03]'
                                        : 'bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200/60 hover:border-rose-300 hover:shadow-md hover:shadow-rose-100/50 hover:scale-[1.02]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-sm transition-all duration-300 ${
                                        filterBuscaAtiva === false ? 'bg-rose-600 shadow-rose-500/40 scale-110' : 'bg-rose-500 shadow-rose-500/30'
                                      }`}>
                                        <CircleOff className="w-2 h-2 text-white" />
                                      </div>
                                      <p className={`text-[7px] font-black uppercase tracking-widest leading-none transition-colors ${
                                        filterBuscaAtiva === false ? 'text-rose-800' : 'text-rose-700'
                                      }`}>Sem Busca</p>
                                    </div>
                                    <div className="flex items-end justify-between">
                                      <span key={`sb-${grupoBuscaStats.semBusca}`} className={`text-sm font-black tabular-nums leading-none transition-colors animate-fade-in ${
                                        filterBuscaAtiva === false ? 'text-rose-900' : 'text-rose-800'
                                      }`}>{grupoBuscaStats.semBusca.toLocaleString('pt-BR')}</span>
                                      <span key={`sbp-${grupoBuscaStats.semBusca}`} className="text-[9px] font-black text-rose-600 tabular-nums animate-fade-in">{item.count > 0 ? Math.round((grupoBuscaStats.semBusca / item.count) * 100) : 0}%</span>
                                    </div>
                                    {filterBuscaAtiva === false && (
                                      <div className="mt-2 h-0.5 w-full bg-rose-400 rounded-full" />
                                    )}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFilterBuscaAtiva(prev => (prev === true ? undefined : true));
                                    }}
                                    className={`rounded-xl p-3 border-2 shadow-sm transition-all duration-300 cursor-pointer text-left group/btn ${
                                      filterBuscaAtiva === true
                                        ? 'bg-gradient-to-br from-emerald-100 to-emerald-200/80 border-emerald-400 shadow-md shadow-emerald-200/50 ring-2 ring-emerald-300/50 scale-[1.03]'
                                        : 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-100/50 hover:scale-[1.02]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-sm transition-all duration-300 ${
                                        filterBuscaAtiva === true ? 'bg-emerald-600 shadow-emerald-500/40 scale-110' : 'bg-emerald-500 shadow-emerald-500/30'
                                      }`}>
                                        <Search className="w-2 h-2 text-white" />
                                      </div>
                                      <p className={`text-[7px] font-black uppercase tracking-widest leading-none transition-colors ${
                                        filterBuscaAtiva === true ? 'text-emerald-800' : 'text-emerald-700'
                                      }`}>Com Busca</p>
                                    </div>
                                    <div className="flex items-end justify-between">
                                      <span key={`cb-${grupoBuscaStats.comBusca}`} className={`text-sm font-black tabular-nums leading-none transition-colors animate-fade-in ${
                                        filterBuscaAtiva === true ? 'text-emerald-900' : 'text-emerald-800'
                                      }`}>{grupoBuscaStats.comBusca.toLocaleString('pt-BR')}</span>
                                      <span key={`cbp-${grupoBuscaStats.comBusca}`} className="text-[9px] font-black text-emerald-600 tabular-nums animate-fade-in">{item.count > 0 ? Math.round((grupoBuscaStats.comBusca / item.count) * 100) : 0}%</span>
                                    </div>
                                    {filterBuscaAtiva === true && (
                                      <div className="mt-2 h-0.5 w-full bg-emerald-400 rounded-full" />
                                    )}
                                  </button>
                                </div>
                              ) : null}
                              {/* Botão ir para listagem */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const pending: any = { filterGrupo: item.gruposDB, grupoNum: c.num, grupoTitulo: c.titulo, grupoDescricao: c.desc };
                                  const isIndependente = 'reuseFrom' in c && typeof (c as any).reuseFrom === 'number';
                                  // Filtro cito: SEMPRE (exceto COM BUSCA + datas ou independente)
                                  const isComBuscaComDatas = filterBuscaAtiva === true && (grupoDataInicio || grupoDataFim);
                                  
                                  if (!isComBuscaComDatas && !isIndependente) {
                                    pending.filterDnaHpvPep = 'NÃO';
                                    pending.filterDnaHpvGal = 'NÃO';
                                    pending.filterCitoPep = 'NÃO';
                                    pending.filterCitoLab = 'NÃO';
                                  } else if (!isComBuscaComDatas && isIndependente) {
                                    // 3º card: só DNA não feito (inclui cito feito)
                                    pending.filterDnaHpvPep = 'NÃO';
                                    pending.filterDnaHpvGal = 'NÃO';
                                  }
                                  // Envia filtros SEM/COM BUSCA + datas quando selecionado
                                  if (filterBuscaAtiva !== undefined) {
                                    if (grupoDataInicio) pending.filterDataInicio = grupoDataInicio;
                                    if (grupoDataFim) pending.filterDataFim = grupoDataFim;
                                    pending.buscaAtiva = filterBuscaAtiva;
                                  }
                                  localStorage.setItem('dashboard:pendingFilter', JSON.stringify(pending));
                                  setActiveTab('pacientes');
                                }}
                                disabled={isLoadingPrioCounts || !grupoBuscaStats || hasOneDateOnly}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
                                  isLoadingPrioCounts || !grupoBuscaStats || hasOneDateOnly
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                    : `${c.numBg} text-white shadow-lg hover:opacity-90 hover:shadow-xl cursor-pointer`
                                }`}
                              >
                                <ArrowRightCircle className="w-3.5 h-3.5" />
                                Ir para relação de pacientes
                              </button>
                            </div>
                          )}
                        </div>
                        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${c.gradient} ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'} transition-opacity duration-500`} />
                      </div>
                    );
                  })}
                  {/* Extra unmatched groups */}
                  {unmatched.map((item, idx) => {
                    const colorName = EXTRA_COLORS[idx % EXTRA_COLORS.length];
                    const c = extraColorMap[colorName];
                    const pct = totalPct(item.count);
                    const isSelected = selectedGrupo === item.grupo;
                    return (
                      <div
                        key={item.grupo}
                        onClick={() => handleGrupoClick(item.num, item.gruposDB)}
                        className={`group relative bg-white rounded-2xl border-2 ${isSelected ? `${c.border} ring-4 ${c.ring} shadow-xl` : `${c.border} ${c.hoverBorder} shadow-lg ${c.glow} ${c.hoverGlow}`} hover:shadow-xl hover:scale-[1.02] hover:-translate-y-1 transition-all duration-500 cursor-pointer ${isSelected ? '' : 'overflow-hidden'}`}
                      >
                        <div className={`h-1 w-full bg-gradient-to-r ${c.gradient} ${isSelected ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'} transition-opacity`} />
                        <div className="p-5 md:p-6 flex flex-col gap-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`inline-flex items-center justify-center w-9 h-9 rounded-xl ${isSelected ? `${c.numBg} animate-pulse` : c.numBg} ${c.numText} text-[10px] font-black shadow-md ring-2 ${c.ring}`}>
                                  {item.num}
                                </span>
                                <span className={`text-[7px] font-black ${c.text} uppercase tracking-widest leading-none opacity-60`}>Grupo</span>
                              </div>
                              <div className={`w-7 h-7 rounded-lg ${c.bg} flex items-center justify-center ring-1 ${c.ring}`}>
                                <Users className={`w-4 h-4 ${c.iconColor}`} />
                              </div>
                            </div>
                            <div className="text-right">
                              {isLoadingPrioCounts ? (
                                <span className="skeleton-scan inline-block h-6 w-16 shadow-sm" />
                              ) : (
                                <span className="text-lg md:text-xl font-black text-slate-800 tabular-nums animate-fade-in">{item.count.toLocaleString('pt-BR')}</span>
                              )}
                              {isLoadingPrioCounts ? (
                                <span className="skeleton-scan inline-block h-2.5 w-8 mt-0.5 shadow-xs" />
                              ) : (
                                <span className="block text-[9px] font-black text-slate-400 uppercase tracking-widest animate-fade-in">{pct}%</span>
                              )}
                            </div>
                          </div>
                          <h3 className={`text-sm md:text-base font-black ${c.text} uppercase tracking-wide leading-snug truncate`} title={item.grupo}>Mulheres de {item.grupo}</h3>
                          <div className="mt-1 h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full bg-gradient-to-r ${c.gradient} rounded-full transition-all duration-700`} style={{ width: `${Math.max(pct, 3)}%` }} />
                          </div>
                          {/* Conteúdo expandido quando selecionado — extras */}
                          {isSelected && (
                            <div className={`relative flex flex-col gap-3 mt-1 animate-fade-in-up`} onClick={(e) => e.stopPropagation()}>
                              {/* Datas */}
                              <div className="flex gap-3" onMouseDown={(e) => e.stopPropagation()}>
                                <div className="flex-1 min-w-0">
                                  <label className={`text-[8px] font-black ${c.text} uppercase tracking-widest mb-1.5 block`}>Data Inicial</label>
                                  <DatePickerPTBR placeholder="Início" value={grupoDataInicio} onChange={setGrupoDataInicio} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <label className={`text-[8px] font-black ${c.text} uppercase tracking-widest mb-1.5 block`}>Data Final</label>
                                  <DatePickerPTBR placeholder="Fim" value={grupoDataFim} onChange={setGrupoDataFim} />
                                </div>
                              </div>
                              {/* Contadores Sem Busca / Com Busca */}
                              {hasOneDateOnly && selectedGrupo ? (
                                <div className="flex items-center justify-center gap-2 py-4 rounded-xl border-2 border-dashed border-amber-300/80 bg-amber-50/50" onMouseDown={(e) => e.stopPropagation()}>
                                  <Calendar className="w-4 h-4 text-amber-500" />
                                  <span className="text-[9px] font-black text-amber-600 uppercase tracking-widest">Preencha ambos os campos de data</span>
                                </div>
                              ) : (isLoadingPrioCounts || !grupoBuscaStats) && selectedGrupo ? (
                                <div className="grid grid-cols-2 gap-2" onMouseDown={(e) => e.stopPropagation()}>
                                  <div className="rounded-xl p-3 border-2 border-rose-200/80 shadow-sm shadow-rose-100/40">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <span className="skeleton-scan skeleton-scan-rose w-3.5 h-3.5 !rounded-full shadow-sm" />
                                      <span className="skeleton-scan skeleton-scan-rose h-2 w-12 !rounded-sm" />
                                    </div>
                                    <div className="flex items-end justify-between">
                                      <span className="skeleton-scan skeleton-scan-rose h-4 w-10 shadow-sm" />
                                      <span className="skeleton-scan skeleton-scan-rose h-2 w-6 !rounded-sm shadow-xs" />
                                    </div>
                                  </div>
                                  <div className="rounded-xl p-3 border-2 border-emerald-200/80 shadow-sm shadow-emerald-100/40">
                                    <div className="flex items-center gap-1.5 mb-2">
                                      <span className="skeleton-scan skeleton-scan-emerald w-3.5 h-3.5 !rounded-full shadow-sm" />
                                      <span className="skeleton-scan skeleton-scan-emerald h-2 w-12 !rounded-sm" />
                                    </div>
                                    <div className="flex items-end justify-between">
                                      <span className="skeleton-scan skeleton-scan-emerald h-4 w-10 shadow-sm" />
                                      <span className="skeleton-scan skeleton-scan-emerald h-2 w-6 !rounded-sm shadow-xs" />
                                    </div>
                                  </div>
                                </div>
                              ) : grupoBuscaStats ? (
                                <div className="grid grid-cols-2 gap-2" onMouseDown={(e) => e.stopPropagation()}>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFilterBuscaAtiva(prev => (prev === false ? undefined : false));
                                    }}
                                    className={`rounded-xl p-3 border-2 shadow-sm transition-all duration-300 cursor-pointer text-left group/btn ${
                                      filterBuscaAtiva === false
                                        ? 'bg-gradient-to-br from-rose-100 to-rose-200/80 border-rose-400 shadow-md shadow-rose-200/50 ring-2 ring-rose-300/50 scale-[1.03]'
                                        : 'bg-gradient-to-br from-rose-50 to-rose-100/50 border-rose-200/60 hover:border-rose-300 hover:shadow-md hover:shadow-rose-100/50 hover:scale-[1.02]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-sm transition-all duration-300 ${
                                        filterBuscaAtiva === false ? 'bg-rose-600 shadow-rose-500/40 scale-110' : 'bg-rose-500 shadow-rose-500/30'
                                      }`}>
                                        <CircleOff className="w-2 h-2 text-white" />
                                      </div>
                                      <p className={`text-[7px] font-black uppercase tracking-widest leading-none transition-colors ${
                                        filterBuscaAtiva === false ? 'text-rose-800' : 'text-rose-700'
                                      }`}>Sem Busca</p>
                                    </div>
                                    <div className="flex items-end justify-between">
                                      <span key={`sb2-${grupoBuscaStats.semBusca}`} className={`text-sm font-black tabular-nums leading-none transition-colors animate-fade-in ${
                                        filterBuscaAtiva === false ? 'text-rose-900' : 'text-rose-800'
                                      }`}>{grupoBuscaStats.semBusca.toLocaleString('pt-BR')}</span>
                                      <span key={`sbp2-${grupoBuscaStats.semBusca}`} className="text-[9px] font-black text-rose-600 tabular-nums animate-fade-in">{item.count > 0 ? Math.round((grupoBuscaStats.semBusca / item.count) * 100) : 0}%</span>
                                    </div>
                                    {filterBuscaAtiva === false && (
                                      <div className="mt-2 h-0.5 w-full bg-rose-400 rounded-full" />
                                    )}
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFilterBuscaAtiva(prev => (prev === true ? undefined : true));
                                    }}
                                    className={`rounded-xl p-3 border-2 shadow-sm transition-all duration-300 cursor-pointer text-left group/btn ${
                                      filterBuscaAtiva === true
                                        ? 'bg-gradient-to-br from-emerald-100 to-emerald-200/80 border-emerald-400 shadow-md shadow-emerald-200/50 ring-2 ring-emerald-300/50 scale-[1.03]'
                                        : 'bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200/60 hover:border-emerald-300 hover:shadow-md hover:shadow-emerald-100/50 hover:scale-[1.02]'
                                    }`}
                                  >
                                    <div className="flex items-center gap-1.5 mb-1">
                                      <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center shadow-sm transition-all duration-300 ${
                                        filterBuscaAtiva === true ? 'bg-emerald-600 shadow-emerald-500/40 scale-110' : 'bg-emerald-500 shadow-emerald-500/30'
                                      }`}>
                                        <Search className="w-2 h-2 text-white" />
                                      </div>
                                      <p className={`text-[7px] font-black uppercase tracking-widest leading-none transition-colors ${
                                        filterBuscaAtiva === true ? 'text-emerald-800' : 'text-emerald-700'
                                      }`}>Com Busca</p>
                                    </div>
                                    <div className="flex items-end justify-between">
                                      <span key={`cb2-${grupoBuscaStats.comBusca}`} className={`text-sm font-black tabular-nums leading-none transition-colors animate-fade-in ${
                                        filterBuscaAtiva === true ? 'text-emerald-900' : 'text-emerald-800'
                                      }`}>{grupoBuscaStats.comBusca.toLocaleString('pt-BR')}</span>
                                      <span key={`cbp2-${grupoBuscaStats.comBusca}`} className="text-[9px] font-black text-emerald-600 tabular-nums animate-fade-in">{item.count > 0 ? Math.round((grupoBuscaStats.comBusca / item.count) * 100) : 0}%</span>
                                    </div>
                                    {filterBuscaAtiva === true && (
                                      <div className="mt-2 h-0.5 w-full bg-emerald-400 rounded-full" />
                                    )}
                                  </button>
                                </div>
                              ) : null}
                              {/* Botão ir para listagem */}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const pending: any = { filterGrupo: [item.grupo], grupoNum: item.num, grupoTitulo: item.titulo, grupoDescricao: '' };
                                  // SEMPRE envia filtro rastreamento vazio — Dashboard filtra "sem rastreamento" em ambos (COM/SEM BUSCA)
                                  const isComBuscaComDatas = filterBuscaAtiva === true && (grupoDataInicio || grupoDataFim);
                                  if (!isComBuscaComDatas) {
                                    pending.filterDnaHpvPep = 'NÃO';
                                    pending.filterDnaHpvGal = 'NÃO';
                                    pending.filterCitoPep = 'NÃO';
                                    pending.filterCitoLab = 'NÃO';
                                  }
                                  // Datas só enviadas quando buscaAtiva selecionado
                                  if (filterBuscaAtiva !== undefined) {
                                    if (grupoDataInicio) pending.filterDataInicio = grupoDataInicio;
                                    if (grupoDataFim) pending.filterDataFim = grupoDataFim;
                                    pending.buscaAtiva = filterBuscaAtiva;
                                  }
                                  localStorage.setItem('dashboard:pendingFilter', JSON.stringify(pending));
                                  setActiveTab('pacientes');
                                }}
                                disabled={isLoadingPrioCounts || !grupoBuscaStats || hasOneDateOnly}
                                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 ${
                                  isLoadingPrioCounts || !grupoBuscaStats || hasOneDateOnly
                                    ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                    : `${c.numBg} text-white shadow-lg hover:opacity-90 hover:shadow-xl cursor-pointer`
                                }`}
                              >
                                <ArrowRightCircle className="w-3.5 h-3.5" />
                                Ir para relação de pacientes
                              </button>
                            </div>
                          )}
                        </div>
                        <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${c.gradient} ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60'} transition-opacity duration-500`} />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Grid de Estatísticas Principais - Rastreamento */}
          <div className="mb-16">

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5">
              {[
                { key: 'NAO_IDENTIFICADO', label: 'NÃO IDENTIFICADO COLETA OU RESULTADO DE EXAME DE RASTREAMENTO', descricao: 'Pacientes que nunca realizaram ou não possuem registro de exame de rastreamento citopatológico', value: displayStats.alertBreakdown['NAO_IDENTIFICADO'] || 0, objetivo: 'DIMINUIR', objetivoColor: 'text-rose-700 bg-rose-50 border-rose-200', barColor: 'bg-gradient-to-r from-rose-400 to-rose-600', dotColor: 'bg-rose-500', icon: CircleOff, glowColor: 'shadow-rose-500/20', ringColor: 'ring-rose-400/30', hoverBorder: 'hover:border-rose-300', iconBg: 'bg-rose-100', iconColor: 'text-rose-600' },
                { key: 'COLETA_CITO', label: 'IDENTIFICADO COLETA DE CITO/PENDENTE DE REGISTRO DE RESULTADO NO PEP', descricao: 'Coleta realizada mas resultado ainda não registrado no sistema PEP', value: displayStats.alertBreakdown['COLETA_CITO'] || 0, objetivo: 'ZERAR', objetivoColor: 'text-amber-700 bg-amber-50 border-amber-200', barColor: 'bg-gradient-to-r from-amber-400 to-amber-600', dotColor: 'bg-amber-500', icon: Clock, glowColor: 'shadow-amber-500/20', ringColor: 'ring-amber-400/30', hoverBorder: 'hover:border-amber-300', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
                { key: 'PEP_CITO', label: 'IDENTIFICADO REGISTRO DE RESULTADO DE CITO NO PEP', descricao: 'Resultado de exame citopatológico já registrado e disponível no PEP', value: displayStats.alertBreakdown['PEP_CITO'] || 0, objetivo: 'MONITORAR', objetivoColor: 'text-emerald-700 bg-emerald-50 border-emerald-200', barColor: 'bg-gradient-to-r from-emerald-400 to-emerald-600', dotColor: 'bg-emerald-500', icon: CheckCircle, glowColor: 'shadow-emerald-500/20', ringColor: 'ring-emerald-400/30', hoverBorder: 'hover:border-emerald-300', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
                { key: 'COLETA_MOLECULAR', label: 'IDENTIFICADO TESTE MOLECULAR DNA-HPV - (GAL/MEDIREC)', descricao: 'Coleta de material para teste molecular DNA-HPV realizada via GAL/MEDIREC', value: displayStats.alertBreakdown['COLETA_MOLECULAR'] || 0, objetivo: 'AUMENTAR', objetivoColor: 'text-[#9a4b20] bg-[#fb9a61]/10 border-[#fb9a61]/40', barColor: 'bg-gradient-to-r from-[#fb9a61] to-[#e87530]', dotColor: 'bg-[#fb9a61]', icon: TestTube2, glowColor: 'shadow-[#fb9a61]/20', ringColor: 'ring-[#fb9a61]/30', hoverBorder: 'hover:border-[#fb9a61]/50', iconBg: 'bg-[#fb9a61]/15', iconColor: 'text-[#e87530]' },
                { key: 'PEP_MOLECULAR', label: 'CONFIRMADO O REGISTRO DE RESULTADOS DO TESTE MOLECULAR DNA-HPV NO PEP', descricao: 'Resultado do teste molecular DNA-HPV confirmado e registrado no PEP', value: displayStats.alertBreakdown['PEP_MOLECULAR'] || 0, objetivo: 'AUMENTAR', objetivoColor: 'text-blue-700 bg-blue-50 border-blue-200', barColor: 'bg-gradient-to-r from-blue-400 to-blue-600', dotColor: 'bg-blue-500', icon: BadgeCheck, glowColor: 'shadow-blue-500/20', ringColor: 'ring-blue-400/30', hoverBorder: 'hover:border-blue-300', iconBg: 'bg-blue-100', iconColor: 'text-blue-600' },
              ].map((card) => {
                const pct = displayStats.totalPacientes > 0 ? Math.round((card.value / displayStats.totalPacientes) * 100) : 0;
                const isActiveSearch = card.key === 'NAO_IDENTIFICADO';
                // Busca ativa = pacientes únicos com acompanhamento NESTE status
                const buscaAtivaValor = (acompStats as any).alertComBusca?.[card.key] || 0;
                const buscaAtivaPct = displayStats.totalPacientes > 0 ? Math.round((buscaAtivaValor / displayStats.totalPacientes) * 100) : 0;
                const semBuscaValor = card.value - buscaAtivaValor;
                const semBuscaPct = displayStats.totalPacientes > 0 ? Math.round((semBuscaValor / displayStats.totalPacientes) * 100) : 0;
                const Icon = card.icon;

                return (
                  <div
                    key={card.key}
                    onClick={() => {
                      localStorage.setItem('dashboard:pendingFilter', JSON.stringify({ filterStatus: [card.key], grupoTitulo: card.label || '', grupoDescricao: card.descricao || '' }));
                      setActiveTab('pacientes');
                    }}
                    className={`group bg-white rounded-3xl shadow-lg ${card.glowColor} hover:shadow-2xl hover:${card.glowColor} border border-slate-200/80 ${card.hoverBorder} transition-all duration-500 flex flex-col overflow-hidden cursor-pointer hover:scale-[1.03] hover:-translate-y-1`}
                  >
                    {/* Glow accent top bar */}
                    <div className={`h-1.5 w-full ${card.barColor} opacity-80 group-hover:opacity-100 transition-opacity`} />

                    {/* Icon header */}
                    <div className="px-5 pt-5 pb-2 flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${card.iconBg} flex items-center justify-center ring-4 ${card.ringColor} shadow-md group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className={`w-5 h-5 ${card.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-wide leading-tight group-hover:text-slate-700 transition-colors line-clamp-3">
                          {card.label}
                        </p>
                      </div>
                    </div>

                    <div className="px-5 pt-1 pb-5 flex-1 flex flex-col">
                      {/* Objetivo badge */}
                      <div className="mb-4">
                        {card.objetivo ? (
                          <span className={`inline-flex items-center gap-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${card.objetivoColor}`}>
                            <Activity className="w-3 h-3" />
                            Meta: {card.objetivo}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border text-slate-400 bg-slate-50 border-slate-200">
                            Meta: -
                          </span>
                        )}
                      </div>

                      {/* Valor Absoluto */}
                      <div className="flex items-end justify-between gap-2 mb-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Absoluto</span>
                        <span className="text-2xl md:text-3xl font-black text-slate-800 tabular-nums leading-none group-hover:scale-105 transition-transform origin-right">
                          {card.value.toLocaleString('pt-BR')}
                        </span>
                      </div>

                      {/* Percentual */}
                      <div className="flex items-end justify-between gap-2 mb-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Percentual</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-black text-slate-700 tabular-nums">
                            {pct}%
                          </span>
                        </div>
                      </div>

                      {/* Mini bar */}
                      <div className="mt-auto h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <div
                          className={`h-full ${card.barColor} rounded-full transition-all duration-700 ease-out shadow-md`}
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                    </div>

                    {/* Busca Ativa section (only NAO_IDENTIFICADO) */}
                    {isActiveSearch && (
                        <>
                          <div className="mx-5 border-t border-dashed border-slate-200" />
                          <div className="px-5 py-4 grid grid-cols-2 gap-2.5">
                            {/* Sem Busca Ativa — rose */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                localStorage.setItem('dashboard:pendingFilter', JSON.stringify({
                                  filterStatus: ['NAO_IDENTIFICADO'],
                                  buscaAtiva: false,
                                  grupoTitulo: card.label || '',
                                  grupoDescricao: card.descricao || '',
                                }));
                                setActiveTab('pacientes');
                              }}
                              className="bg-gradient-to-br from-rose-50 to-rose-100/50 rounded-2xl p-3 border border-rose-200/60 shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-300"
                            >
                              <div className="flex items-center gap-1.5 mb-2">
                                <div className="w-4 h-4 rounded-full bg-rose-500 flex items-center justify-center shadow-sm shadow-rose-500/30">
                                  <CircleOff className="w-2 h-2 text-white" />
                                </div>
                                <p className="text-[7px] md:text-[8px] font-black text-rose-700 uppercase tracking-widest leading-none">Sem Busca</p>
                              </div>
                              <div className="flex items-end justify-between">
                                <span className="text-sm font-black text-rose-800 tabular-nums leading-none">
                                  {semBuscaValor.toLocaleString('pt-BR')}
                                </span>
                                <span className="text-[10px] font-black text-rose-600 tabular-nums">{semBuscaPct}%</span>
                              </div>
                            </div>

                            {/* Com Busca Ativa — verde */}
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                localStorage.setItem('dashboard:pendingFilter', JSON.stringify({
                                  filterStatus: ['NAO_IDENTIFICADO'],
                                  buscaAtiva: true,
                                  grupoTitulo: card.label || '',
                                  grupoDescricao: card.descricao || '',
                                }));
                                setActiveTab('pacientes');
                              }}
                              className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 rounded-2xl p-3 border border-emerald-200/60 shadow-sm cursor-pointer hover:shadow-md hover:scale-[1.02] transition-all duration-300"
                            >
                              <div className="flex items-center gap-1.5 mb-2">
                                <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shadow-sm shadow-emerald-500/30">
                                  <Search className="w-2 h-2 text-white" />
                                </div>
                                <p className="text-[7px] md:text-[8px] font-black text-emerald-700 uppercase tracking-widest leading-none">Com Busca</p>
                              </div>
                              <div className="flex items-end justify-between">
                                <span className="text-sm font-black text-emerald-800 tabular-nums leading-none">
                                  {buscaAtivaValor.toLocaleString('pt-BR')}
                                </span>
                                <span className="text-[10px] font-black text-emerald-600 tabular-nums">{buscaAtivaPct}%</span>
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gráficos e Tabelas */}


          <Footer />
        </div>
      </div>

      <LoadingOverlay visible={isLoading} message="Carregando resumo..." />
      <LoadingOverlay visible={isFilterLoading && !isLoading} variant="card" title="Carregando Dados" message="Aplicando filtros avançados, aguarde um momento..." />
    </div>
  );
};
