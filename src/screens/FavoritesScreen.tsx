import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { X, Search, AlertTriangle, Calendar, Phone, ClipboardList, MapPin, MessageSquare, Info, CheckCircle2, Building, TestTube, Microscope, SearchX, FileText, ChevronLeft, ChevronRight, Eye, Users, Filter, RotateCcw, Star, BadgeCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { pb } from '../lib/pocketbase';
import { DatePickerPTBR } from '../components/DatePickerPTBR';
import { MultiSelect } from '../components/MultiSelect';
import { SingleSelect } from '../components/SingleSelect';
import { UNIDADES_EQUIPES, MICROAREAS } from '../constants/regionalData';
import {
  TIPO_BUSCA_OPTIONS,
  TIPO_CONTATO_OPTIONS,
  SITUACAO_POS_BUSCA_OPTIONS,
  ENTRAVES_IDENTIFICADOS_OPTIONS,
  ENTRAVES_INFORMADO_POR_OPTIONS,
  getCanonicalSelectValue,
  matchesSelectFilter
} from '../constants/followUpOptions';

// Remove acentos via Unicode NFD decomposition (ex: "ESPERANÇA" → "ESPERANCA")
const normalizeText = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\s+/g, ' ');

interface Paciente {
  id: string;
  unidade?: string;
  equipe?: string;
  microarea?: number;
  nome: string;
  cns: string;
  data_nascimento: string;
  idade: number;
  grupo: string;
  cito_lab?: string;
  cito_pep?: string;
  dna_hpv_gal?: string;
  dna_hpv_pep?: string;
  alertas_rastreamento?: string;
  alertas?: string; 
  total_acompanhamentos?: number;
  isFavorite?: boolean;
}

const DNA_HPV_PEP_SYNC_EVENT = 'amarcap53:dna-hpv-pep-updated';

interface FavoritesScreenProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const SIM_NAO_OPTIONS = [
  { label: 'SIM', value: 'SIM' },
  { label: 'NÃO', value: 'NÃO' },
];

const matchesMultiValueField = (rawValue: string | undefined, selectedValues: string[]) => {
  if (selectedValues.length === 0) return true;
  if (!rawValue) return false;

  const values = rawValue.split(';').map(value => value.trim()).filter(Boolean);
  return selectedValues.some(value => values.includes(value));
};

const InfoTooltip: React.FC<{ content: string }> = ({ content }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node) &&
          buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (closeTimeoutRef.current) window.clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
  };

  const handleOpen = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    updatePosition();
    setIsOpen(true);
  };

  const handleClose = (immediate = false) => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }

    if (immediate) {
      setIsOpen(false);
      return;
    }

    closeTimeoutRef.current = window.setTimeout(() => {
      setIsOpen(false);
      closeTimeoutRef.current = null;
    }, 120);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={(e) => { e.stopPropagation(); if (isOpen) handleClose(true); else handleOpen(); }}
        onMouseEnter={handleOpen}
        onMouseLeave={handleClose}
        onFocus={handleOpen}
        onBlur={() => handleClose(true)}
        className="w-3.5 h-3.5 rounded-full bg-blue-400/20 hover:bg-blue-400/40 text-blue-300 hover:text-blue-200 flex items-center justify-center transition-all duration-200 flex-shrink-0 ring-1 ring-blue-400/20 hover:ring-blue-400/40"
        aria-label="Mais informações"
      >
        <span className="text-[7px] font-black leading-none" style={{ fontFamily: 'serif' }}>i</span>
      </button>
      {isOpen && createPortal(
        <div
          ref={tooltipRef}
          className="fixed z-[9999] pointer-events-auto"
          style={{ top: position.top, left: position.left }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={handleOpen}
          onMouseLeave={handleClose}
        >
          <div className="relative -translate-x-1/2 -translate-y-[calc(100%+4px)]">
            <div className="bg-white text-slate-800 text-[10px] leading-relaxed font-medium rounded-xl px-4 py-3 shadow-[0_8px_30px_rgba(0,0,0,0.18)] border border-slate-200/80 max-w-[240px] text-center">
              {content}
            </div>
            <div className="absolute -bottom-[6px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.08)]"></div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

const ALERT_CONFIGS: Record<string, { label: string; icon: any; color: string; bg: string; description: string }> = {
  'PEP_MOLECULAR': {
    label: 'CONFIRMADO O REGISTRO DE RESULTADOS DO TESTE MOLECULAR DNA-HPV NO PEP',
    icon: TestTube,
    color: 'text-white',
    bg: 'bg-blue-600 border-blue-700 shadow-md shadow-blue-600/20',
    description: 'Identificado registro de resultado no PEP de teste molecular'
  },
  'COLETA_MOLECULAR': {
    label: 'IDENTIFICADO TESTE MOLECULAR DNA-HPV - (GAL/MEDIREC)',
    icon: TestTube,
    color: 'text-white',
    bg: 'bg-orange-500 border-orange-600 shadow-md shadow-orange-500/20',
    description: 'Identificado coleta/resultado de teste molecular'
  },
  'PEP_CITO': {
    label: 'IDENTIFICADO REGISTRO DE RESULTADO DE CITO NO PEP',
    icon: Microscope,
    color: 'text-white',
    bg: 'bg-emerald-600 border-emerald-700 shadow-md shadow-emerald-600/20',
    description: 'Identificado registro de resultado no PEP de cito'
  },
  'COLETA_CITO': {
    label: 'IDENTIFICADO COLETA DE CITO/PENDENTE DE REGISTRO DE RESULTADO NO PEP',
    icon: Microscope,
    color: 'text-white',
    bg: 'bg-yellow-500 border-yellow-600 shadow-md shadow-yellow-500/20',
    description: 'Identificado coleta/resultado de cito'
  },
  'NAO_IDENTIFICADO': {
    label: 'NÃO IDENTIFICADO COLETA OU RESULTADO DE EXAME DE RASTREAMENTO',
    icon: SearchX,
    color: 'text-white',
    bg: 'bg-red-600 border-red-700 shadow-md shadow-red-600/20',
    description: 'Não identificado coleta ou resultado de exame de rastreamento'
  }
};

const formatarData = (dataStr: string | undefined) => {
  if (!dataStr || dataStr === '--') return '--';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) return dataStr;
  let dateOnly = dataStr;
  if (dateOnly.includes(' ')) dateOnly = dateOnly.split(' ')[0];
  if (dateOnly.includes('T')) dateOnly = dateOnly.split('T')[0];
  if (/^\d{4}-\d{2}-\d{2}/.test(dateOnly)) {
    const [ano, mes, dia] = dateOnly.split('-');
    return `${dia}/${mes}/${ano}`;
  }
  return dateOnly;
};

const calcularIdade = (dataNascimento: string) => {
  if (!dataNascimento) return 0;
  let dataFormatada = dataNascimento;
  if (dataNascimento.includes('/')) {
    const [dia, mes, ano] = dataNascimento.split('/');
    dataFormatada = `${ano}-${mes}-${dia}`;
  }
  const hoje = new Date();
  const nascimento = new Date(dataFormatada);
  let idade = hoje.getFullYear() - nascimento.getFullYear();
  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) idade--;
  return isNaN(idade) ? 0 : idade;
};

export const FavoritesScreen: React.FC<FavoritesScreenProps> = ({ activeTab, setActiveTab }) => {
  const { user, isAdmin } = useAuth();

  const FAV_CACHE_KEY = `favorites_cache_${user?.id}`;
  const FAV_CACHE_TTL = 5 * 60 * 1000;
  const getFavCache = () => {
    try {
      const raw = localStorage.getItem(FAV_CACHE_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (Date.now() - c.ts > FAV_CACHE_TTL) return null;
      return c.data;
    } catch { return null; }
  };
  const setFavCache = (data: any) => {
    try { localStorage.setItem(FAV_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
  };

  const _favInit = getFavCache();
  const [pacientes, setPacientes] = useState<Paciente[]>(_favInit ?? []);
  const [isLoading, setIsLoading] = useState(!_favInit);
  
  // Estados de Busca e Filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterGrupo, setFilterGrupo] = useState<string[]>([]);
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
    setFilterStatus([]);
    setFilterGrupo([]);
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
  };

  const [availableGroups, setAvailableGroups] = useState<string[]>([]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [patientForDetails, setPatientDetails] = useState<Paciente | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Garantir que os detalhes sejam sempre do dado mais recente no estado
  const activePatientForDetails = patientForDetails 
    ? (pacientes.find(p => p.id === patientForDetails.id) || patientForDetails) 
    : null;

  // Estados para os campos do modal de acompanhamento
  const [modalTipoBusca, setModalTipoBusca] = useState('');
  const [modalTipoContato, setModalTipoContato] = useState('');
  const [modalSituacao, setModalSituacao] = useState('');
  const [modalEntraves, setModalEntraves] = useState<string[]>([]);
  const [modalEntravesInformadoPor, setModalEntravesInformadoPor] = useState('');
  const [modalObservacoes, setModalObservacoes] = useState('');

  const [favorites, setFavorites] = useState<string[]>(user?.favoritos || []);

  // Sincroniza estado local com o usuário do AuthContext (que vem do PocketBase)
  useEffect(() => {
    setFavorites(user?.favoritos || []);
  }, [user?.favoritos]);

  useEffect(() => {
    fetchFavorites(true);
  }, [favorites]);

  useEffect(() => {
    const handleCitoUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ patientId: string; displayDate: string; source?: string }>;
      if (!customEvent.detail?.patientId || customEvent.detail.source === 'favorites') return;
      applyCitoLaboratorioUpdate(customEvent.detail.patientId, customEvent.detail.displayDate || '--');
    };

    const handleStorageSync = (event: StorageEvent) => {
      if (event.key !== 'amarcap53_dna_hpv_pep_sync' || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as { patientId: string; displayDate: string; source?: string };
        if (!payload.patientId || payload.source === 'favorites') return;
        applyCitoLaboratorioUpdate(payload.patientId, payload.displayDate || '--');
      } catch (error) {
        console.error('Erro ao sincronizar DNA-HPV (PEP):', error);
      }
    };

    window.addEventListener(DNA_HPV_PEP_SYNC_EVENT, handleCitoUpdate as EventListener);
    window.addEventListener('storage', handleStorageSync);

    return () => {
      window.removeEventListener(DNA_HPV_PEP_SYNC_EVENT, handleCitoUpdate as EventListener);
      window.removeEventListener('storage', handleStorageSync);
    };
  }, []);

  const toggleFavorite = async (id: string) => {
    if (!user?.id) return;

    const collectionName = pb.authStore.model?.collectionName || 'users';
    
    const isFav = favorites.includes(id);
    const newFavorites = isFav 
      ? favorites.filter(f => f !== id) 
      : [...favorites, id];
    
    // Atualização otimista local e no AuthStore
    setFavorites(newFavorites);
    pb.authStore.save(pb.authStore.token, {
      ...pb.authStore.model,
      favoritos: newFavorites,
    });
    
    try {
      const updatedUser = await pb.collection(collectionName).update(user.id, {
        favoritos: newFavorites
      });
      
      // Sincroniza com o retorno real do servidor
      pb.authStore.save(pb.authStore.token, updatedUser);
    } catch (error) {
      console.error("Erro ao sincronizar favoritos:", error);
      
      // Reverter para o estado que está no objeto user do contexto
      const rollbackFavs = user.favoritos || [];
      setFavorites(rollbackFavs);
      pb.authStore.save(pb.authStore.token, {
        ...pb.authStore.model,
        favoritos: rollbackFavs,
      });
      
      alert("Erro ao salvar favorito. Verifique sua conexão ou se o campo 'favoritos' existe na coleção de usuários.");
    }
  };

  const determinarAlerta = (p: any) => {
    if (p.dna_hpv_pep && p.dna_hpv_pep !== '--' && p.dna_hpv_pep !== '') return 'PEP_MOLECULAR';
    if (p.dna_hpv_gal && p.dna_hpv_gal !== '--' && p.dna_hpv_gal !== '') return 'COLETA_MOLECULAR';
    if (p.cito_pep && p.cito_pep !== '--' && p.cito_pep !== '') return 'PEP_CITO';
    if (p.cito_lab && p.cito_lab !== '--' && p.cito_lab !== '') return 'COLETA_CITO';
    return 'NAO_IDENTIFICADO';
  };

  const applyCitoLaboratorioUpdate = (patientId: string, displayDate: string) => {
    setPacientes(prev => prev.map(p => {
      if (p.id === patientId) {
        const updated = { ...p, dna_hpv_pep: displayDate === '' ? '--' : displayDate };
        updated.alertas = determinarAlerta(updated);
        return updated;
      }
      return p;
    }));

    setPatientDetails(prev => {
      if (!prev || prev.id !== patientId) return prev;
      const updated = { ...prev, dna_hpv_pep: displayDate === '' ? '--' : displayDate };
      updated.alertas = determinarAlerta(updated);
      return updated;
    });
  };

  const broadcastCitoLaboratorioUpdate = (patientId: string, displayDate: string) => {
    const normalizedDate = displayDate === '' ? '--' : displayDate;
    const payload = { patientId, displayDate: normalizedDate, source: 'favorites' };

    window.dispatchEvent(new CustomEvent(DNA_HPV_PEP_SYNC_EVENT, { detail: payload }));
    localStorage.setItem('amarcap53_dna_hpv_pep_sync', JSON.stringify({
      ...payload,
      timestamp: Date.now(),
    }));
  };

  const handleUpdateCitoLaboratorio = async (patientId: string, displayDate: string) => {
    applyCitoLaboratorioUpdate(patientId, displayDate);
    broadcastCitoLaboratorioUpdate(patientId, displayDate);

    if (displayDate === '' || displayDate === '--' || displayDate.length === 10) {
      try {
        let valueToSave = displayDate === '--' ? '' : displayDate;
        // Converter DD/MM/YYYY → YYYY-MM-DD para PocketBase type=date
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(valueToSave)) {
          const [d, m, y] = valueToSave.split('/');
          valueToSave = `${y}-${m}-${d}`;
        }
        await pb.collection('amarcap53_pacientes').update(patientId, { dna_hpv_pep: valueToSave });
      } catch (err) {
        console.error('Erro ao atualizar data no PocketBase:', err);
      }
    }
  };

  const fetchFavorites = async (silent = false) => {
    if (!user || favorites.length === 0) {
      setPacientes([]);
      setIsLoading(false);
      return;
    }

    try {
      if (!silent) setIsLoading(true);
      const regionFilters: string[] = [];
      if (!isAdmin) {
        if (user.role === 'unidade') {
          regionFilters.push(pb.filter('unidade ~ {:u}', { u: normalizeText(user.unidade_saude) }));
        } else if (user.role === 'equipe') {
          regionFilters.push(pb.filter('unidade ~ {:u} && equipe ~ {:e}', { u: normalizeText(user.unidade_saude), e: normalizeText(user.equipe) }));
        } else if (user.role === 'microarea') {
          regionFilters.push(pb.filter('unidade ~ {:u} && equipe ~ {:e}', { u: normalizeText(user.unidade_saude), e: normalizeText(user.equipe) }));
          regionFilters.push(`microarea = ${Number(user.microarea)}`);
        }
      }
      const regionFilter = regionFilters.length > 0 ? `(${regionFilters.join(' && ')})` : '';
      const favFilter = favorites.map(id => `id = "${id}"`).join(' || ');
      const filterStr = regionFilter ? `(${regionFilter}) && (${favFilter})` : favFilter;

      // Build complete server-side filter (region + fav + SIM/NÃO + status)
      const serverFilterParts: string[] = [];
      if (filterStr) serverFilterParts.push(filterStr);

      // Filtros SIM/NÃO de exames (server-side)
      const simNaoFilter = (field: string, val: string) => {
        if (!val) return null;
        if (val === 'SIM') return `${field} != ""`;
        if (val === 'NÃO') return `${field} = ""`;
        return null;
      };
      const dnaHpvPepF = simNaoFilter('dna_hpv_pep', filterDnaHpvPep);
      if (dnaHpvPepF) serverFilterParts.push(dnaHpvPepF);
      const citoLabF = simNaoFilter('cito_lab', filterCitoLab);
      if (citoLabF) serverFilterParts.push(citoLabF);
      const citoPepF = simNaoFilter('cito_pep', filterCitoPep);
      if (citoPepF) serverFilterParts.push(citoPepF);
      const dnaHpvGalF = simNaoFilter('dna_hpv_gal', filterDnaHpvGal);
      if (dnaHpvGalF) serverFilterParts.push(dnaHpvGalF);

      // Filtro de Status de Rastreamento (server-side)
      if (filterStatus.length > 0) {
        const statusClauses: string[] = [];
        if (filterStatus.includes('PEP_MOLECULAR')) statusClauses.push('dna_hpv_pep != ""');
        if (filterStatus.includes('COLETA_MOLECULAR')) statusClauses.push('(dna_hpv_gal != "" && dna_hpv_pep = "")');
        if (filterStatus.includes('PEP_CITO')) statusClauses.push('(cito_pep != "" && dna_hpv_gal = "" && dna_hpv_pep = "")');
        if (filterStatus.includes('COLETA_CITO')) statusClauses.push('(cito_lab != "" && cito_pep = "" && dna_hpv_gal = "" && dna_hpv_pep = "")');
        if (filterStatus.includes('NAO_IDENTIFICADO')) statusClauses.push('(dna_hpv_pep = "" && dna_hpv_gal = "" && cito_pep = "" && cito_lab = "")');
        if (statusClauses.length > 0) serverFilterParts.push(`(${statusClauses.join(' || ')})`);
      }

      const finalServerFilter = serverFilterParts.length > 0 ? serverFilterParts.join(' && ') : '';
      const resultList = await pb.collection('amarcap53_pacientes').getFullList({
        filter: finalServerFilter,
        sort: 'nome'
      });

      // Busca acompanhamentos em lote (evita N+1)
      const patientIds = resultList.map(r => r.id);
      const acompRecords = patientIds.length > 0
        ? await pb.collection('amarcap53_acompanhamentos').getFullList({
            filter: `(${patientIds.map(id => `paciente = "${id}"`).join(' || ')})`,
            sort: '-created',
            fields: 'id,paciente,tipo_busca,tipo_contato,situacao_pos_busca,entraves_identificados,data_cadastro',
            requestKey: null
          })
        : [];
      const countMap = new Map<string, number>();
      const lastAcompMap = new Map<string, any>();
      acompRecords.forEach(r => {
        countMap.set(r.paciente, (countMap.get(r.paciente) || 0) + 1);
        if (!lastAcompMap.has(r.paciente)) {
          lastAcompMap.set(r.paciente, r);
        }
      });

      const formatados = resultList.map(record => {
        const total = countMap.get(record.id) || 0;
        const lastAcomp = lastAcompMap.get(record.id) || null;
        const p: any = {
          id: record.id,
          unidade: record.unidade || '--',
          equipe: record.equipe || '--',
          microarea: Number(record.microarea) || 0,
          nome: record.nome || '--',
          cns: record.cns || '--',
          data_nascimento: record.data_nascimento || '--',
          idade: Number(record.idade) || calcularIdade(record.data_nascimento),
          grupo: record.grupo || '--',
          cito_lab: record.cito_lab || '--',
          cito_pep: record.cito_pep || '--',
          dna_hpv_gal: record.dna_hpv_gal || '--',
          dna_hpv_pep: formatarData(record.dna_hpv_pep) || '--',
          alertas_rastreamento: record.alertas_rastreamento || '--',
          total_acompanhamentos: total || 0,
          lastAcomp: lastAcomp || null,
          isFavorite: true,
        };
        p.alertas = determinarAlerta(p);
        return p;
      });

      setPacientes(formatados);
      setFavCache(formatados);
      
      // Coleta grupos únicos dos favoritos
      const groups = Array.from(new Set(formatados.map(p => p.grupo))).filter(g => g && g !== '--');
      setAvailableGroups(groups);

    } catch (error) {
      console.error("Erro ao buscar favoritos:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredPacientes = pacientes.filter(p => {
    const matchesSearch = p.nome.toLowerCase().includes(searchTerm.toLowerCase()) || p.cns.includes(searchTerm);
    const matchesGrupo = filterGrupo.length === 0 || filterGrupo.includes(p.grupo);
    
    // Regional filters (client-side for display filtering)
    const matchesUnidade = filterUnidade.length === 0 || filterUnidade.some(u => normalizeText(u) === normalizeText(p.unidade));
    const matchesEquipe = filterEquipe.length === 0 || filterEquipe.some(e => normalizeText(e) === normalizeText(p.equipe));
    const matchesMicroarea = filterMicroarea.length === 0 || filterMicroarea.includes(String(p.microarea));

    // Filtros de acompanhamento (baseados no último registro)
    const matchesTipoBusca = matchesSelectFilter(p.lastAcomp?.tipo_busca, filterTipoBusca, TIPO_BUSCA_OPTIONS);
    const matchesTipoContato = matchesSelectFilter(p.lastAcomp?.tipo_contato, filterTipoContato, TIPO_CONTATO_OPTIONS);
    const matchesSituacao = matchesSelectFilter(p.lastAcomp?.situacao_pos_busca, filterSituacao, SITUACAO_POS_BUSCA_OPTIONS);
    const matchesEntraves = matchesMultiValueField(p.lastAcomp?.entraves_identificados, filterEntraves);

    // Filtro de Data (baseado no último registro)
    let matchesData = true;
    if (filterDataInicio || filterDataFim) {
      if (p.lastAcomp?.data_busca) {
        const dataAcomp = new Date(p.lastAcomp.data_busca);
        dataAcomp.setHours(0, 0, 0, 0);

        if (filterDataInicio) {
          const dInicio = new Date(filterDataInicio);
          dInicio.setHours(0, 0, 0, 0);
          if (dataAcomp < dInicio) matchesData = false;
        }
        if (filterDataFim) {
          const dFim = new Date(filterDataFim);
          dFim.setHours(0, 0, 0, 0);
          if (dataAcomp > dFim) matchesData = false;
        }
      } else {
        matchesData = false;
      }
    }
    
    return matchesSearch && matchesGrupo && matchesTipoBusca && matchesTipoContato && matchesSituacao && matchesEntraves && matchesData && matchesUnidade && matchesEquipe && matchesMicroarea;
  });

  const handleOpenDetails = (paciente: Paciente) => {
    setPatientDetails(paciente);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetails = () => {
    setIsDetailsModalOpen(false);
    setPatientDetails(null);
  };

  const handleOpenModal = (paciente: Paciente) => {
    setSelectedPaciente(paciente);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPaciente(null);
    setSelectedDate('');
    setModalTipoBusca('');
    setModalTipoContato('');
    setModalSituacao('');
    setModalEntraves([]);
    setModalEntravesInformadoPor('');
    setModalObservacoes('');
  };

  const handleSaveFollowUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPaciente || !user) return;
    
    // Validação de entraves obrigatórios se informado por preenchido
    if (modalEntravesInformadoPor && (!modalEntraves || modalEntraves.length === 0)) {
      alert('Por favor, selecione ao menos um entrave identificado.');
      return;
    }

    setIsSaving(true);
    
    let dataBuscaIso = '';
    if (selectedDate && selectedDate.includes('/')) {
      const [d, m, y] = selectedDate.split('/');
      dataBuscaIso = `${y}-${m}-${d}`; // Formato YYYY-MM-DD
    }

    const data = {
      paciente: selectedPaciente.id,
      profissional: user.id,
      data_busca: dataBuscaIso || selectedDate,
      tipo_busca: getCanonicalSelectValue(modalTipoBusca, TIPO_BUSCA_OPTIONS),
      tipo_contato: getCanonicalSelectValue(modalTipoContato, TIPO_CONTATO_OPTIONS),
      situacao_pos_busca: getCanonicalSelectValue(modalSituacao, SITUACAO_POS_BUSCA_OPTIONS),
      entraves_identificados: JSON.stringify(
        Array.isArray(modalEntraves)
          ? modalEntraves.filter(v => v)
          : modalEntraves ? [modalEntraves] : []
      ),
      entraves_informado_por: getCanonicalSelectValue(modalEntravesInformadoPor, ENTRAVES_INFORMADO_POR_OPTIONS),
      observacoes: modalObservacoes,
    };

    try {
      // #region debug-point C:favorites-followup-create-payload
      fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"acompanhamento-save-fail",runId:"pre-fix",hypothesisId:"C",location:"FavoritesScreen.tsx:handleSaveFollowUp",msg:"favorites create payload",data:{payload:data},ts:Date.now()})}).catch(()=>{});
      // #endregion
      await pb.collection('amarcap53_acompanhamentos').create(data);
      alert('Acompanhamento registrado com sucesso!');
      handleCloseModal();
      fetchFavorites(true); // Refresh list to update counts
    } catch (error: any) {
      try {
        const sampleRecords = await pb.collection('amarcap53_acompanhamentos').getList(1, 5, {
          sort: '-created',
          fields: 'id,tipo_busca,tipo_contato,situacao_pos_busca,entraves_informado_por',
        });
        // #region debug-point H:favorites-followup-create-samples
        fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"acompanhamento-save-fail",runId:"pre-fix",hypothesisId:"H",location:"FavoritesScreen.tsx:handleSaveFollowUp-samples",msg:"favorites existing samples",data:{items:sampleRecords.items},ts:Date.now()})}).catch(()=>{});
        // #endregion
      } catch (_) {}
      // #region debug-point D:favorites-followup-create-error
      fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"acompanhamento-save-fail",runId:"pre-fix",hypothesisId:"D",location:"FavoritesScreen.tsx:handleSaveFollowUp-catch",msg:"favorites create error",data:{payload:data,errorData:error?.data||null,errorMessage:error?.message||null,response:error?.response||null},ts:Date.now()})}).catch(()=>{});
      // #endregion
      console.error('Erro ao salvar acompanhamento:', error);
      const pbError = error.data?.data;
      let errorMsg = 'Erro ao salvar o acompanhamento.';
      
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

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <Header title="Favoritos" pageTitle="Pacientes Favoritos" activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 no-scrollbar">
        <div className="max-w-[1600px] mx-auto">
          
          <div className="grid grid-cols-1 gap-4 md:gap-6 mb-8 md:mb-10">
            <div className="bg-gradient-to-br from-[#001b3d] to-[#002b5c] p-4 md:p-10 rounded-2xl md:rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 md:gap-10 relative overflow-hidden group">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl group-hover:bg-amber-500/20 transition-all duration-700"></div>

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full md:w-auto">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner group-hover:scale-105 transition-transform duration-500">
                  <Star className="w-8 h-8 md:w-10 md:h-10 text-amber-400 fill-amber-400" />
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[10px] md:text-sm font-black text-white/40 uppercase tracking-[0.3em] mb-2">Monitoramento Prioritário</p>
                  <p className="text-2xl md:text-[3.5rem] font-black text-white leading-none tracking-tighter">
                    {filteredPacientes.length} <span className="text-sm md:text-lg font-bold text-white/60 ml-2 tracking-normal uppercase">Favoritos</span>
                  </p>
                </div>
              </div>

              {/* Botões de Busca e Filtro */}
              <div className="relative z-10 flex items-center gap-3 md:gap-4 w-full md:w-auto justify-center md:justify-end">
                <button
                  onClick={() => setIsSearchVisible(!isSearchVisible)}
                  className={`w-12 h-12 md:w-14 md:h-14 flex items-center justify-center rounded-2xl transition-all duration-500 border ${
                    isSearchVisible
                      ? 'bg-white text-primary border-white shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                  title="Ativar Busca"
                >
                  <Search className={`w-5 h-5 md:w-6 md:h-6 transition-transform duration-500 ${isSearchVisible ? 'scale-110' : ''}`} />
                </button>

                <button
                  onClick={() => setIsFilterVisible(!isFilterVisible)}
                  className={`flex items-center gap-2 md:gap-3 px-4 md:px-8 h-12 md:h-14 rounded-2xl text-[10px] md:text-sm font-black uppercase tracking-widest transition-all duration-500 border ${
                    isFilterVisible || filterStatus.length > 0 || filterGrupo.length > 0 || filterTipoBusca.length > 0 || filterTipoContato.length > 0 || filterSituacao.length > 0 || filterEntraves.length > 0 || filterDnaHpvPep.length > 0 || filterCitoLab.length > 0 || filterCitoPep.length > 0 || filterDnaHpvGal.length > 0
                      ? 'bg-primary text-white border-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]'
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  <Filter className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="hidden sm:inline">Filtros</span>
                  {(filterStatus.length > 0 || filterGrupo.length > 0 || filterTipoBusca.length > 0 || filterTipoContato.length > 0 || filterSituacao.length > 0 || filterEntraves.length > 0 || filterDnaHpvPep.length > 0 || filterCitoLab.length > 0 || filterCitoPep.length > 0 || filterDnaHpvGal.length > 0) && (
                    <div className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center bg-white text-primary text-[9px] md:text-[10px] rounded-full font-black animate-pulse">
                      {[filterStatus, filterGrupo, filterTipoBusca, filterTipoContato, filterSituacao, filterEntraves, filterDnaHpvPep, filterCitoLab, filterCitoPep, filterDnaHpvGal].filter(f => f.length > 0).length}
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Barra de Busca Animada */}
            {isSearchVisible && (
              <div className="bg-white p-6 rounded-3xl shadow-xl border border-primary/5 animate-in slide-in-from-top-6 fade-in duration-500">
                <div className="relative group">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/30 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Filtrar favoritos por nome ou CNS..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-14 pr-6 py-5 bg-surface-container-low border-2 border-transparent rounded-2xl text-base font-bold text-on-surface focus:border-primary/20 outline-none transition-all placeholder:text-on-surface-variant/30"
                    autoFocus
                  />
                </div>
              </div>
            )}

            {/* Painel de Filtros Avançados */}
            {isFilterVisible && (
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-2xl border border-primary/5 animate-in slide-in-from-top-6 fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-5">
                  {/* Período de Busca (Acomp.) */}
                  <div className="md:col-span-2 space-y-2">
                    <label className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                      <Calendar className="w-3.5 h-3.5" />
                      Período da Busca (Acomp.)
                    </label>
                    <div className="flex gap-3">
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

                  <div className="space-y-2">
                    <MultiSelect 
                      label="Status de Rastreamento"
                      placeholder="Todos os Status"
                      options={Object.entries(ALERT_CONFIGS).map(([key, config]) => ({
                        label: config.label,
                        value: key
                      }))}
                      value={filterStatus}
                      onChange={setFilterStatus}
                    />
                  </div>
                  <div className="space-y-2">
                    <MultiSelect 
                      label="Grupo de Idade"
                      placeholder="Todos os Grupos"
                      options={availableGroups}
                      value={filterGrupo}
                      onChange={setFilterGrupo}
                    />
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

                  {/* Filtros Regionais condicionais */}
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
                        options={
                          filterUnidade.length > 0 
                            ? Array.from(new Set(filterUnidade.flatMap(u => UNIDADES_EQUIPES[u] || [])))
                            : user?.role === 'unidade' ? UNIDADES_EQUIPES[user.unidade_saude] || [] : []
                        }
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
                    <MultiSelect 
                      label="Tipo de Busca (Acomp.)"
                      placeholder="Todos os Tipos"
                      options={TIPO_BUSCA_OPTIONS}
                      value={filterTipoBusca}
                      onChange={setFilterTipoBusca}
                    />
                  </div>
                  <div className="space-y-2">
                    <MultiSelect 
                      label="Tipo de Contato (Acomp.)"
                      placeholder="Todos os Contatos"
                      options={TIPO_CONTATO_OPTIONS}
                      value={filterTipoContato}
                      onChange={setFilterTipoContato}
                    />
                  </div>
                  <div className="space-y-2">
                    <MultiSelect 
                      label="Situação Pós Busca (Acomp.)"
                      placeholder="Todas as Situações"
                      options={SITUACAO_POS_BUSCA_OPTIONS}
                      value={filterSituacao}
                      onChange={setFilterSituacao}
                    />
                  </div>
                  <div className="space-y-2">
                    <MultiSelect 
                      label="Entraves (Acomp.)"
                      placeholder="Todos os Entraves"
                      options={ENTRAVES_IDENTIFICADOS_OPTIONS}
                      value={filterEntraves}
                      onChange={setFilterEntraves}
                    />
                  </div>

                  {/* Botões */}
                  <div className="flex items-end gap-4 md:col-span-2 lg:col-span-4 pt-3">
                    <button onClick={resetFilters}
                      className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-surface-container-high text-on-surface-variant text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-surface-container-highest transition-all duration-300">
                      <RotateCcw className="w-4 h-4" /> Resetar
                    </button>
                    <button onClick={() => setIsFilterVisible(false)}
                      className="flex-1 py-3.5 bg-primary text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all duration-300 shadow-lg shadow-primary/20">
                      Aplicar Filtros
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="relative bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_20px_50px_rgba(0,0,0,0.06)] border border-outline-variant/15 min-h-[200px]">
            </div>
          ) : filteredPacientes.length === 0 ? (
            <div className="bg-white rounded-[2rem] p-20 text-center shadow-xl border border-primary/5">
              <Star className="w-20 h-20 text-slate-200 mx-auto mb-6" />
              <h3 className="text-xl font-black text-primary uppercase mb-2">Nenhum favorito encontrado</h3>
              <p className="text-on-surface-variant font-medium max-w-md mx-auto">
                {searchTerm || filterStatus.length > 0 || filterGrupo.length > 0 
                  ? 'Nenhum paciente favorito corresponde aos filtros aplicados.'
                  : 'Adicione pacientes aos seus favoritos na página principal para acessá-los rapidamente aqui.'}
              </p>
              <button 
                onClick={searchTerm || filterStatus.length > 0 || filterGrupo.length > 0 ? resetFilters : () => setActiveTab('pacientes')}
                className="mt-8 px-8 py-4 bg-primary text-white font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20"
              >
                {searchTerm || filterStatus.length > 0 || filterGrupo.length > 0 ? 'Limpar Filtros' : 'Ir para Meus Pacientes'}
              </button>
            </div>
          ) : (
            <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_20px_50px_rgba(0,0,0,0.06)] border border-outline-variant/15 relative">
            <div className="w-full overflow-x-auto custom-scrollbar-horizontal">
                <table className="w-full text-center border-collapse">
                  <thead>
                    <tr className="bg-[#001b3d] border-b border-white/10 shadow-sm">
                      <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[240px] border-r border-white/5">
                        <div className="flex flex-col items-center gap-1">
                          <Users className="w-4 h-4 text-blue-400/60" />
                          <span>Paciente</span>
                        </div>
                      </th>
                      <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[180px] border-r border-white/5">
                        <div className="flex flex-col items-center gap-1">
                          <Info className="w-4 h-4 text-blue-400/60" />
                          <span>Status</span>
                        </div>
                      </th>
                      <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[110px] border-r border-white/5">
                        <div className="flex flex-col items-center gap-1">
                          <RotateCcw className="w-4 h-4 text-blue-400/60" />
                          <span>Ação</span>
                        </div>
                      </th>
                      <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[120px] border-r border-white/5">
                        <div className="flex flex-col items-center gap-1">
                          <TestTube className="w-4 h-4 text-blue-400/60" />
                          <div className="flex items-center gap-1.5">
                            <span>DNA-HPV (PEP)</span>
                            <InfoTooltip content="Data de registro do resultado do teste molecular de DNA-HPV no PEP." />
                          </div>
                          <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">(Data Registro)</span>
                        </div>
                      </th>
                      {(isAdmin || user?.role === 'cap' || user?.role === 'unidade' || user?.role === 'equipe' || user?.role === 'microarea') && (
                        <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[220px] border-r border-white/5">
                          <div className="flex flex-col items-center gap-1">
                            <Building className="w-4 h-4 text-blue-400/60" />
                            <span>Unidade<br/>Equipe<br/>Microárea</span>
                          </div>
                        </th>
                      )}
                      <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[110px] border-r border-white/5">
                        <div className="flex flex-col items-center gap-1">
                          <Calendar className="w-4 h-4 text-blue-400/60" />
                          <span>Idade/Grupo</span>
                        </div>
                      </th>
                      <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[180px] border-r border-white/5">
                        <div className="flex flex-col items-center gap-1">
                          <Microscope className="w-4 h-4 text-blue-400/60" />
                          <div className="flex items-center gap-1.5">
                            <span>Cito (Lab)</span>
                            <InfoTooltip content="Data de cadastro do resultado do exame citopatológico realizado no laboratório." />
                          </div>
                          <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">(Data Cadastro)</span>
                        </div>
                      </th>
                      <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[180px]">
                        <div className="flex flex-col items-center gap-1">
                          <FileText className="w-4 h-4 text-blue-400/60" />
                          <div className="flex items-center gap-1.5">
                            <span>Cito (PEP)</span>
                          <InfoTooltip content="Data de coleta do exame citopatológico registrada no PEP." />
                        </div>
                        <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">(Data Coleta)</span>
                      </div>
                    </th>
                    <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[180px]">
                      <div className="flex flex-col items-center gap-1">
                        <TestTube className="w-4 h-4 text-blue-400/60" />
                        <div className="flex items-center gap-1.5">
                          <span>DNA-HPV (GAL)</span>
                          <InfoTooltip content="Data do resultado do teste molecular de DNA-HPV registrada no GAL." />
                        </div>
                        <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">(Data GAL)</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                  <tbody className="divide-y divide-outline-variant/10">
                    {filteredPacientes.map((paciente) => (
                      <tr key={paciente.id} className="hover:bg-primary/[0.03] transition-all group">
                        <td className="px-4 py-6 text-center relative">
                          <button 
                            onClick={() => toggleFavorite(paciente.id)}
                            className="absolute left-2 top-2 p-1.5 rounded-lg text-amber-400 bg-amber-50 shadow-sm border border-amber-100 transition-all"
                          >
                            <Star className="w-3.5 h-3.5 fill-current" />
                          </button>
                          <div className="flex flex-col items-center gap-0.5 mt-2">
                            <p className="text-[11px] md:text-[12px] font-black text-primary uppercase leading-tight break-words" title={paciente.nome}>{paciente.nome}</p>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-tighter leading-none">CNS: {paciente.cns}</p>
                          </div>
                        </td>
                        <td className="px-2 py-6 text-center">
                          {paciente.alertas && ALERT_CONFIGS[paciente.alertas] && (
                            <div className={`inline-flex flex-col items-center justify-center px-2 py-2 rounded-lg border border-white/10 shadow-lg min-h-[50px] w-full max-w-[140px] mx-auto ${ALERT_CONFIGS[paciente.alertas].bg}`}>
                              <span className={`text-[8px] md:text-[10px] font-bold uppercase leading-tight text-center ${ALERT_CONFIGS[paciente.alertas].color}`}>
                                {ALERT_CONFIGS[paciente.alertas].label}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-4 text-center">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <button 
                              onClick={() => handleOpenDetails(paciente)}
                              className="h-10 w-24 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-tight shadow-sm transition-all flex items-center justify-center gap-2"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detalhes
                            </button>
                            <button 
                              onClick={() => handleOpenModal(paciente)}
                              className="h-10 w-24 bg-[#001b3d] text-white rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-tight shadow-md transition-all flex items-center justify-center gap-2 relative"
                            >
                              <ClipboardList className="w-3.5 h-3.5 text-blue-300" /> Acomp.
                              {paciente.total_acompanhamentos !== undefined && paciente.total_acompanhamentos > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-5 px-1 flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full border-2 border-[#001b3d] shadow-md z-10">
                                  {paciente.total_acompanhamentos}
                                </span>
                              )}
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-6 text-center">
                          <DatePickerPTBR 
                            value={paciente.dna_hpv_pep || ''} 
                            isISO={false}
                            onChange={(displayDate) => handleUpdateCitoLaboratorio(paciente.id, displayDate)} 
                          />
                        </td>
                        {(isAdmin || user?.role === 'cap' || user?.role === 'unidade' || user?.role === 'equipe' || user?.role === 'microarea') && (
                        <td className="px-4 py-6 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <p className="text-[10px] md:text-[11px] font-black text-primary uppercase leading-tight truncate max-w-full" title={paciente.unidade}>
                              {paciente.unidade}
                            </p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                              {paciente.equipe}
                            </p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                              MA: {paciente.microarea}
                            </p>
                          </div>
                        </td>
                        )}
                        <td className="px-4 py-6 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <p className="text-[14px] md:text-[16px] font-black text-[#001b3d]">{paciente.idade}</p>
                            <span className="inline-block px-2.5 py-1 rounded text-[11px] md:text-[12px] font-black uppercase bg-slate-100 text-slate-600">{paciente.grupo}</span>
                          </div>
                        </td>
                        <td className="px-4 py-6 text-center">
                          <span className="inline-block px-3.5 py-2 rounded-lg text-[11px] md:text-[12px] font-black uppercase bg-yellow-50 text-yellow-700 border border-yellow-100 shadow-sm">{formatarData(paciente.cito_lab)}</span>
                        </td>
                        <td className="px-4 py-6 text-center">
                          <span className="inline-block px-3.5 py-2 rounded-lg text-[11px] md:text-[12px] font-black uppercase bg-emerald-50 text-emerald-700 border border-emerald-100 shadow-sm">{formatarData(paciente.cito_pep)}</span>
                        </td>
                        <td className="px-4 py-6 text-center">
                          <span className={`inline-block px-3.5 py-2 rounded-lg text-[11px] md:text-[12px] font-black uppercase tracking-tight shadow-sm ${paciente.dna_hpv_gal !== '--' ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'text-slate-300 italic'}`}>
                            {formatarData(paciente.dna_hpv_gal)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          <Footer />
        </div>
      </div>

      {/* Modais */}
      {isModalOpen && selectedPaciente && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div data-dropdown-root="true" className="relative bg-surface-container-lowest w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-[0px_24px_48px_rgba(0,0,0,0.15)] overflow-visible border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="bg-gradient-to-r from-[#1c2e4a] to-[#253c61] px-10 py-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white text-xl font-black tracking-tight leading-tight">Registro de Acompanhamento</h3>
                  <p className="text-white/60 text-xs font-medium uppercase tracking-widest mt-1">Paciente: {selectedPaciente.nome}</p>
                </div>
              </div>
              <button onClick={handleCloseModal} className="p-2 -mr-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all duration-300 hover:rotate-90">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar-modal flex-1 p-5 sm:p-8 md:p-10">
              <form id="registro-acompanhamento-form" onSubmit={handleSaveFollowUp}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 sm:gap-y-6">
                  <div className="space-y-2 group/field">
                    <DatePickerPTBR 
                      label="Data da Busca"
                      value={selectedDate} 
                      isISO={false}
                      onChange={(val) => setSelectedDate(val)} 
                    />
                  </div>

                  {/* Tipo de Busca */}
                  <SingleSelect 
                    label="Tipo de Busca"
                    placeholder="Selecione"
                    options={TIPO_BUSCA_OPTIONS}
                    value={modalTipoBusca}
                    onChange={setModalTipoBusca}
                    required
                    icon={<Search className="w-3.5 h-3.5" />}
                    showSearch={false}
                  />

                  {/* Tipo de Contato */}
                  <SingleSelect 
                    label="Tipo de Contato"
                    placeholder="Selecione uma modalidade"
                    options={TIPO_CONTATO_OPTIONS}
                    value={modalTipoContato}
                    onChange={setModalTipoContato}
                    required
                    icon={<Phone className="w-3.5 h-3.5" />}
                    showSearch={false}
                  />

                  {/* Entraves Informado Por */}
                  <SingleSelect 
                    label="Entrave(s) Informado Por"
                    placeholder="Selecione"
                    options={ENTRAVES_INFORMADO_POR_OPTIONS}
                    value={modalEntravesInformadoPor}
                    onChange={setModalEntravesInformadoPor}
                    icon={<Info className="w-3.5 h-3.5" />}
                    showSearch={false}
                  />

                  {/* Situação Pós Busca Ativa */}
                  <SingleSelect 
                    label="Situação Pós Busca Ativa"
                    placeholder="Selecione o desfecho da busca"
                    className="col-span-1 md:col-span-2"
                    options={SITUACAO_POS_BUSCA_OPTIONS}
                    value={modalSituacao}
                    onChange={setModalSituacao}
                    required
                    icon={<Info className="w-3.5 h-3.5" />}
                    showSearch={false}
                  />

                  {/* Entraves Identificados */}
                  <MultiSelect 
                    label="Entraves Identificados"
                    placeholder="Selecione"
                    className="col-span-1 md:col-span-2"
                    options={ENTRAVES_IDENTIFICADOS_OPTIONS}
                    value={modalEntraves}
                    onChange={setModalEntraves}
                    showSearch={false}
                  />

                  {/* Observações */}
                  <div className="col-span-1 md:col-span-2 space-y-2 group/field">
                    <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                      <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                        <MessageSquare className="w-3.5 h-3.5" />
                      </div>
                      Observações Detalhadas
                    </label>
                    <textarea 
                      name="observacoes"
                      value={modalObservacoes}
                      onChange={(e) => setModalObservacoes(e.target.value)}
                      className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-4 resize-none transition-all outline-none placeholder:text-outline-variant/60 shadow-sm hover:border-primary/40 min-h-[120px]" 
                      placeholder="Descreva aqui detalhes relevantes do atendimento..." 
                      rows={4}
                    ></textarea>
                  </div>
                </div>
              </form>
            </div>
              
            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 p-5 sm:p-6 md:px-10 md:py-6 border-t border-outline-variant/10 bg-surface-container-lowest shrink-0 z-10">
              <button 
                type="button" 
                onClick={handleCloseModal}
                disabled={isSaving}
                className="px-6 sm:px-8 py-3 rounded-xl text-sm font-bold text-primary hover:bg-primary/5 transition-all border border-transparent hover:border-primary/10 w-full sm:w-auto order-2 sm:order-1 disabled:opacity-50"
              >
                Descartar
              </button>
              <button 
                form="registro-acompanhamento-form"
                type="submit" 
                disabled={isSaving}
                className="px-6 sm:px-10 py-3 rounded-xl text-sm font-black text-white bg-gradient-to-r from-[#1c2e4a] to-[#253c61] shadow-[0_10px_20px_rgba(28,46,74,0.3)] hover:shadow-[0_15px_30px_rgba(28,46,74,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 group w-full sm:w-auto order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                )}
                {isSaving ? 'Salvando...' : 'Salvar Registro'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isDetailsModalOpen && activePatientForDetails && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-[0px_24px_48px_rgba(0,0,0,0.15)] flex flex-col border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="bg-gradient-to-r from-[#001b3d] to-[#002b5c] px-6 py-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white text-lg font-black tracking-tight leading-tight">Detalhes do Paciente</h3>
                  <p className="text-white/60 text-[10px] uppercase tracking-widest mt-1">Informações Cadastrais</p>
                </div>
              </div>
              <button onClick={handleCloseDetails} className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">Nome Completo</p>
                    <p className="text-sm font-bold text-primary">{activePatientForDetails.nome}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">Cartão Nacional de Saúde (CNS)</p>
                    <code className="text-xs font-bold text-on-surface-variant bg-surface-container-high px-2 py-1 rounded inline-block">{activePatientForDetails.cns}</code>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">Data de Nascimento / Idade</p>
                    <p className="text-sm font-bold text-primary">{formatarData(activePatientForDetails.data_nascimento)} ({activePatientForDetails.idade} anos)</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">Grupo</p>
                    <p className="text-sm font-bold text-primary">{activePatientForDetails.grupo}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">Unidade de Saúde</p>
                    <p className="text-sm font-bold text-primary">{activePatientForDetails.unidade}</p>
                  </div>
                  <div className="flex gap-8">
                    <div>
                      <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">Equipe</p>
                      <p className="text-sm font-bold text-primary">{activePatientForDetails.equipe}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">Microárea</p>
                      <p className="text-sm font-bold text-primary">{activePatientForDetails.microarea}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-outline-variant/10">
                    <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-2">Status de Rastreamento</p>
                    <div className="flex flex-col gap-3">
                      <div className="space-y-2">
                        <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest">DNA-HPV (PEP)</p>
                        <DatePickerPTBR
                          value={activePatientForDetails.dna_hpv_pep || ''}
                          isISO={false}
                          onChange={(displayDate) => handleUpdateCitoLaboratorio(activePatientForDetails.id, displayDate)}
                        />
                      </div>

                      {/* Badge de Status Principal */}
                      {activePatientForDetails.alertas && ALERT_CONFIGS[activePatientForDetails.alertas] ? (
                        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 shadow-lg ${ALERT_CONFIGS[activePatientForDetails.alertas].bg}`}>
                          <div className="p-2 bg-white/20 rounded-lg">
                            {React.createElement(ALERT_CONFIGS[activePatientForDetails.alertas].icon, { className: "w-4 h-4 text-white" })}
                          </div>
                          <span className="text-[10px] font-black uppercase leading-tight text-white">
                            {ALERT_CONFIGS[activePatientForDetails.alertas].label}
                          </span>
                        </div>
                      ) : (
                        <div className="px-4 py-3 rounded-xl bg-slate-100 border border-slate-200 text-slate-400 text-[10px] font-black uppercase italic">
                          Status não identificado
                        </div>
                      )}

                      {/* Datas de Exames */}
                      <div className="flex flex-wrap gap-2">
                        {activePatientForDetails.dna_hpv_pep && activePatientForDetails.dna_hpv_pep !== '--' && (
                          <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-black uppercase">DNA-HPV (PEP): {formatarData(activePatientForDetails.dna_hpv_pep)}</span>
                        )}
                        {activePatientForDetails.dna_hpv_gal !== '--' && (
                          <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-black uppercase">DNA-HPV (GAL): {formatarData(activePatientForDetails.dna_hpv_gal)}</span>
                        )}
                        {activePatientForDetails.cito_pep !== '--' && (
                          <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black uppercase">CITO (PEP): {formatarData(activePatientForDetails.cito_pep)}</span>
                        )}
                        {activePatientForDetails.cito_lab !== '--' && (
                          <span className="px-2 py-1 rounded-md bg-yellow-50 text-yellow-700 border border-yellow-100 text-[9px] font-black uppercase">CITO (LAB): {formatarData(activePatientForDetails.cito_lab)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {activePatientForDetails.alertas_rastreamento && activePatientForDetails.alertas_rastreamento !== '--' && (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Observações de Alerta (Coluna N)</p>
                  <p className="text-xs font-bold text-amber-900">{activePatientForDetails.alertas_rastreamento}</p>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-outline-variant/10 bg-surface-container-lowest flex justify-end shrink-0">
              <button onClick={handleCloseDetails} className="px-8 py-2.5 rounded-xl text-sm font-black text-white bg-[#001b3d] shadow-lg hover:shadow-xl transition-all active:scale-95 w-full sm:w-auto">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
