import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Header } from '../components/Header';
import { ScrollIndicator } from '../components/ScrollIndicator';
import { Footer } from '../components/Footer';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { TrendingUp, BadgeCheck, Search, Filter, Download, Phone, Home, FileText, Eye, ChevronLeft, ChevronRight, Edit, Trash2, X, ClipboardList, Calendar, Info, AlertTriangle, MessageSquare, CheckCircle2, RotateCcw, Users, MapPin, Plus, Printer, Clock, Loader2 } from 'lucide-react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../contexts/AuthContext';
import { DatePickerPTBR } from '../components/DatePickerPTBR';
import { MultiSelect } from '../components/MultiSelect';
import { SingleSelect } from '../components/SingleSelect';
import Papa from 'papaparse';
import { UNIDADES_EQUIPES, MICROAREAS } from '../constants/regionalData';
import {
  TIPO_BUSCA_OPTIONS,
  TIPO_CONTATO_OPTIONS,
  SITUACAO_POS_BUSCA_OPTIONS,
  ENTRAVES_IDENTIFICADOS_OPTIONS,
  ENTRAVES_INFORMADO_POR_OPTIONS,
  buildSelectFilter,
  getCanonicalSelectValue,
  getSelectLabel,
  matchesSelectFilter,
  getCanonicalValue
} from '../constants/followUpOptions';

// Remove acentos via Unicode NFD decomposition (ex: "ESPERANÇA" → "ESPERANCA")
const normalizeText = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\s+/g, ' ');

interface Acompanhamento {
  id: string;
  created: string;
  updated: string;
  paciente: string; // ID do paciente
  expand?: {
    paciente: {
      nome: string;
      cns: string;
    };
  };
  data_busca?: string;
  tipo_busca?: string;
  tipo_contato?: string;
  situacao_pos_busca?: string;
  data_do_agendamento?: string;
  entraves_identificados?: string | string[];
  entraves_informado_por?: string; // Novo campo
  observacoes?: string;
  profissional: string; // ID do profissional
}

interface FollowUpsScreenProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const matchesMultiValueField = (rawValue: string | string[] | undefined, selectedValues: string[]) => {
  if (selectedValues.length === 0) return true;
  if (!rawValue || (Array.isArray(rawValue) && rawValue.length === 0)) return false;

  const values = Array.isArray(rawValue) ? rawValue : rawValue.split('; ');
  const normSelected = new Set(selectedValues.map(normalizeText));
  return values.some(v => normSelected.has(normalizeText(v)));
};

const SIM_NAO_OPTIONS = [
  { label: 'SIM', value: 'SIM' },
  { label: 'NÃO', value: 'NÃO' },
];

const InfoRow: React.FC<{ label: string; value?: string }> = ({ label, value }) => {
  let display = value || '--';
  if (value && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    const p = value.substring(0, 10).split('-');
    if (p.length === 3) display = `${p[2]}/${p[1]}/${p[0]}`;
  }
  return (
    <div className="flex flex-col">
      <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-0.5">{label}</span>
      <span className="text-xs font-semibold text-slate-700">{display}</span>
    </div>
  );
};

export const FollowUpsScreen: React.FC<FollowUpsScreenProps> = ({ activeTab, setActiveTab }) => {
  const { user, isAdmin } = useAuth();

  const FOLLOWUP_CACHE_KEY = `followup_cache_${user?.id}`;
  const FOLLOWUP_CACHE_TTL = 5 * 60 * 1000;
  const getFUCache = () => {
    try {
      const raw = localStorage.getItem(FOLLOWUP_CACHE_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (Date.now() - c.ts > FOLLOWUP_CACHE_TTL) return null;
      return c.data;
    } catch { return null; }
  };
  const setFUCache = (data: any) => {
    try { localStorage.setItem(FOLLOWUP_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
  };

  const _fuInit = getFUCache();
  const [acompanhamentos, setAcompanhamentos] = useState<Acompanhamento[]>(_fuInit ?? []);
  const [isLoading, setIsLoading] = useState(!_fuInit);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [filterVersion, setFilterVersion] = useState(0);
  const [sortField, setSortField] = useState<string>('data_busca');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const loadedOnceRef = useRef(false);

  // Modal de edição state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAcompanhamento, setSelectedAcompanhamento] = useState<any>(null);
  // Sempre usar dados frescos do array para o modal
  const activeSelectedAcompanhamento = selectedAcompanhamento
    ? (acompanhamentos.find(a => a.id === selectedAcompanhamento.id) || selectedAcompanhamento)
    : null;
  const [isSaving, setIsSaving] = useState(false);

  // Modal de visualização do paciente
  const [viewPacienteModal, setViewPacienteModal] = useState<{ isOpen: boolean; paciente: any; loading: boolean }>({ isOpen: false, paciente: null, loading: false });

  const handleViewPaciente = async (pacienteId?: string) => {
    if (!pacienteId) return;
    setViewPacienteModal({ isOpen: true, paciente: null, loading: true });
    try {
      const record = await pb.collection('amarcap53_pacientes').getOne(pacienteId, { expand: '', requestKey: null });
      setViewPacienteModal({ isOpen: true, paciente: record, loading: false });
    } catch (err) {
      console.error('[VIEW PACIENTE] Erro:', err);
      setViewPacienteModal({ isOpen: true, paciente: null, loading: false });
    }
  };

  // Modal de novo registro state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createSelectedPaciente, setCreateSelectedPaciente] = useState<any>(null);
  const [createPacienteSearch, setCreatePacienteSearch] = useState('');
  const [createPacienteResults, setCreatePacienteResults] = useState<any[]>([]);
  const [isSearchingPaciente, setIsSearchingPaciente] = useState(false);
  const [createDate, setCreateDate] = useState('');
  const [createTipoBusca, setCreateTipoBusca] = useState('');
  const [createTipoContato, setCreateTipoContato] = useState('');
  const [createSituacao, setCreateSituacao] = useState('');
  const [createDataAgendamento, setCreateDataAgendamento] = useState('');
  const [createEntraves, setCreateEntraves] = useState<string[]>([]);
  const [createEntravesInformadoPor, setCreateEntravesInformadoPor] = useState('');
  const [createObservacoes, setCreateObservacoes] = useState('');

  // Estados para Busca e Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchTyping, setIsSearchTyping] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filtro por paciente vindo do long press (PatientsScreen/FavoritesScreen)
  const [filterPacienteId, setFilterPacienteId] = useState<string | null>(() => {
    try {
      const id = localStorage.getItem('followups:pacienteFilter');
      if (id) localStorage.removeItem('followups:pacienteFilter');
      return id;
    } catch { return null; }
  });
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filterTipoBusca, setFilterTipoBusca] = useState<string[]>([]);
  const [filterTipoContato, setFilterTipoContato] = useState<string[]>([]);
  const [filterSituacao, setFilterSituacao] = useState<string[]>([]);
  const [filterEntraves, setFilterEntraves] = useState<string[]>([]);
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');
  const [filterUnidade, setFilterUnidade] = useState<string[]>([]);
  const [filterEquipe, setFilterEquipe] = useState<string[]>([]);
  const [filterMicroarea, setFilterMicroarea] = useState<string[]>([]);
  const [filterDnaHpvPep, setFilterDnaHpvPep] = useState('');
  const [filterCitoLab, setFilterCitoLab] = useState('');
  const [filterCitoPep, setFilterCitoPep] = useState('');
  const [filterDnaHpvGal, setFilterDnaHpvGal] = useState('');

  const resetFilters = () => {
    setSearchTerm('');
    setFilterTipoBusca([]);
    setFilterTipoContato([]);
    setFilterSituacao([]);
    setFilterEntraves([]);
    setFilterDataInicio('');
    setFilterDataFim('');
    setFilterUnidade([]);
    setFilterEquipe([]);
    setFilterMicroarea([]);
    setFilterDnaHpvPep('');
    setFilterCitoLab('');
    setFilterCitoPep('');
    setFilterDnaHpvGal('');
    setFilterPacienteId(null);
    localStorage.removeItem('followups:pacienteFilter');
  };

  const normalizeCanalLabel = (value?: string) => value || '';

  const getCanalLabel = (acomp: Acompanhamento) => {
    const canonical = String(getCanonicalValue('tipo_contato', acomp.tipo_contato || ''));
    const lower = canonical.toLowerCase();
    
    if (lower.includes('não houve contato')) return 'Sem Contato';
    if (lower.includes('contato direto')) return 'Contato Direto';
    if (lower.includes('contato indireto')) return 'Contato Indireto';

    return acomp.tipo_contato || '';
  };

  // Registros filtrados pelo cliente (busca + filtros UI) — usado por stats E tabela
  const filteredRecords = useMemo(() => {
    return acompanhamentos.filter(acomp => {
      const search = normalizeText(searchTerm);
      const patientName = normalizeText(acomp.expand?.paciente?.nome || '');
      const cns = normalizeText(acomp.expand?.paciente?.cns || '');
      const date = acomp.data_busca ? normalizeText(`${acomp.data_busca.split('-').reverse().join('/')}`) : '';

      const matchesSearch = !searchTerm || patientName.includes(search) || cns.includes(search) || date.includes(search);
      const matchesTipoBusca = matchesSelectFilter(acomp.tipo_busca, filterTipoBusca, TIPO_BUSCA_OPTIONS);
      const matchesTipoContato = matchesSelectFilter(acomp.tipo_contato, filterTipoContato, TIPO_CONTATO_OPTIONS);
      const matchesSituacao = matchesSelectFilter(acomp.situacao_pos_busca, filterSituacao, SITUACAO_POS_BUSCA_OPTIONS);
      const matchesEntraves = matchesMultiValueField(acomp.entraves_identificados, filterEntraves);

      let matchesData = true;
      if (acomp.data_busca) {
        const dataAcomp = acomp.data_busca.substring(0, 10); // YYYY-MM-DD direto do DB
        if (filterDataInicio) {
          if (dataAcomp < filterDataInicio) matchesData = false;
        }
        if (filterDataFim) {
          if (dataAcomp > filterDataFim) matchesData = false;
        }
      } else if (filterDataInicio || filterDataFim) {
        matchesData = false;
      }

      return matchesSearch && matchesTipoBusca && matchesTipoContato && matchesSituacao && matchesEntraves && matchesData;
    });
  }, [acompanhamentos, searchTerm, filterTipoBusca, filterTipoContato, filterSituacao, filterEntraves, filterDataInicio, filterDataFim]);

  // Estatísticas Calculadas a partir dos registros filtrados
  const stats = useMemo(() => {
    const total = filteredRecords.length;
    const contatos = filteredRecords.filter(a => {
      const val = String(a.tipo_contato || '').toLowerCase();
      return val && !val.includes('não houve contato');
    }).length;

    const falhas = filteredRecords.filter(a => {
      const val = String(a.tipo_contato || '').toLowerCase();
      return val && val.includes('não houve contato');
    }).length;

    const agendamentos = filteredRecords.filter(a => {
      const val = String(a.situacao_pos_busca || '').toLowerCase();
      return val && val.includes('agendamento');
    }).length;

    const counts: Record<string, number> = {};
    const totalCounts: Record<string, number> = {};

    const validAcomps = filteredRecords
      .map(a => ({ ...a, canal_label: getCanalLabel(a) }))
      .filter(a => a.canal_label);

    validAcomps.forEach(a => {
      totalCounts[a.canal_label] = (totalCounts[a.canal_label] || 0) + 1;
      const situacaoLower = String(a.situacao_pos_busca || '').toLowerCase();
      if (situacaoLower.includes('agendamento')) {
        counts[a.canal_label] = (counts[a.canal_label] || 0) + 1;
      }
    });

    const sorted = Object.entries(counts).sort(([,a], [,b]) => b - a);
    let canalEfetivo = { label: '--', count: 0 };

    if (sorted.length > 0) {
      const topLabel = sorted[0][0];
      canalEfetivo = {
        label: normalizeCanalLabel(topLabel),
        count: sorted[0][1]
      };
    } else if (validAcomps.length > 0) {
      const sortedTotal = Object.entries(totalCounts).sort(([,a], [,b]) => b - a);
      if (sortedTotal.length > 0) {
        const topLabel = sortedTotal[0][0];
        canalEfetivo = {
          label: normalizeCanalLabel(topLabel),
          count: 0
        };
      }
    }

    return { total, contatos, falhas, agendamentos, canalEfetivo };
  }, [filteredRecords]);

  useEffect(() => {
    let cancelled = false;
    const fetchAcompanhamentos = async () => {
      if (!user) return;
      try {
        // Build patient region filter (normalize accents: DB stores unaccented)
        const patientRegionFilterParts: string[] = [];
        const hasUnidadeFilter = filterUnidade.length > 0;
        const hasEquipeFilter = filterEquipe.length > 0;
        const hasMicroareaFilter = filterMicroarea.length > 0;

        // Filtro de permissão: só aplica quando NÃO há filtro UI correspondente
        if (!isAdmin) {
          if (user.role === 'unidade' && !hasUnidadeFilter) {
            patientRegionFilterParts.push(pb.filter('unidade ~ {:u}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%') }));
          } else if (user.role === 'equipe' && !hasUnidadeFilter && !hasEquipeFilter) {
            patientRegionFilterParts.push(pb.filter('unidade ~ {:u} && equipe ~ {:e}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%'), e: normalizeText(user.equipe).replace(/\s+/g, '%') }));
          } else if (user.role === 'microarea' && !hasUnidadeFilter && !hasEquipeFilter && !hasMicroareaFilter) {
            patientRegionFilterParts.push(pb.filter('unidade ~ {:u} && equipe ~ {:e}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%'), e: normalizeText(user.equipe).replace(/\s+/g, '%') }));
            patientRegionFilterParts.push(`microarea = ${Number(user.microarea)}`);
          }
        }
        // Filtros UI substituem filtro de permissão
        if (hasUnidadeFilter) {
          const uParams: Record<string, string> = {};
          const uClauses = filterUnidade.map((u, i) => {
            uParams[`u${i}`] = normalizeText(u).replace(/\s+/g, '%');
            return `unidade ~ {:u${i}}`;
          });
          patientRegionFilterParts.push(pb.filter(uClauses.join(' || '), uParams));
        }
        if (filterEquipe.length > 0) {
          const eParams: Record<string, string> = {};
          const eClauses = filterEquipe.map((e, i) => {
            eParams[`e${i}`] = normalizeText(e).replace(/\s+/g, '%');
            return `equipe ~ {:e${i}}`;
          });
          patientRegionFilterParts.push(pb.filter(eClauses.join(' || '), eParams));
        }
        if (filterMicroarea.length > 0) {
          patientRegionFilterParts.push(`(${filterMicroarea.map(m => `microarea = ${Number(m)}`).join(' || ')})`);
        }

        const buildIdFilter = (ids: string[], chunkSize = 200) => {
          if (ids.length === 0) return null;
          const chunks: string[][] = [];
          for (let i = 0; i < ids.length; i += chunkSize) {
            chunks.push(ids.slice(i, i + chunkSize));
          }
          return `(${chunks.map(chunk => `(${chunk.map(id => `paciente = "${id}"`).join(' || ')})`).join(' || ')})`;
        };

        // Parallel: fetch region patient IDs + SIM/NÃO patient IDs (2x faster)
        const regionPromise = (patientRegionFilterParts.length > 0)
          ? pb.collection('amarcap53_pacientes').getFullList({
              filter: patientRegionFilterParts.join(' && '),
              batch: 500,
              requestKey: null,
              fields: 'id'
            }).then(r => r.map(p => p.id).filter(Boolean))
          : Promise.resolve([]);

        const simNaoFilter = (field: string, val: string) => {
          if (!val) return null;
          if (val === 'SIM') return `${field} != ""`;
          if (val === 'NÃO') return `${field} = ""`;
          return null;
        };
        const hasSimNaoFilter = filterDnaHpvPep.length > 0 || filterCitoLab.length > 0 || filterCitoPep.length > 0 || filterDnaHpvGal.length > 0;
        const simNaoPromise = hasSimNaoFilter ? (() => {
          const patFilters: string[] = [];
          const f1 = simNaoFilter('dna_hpv_pep', filterDnaHpvPep);
          if (f1) patFilters.push(f1);
          const f2 = simNaoFilter('cito_lab', filterCitoLab);
          if (f2) patFilters.push(f2);
          const f3 = simNaoFilter('cito_pep', filterCitoPep);
          if (f3) patFilters.push(f3);
          const f4 = simNaoFilter('dna_hpv_gal', filterDnaHpvGal);
          if (f4) patFilters.push(f4);
          if (patFilters.length === 0) return Promise.resolve([]);
          return pb.collection('amarcap53_pacientes').getFullList({
            filter: patFilters.join(' && '),
            fields: 'id',
            batch: 500,
            requestKey: null
          }).then(r => r.map(p => p.id).filter(Boolean));
        })() : Promise.resolve([]);

        const [regionPatientIds, simNaoPatientIds] = await Promise.all([regionPromise, simNaoPromise]);

        const acompFilters = [];
        // Filtro por paciente específico (vindo do long press)
        if (filterPacienteId) {
          acompFilters.push(`paciente = "${filterPacienteId}"`);
        }
        const regionIdFilter = buildIdFilter(regionPatientIds);
        if (regionIdFilter) acompFilters.push(regionIdFilter);

        if (hasSimNaoFilter) {
          const simNaoIdFilter = buildIdFilter(simNaoPatientIds);
          if (simNaoIdFilter) {
            acompFilters.push(simNaoIdFilter);
          } else {
            acompFilters.push('id = "none"');
          }
        }

        // Outros Filtros UI
        if (filterTipoBusca.length > 0) {
          acompFilters.push(buildSelectFilter('tipo_busca', filterTipoBusca, TIPO_BUSCA_OPTIONS));
        }
        if (filterTipoContato.length > 0) {
          acompFilters.push(buildSelectFilter('tipo_contato', filterTipoContato, TIPO_CONTATO_OPTIONS));
        }
        if (filterSituacao.length > 0) {
          acompFilters.push(buildSelectFilter('situacao_pos_busca', filterSituacao, SITUACAO_POS_BUSCA_OPTIONS));
        }
        if (filterEntraves.length > 0) {
          const escapedEntraves = filterEntraves.map(v => v.replace(/[()]/g, '\\$&'));
          acompFilters.push(`(${escapedEntraves.map(v => `entraves_identificados ~ "${v}"`).join(' || ')})`);
        }

        if (filterDataInicio) {
          acompFilters.push(`data_busca >= "${filterDataInicio} 00:00:00"`);
        }
        if (filterDataFim) {
          acompFilters.push(`data_busca <= "${filterDataFim} 23:59:59"`);
        }

        const fetchOpts: any = {
          sort: '-created',
          expand: 'paciente',
          fields: 'id,created,updated,paciente,data_busca,tipo_busca,tipo_contato,situacao_pos_busca,data_do_agendamento,entraves_identificados,entraves_informado_por,observacoes,profissional,expand.paciente.nome,expand.paciente.cns,expand.paciente.unidade,expand.paciente.equipe,expand.paciente.microarea',
          batch: 500,
          requestKey: null,
        };
        const filterStr = acompFilters.join(' && ');
        if (filterStr) fetchOpts.filter = filterStr;
        const records = await pb.collection('amarcap53_acompanhamentos').getFullList(fetchOpts);
        setAcompanhamentos(records);
        setFUCache(records);
      } catch (error) {
        if (cancelled) return;
        console.error('Erro ao buscar acompanhamentos:', error);
      } finally {
        setIsLoading(false);
        setIsFilterLoading(false);
        if (!cancelled) loadedOnceRef.current = true;
      }
    };

    fetchAcompanhamentos();
    return () => { cancelled = true; };
  }, [user?.id, user?.role, user?.unidade_saude, user?.equipe, user?.microarea, isAdmin, filterUnidade, filterEquipe, filterMicroarea, filterTipoBusca, filterTipoContato, filterSituacao, filterEntraves, filterDataInicio, filterDataFim, filterDnaHpvPep, filterCitoLab, filterCitoPep, filterDnaHpvGal, filterPacienteId, filterVersion]);

  const handleDelete = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este registro?')) {
      try {
        await pb.collection('amarcap53_acompanhamentos').delete(id);
        setAcompanhamentos(prev => prev.filter(item => item.id !== id));
      } catch (error) {
        console.error('Erro ao excluir:', error);
        alert('Erro ao excluir registro.');
      }
    }
  };

  const handleEdit = (id: string) => {
    const acompToEdit = acompanhamentos.find(item => item.id === id);
    if (acompToEdit) {
      // Ajuste de data para o DatePickerPTBR (DD/MM/YYYY)
      let dataBuscaFormatada = '';
      if (acompToEdit.data_busca) {
        const parts = acompToEdit.data_busca.substring(0, 10).split('-');
        dataBuscaFormatada = `${parts[2]}/${parts[1]}/${parts[0]}`;
      }

      let dataAgendamentoFormatada = '';
      if (acompToEdit.data_do_agendamento) {
        const parts = acompToEdit.data_do_agendamento.substring(0, 10).split('-');
        if (parts.length === 3) {
          dataAgendamentoFormatada = `${parts[0]}-${parts[1]}-${parts[2]}`;
        }
      }

      setSelectedAcompanhamento({
        ...acompToEdit,
        data_busca_formatada: dataBuscaFormatada,
        data_do_agendamento: dataAgendamentoFormatada,
        tipo_busca: getCanonicalSelectValue(acompToEdit.tipo_busca, TIPO_BUSCA_OPTIONS),
        tipo_contato: getCanonicalSelectValue(acompToEdit.tipo_contato, TIPO_CONTATO_OPTIONS),
        situacao_pos_busca: getCanonicalSelectValue(acompToEdit.situacao_pos_busca, SITUACAO_POS_BUSCA_OPTIONS),
        entraves_identificados: (() => {
          const raw = acompToEdit.entraves_identificados;
          if (!raw) return [];
          if (Array.isArray(raw)) return raw.map(v => getCanonicalSelectValue(v, ENTRAVES_IDENTIFICADOS_OPTIONS));
          try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed.map((v: any) => getCanonicalSelectValue(String(v), ENTRAVES_IDENTIFICADOS_OPTIONS));
          } catch {}
          return raw.split('; ').map(v => getCanonicalSelectValue(v, ENTRAVES_IDENTIFICADOS_OPTIONS));
        })(),
        entraves_informado_por: getCanonicalSelectValue(acompToEdit.entraves_informado_por, ENTRAVES_INFORMADO_POR_OPTIONS)
      });
      setIsEditModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setSelectedAcompanhamento(null);
  };

  // Search patients for create modal (server-side debounced)
  useEffect(() => {
    if (!createPacienteSearch || createPacienteSearch.length < 2) {
      setCreatePacienteResults([]);
      setIsSearchingPaciente(false);
      return;
    }
    setIsSearchingPaciente(true);
    const timer = setTimeout(async () => {
      try {
        const search = createPacienteSearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
        const patients = await pb.collection('amarcap53_pacientes').getFullList({
          filter: `nome ~ "${search}" || cns ~ "${search}"`,
          fields: 'id,nome,cns,unidade,equipe,microarea',
          sort: 'nome',
          limit: 10,
          requestKey: null,
        });
        setCreatePacienteResults(patients);
      } catch (e) {
        console.error('[FollowUpsScreen] Erro ao buscar pacientes:', e);
        setCreatePacienteResults([]);
      } finally {
        setIsSearchingPaciente(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [createPacienteSearch]);

  const resetCreateModal = () => {
    setIsCreateModalOpen(false);
    setCreateSelectedPaciente(null);
    setCreatePacienteSearch('');
    setCreatePacienteResults([]);
    setCreateDate('');
    setCreateTipoBusca('');
    setCreateTipoContato('');
    setCreateSituacao('');
    setCreateDataAgendamento('');
    setCreateEntraves([]);
    setCreateEntravesInformadoPor('');
    setCreateObservacoes('');
  };

  const handleSaveCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!createSelectedPaciente || !user) return;

    if (!createDate) {
      alert('Preencha a Data da Busca.');
      return;
    }
    if (!createTipoBusca || !createTipoContato || !createSituacao) {
      alert('Preencha todos os campos obrigatórios: Tipo de Busca, Tipo de Contato e Situação Pós Busca.');
      return;
    }
    if (createEntraves.length > 0 && !createEntravesInformadoPor) {
      alert('Por favor, preencha o campo "Entrave(s) Informado Por" quando houver entrave(s) identificado(s).');
      return;
    }
    if (getSelectLabel(createSituacao, SITUACAO_POS_BUSCA_OPTIONS) === 'AGENDAMENTO APÓS CONTATO DIRETO' && !createDataAgendamento) {
      alert('Por favor, preencha o campo "Data do Agendamento" quando a situação for "Agendamento após contato direto".');
      return;
    }

    setIsSaving(true);

    let dataBuscaIso = '';
    if (createDate && createDate.includes('/')) {
      const [d, m, y] = createDate.split('/');
      dataBuscaIso = `${y}-${m}-${d}`;
    }

    let dataAgendamentoIso = '';
    if (createDataAgendamento && createDataAgendamento.includes('/')) {
      const [d, m, y] = createDataAgendamento.split('/');
      dataAgendamentoIso = `${y}-${m}-${d}`;
    }

    const data = {
      paciente: createSelectedPaciente.id,
      profissional: user.id,
      data_busca: dataBuscaIso || createDate,
      tipo_busca: getSelectLabel(createTipoBusca, TIPO_BUSCA_OPTIONS),
      tipo_contato: getSelectLabel(createTipoContato, TIPO_CONTATO_OPTIONS),
      situacao_pos_busca: getSelectLabel(createSituacao, SITUACAO_POS_BUSCA_OPTIONS),
      data_do_agendamento: dataAgendamentoIso || createDataAgendamento,
      entraves_identificados: JSON.stringify(
        Array.isArray(createEntraves) ? createEntraves.filter(v => v) : []
      ),
      entraves_informado_por: getSelectLabel(createEntravesInformadoPor, ENTRAVES_INFORMADO_POR_OPTIONS),
      observacoes: createObservacoes,
    };

    try {
      const result = await pb.collection('amarcap53_acompanhamentos').create(data);
      setAcompanhamentos(prev => [result as any, ...prev]);
      alert('Acompanhamento registrado com sucesso!');
      resetCreateModal();
    } catch (error: any) {
      console.error('[SAVE CREATE] Erro:', error);
      const msg = error?.data?.data
        ? Object.entries(error.data.data).map(([k, v]: any) => `${k}: ${v?.message || v}`).join('\n')
        : error?.message || 'Erro desconhecido';
      alert(`Erro ao salvar o acompanhamento.\nCampos com problema:\n${msg}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAcompanhamento) return;
    
    if (!selectedAcompanhamento.data_busca_formatada || !selectedAcompanhamento.tipo_busca || !selectedAcompanhamento.tipo_contato || !selectedAcompanhamento.situacao_pos_busca) {
      alert('Preencha todos os campos obrigatórios: Data da Busca, Tipo de Busca, Tipo de Contato e Situação Pós Busca.');
      return;
    }
    
    const hasEntravesIdentificados = Array.isArray(selectedAcompanhamento.entraves_identificados) ? selectedAcompanhamento.entraves_identificados.filter((v: any) => v).length > 0 : !!selectedAcompanhamento.entraves_identificados;
    if (hasEntravesIdentificados && !selectedAcompanhamento.entraves_informado_por) {
      alert('Por favor, preencha o campo "Entrave(s) Informado Por" quando houver entrave(s) identificado(s).');
      return;
    }
    if (getSelectLabel(selectedAcompanhamento.situacao_pos_busca || '', SITUACAO_POS_BUSCA_OPTIONS) === 'AGENDAMENTO APÓS CONTATO DIRETO' && !selectedAcompanhamento.data_do_agendamento) {
      alert('Por favor, preencha o campo "Data do Agendamento" quando a situação for "Agendamento após contato direto".');
      return;
    }

    setIsSaving(true);
    
    const rawDate = selectedAcompanhamento.data_busca_formatada;
    let dataBuscaIso = '';
    if (rawDate && rawDate.includes('/')) {
      const [d, m, y] = rawDate.split('/');
      dataBuscaIso = `${y}-${m}-${d}`;
    }

    const rawTipoContato = selectedAcompanhamento.tipo_contato || '';

    const rawDataAgendamento = selectedAcompanhamento.data_do_agendamento || '';
    let dataAgendamentoIso = '';
    if (rawDataAgendamento && rawDataAgendamento.includes('/')) {
      const [d, m, y] = rawDataAgendamento.split('/');
      dataAgendamentoIso = `${y}-${m}-${d}`;
    }

    const data = {
      tipo_busca: getSelectLabel(selectedAcompanhamento.tipo_busca, TIPO_BUSCA_OPTIONS),
      data_busca: dataBuscaIso || rawDate,
      tipo_contato: rawTipoContato.normalize('NFC'),
      situacao_pos_busca: getSelectLabel(selectedAcompanhamento.situacao_pos_busca, SITUACAO_POS_BUSCA_OPTIONS),
      data_do_agendamento: dataAgendamentoIso || rawDataAgendamento,
      entraves_identificados: JSON.stringify(
        Array.isArray(selectedAcompanhamento.entraves_identificados)
          ? selectedAcompanhamento.entraves_identificados.filter(v => v)
          : selectedAcompanhamento.entraves_identificados ? [selectedAcompanhamento.entraves_identificados] : []
      ),
      entraves_informado_por: getSelectLabel(selectedAcompanhamento.entraves_informado_por, ENTRAVES_INFORMADO_POR_OPTIONS),
      observacoes: selectedAcompanhamento.observacoes || '',
    };

    try {
      const result = await pb.collection('amarcap53_acompanhamentos').update(selectedAcompanhamento.id, data);
      
      setAcompanhamentos(prev => prev.map(item => {
        if (item.id === selectedAcompanhamento.id) {
          return { ...item, ...data };
        }
        return item;
      }));
      
      alert('Acompanhamento atualizado com sucesso!');
      handleCloseModal();
    } catch (error: any) {
      console.error('[SAVE EDIT] Erro completo:', error);
      console.error('[SAVE EDIT] error.data:', error?.data);
      console.error('[SAVE EDIT] error.message:', error?.message);
      
      const pbError = error.data?.data;
      let errorMsg = 'Erro ao atualizar o registro.';
      
      if (pbError) {
        const fields = Object.keys(pbError).map(k => {
          const fieldError = pbError[k];
          return `${k}: ${fieldError.message || JSON.stringify(fieldError)}`;
        }).join('\n');
        errorMsg += `\n\nCampos com problema:\n${fields}`;
      } else if (error.message) {
        errorMsg += `\n\nDetalhes: ${error.message}`;
      }
      
      alert(errorMsg);
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { alert('Bloqueador de popup ativo. Permita popups para este site.'); return; }
    printWindow.document.write('<html><head><title>AMAR</title><style>body{font-family:Arial,sans-serif;display:flex;justify-content:center;align-items:center;height:100vh;margin:0;background:#f1f5f9;}h2{color:#001b3d;}</style></head><body><h2>Carregando listagem...</h2></body></html>');
    printWindow.document.close();

    const sortedRecords = [...filteredRecords].sort((a, b) => {
      let va = '', vb = '';
      switch (sortField) {
        case 'nome': va = a.expand?.paciente?.nome || ''; vb = b.expand?.paciente?.nome || ''; break;
        case 'data_busca': va = a.data_busca || ''; vb = b.data_busca || ''; break;
        case 'tipo_contato': va = a.tipo_contato || ''; vb = b.tipo_contato || ''; break;
        case 'situacao_pos_busca': va = a.situacao_pos_busca || ''; vb = b.situacao_pos_busca || ''; break;
        case 'observacoes': va = a.observacoes || ''; vb = b.observacoes || ''; break;
        default: va = a.data_busca || ''; vb = b.data_busca || '';
      }
      const cmp = va.localeCompare(vb, 'pt-BR', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const dataAtual = new Date().toLocaleDateString('pt-BR');
    const rows = sortedRecords.map(acomp => {
      const dataFormatada = acomp.data_busca ? (() => { const p = acomp.data_busca.substring(0,10).split('-'); return `${p[2]}/${p[1]}/${p[0]}`; })() : '--';
      return `<tr>
        <td>${acomp.expand?.paciente?.nome || '--'}</td>
        <td>${acomp.expand?.paciente?.cns || '--'}</td>
        <td>${dataFormatada}</td>
        <td>${acomp.tipo_contato || '--'}</td>
        <td>${acomp.entraves_identificados || '--'}</td>
        <td>${acomp.situacao_pos_busca || '--'}</td>
        <td>${acomp.tipo_busca || '--'}</td>
        <td>${acomp.observacoes || '--'}</td>
      </tr>`;
    }).join('');

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>AMAR - Listagem de Acompanhamentos</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, Helvetica, sans-serif; font-size: 8pt; color: #1a1a2e; padding: 0; }
    .header { text-align: center; margin-bottom: 12px; border-bottom: 2px solid #001b3d; padding-bottom: 8px; }
    .header h1 { font-size: 16pt; color: #001b3d; margin-bottom: 4px; }
    .header p { font-size: 9pt; color: #555; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; }
    th { background-color: #001b3d; color: #fff; padding: 5px 4px; text-align: left; font-size: 7pt; text-transform: uppercase; letter-spacing: 0.03em; }
    td { padding: 4px 4px; border-bottom: 1px solid #e0e0e0; font-size: 7pt; vertical-align: top; }
    tr:nth-child(even) { background-color: #f7f9fc; }
    .footer { text-align: center; margin-top: 10px; font-size: 7pt; color: #999; border-top: 1px solid #e0e0e0; padding-top: 6px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>AMAR - Listagem de Acompanhamentos</h1>
    <p>Gerado em: ${dataAtual} | Total: ${sortedRecords.length} registro(s)</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Paciente</th><th>CNS</th><th>Data da Ação</th><th>Contato</th><th>Entraves</th><th>Desfecho</th><th>Tipo</th><th>Observações</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="footer">Documento gerado automaticamente pelo sistema AMAR CAP 53</div>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  const handleDownloadCsv = () => {
    const sortedRecords = [...filteredRecords].sort((a, b) => {
      let va = '', vb = '';
      switch (sortField) {
        case 'nome': va = a.expand?.paciente?.nome || ''; vb = b.expand?.paciente?.nome || ''; break;
        case 'data_busca': va = a.data_busca || ''; vb = b.data_busca || ''; break;
        case 'tipo_contato': va = a.tipo_contato || ''; vb = b.tipo_contato || ''; break;
        case 'situacao_pos_busca': va = a.situacao_pos_busca || ''; vb = b.situacao_pos_busca || ''; break;
        case 'observacoes': va = a.observacoes || ''; vb = b.observacoes || ''; break;
        default: va = a.data_busca || ''; vb = b.data_busca || '';
      }
      const cmp = va.localeCompare(vb, 'pt-BR', { sensitivity: 'base' });
      return sortDir === 'asc' ? cmp : -cmp;
    });

    const data = sortedRecords.map(acomp => ({
      'Paciente': acomp.expand?.paciente?.nome || '--',
      'CNS': acomp.expand?.paciente?.cns || '--',
      'Data da Ação': acomp.data_busca ? (() => { const p = acomp.data_busca.substring(0,10).split('-'); return `${p[2]}/${p[1]}/${p[0]}`; })() : '--',
      'Tipo Contato': acomp.tipo_contato || '--',
      'Entraves': acomp.entraves_identificados || '--',
      'Situação': acomp.situacao_pos_busca || '--',
      'Tipo Busca': acomp.tipo_busca || '--',
      'Observações': acomp.observacoes || '--',
      'Unidade': acomp.expand?.paciente?.unidade || '--',
      'Equipe': acomp.expand?.paciente?.equipe || '--',
      'Microárea': acomp.expand?.paciente?.microarea || '--',
    }));

    const csvContent = '\uFEFF' + Papa.unparse(data, { delimiter: ';' });
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `acompanhamentos_${today}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <Header 
        title="Meus Acompanhamentos" 
        pageTitle="Meus Acompanhamentos" 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 no-scrollbar">
        <LoadingOverlay visible={isLoading} message="Sincronizando registros..." />
        <LoadingOverlay visible={isFilterLoading} variant="card" title="Carregando Acompanhamentos" message="Aplicando filtros, aguarde um momento..." />

        {/* Barra de filtro de paciente específico (vindo do long press) */}
        {filterPacienteId && !isLoading && (
          <div className="mb-6 animate-in fade-in duration-300">
            <div className="relative bg-gradient-to-br from-[#001b3d] to-[#002b5c] px-5 py-3 rounded-2xl shadow-md border border-white/5 overflow-hidden">
              <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMiI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMS41Ii8+PC9nPjwvZz48L3N2Zz4=')] opacity-40" />
              <div className="relative z-10 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                  <span className="text-[9px] font-black text-blue-300/60 uppercase tracking-widest">
                    Acompanhamentos do paciente
                  </span>
                </div>
                <button
                  onClick={() => setFilterPacienteId(null)}
                  className="text-[9px] font-black text-blue-300/60 hover:text-white uppercase tracking-widest transition-colors cursor-pointer"
                >
                  Limpar filtro
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="max-w-[1600px] mx-auto">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="bg-gradient-to-br from-[#001b3d] to-[#002b5c] p-4 md:p-10 rounded-2xl md:rounded-[2.5rem] shadow-2xl col-span-1 md:col-span-2 lg:col-span-4 flex flex-col md:flex-row items-center justify-between gap-4 md:gap-10 relative overflow-hidden group">
              {/* Efeitos de luz no fundo */}
              <div className="absolute -top-24 -right-24 w-80 h-80 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-1000"></div>
              <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-1000"></div>

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full md:w-auto">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner group-hover:scale-105 transition-transform duration-500">
                  <ClipboardList className="w-8 h-8 md:w-10 md:h-10 text-white" />
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[10px] md:text-sm font-black text-white/40 uppercase tracking-[0.3em] mb-2">Histórico de Ações</p>
                  <p className="text-2xl md:text-[3.5rem] font-black text-white leading-none tracking-tighter">
                    {stats.total} <span className="text-sm md:text-lg font-bold text-white/60 ml-2 tracking-normal uppercase">Registros</span>
                  </p>
                </div>
              </div>

              {/* Botões de Ação */}
              <div className="relative z-10 flex items-center gap-2 md:gap-2.5 w-full md:w-auto justify-center md:justify-end">
                <button
                  onClick={() => setIsSearchVisible(!isSearchVisible)}
                  className={`group/btn w-11 h-11 md:w-[2.75rem] md:h-[2.75rem] flex items-center justify-center rounded-2xl backdrop-blur-md border transition-all duration-300 ${
                    isSearchVisible
                      ? 'bg-white text-[#001b3d] border-white shadow-[0_0_24px_rgba(255,255,255,0.25)] scale-105'
                      : 'bg-white/[0.08] border-white/[0.15] text-white/70 hover:bg-white/[0.18] hover:border-white/30 hover:text-white hover:shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
                  }`}
                  title="Ativar Busca"
                >
                  <Search className={`w-4 h-4 md:w-[1.125rem] md:h-[1.125rem] transition-all duration-300 ${isSearchVisible ? 'scale-110' : 'group-hover/btn:scale-110'}`} />
                </button>

                <button
                  onClick={() => setIsFilterVisible(!isFilterVisible)}
                  className={`group/btn flex items-center gap-2 md:gap-2.5 px-4 md:px-5 h-11 md:h-[2.75rem] rounded-2xl backdrop-blur-md border text-[10px] md:text-xs font-bold uppercase tracking-[0.1em] transition-all duration-300 ${
                    isFilterVisible || filterTipoBusca.length > 0 || filterTipoContato.length > 0 || filterSituacao.length > 0 || filterEntraves.length > 0 || filterDataInicio || filterDataFim || filterDnaHpvPep.length > 0 || filterCitoLab.length > 0 || filterCitoPep.length > 0 || filterDnaHpvGal.length > 0
                      ? 'bg-white text-[#001b3d] border-white shadow-[0_0_24px_rgba(255,255,255,0.25)] scale-105'
                      : 'bg-white/[0.08] border-white/[0.15] text-white/70 hover:bg-white/[0.18] hover:border-white/30 hover:text-white hover:shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95'
                  }`}
                >
                  <Filter className="w-4 h-4 md:w-[1.125rem] md:h-[1.125rem] transition-transform duration-300 group-hover/btn:rotate-12" />
                  <span className="hidden sm:inline">Filtros</span>
                  {(filterTipoBusca.length > 0 || filterTipoContato.length > 0 || filterSituacao.length > 0 || filterEntraves.length > 0 || filterDataInicio || filterDataFim || filterDnaHpvPep.length > 0 || filterCitoLab.length > 0 || filterCitoPep.length > 0 || filterDnaHpvGal.length > 0) && (
                    <div className="w-5 h-5 flex items-center justify-center bg-white text-[#001b3d] text-[9px] rounded-full font-black shadow-sm">
                      {[filterTipoBusca, filterTipoContato, filterSituacao, filterEntraves, filterDnaHpvPep, filterCitoLab, filterCitoPep, filterDnaHpvGal].filter(f => f.length > 0).length + (filterDataInicio || filterDataFim ? 1 : 0)}
                    </div>
                  )}
                </button>

                <button
                  onClick={handlePrint}
                  className="group/btn w-11 h-11 md:w-[2.75rem] md:h-[2.75rem] flex items-center justify-center rounded-2xl bg-white/[0.08] backdrop-blur-md border border-white/[0.15] text-white/70 hover:bg-white/[0.18] hover:border-white/30 hover:text-white hover:shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300"
                  title="Imprimir Listagem"
                >
                  <Printer className="w-4 h-4 md:w-[1.125rem] md:h-[1.125rem] transition-transform duration-300 group-hover/btn:scale-110" />
                </button>

                <button
                  onClick={handleDownloadCsv}
                  className="group/btn w-11 h-11 md:w-[2.75rem] md:h-[2.75rem] flex items-center justify-center rounded-2xl bg-white/[0.08] backdrop-blur-md border border-white/[0.15] text-white/70 hover:bg-white/[0.18] hover:border-white/30 hover:text-white hover:shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300"
                  title="Download CSV"
                >
                  <Download className="w-4 h-4 md:w-[1.125rem] md:h-[1.125rem] transition-transform duration-300 group-hover/btn:scale-110" />
                </button>

                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="group/btn flex items-center gap-2 md:gap-2.5 px-4 md:px-5 h-11 md:h-[2.75rem] rounded-2xl bg-white/[0.08] backdrop-blur-md border border-white/[0.15] text-[10px] md:text-xs font-bold uppercase tracking-[0.1em] text-white/70 hover:bg-white/[0.18] hover:border-white/30 hover:text-white hover:shadow-[0_8px_32px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.1)] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all duration-300"
                >
                  <Plus className="w-4 h-4 md:w-[1.125rem] md:h-[1.125rem] transition-transform duration-300 group-hover/btn:rotate-90" />
                  <span className="hidden sm:inline">Novo Registro</span>
                </button>
              </div>
            </div>

            {/* Barra de Busca Animada */}
            {isSearchVisible && (
              <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-white p-6 rounded-[2rem] shadow-xl border border-primary/5 animate-in slide-in-from-top-6 fade-in duration-500">
                <div className="relative group">
                  {isSearchTyping ? (
                    <Loader2 className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-cyan-500 animate-spin" />
                  ) : (
                    <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/30 group-focus-within:text-primary transition-colors" />
                  )}
                  <input 
                    type="text" 
                    placeholder="Buscar paciente ou data específica..." 
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setIsSearchTyping(true);
                      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                      searchTimerRef.current = setTimeout(() => setIsSearchTyping(false), 300);
                    }}
                    className="w-full pl-14 pr-12 py-5 bg-surface-container-low border-2 border-transparent rounded-2xl text-base font-bold text-on-surface focus:border-primary/20 outline-none transition-all placeholder:text-on-surface-variant/30"
                    autoFocus
                  />
                  {searchTerm && (
                    <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-rose-500/10 text-rose-400 hover:text-rose-500 transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                {searchTerm && !isSearchTyping && (
                  <div className="mt-2 flex items-center gap-2 animate-in fade-in duration-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                      {filteredRecords.length} resultado{filteredRecords.length !== 1 ? 's' : ''} encontrado{filteredRecords.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
                {searchTerm && isSearchTyping && (
                  <div className="mt-2 flex items-center gap-2 animate-in fade-in duration-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-[11px] font-bold text-cyan-500 uppercase tracking-widest animate-pulse">
                      Filtrando...
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Painel de Filtros Avançados */}
            {isFilterVisible && (
              <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-white p-6 md:p-8 rounded-3xl shadow-2xl border border-primary/5 animate-in slide-in-from-top-6 fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
                  {/* Período de Busca */}
                  <div className="md:col-span-2 space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                      <Calendar className="w-3.5 h-3.5" />
                      Período da Busca (Início e Fim)
                    </label>
                    <div className="flex gap-3">
                      <DatePickerPTBR 
                        placeholder="Data Inicial"
                        value={filterDataInicio}
                        onChange={setFilterDataInicio}
                      />
                      <DatePickerPTBR 
                        placeholder="Data Final"
                        value={filterDataFim}
                        onChange={setFilterDataFim}
                      />
                    </div>
                  </div>

                  {/* Exames SIM/NÃO */}
                  <div className="space-y-2">
                    <SingleSelect
                      label="DNA-HPV (PEP)"
                      placeholder="SIM / NÃO"
                      options={SIM_NAO_OPTIONS}
                      value={filterDnaHpvPep}
                      onChange={setFilterDnaHpvPep}
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      showSearch={false}
                    />
                  </div>
                  <div className="space-y-2">
                    <SingleSelect
                      label="Cito (Lab)"
                      placeholder="SIM / NÃO"
                      options={SIM_NAO_OPTIONS}
                      value={filterCitoLab}
                      onChange={setFilterCitoLab}
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      showSearch={false}
                    />
                  </div>
                  <div className="space-y-2">
                    <SingleSelect
                      label="Cito (PEP)"
                      placeholder="SIM / NÃO"
                      options={SIM_NAO_OPTIONS}
                      value={filterCitoPep}
                      onChange={setFilterCitoPep}
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      showSearch={false}
                    />
                  </div>
                  <div className="space-y-2">
                    <SingleSelect
                      label="DNA-HPV (GAL)"
                      placeholder="SIM / NÃO"
                      options={SIM_NAO_OPTIONS}
                      value={filterDnaHpvGal}
                      onChange={setFilterDnaHpvGal}
                      icon={<CheckCircle2 className="w-3.5 h-3.5" />}
                      showSearch={false}
                    />
                  </div>

                  {/* Regionais */}
                  {(isAdmin || user?.role === 'cap') && (
                    <div>
                      <MultiSelect 
                        label="Unidade"
                        placeholder="Todas as Unidades"
                        options={Object.keys(UNIDADES_EQUIPES)}
                        value={filterUnidade}
                        onChange={(val) => { setFilterUnidade(val); setFilterEquipe([]); setFilterMicroarea([]); }}
                      />
                    </div>
                  )}
                  {(isAdmin || user?.role === 'cap' || user?.role === 'unidade') && (
                    <div>
                      <MultiSelect 
                        label="Equipe"
                        placeholder="Todas as Equipes"
                        options={filterUnidade.length > 0 ? Array.from(new Set(filterUnidade.flatMap(u => UNIDADES_EQUIPES[u] || []))) : user?.role === 'unidade' ? UNIDADES_EQUIPES[user.unidade_saude] || [] : []}
                        value={filterEquipe}
                        onChange={(val) => { setFilterEquipe(val); setFilterMicroarea([]); }}
                        disabled={filterUnidade.length === 0 && user?.role === 'cap'}
                      />
                    </div>
                  )}
                  {(isAdmin || user?.role === 'cap' || user?.role === 'unidade' || user?.role === 'equipe') && (
                    <div>
                      <MultiSelect 
                        label="Microárea"
                        placeholder="Todas as Microáreas"
                        options={MICROAREAS.map(ma => ma.toString())}
                        value={filterMicroarea}
                        onChange={setFilterMicroarea}
                        disabled={filterEquipe.length === 0 && user?.role === 'cap'}
                      />
                    </div>
                  )}

                  {/* Acompanhamento filters */}
                  <div className="space-y-2">
                    <MultiSelect label="Tipo de Busca" placeholder="Todos os Tipos"
                      options={TIPO_BUSCA_OPTIONS} value={filterTipoBusca} onChange={setFilterTipoBusca} />
                  </div>
                  <div className="space-y-2">
                    <MultiSelect label="Tipo de Contato" placeholder="Todos os Contatos"
                      options={TIPO_CONTATO_OPTIONS} value={filterTipoContato} onChange={setFilterTipoContato} />
                  </div>
                  <div className="space-y-2">
                    <MultiSelect label="Situação Pós Busca" placeholder="Todas as Situações"
                      options={SITUACAO_POS_BUSCA_OPTIONS} value={filterSituacao} onChange={setFilterSituacao} />
                  </div>
                  <div className="space-y-2">
                    <MultiSelect label="Entraves Identificados" placeholder="Todos os Entraves"
                      options={ENTRAVES_IDENTIFICADOS_OPTIONS} value={filterEntraves} onChange={setFilterEntraves} />
                  </div>

                  {/* Botões */}
                  <div className="flex items-end gap-4 md:col-span-2 lg:col-span-4 pt-3">
                    <button onClick={resetFilters}
                      className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-surface-container-high text-on-surface-variant text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-surface-container-highest transition-all duration-300">
                      <RotateCcw className="w-4 h-4" /> Resetar
                    </button>
                    <button onClick={() => { setIsFilterVisible(false); setIsFilterLoading(true); setFilterVersion(v => v + 1); }}
                      className="flex-1 py-3.5 bg-primary text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all duration-300 shadow-lg shadow-primary/20">
                      Aplicar Filtros
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Cards de Resumo Estilizados */}
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-primary/5 hover:border-primary/20 transition-all duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <BadgeCheck className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest leading-none">Contatos<br/>Realizados</p>
              </div>
              <p className="text-3xl font-black text-primary">
                {stats.contatos}
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-primary/5 hover:border-primary/20 transition-all duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-rose-500" />
                </div>
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest leading-none">Buscas sem<br/>Sucesso</p>
              </div>
              <p className="text-3xl font-black text-primary">
                {stats.falhas}
              </p>
            </div>
            
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-primary/5 hover:border-primary/20 transition-all duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-blue-500" />
                </div>
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest leading-none">Sucesso no<br/>Agendamento</p>
              </div>
              <p className="text-3xl font-black text-primary">
                {stats.agendamentos}
              </p>
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-primary/5 hover:border-purple/20 transition-all duration-300 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp className="w-16 h-16 text-purple-500 -rotate-12" />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                    <TrendingUp className="w-6 h-6 text-purple-500" />
                  </div>
                  <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest leading-none">Canal Mais<br/>Efetivo</p>
                </div>
                
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-black text-primary uppercase leading-tight">
                    {stats.canalEfetivo.label}
                  </p>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100">
                      {stats.canalEfetivo.count} Agendamentos
                    </span>
                    {stats.total > 0 && stats.canalEfetivo.count > 0 && (
                      <span className="text-[10px] font-black text-on-surface-variant/40">
                        {Math.round((stats.canalEfetivo.count / stats.total) * 100)}% do Total
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl border border-outline-variant/10 relative">
            <ScrollIndicator onlyWhenParentVisible />
            <div className="overflow-x-auto custom-scrollbar-horizontal">
              <table className="w-full text-center border-collapse min-w-[900px] lg:min-w-full">
                <thead>
                  <tr className="bg-[#001b3d] border-b border-white/10 shadow-sm">
                    <th className="px-6 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center border-r border-white/5 cursor-pointer select-none" onClick={() => { if (sortField === 'nome') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField('nome'); setSortDir('asc'); } }}>
                      <div className="flex flex-col items-center gap-1">
                        <Users className="w-4 h-4 text-blue-400/60" />
                        <span>Paciente</span>
                        {sortField === 'nome' && <svg className={'h-2.5 w-2.5 transition-all duration-300 ' + (sortDir === 'desc' ? 'rotate-180' : '')} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>}
                      </div>
                    </th>
                    <th className="px-6 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center border-r border-white/5 cursor-pointer select-none" onClick={() => { if (sortField === 'data_busca') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField('data_busca'); setSortDir('asc'); } }}>
                      <div className="flex flex-col items-center gap-1">
                        <Calendar className="w-4 h-4 text-blue-400/60" />
                        <span>Data da Ação</span>
                        {sortField === 'data_busca' && <svg className={'h-2.5 w-2.5 transition-all duration-300 ' + (sortDir === 'desc' ? 'rotate-180' : '')} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>}
                      </div>
                    </th>
                    <th className="px-6 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center border-r border-white/5 cursor-pointer select-none" onClick={() => { if (sortField === 'tipo_contato') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField('tipo_contato'); setSortDir('asc'); } }}>
                      <div className="flex flex-col items-center gap-1">
                        <Phone className="w-4 h-4 text-blue-400/60" />
                        <span>Contato / Entrave</span>
                        {sortField === 'tipo_contato' && <svg className={'h-2.5 w-2.5 transition-all duration-300 ' + (sortDir === 'desc' ? 'rotate-180' : '')} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>}
                      </div>
                    </th>
                    <th className="px-6 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center border-r border-white/5 cursor-pointer select-none" onClick={() => { if (sortField === 'situacao_pos_busca') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField('situacao_pos_busca'); setSortDir('asc'); } }}>
                      <div className="flex flex-col items-center gap-1">
                        <BadgeCheck className="w-4 h-4 text-blue-400/60" />
                        <span>Desfecho / Tipo</span>
                        {sortField === 'situacao_pos_busca' && <svg className={'h-2.5 w-2.5 transition-all duration-300 ' + (sortDir === 'desc' ? 'rotate-180' : '')} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>}
                      </div>
                    </th>
                    <th className="px-6 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center border-r border-white/5 cursor-pointer select-none" onClick={() => { if (sortField === 'observacoes') setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField('observacoes'); setSortDir('asc'); } }}>
                      <div className="flex flex-col items-center gap-1">
                        <MessageSquare className="w-4 h-4 text-blue-400/60" />
                        <span>Observações</span>
                        {sortField === 'observacoes' && <svg className={'h-2.5 w-2.5 transition-all duration-300 ' + (sortDir === 'desc' ? 'rotate-180' : '')} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" /></svg>}
                      </div>
                    </th>
                    <th className="px-6 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <RotateCcw className="w-4 h-4 text-blue-400/60" />
                        <span>Ações</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/5">
                  {filteredRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center opacity-30">
                          <ClipboardList className="w-16 h-16 mb-4" />
                          <p className="text-sm font-black uppercase tracking-widest">Nenhum registro encontrado</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    [...filteredRecords].sort((a, b) => {
                      let va = '', vb = '';
                      switch (sortField) {
                        case 'nome': va = a.expand?.paciente?.nome || ''; vb = b.expand?.paciente?.nome || ''; break;
                        case 'data_busca': va = a.data_busca || ''; vb = b.data_busca || ''; break;
                        case 'tipo_contato': va = a.tipo_contato || ''; vb = b.tipo_contato || ''; break;
                        case 'situacao_pos_busca': va = a.situacao_pos_busca || ''; vb = b.situacao_pos_busca || ''; break;
                        case 'observacoes': va = a.observacoes || ''; vb = b.observacoes || ''; break;
                        default: va = a.data_busca || ''; vb = b.data_busca || '';
                      }
                      const cmp = String(va || '').localeCompare(String(vb || ''), 'pt-BR', { sensitivity: 'base' });
                      return sortDir === 'asc' ? cmp : -cmp;
                    }).map((acomp) => {
                        const p = acomp.expand?.paciente as any || {};
                        const pacienteNome = p.nome || 'Paciente Desconhecido';
                        const cns = p.cns || '--';
                        const unidade = p.unidade || '--';
                        const equipe = p.equipe || '--';
                        const microarea = p.microarea !== undefined && p.microarea !== '' ? p.microarea : '--';
                        
                        // Formatando a data
                        const dataFormatada = acomp.data_busca
                          ? (() => { const p = acomp.data_busca.substring(0,10).split('-'); const mes = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'][parseInt(p[1])-1]; return `${p[2]} DE ${mes?.toUpperCase()} DE ${p[0]}`; })()
                          : '--';

                        return (
                          <tr key={acomp.id} className="hover:bg-primary/[0.03] transition-all group">
                            <td className="px-4 py-4 text-center align-middle">
                              <div className="flex flex-col items-center gap-1">
                                <p className="text-[11px] md:text-[12px] font-black text-primary uppercase leading-snug break-words" title={pacienteNome}>{pacienteNome}</p>
                                <p className="text-[9px] font-bold text-on-surface-variant/60 uppercase tracking-tighter">CNS: {cns}</p>
                                <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter leading-tight">{unidade}</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter leading-tight">{equipe}</p>
                                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter leading-tight">MA: {microarea}</p>
                              </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                              <span className="text-[13px] font-black text-[#001b3d] uppercase whitespace-nowrap bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/10">
                                {dataFormatada}
                              </span>
                            </td>
                            <td className="px-6 py-6 text-center">
                              <div className="flex flex-col items-center gap-1.5">
                                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-tight border border-blue-100 shadow-sm">
                                  <Phone className="w-3.5 h-3.5" />
                                  {acomp.tipo_contato || '--'}
                                </span>
                                {acomp.entraves_identificados && acomp.entraves_identificados.length > 0 && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-500 uppercase tracking-tighter bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
                                    <AlertTriangle className="w-3 h-3" />
                                    {Array.isArray(acomp.entraves_identificados) ? acomp.entraves_identificados.join('; ') : acomp.entraves_identificados}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                              <div className="flex flex-col items-center gap-1.5">
                                <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight border shadow-sm ${
                                  acomp.situacao_pos_busca?.includes('Sucesso') || acomp.situacao_pos_busca?.includes('Agendamento')
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                    : 'bg-amber-50 text-amber-700 border-amber-100'
                                }`}>
                                  {acomp.situacao_pos_busca || '--'}
                                </span>
                                <span className="text-[8px] font-bold text-slate-400 uppercase">
                                  {acomp.tipo_busca || '--'}
                                </span>
                                {getSelectLabel(acomp.situacao_pos_busca || '', SITUACAO_POS_BUSCA_OPTIONS) === 'AGENDAMENTO APÓS CONTATO DIRETO' && acomp.data_do_agendamento && (
                                  <span className="text-[8px] font-bold text-cyan-600 uppercase">
                                    Agendado para {(() => { const p = (acomp.data_do_agendamento || '').substring(0, 10).split('-'); return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : acomp.data_do_agendamento; })()}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-4 text-center align-middle">
                              <div className="max-w-[200px] mx-auto" title={acomp.observacoes || ''}>
                                {acomp.observacoes ? (
                                  <p className="text-[10px] md:text-[11px] font-medium italic text-slate-500/80 leading-relaxed text-center line-clamp-2 tracking-wide">
                                    {acomp.observacoes.length > 144 ? `${acomp.observacoes.substring(0, 144)}...` : acomp.observacoes}
                                  </p>
                                ) : (
                                  <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">--</span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                              <div className="flex items-center justify-center gap-3">
                                <button 
                                  onClick={() => handleViewPaciente(acomp.paciente || acomp.expand?.paciente?.id)}
                                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-cyan-600 hover:border-cyan-200 hover:bg-cyan-50 transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                  title="Ver Paciente"
                                >
                                  <Eye className="w-5 h-5" />
                                </button>
                                <button 
                                  onClick={() => handleEdit(acomp.id)}
                                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                  title="Editar"
                                >
                                  <Edit className="w-5 h-5" />
                                </button>
                                <button 
                                  onClick={() => handleDelete(acomp.id)}
                                  className="w-10 h-10 flex items-center justify-center rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <Footer />
        </div>
      </div>

      {/* Modal de Edição */}
      {isEditModalOpen && activeSelectedAcompanhamento && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div data-dropdown-root="true" className="relative flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-slate-900/10 animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="relative flex items-center gap-4 bg-gradient-to-r from-[#1c2e4a] via-[#253c61] to-[#1a365d] px-5 py-5 sm:px-6 shrink-0">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-xl font-black text-white shadow-lg shadow-cyan-500/30 ring-2 ring-white/20">
                {(activeSelectedAcompanhamento.expand?.paciente?.nome || '??').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-200/70 mb-0.5">
                  <Edit className="h-3.5 w-3.5" />
                  EDITAR ACOMPANHAMENTO
                </div>
                <h2 className="truncate text-lg font-black text-white leading-tight">{activeSelectedAcompanhamento.expand?.paciente?.nome || 'Desconhecido'}</h2>
              </div>
              <button onClick={handleCloseModal} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/50 ring-1 ring-white/10 transition-all hover:bg-white/15 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              <form id="edit-acompanhamento-form" onSubmit={handleSaveEdit}>
                <div className="space-y-3">
                  {/* Seção 1 — Busca Ativa */}
                  <div className="rounded-xl border-l-4 border-cyan-500 bg-gradient-to-r from-cyan-50/80 to-white p-3.5">
                    <div className="mb-2.5 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/10">
                        <Search className="h-3.5 w-3.5 text-cyan-600" />
                      </div>
                      <p className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-700">Busca Ativa</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-2.5">
                      <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                          <Calendar className="h-3 w-3" />
                          Data da Busca <span className="text-red-500">*</span>
                        </label>
                        <DatePickerPTBR value={selectedAcompanhamento.data_busca_formatada || ''} isISO={false} onChange={(val) => setSelectedAcompanhamento({...selectedAcompanhamento, data_busca_formatada: val})} />
                      </div>
                      <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                          <Search className="h-3 w-3" />
                          Tipo de Busca <span className="text-red-500">*</span>
                        </label>
                        <SingleSelect placeholder="Selecione o tipo" options={TIPO_BUSCA_OPTIONS} value={getCanonicalSelectValue(selectedAcompanhamento.tipo_busca || '', TIPO_BUSCA_OPTIONS)} onChange={(val) => setSelectedAcompanhamento({...selectedAcompanhamento, tipo_busca: val})} required showSearch={false} />
                      </div>
                      <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                          <Phone className="h-3 w-3" />
                          Tipo de Contato <span className="text-red-500">*</span>
                        </label>
                        <SingleSelect placeholder="Selecione" options={TIPO_CONTATO_OPTIONS} value={getCanonicalSelectValue(selectedAcompanhamento.tipo_contato || '', TIPO_CONTATO_OPTIONS)} onChange={(val) => setSelectedAcompanhamento({...selectedAcompanhamento, tipo_contato: val})} required showSearch={false} />
                      </div>
                    </div>
                  </div>

                  {/* Seção 2 — Entraves */}
                  <div className="rounded-xl border-l-4 border-amber-500 bg-gradient-to-r from-amber-50/80 to-white p-3.5">
                    <div className="mb-2.5 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      </div>
                      <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber-700">Entraves</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5">
                      <div>
                        <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-500">Entrave(s) Identificado(s)</label>
                        <MultiSelect placeholder="Selecione" options={ENTRAVES_IDENTIFICADOS_OPTIONS} value={selectedAcompanhamento.entraves_identificados || []} onChange={(val) => setSelectedAcompanhamento({...selectedAcompanhamento, entraves_identificados: val})} showSearch={false} />
                      </div>
                      <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">Entrave(s) Informado Por {Array.isArray(selectedAcompanhamento.entraves_identificados) && selectedAcompanhamento.entraves_identificados.filter((v: any) => v).length > 0 && <span className="text-red-500">*</span>}</label>
                        <SingleSelect placeholder="Selecione" options={ENTRAVES_INFORMADO_POR_OPTIONS} value={getCanonicalSelectValue(selectedAcompanhamento.entraves_informado_por || '', ENTRAVES_INFORMADO_POR_OPTIONS)} onChange={(val) => setSelectedAcompanhamento({...selectedAcompanhamento, entraves_informado_por: val})} showSearch={false} />
                      </div>
                    </div>
                  </div>

                  {/* Seção 3 — Desfecho */}
                  <div className="rounded-xl border-l-4 border-emerald-500 bg-gradient-to-r from-emerald-50/80 to-white p-3.5">
                    <div className="mb-2.5 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10">
                        <Clock className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <p className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700">Desfecho</p>
                    </div>
                    <div className={`grid gap-x-3 gap-y-2.5 ${getSelectLabel(selectedAcompanhamento.situacao_pos_busca || '', SITUACAO_POS_BUSCA_OPTIONS) === 'AGENDAMENTO APÓS CONTATO DIRETO' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                      <div>
                        <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                          Situação Pós Busca Ativa <span className="text-red-500">*</span>
                        </label>
                        <SingleSelect placeholder="Selecione o desfecho" options={SITUACAO_POS_BUSCA_OPTIONS} value={getCanonicalSelectValue(selectedAcompanhamento.situacao_pos_busca || '', SITUACAO_POS_BUSCA_OPTIONS)} onChange={(val) => setSelectedAcompanhamento({...selectedAcompanhamento, situacao_pos_busca: val})} required showSearch={false} />
                      </div>
                      {getSelectLabel(selectedAcompanhamento.situacao_pos_busca || '', SITUACAO_POS_BUSCA_OPTIONS) === 'AGENDAMENTO APÓS CONTATO DIRETO' && (
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                            <Calendar className="h-3 w-3" />
                            Data do Agendamento <span className="text-red-500">*</span>
                          </label>
                          <DatePickerPTBR value={(selectedAcompanhamento.data_do_agendamento || '').substring(0, 10)} isISO={true} onChange={(val) => setSelectedAcompanhamento({...selectedAcompanhamento, data_do_agendamento: val})} />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Seção 4 — Observações */}
                  <div className="rounded-xl border-l-4 border-blue-500 bg-gradient-to-r from-blue-50/80 to-white p-3.5">
                    <div className="mb-2.5 flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10">
                        <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                      </div>
                      <p className="text-[11px] font-extrabold uppercase tracking-widest text-blue-700">Observações</p>
                    </div>
                    <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">Observações do Acompanhamento</label>
                    <textarea name="observacoes" value={selectedAcompanhamento.observacoes || ''} onChange={(e) => setSelectedAcompanhamento({...selectedAcompanhamento, observacoes: e.target.value})}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition-all duration-200 placeholder:text-slate-400 focus:bg-white focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15"
                      rows={3} placeholder="Descreva aqui detalhes relevantes do atendimento..."
                    ></textarea>
                  </div>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-slate-100 shrink-0">
              <button type="button" onClick={handleCloseModal} disabled={isSaving} className="text-xs font-bold text-slate-400 transition-colors hover:text-slate-600 px-5 py-2.5 disabled:opacity-50">
                Cancelar
              </button>
              <button form="edit-acompanhamento-form" type="submit" disabled={isSaving}
                className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-2.5 text-xs font-black uppercase tracking-wider text-white shadow-lg shadow-emerald-500/20 transition-all hover:from-emerald-400 hover:to-emerald-500 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Novo Registro de Acompanhamento */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div data-dropdown-root="true" className="relative bg-white w-full max-w-3xl max-h-[92vh] flex flex-col rounded-3xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.25)] overflow-visible border border-slate-200/60 animate-in zoom-in-95 duration-300">
            {/* Header com gradiente e decoração */}
            <div className="relative bg-gradient-to-br from-[#1c2e4a] via-[#253c61] to-[#1a365d] px-5 sm:px-8 md:px-10 py-5 sm:py-6 shrink-0 overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
              <div className="absolute top-6 right-24 w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />

              <div className="relative flex justify-between items-center">
                <div className="flex items-center gap-3 sm:gap-4">
                  <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-[inset_0_2px_4px_rgba(255,255,255,0.15)] border border-white/10">
                    <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-white text-base sm:text-lg md:text-xl font-black tracking-tight leading-tight">Novo Registro</h3>
                    {createSelectedPaciente && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
                        <p className="text-white/60 text-[10px] sm:text-xs font-medium uppercase tracking-widest truncate max-w-[200px] sm:max-w-[300px]">
                          {createSelectedPaciente.nome}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
                <button onClick={resetCreateModal} className="p-2 -mr-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white transition-all duration-300 hover:rotate-90 backdrop-blur-sm">
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="overflow-y-auto custom-scrollbar-modal flex-1 p-5 sm:p-8 md:p-10">
              <form id="create-acompanhamento-form" onSubmit={handleSaveCreate}>
                {!createSelectedPaciente ? (
                  <div className="space-y-4">
                    <label className="flex items-center gap-2 text-[0.65rem] font-bold text-slate-400 uppercase tracking-[0.15em]">
                      <div className="p-1 rounded-lg bg-slate-100"><Users className="w-3.5 h-3.5" /></div>
                      Buscar Paciente por Nome ou CNS *
                    </label>
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
                      <input
                        type="text"
                        value={createPacienteSearch}
                        onChange={(e) => setCreatePacienteSearch(e.target.value)}
                        placeholder="Digite o nome ou CNS do paciente..."
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border-2 border-slate-200/60 rounded-2xl text-base font-bold text-slate-800 focus:border-blue-400 focus:bg-white outline-none transition-all placeholder:text-slate-300"
                        autoFocus
                      />
                    </div>
                    {createPacienteResults.length > 0 && (
                      <div className="bg-white border border-slate-200/60 rounded-2xl shadow-xl max-h-48 overflow-y-auto">
                        {createPacienteResults.map(p => (
                          <button key={p.id} type="button"
                            onClick={() => { setCreateSelectedPaciente(p); setCreatePacienteSearch(''); setCreatePacienteResults([]); }}
                            className="w-full text-left px-4 py-3 hover:bg-blue-50 transition-colors border-b border-slate-100 last:border-0"
                          >
                            <p className="text-sm font-black text-slate-800 uppercase">{p.nome}</p>
                            <p className="text-[10px] font-bold text-slate-400 uppercase">CNS: {p.cns || '--'} | {p.unidade || '--'}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    {isSearchingPaciente && (
                      <p className="text-xs font-bold text-slate-300 uppercase text-center py-4">Buscando...</p>
                    )}
                    {!isSearchingPaciente && createPacienteSearch.length >= 2 && createPacienteResults.length === 0 && (
                      <p className="text-xs font-bold text-slate-300 uppercase text-center py-4">Nenhum paciente encontrado</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-5">
                    {/* Selected patient chip */}
                    <div className="flex items-center gap-3 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/60 rounded-2xl px-4 py-3">
                      <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-white text-sm font-black">
                        {createSelectedPaciente.nome.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-black text-emerald-800 uppercase truncate">{createSelectedPaciente.nome}</p>
                        <p className="text-[10px] font-bold text-emerald-500">CNS: {createSelectedPaciente.cns}</p>
                      </div>
                      <button type="button" onClick={() => setCreateSelectedPaciente(null)} className="p-1.5 rounded-lg hover:bg-emerald-100 text-emerald-400 hover:text-emerald-700 transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                      <span className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">Dados do Acompanhamento</span>
                      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
                    </div>

                    {/* Seção 1 — Busca Ativa */}
                    <div className="rounded-xl border-l-4 border-cyan-500 bg-gradient-to-r from-cyan-50/80 to-white p-3.5">
                      <div className="mb-2.5 flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-cyan-500/10">
                          <Search className="h-3.5 w-3.5 text-cyan-600" />
                        </div>
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-700">Busca Ativa</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-3 gap-y-2.5">
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                            <Calendar className="h-3 w-3" />
                            Data da Busca <span className="text-red-500">*</span>
                          </label>
                          <DatePickerPTBR value={createDate} isISO={false} onChange={setCreateDate} />
                        </div>
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                            <Search className="h-3 w-3" />
                            Tipo de Busca <span className="text-red-500">*</span>
                          </label>
                          <SingleSelect placeholder="Selecione o tipo" options={TIPO_BUSCA_OPTIONS} value={createTipoBusca} onChange={setCreateTipoBusca} required showSearch={false} />
                        </div>
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                            <Phone className="h-3 w-3" />
                            Tipo de Contato <span className="text-red-500">*</span>
                          </label>
                          <SingleSelect placeholder="Selecione o tipo" options={TIPO_CONTATO_OPTIONS} value={createTipoContato} onChange={setCreateTipoContato} required showSearch={false} />
                        </div>
                      </div>
                    </div>

                    {/* Seção 2 — Entraves */}
                    <div className="rounded-xl border-l-4 border-amber-500 bg-gradient-to-r from-amber-50/80 to-white p-3.5">
                      <div className="mb-2.5 flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/10">
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        </div>
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-amber-700">Entraves</p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-2.5">
                        <div>
                          <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-widest text-slate-500">Entrave(s) Identificado(s)</label>
                          <MultiSelect placeholder="Selecione" options={ENTRAVES_IDENTIFICADOS_OPTIONS} value={createEntraves} onChange={setCreateEntraves} showSearch={false} />
                        </div>
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">Entrave(s) Informado Por {createEntraves.length > 0 && <span className="text-red-500">*</span>}</label>
                          <SingleSelect placeholder="Selecione" options={ENTRAVES_INFORMADO_POR_OPTIONS} value={createEntravesInformadoPor} onChange={setCreateEntravesInformadoPor} showSearch={false} />
                        </div>
                      </div>
                    </div>

                    {/* Seção 3 — Desfecho */}
                    <div className="rounded-xl border-l-4 border-emerald-500 bg-gradient-to-r from-emerald-50/80 to-white p-3.5">
                      <div className="mb-2.5 flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10">
                          <Clock className="h-3.5 w-3.5 text-emerald-600" />
                        </div>
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700">Desfecho</p>
                      </div>
                      <div className={`grid gap-x-3 gap-y-2.5 ${getSelectLabel(createSituacao, SITUACAO_POS_BUSCA_OPTIONS) === 'AGENDAMENTO APÓS CONTATO DIRETO' ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                        <div>
                          <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                            Situação Pós Busca Ativa <span className="text-red-500">*</span>
                          </label>
                          <SingleSelect placeholder="Selecione o desfecho" options={SITUACAO_POS_BUSCA_OPTIONS} value={createSituacao} onChange={setCreateSituacao} required showSearch={false} />
                        </div>
                        {getSelectLabel(createSituacao, SITUACAO_POS_BUSCA_OPTIONS) === 'AGENDAMENTO APÓS CONTATO DIRETO' && (
                          <div>
                            <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                              <Calendar className="h-3 w-3" />
                              Data do Agendamento <span className="text-red-500">*</span>
                            </label>
                            <DatePickerPTBR value={createDataAgendamento} isISO={false} onChange={setCreateDataAgendamento} />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Seção 4 — Observações */}
                    <div className="rounded-xl border-l-4 border-blue-500 bg-gradient-to-r from-blue-50/80 to-white p-3.5">
                      <div className="mb-2.5 flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-blue-500/10">
                          <MessageSquare className="h-3.5 w-3.5 text-blue-600" />
                        </div>
                        <p className="text-[11px] font-extrabold uppercase tracking-widest text-blue-700">Observações</p>
                      </div>
                      <label className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">Observações do Acompanhamento</label>
                      <textarea
                        value={createObservacoes}
                        onChange={(e) => setCreateObservacoes(e.target.value)}
                        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none transition-all duration-200 placeholder:text-slate-400 focus:bg-white focus:border-cyan-400/60 focus:ring-2 focus:ring-cyan-400/15"
                        rows={3}
                        placeholder="Informações adicionais relevantes..."
                      ></textarea>
                    </div>
                  </div>
                )}
              </form>
            </div>

            {/* Footer */}
            {createSelectedPaciente && (
              <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 px-5 sm:px-8 py-5 border-t border-slate-100 bg-gradient-to-b from-white to-slate-50 shrink-0 z-10">
                <button type="button" onClick={resetCreateModal} disabled={isSaving} className="px-6 sm:px-8 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 transition-all border border-transparent hover:border-slate-200 w-full sm:w-auto order-2 sm:order-1 disabled:opacity-50">
                  Descartar
                </button>
                <button type="submit" form="create-acompanhamento-form" disabled={isSaving} className="px-8 sm:px-10 py-3 rounded-xl text-sm font-black uppercase tracking-widest text-white bg-gradient-to-r from-[#1c2e4a] to-[#253c61] shadow-lg shadow-slate-300/50 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all disabled:opacity-50 flex items-center gap-2 w-full sm:w-auto justify-center order-1 sm:order-2">
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {isSaving ? 'Salvando...' : 'Salvar Registro'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Visualizar Paciente */}
      {viewPacienteModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xl z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="relative bg-white w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl shadow-2xl shadow-slate-900/10 overflow-hidden border border-slate-200/60 animate-in zoom-in-95 duration-300">
            {/* Header */}
            <div className="relative flex items-center gap-4 bg-gradient-to-r from-[#1c2e4a] via-[#253c61] to-[#1a365d] px-5 py-5 shrink-0">
              <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 text-xl font-black text-white shadow-lg shadow-cyan-500/30 ring-2 ring-white/20">
                {viewPacienteModal.paciente ? (
                  (viewPacienteModal.paciente.nome || '??').split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
                ) : (
                  <Loader2 className="h-6 w-6 animate-spin" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 text-xs font-semibold text-cyan-200/70 mb-0.5">
                  <Eye className="h-3.5 w-3.5" />
                  FICHA DO PACIENTE
                </div>
                <h2 className="truncate text-lg font-black text-white leading-tight">
                  {viewPacienteModal.loading ? 'Carregando...' : (viewPacienteModal.paciente?.nome || 'Paciente não encontrado')}
                </h2>
              </div>
              <button onClick={() => setViewPacienteModal({ isOpen: false, paciente: null, loading: false })} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white/5 text-white/50 ring-1 ring-white/10 transition-all hover:bg-white/15 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {viewPacienteModal.loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 text-cyan-400 animate-spin" />
                  <span className="ml-3 text-sm font-bold text-slate-400">Carregando dados do paciente...</span>
                </div>
              ) : viewPacienteModal.paciente ? (
                <div className="space-y-3">
                  {/* Dados Pessoais & Localização */}
                  <div className="rounded-xl border-l-4 border-cyan-500 bg-gradient-to-r from-cyan-50/80 to-white p-3.5">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-cyan-700 mb-3 flex items-center gap-2">
                      <Users className="h-3.5 w-3.5" /> Dados Pessoais & Localização
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      {/* Dados Pessoais */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-cyan-600 mb-1 flex items-center gap-1.5">
                          <Users className="h-2.5 w-2.5" /> Dados Pessoais
                        </p>
                        <InfoRow label="Nome Completo" value={viewPacienteModal.paciente.nome} />
                        <InfoRow label="CNS" value={viewPacienteModal.paciente.cns} />
                        <InfoRow label="Data de Nascimento" value={viewPacienteModal.paciente.data_nascimento} />
                        <div className="flex gap-4">
                          <div className="flex-1">
                            <InfoRow label="Idade" value={(() => {
                              const dn = viewPacienteModal.paciente.data_nascimento;
                              if (!dn) return undefined;
                              const nasc = new Date(dn.substring(0, 10));
                              const hoje = new Date();
                              let idade = hoje.getFullYear() - nasc.getFullYear();
                              const m = hoje.getMonth() - nasc.getMonth();
                              if (m < 0 || (m === 0 && hoje.getDate() < nasc.getDate())) idade--;
                              return `${idade} anos`;
                            })()} />
                          </div>
                          <div className="flex-1">
                            <InfoRow label="Grupo" value={viewPacienteModal.paciente.grupo} />
                          </div>
                        </div>
                      </div>
                      {/* Localização */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-cyan-600 mb-1 flex items-center gap-1.5">
                          <MapPin className="h-2.5 w-2.5" /> Localização
                        </p>
                        <InfoRow label="Unidade de Saúde" value={viewPacienteModal.paciente.unidade} />
                        <InfoRow label="Equipe" value={viewPacienteModal.paciente.equipe} />
                        <InfoRow label="Microárea" value={viewPacienteModal.paciente.microarea} />
                      </div>
                    </div>
                  </div>

                  {/* Rastreamento */}
                  <div className="rounded-xl border-l-4 border-emerald-500 bg-gradient-to-r from-emerald-50/80 to-white p-3.5">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-emerald-700 mb-3 flex items-center gap-2">
                      <ClipboardList className="h-3.5 w-3.5" /> Rastreamento
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2">
                      <InfoRow label="Cito (PEP)" value={viewPacienteModal.paciente.cito_pep} />
                      <InfoRow label="Cito (Lab)" value={viewPacienteModal.paciente.cito_lab} />
                      <InfoRow label="DNA-HPV (PEP)" value={viewPacienteModal.paciente.dna_hpv_pep} />
                      <InfoRow label="DNA-HPV (GAL)" value={viewPacienteModal.paciente.dna_hpv_gal} />

                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 text-slate-400 text-sm font-bold">Paciente não encontrado.</div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-5 py-4 border-t border-slate-100 shrink-0">
              <button onClick={() => setViewPacienteModal({ isOpen: false, paciente: null, loading: false })} className="text-xs font-bold text-slate-400 transition-colors hover:text-slate-600 px-5 py-2.5">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
