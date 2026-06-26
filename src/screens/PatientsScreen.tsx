import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { X, Search, AlertTriangle, Calendar, Phone, ClipboardList, MapPin, MessageSquare, Info, CheckCircle2, Building, TestTube, Microscope, SearchX, FileText, ChevronLeft, ChevronRight, Eye, Users, Filter, RotateCcw, Star, BadgeCheck, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { pb } from '../lib/pocketbase';
import Papa from 'papaparse';
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
  buildSelectFilter,
  getCanonicalSelectValue,
  getSelectLabel
} from '../constants/followUpOptions';

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
  cito_lab?: string; // Data
  cito_pep?: string; // Data
  dna_hpv_gal?: string;  // Data
  dna_hpv_pep?: string; // Data (Novo campo)
  alertas_rastreamento?: string;
  alertas?: string; 
  total_acompanhamentos?: number;
  isFavorite?: boolean;
}

const DNA_HPV_PEP_SYNC_EVENT = 'amarcap53:dna-hpv-pep-updated';

// Remove acentos via Unicode NFD decomposition (ex: "ESPERANÇA" → "ESPERANCA")
const normalizeText = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\s+/g, ' ');

interface PatientsScreenProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

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
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }
  return isNaN(idade) ? 0 : idade;
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

const SIM_NAO_OPTIONS = [
  { label: 'SIM', value: 'SIM' },
  { label: 'NÃO', value: 'NÃO' },
];

export const PatientsScreen: React.FC<PatientsScreenProps> = ({ activeTab, setActiveTab }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null);
  const { user, isAdmin } = useAuth();

  const PAT_CACHE_KEY = `patients_cache_${user?.id}`;
  const PAT_CACHE_TTL = 5 * 60 * 1000;
  const getPatCache = () => {
    try {
      const raw = localStorage.getItem(PAT_CACHE_KEY);
      if (!raw) return null;
      const c = JSON.parse(raw);
      if (Date.now() - c.ts > PAT_CACHE_TTL) return null;
      return c.data;
    } catch { return null; }
  };
  const setPatCache = (data: any) => {
    try { localStorage.setItem(PAT_CACHE_KEY, JSON.stringify({ ts: Date.now(), data })); } catch {}
  };

  const _patInit = getPatCache();
  const [pacientes, setPacientes] = useState<Paciente[]>(_patInit?.pacientes ?? []);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(_patInit?.totalItems ?? 0);
  const [hasClientSideFilter, setHasClientSideFilter] = useState(false);
  const pageSize = 10;
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [patientForDetails, setPatientDetails] = useState<Paciente | null>(null);
  const [selectedDate, setSelectedDate] = useState('');

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

  // Estados para Busca e Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterBuscaAtiva, setFilterBuscaAtiva] = useState<boolean | null>(null);

  // Read pending filter from Dashboard cards navigation
  useEffect(() => {
    try {
      const raw = localStorage.getItem('dashboard:pendingFilter');
      if (raw) {
        const data = JSON.parse(raw);
        if (data?.filterStatus) {
          setFilterStatus(data.filterStatus);
          if (data.buscaAtiva !== undefined) setFilterBuscaAtiva(data.buscaAtiva);
          setCurrentPage(1);
        }
        if (data?.filterGrupo) {
          setFilterGrupo(data.filterGrupo);
          setCurrentPage(1);
        }
        localStorage.removeItem('dashboard:pendingFilter');
      }
    } catch {}
  }, []);
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

  // CSV Import state
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvRecords, setCsvRecords] = useState<any[]>([]);
  const [csvText, setCsvText] = useState('');
  const [csvFileName, setCsvFileName] = useState('');
  const [isCsvUploading, setIsCsvUploading] = useState(false);
  const [csvProgress, setCsvProgress] = useState({ current: 0, total: 0 });
  const [csvResult, setCsvResult] = useState<{ success: number; errors: number; total: number } | null>(null);
  const [csvPreview, setCsvPreview] = useState<any[]>([]);
  const [csvReplaceExisting, setCsvReplaceExisting] = useState(false);

  const [availableGroups, setAvailableGroups] = useState<string[]>(() => {
    // Carrega cache instantaneamente (evita flash de loading)
    try {
      const raw = localStorage.getItem('patient_groups_cache_v2');
      if (raw) {
        const cached = JSON.parse(raw);
        if (Date.now() - cached.ts < 300_000) return cached.data; // 5min TTL
      }
    } catch {}
    return [];
  });
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [favorites, setFavorites] = useState<string[]>(user?.favoritos || []);

  // Sincroniza estado local com o usuário do AuthContext (que vem do PocketBase)
  useEffect(() => {
    setFavorites(user?.favoritos || []);
  }, [user?.favoritos]);

  useEffect(() => {
    setPacientes(prev =>
      prev.map(paciente => ({
        ...paciente,
        isFavorite: favorites.includes(paciente.id),
      }))
    );
  }, [favorites]);

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

  // Busca grupos distintos: tenta groupBy + suplemento multi-página
  useEffect(() => {
    let cancelled = false;
    const fetchGroups = async () => {
      try {
        const raw = localStorage.getItem('patient_groups_cache_v2');
        if (raw) {
          const cached = JSON.parse(raw);
          if (Date.now() - cached.ts < 300_000) { setAvailableGroups(cached.data); return; }
        }
      } catch {}
      setIsLoadingGroups(true);
      try {
        const allGroups = new Set<string>();

        // Tenta groupBy (PocketBase v0.26+, 1 request)
        try {
          const result = await pb.collection('amarcap53_pacientes').getList(1, 200, {
            groupBy: 'grupo',
            fields: 'grupo',
            skipTotal: true,
            requestKey: 'fetch_groups_groupby',
          });
          if (cancelled) return;
          result.items.forEach(r => { if (r.grupo && r.grupo !== '--') allGroups.add(r.grupo); });
        } catch (e) {
          // groupBy não suportado → ignora
        }

        // Suplemento multi-página: garante grupos raros como "64>"
        // (groupBy pode falhar com > ou servidor não suportar)
        const MAX_PAGES = 15;
        for (let page = 1; page <= MAX_PAGES; page++) {
          if (cancelled) return;
          try {
            const result = await pb.collection('amarcap53_pacientes').getList(page, 200, {
              fields: 'grupo',
              skipTotal: true,
              requestKey: null,
            });
            if (cancelled) return;
            result.items.forEach(r => { if (r.grupo && r.grupo !== '--') allGroups.add(r.grupo); });
            if (result.items.length < 200) break; // última página
          } catch {
            break;
          }
        }

        if (cancelled) return;
        const groups = [...allGroups].sort();
        setAvailableGroups(groups);
        localStorage.setItem('patient_groups_cache_v2', JSON.stringify({ ts: Date.now(), data: groups }));
      } catch (err) {
        console.error('Erro ao buscar grupos:', err);
      } finally {
        if (!cancelled) setIsLoadingGroups(false);
      }
    };
    fetchGroups();
    return () => { cancelled = true; };
  }, []);

  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [isSearchVisible, setIsSearchVisible] = useState(false);

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

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveFollowUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPaciente || !user) return;
    
    if (!selectedDate) {
      alert('Preencha a Data da Busca.');
      return;
    }
    
    if (!modalTipoBusca || !modalTipoContato || !modalSituacao) {
      alert('Preencha todos os campos obrigatórios: Tipo de Busca, Tipo de Contato e Situação Pós Busca.');
      return;
    }
    
    if (modalEntravesInformadoPor && (!modalEntraves || modalEntraves.length === 0)) {
      alert('Por favor, selecione ao menos um entrave identificado.');
      return;
    }

    setIsSaving(true);
    
    let dataBuscaIso = '';
    if (selectedDate && selectedDate.includes('/')) {
      const [d, m, y] = selectedDate.split('/');
      dataBuscaIso = `${y}-${m}-${d}`;
    }

    const data = {
      paciente: selectedPaciente.id,
      profissional: user.id,
      data_busca: dataBuscaIso || selectedDate,
      tipo_busca: getSelectLabel(modalTipoBusca, TIPO_BUSCA_OPTIONS),
      tipo_contato: getSelectLabel(modalTipoContato, TIPO_CONTATO_OPTIONS),
      situacao_pos_busca: getSelectLabel(modalSituacao, SITUACAO_POS_BUSCA_OPTIONS),
      entraves_identificados: JSON.stringify(
        Array.isArray(modalEntraves)
          ? modalEntraves.filter(v => v)
          : modalEntraves ? [modalEntraves] : []
      ),
      entraves_informado_por: getSelectLabel(modalEntravesInformadoPor, ENTRAVES_INFORMADO_POR_OPTIONS),
      observacoes: modalObservacoes,
    };

    console.log('[SAVE] Payload para amarcap53_acompanhamentos:', JSON.stringify(data, null, 2));

    try {
      const result = await pb.collection('amarcap53_acompanhamentos').create(data);
      console.log('[SAVE] Sucesso:', result);
      
      setPacientes(prev => prev.map(p => {
        if (p.id === selectedPaciente.id) {
          return {
            ...p,
            total_acompanhamentos: (p.total_acompanhamentos || 0) + 1
          };
        }
        return p;
      }));

      alert('Acompanhamento registrado com sucesso!');
      handleCloseModal();
    } catch (error: any) {
      console.error('[SAVE] Erro completo:', error);
      console.error('[SAVE] error.data.data (field errors):', JSON.stringify(error?.data?.data, null, 2));
      console.error('[SAVE] error.message:', error?.message);
      
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

  const determinarAlerta = (p: any) => {
    // Ordem de prioridade baseada na eficiência da identificação
    
    // 1. RESULTADO DE DNA- HPV REGISTRADO EM PRONTUÁRIO (DATA DO REGISTRO) -> Azul
    // Campo interativo: dna_hpv_pep
    if (p.dna_hpv_pep && p.dna_hpv_pep !== '--' && p.dna_hpv_pep !== '') return 'PEP_MOLECULAR';
    
    // 2. TESTE MOLECULAR DNA-HPV (DATA DA SOLICITAÇÃO) -> Laranja
    // Campo fixo: dna_hpv_gal
    if (p.dna_hpv_gal && p.dna_hpv_gal !== '--' && p.dna_hpv_gal !== '') return 'COLETA_MOLECULAR';
    
    // 3. RESULTADO DE CITO REGISTRADO NO PEP (DATA DA COLETA) -> Verde
    // Campo fixo: cito_pep
    if (p.cito_pep && p.cito_pep !== '--' && p.cito_pep !== '') return 'PEP_CITO';
    
    // 4. RESULTADO DE CITO LABORATÓRIO (DATA DO CADASTRO) -> Amarelo
    // Campo fixo: cito_lab
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
    const payload = { patientId, displayDate: normalizedDate, source: 'patients' };

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

  useEffect(() => {
    const handleCitoUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{ patientId: string; displayDate: string; source?: string }>;
      if (!customEvent.detail?.patientId || customEvent.detail.source === 'patients') return;
      applyCitoLaboratorioUpdate(customEvent.detail.patientId, customEvent.detail.displayDate || '--');
    };

    const handleStorageSync = (event: StorageEvent) => {
      if (event.key !== 'amarcap53_dna_hpv_pep_sync' || !event.newValue) return;

      try {
        const payload = JSON.parse(event.newValue) as { patientId: string; displayDate: string; source?: string };
        if (!payload.patientId || payload.source === 'patients') return;
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

  // Reseta currentPage para 1 quando filtros mudam (evita pagina vazia)
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterGrupo, filterTipoBusca, filterTipoContato, filterSituacao, filterEntraves, filterDataInicio, filterDataFim, filterUnidade, filterEquipe, filterMicroarea, filterDnaHpvPep, filterCitoLab, filterCitoPep, filterDnaHpvGal]);

  useEffect(() => {
    let cancelled = false;
    const fetchPacientes = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        const options: any = { sort: 'nome' };
        
        const filterParts = [];
        if (!isAdmin && user) {
          if (user.role === 'unidade') {
            filterParts.push(pb.filter('unidade ~ {:u}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%') }));
          } else if (user.role === 'equipe') {
            filterParts.push(pb.filter('unidade ~ {:u} && equipe ~ {:e}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%'), e: normalizeText(user.equipe).replace(/\s+/g, '%') }));
          } else if (user.role === 'microarea') {
            filterParts.push(pb.filter('unidade ~ {:u} && equipe ~ {:e}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%'), e: normalizeText(user.equipe).replace(/\s+/g, '%') }));
            filterParts.push(`microarea = ${Number(user.microarea)}`);
          }
        }

        // Regional UI Filters
        if (filterUnidade.length > 0) {
          const uParams: Record<string, string> = {};
          const uClauses = filterUnidade.map((u, i) => {
            uParams[`u${i}`] = normalizeText(u).replace(/\s+/g, '%');
            return `unidade ~ {:u${i}}`;
          });
          filterParts.push(pb.filter(uClauses.join(' || '), uParams));
        }
        if (filterEquipe.length > 0) {
          // Normaliza acentos (DB: "ESPERANCA" / UI: "ESPERANÇA") + uppercase
          const eParams: Record<string, string> = {};
          const eClauses = filterEquipe.map((e, i) => {
            eParams[`e${i}`] = normalizeText(e).replace(/\s+/g, '%');
            return `equipe ~ {:e${i}}`;
          });
          filterParts.push(pb.filter(eClauses.join(' || '), eParams));
        }
        if (filterMicroarea.length > 0) {
          filterParts.push(`(${filterMicroarea.map(m => `microarea = ${Number(m)}`).join(' || ')})`);
        }

        // Build patient region filter for scoping acomp queries (reliable direct field filters)
        const patientRegionFilterParts: string[] = [];
        if (!isAdmin && user) {
          if (user.role === 'unidade') {
            patientRegionFilterParts.push(pb.filter('unidade ~ {:u}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%') }));
          } else if (user.role === 'equipe') {
            patientRegionFilterParts.push(pb.filter('unidade ~ {:u} && equipe ~ {:e}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%'), e: normalizeText(user.equipe).replace(/\s+/g, '%') }));
          } else if (user.role === 'microarea') {
            patientRegionFilterParts.push(pb.filter('unidade ~ {:u} && equipe ~ {:e}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%'), e: normalizeText(user.equipe).replace(/\s+/g, '%') }));
            patientRegionFilterParts.push(`microarea = ${Number(user.microarea)}`);
          }
        }
        if (filterUnidade.length > 0) {
          const puParams: Record<string, string> = {};
          const puClauses = filterUnidade.map((u, i) => {
            puParams[`u${i}`] = normalizeText(u).replace(/\s+/g, '%');
            return `unidade ~ {:u${i}}`;
          });
          patientRegionFilterParts.push(pb.filter(puClauses.join(' || '), puParams));
        }
        if (filterEquipe.length > 0) {
          const peParams: Record<string, string> = {};
          const peClauses = filterEquipe.map((e, i) => {
            peParams[`e${i}`] = normalizeText(e).replace(/\s+/g, '%');
            return `equipe ~ {:e${i}}`;
          });
          patientRegionFilterParts.push(pb.filter(peClauses.join(' || '), peParams));
        }
        if (filterMicroarea.length > 0) {
          patientRegionFilterParts.push(`(${filterMicroarea.map(m => `microarea = ${Number(m)}`).join(' || ')})`);
        }

        // Filtros de Acompanhamento (Requer busca na outra coleção)
        const hasAcompFilter = filterTipoBusca.length > 0 || filterTipoContato.length > 0 || filterSituacao.length > 0 || filterEntraves.length > 0 || filterDataInicio || filterDataFim;
        
        if (hasAcompFilter) {
          const acompFilters = [];
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

          // Patient ID-based scoping (replaces unreliable paciente.unidade filter syntax)
          if (patientRegionFilterParts.length > 0) {
            const regionFilter = patientRegionFilterParts.join(' && ');
            const regionPatients = await pb.collection('amarcap53_pacientes').getFullList({
              filter: regionFilter,
              batch: 500,
              requestKey: null,
              fields: 'id'
            });
            const regionIds = regionPatients.map(p => p.id).filter(Boolean);
            if (regionIds.length > 0) {
              const chunkSize = 200;
              const idChunks: string[][] = [];
              for (let i = 0; i < regionIds.length; i += chunkSize) {
                idChunks.push(regionIds.slice(i, i + chunkSize));
              }
              const idFilterStr = idChunks.map(chunk => `(${chunk.map(id => `paciente = "${id}"`).join(' || ')})`).join(' || ');
              acompFilters.push(`(${idFilterStr})`);
            }
          }

          const acompRecords = await pb.collection('amarcap53_acompanhamentos').getFullList({
            filter: acompFilters.join(' && '),
            fields: 'paciente'
          });
          
          const patientIds = Array.from(new Set(acompRecords.map(r => r.paciente)));
          if (patientIds.length > 0) {
            filterParts.push(`(${patientIds.map(id => `id = "${id}"`).join(' || ')})`);
          } else {
            // Nenhum acompanhamento encontrado com esses filtros, força resultado vazio
            filterParts.push(`id = "none"`);
          }
        }

        // Busca via client-side (filteredPacientes) — PocketBase ~ é accent-sensitive

        // Filtro de Grupo
        if (filterGrupo.length > 0) {
          filterParts.push(`(${filterGrupo.map(g => `grupo = "${g.trim().replace(/\s+/g, ' ')}"`).join(' || ')})`);
        }

        // Filtro de Status de Rastreamento (server-side)
        // Alerta logic: PEP_MOLECULAR=dna_hpv_pep, COLETA_MOLECULAR=dna_hpv_gal, PEP_CITO=cito_pep, COLETA_CITO=cito_lab, NAO_IDENTIFICADO=nenhum
        if (filterStatus.length > 0) {
          const statusClauses: string[] = [];
          if (filterStatus.includes('PEP_MOLECULAR')) {
            statusClauses.push('dna_hpv_pep != ""');
          }
          if (filterStatus.includes('COLETA_MOLECULAR')) {
            statusClauses.push('(dna_hpv_gal != "" && dna_hpv_pep = "")');
          }
          if (filterStatus.includes('PEP_CITO')) {
            statusClauses.push('(cito_pep != "" && dna_hpv_gal = "" && dna_hpv_pep = "")');
          }
          if (filterStatus.includes('COLETA_CITO')) {
            statusClauses.push('(cito_lab != "" && cito_pep = "" && dna_hpv_gal = "" && dna_hpv_pep = "")');
          }
          if (filterStatus.includes('NAO_IDENTIFICADO')) {
            statusClauses.push('(dna_hpv_pep = "" && dna_hpv_gal = "" && cito_pep = "" && cito_lab = "")');
          }
          if (statusClauses.length > 0) {
            filterParts.push(`(${statusClauses.join(' || ')})`);
          }
        }

        // Filtros SIM/NÃO de exames (server-side)
        const simNaoFilter = (field: string, val: string) => {
          if (!val) return null;
          if (val === 'SIM') return `${field} != ""`;
          if (val === 'NÃO') return `${field} = ""`;
          return null;
        };
        const dnaHpvPepF = simNaoFilter('dna_hpv_pep', filterDnaHpvPep);
        if (dnaHpvPepF) filterParts.push(dnaHpvPepF);
        const citoLabF = simNaoFilter('cito_lab', filterCitoLab);
        if (citoLabF) filterParts.push(citoLabF);
        const citoPepF = simNaoFilter('cito_pep', filterCitoPep);
        if (citoPepF) filterParts.push(citoPepF);
        const dnaHpvGalF = simNaoFilter('dna_hpv_gal', filterDnaHpvGal);
        if (dnaHpvGalF) filterParts.push(dnaHpvGalF);

        // Busca server-side (129K registros — manter paginado)
        if (searchTerm) {
          const safeSearch = searchTerm.replace(/"/g, '\\"');
          filterParts.push(`(nome ~ "${safeSearch}" || cns ~ "${safeSearch}")`);
        }

        if (filterParts.length > 0) {
          const filterStr = filterParts.join(' && ').trim();
          if (filterStr) options.filter = filterStr;
        }

        const effectivePage = searchTerm ? 1 : currentPage;

        // Filtrar por busca ativa (pacientes COM ou SEM acompanhamento)
        if (filterBuscaAtiva !== null) {
          try {
            const allAcomp = await pb.collection('amarcap53_acompanhamentos').getFullList({
              fields: 'paciente',
              requestKey: null,
              batch: 500,
            });
            const acompPacIds = [...new Set(allAcomp.map((a: any) => a.paciente).filter(Boolean))];
            if (acompPacIds.length > 0) {
              if (filterBuscaAtiva === true) {
                // COM acompanhamento
                const idFilter = acompPacIds.map(id => `id = "${id}"`).join(' || ');
                filterParts.push(`(${idFilter})`);
              } else {
                // SEM acompanhamento — negar ids
                const idFilter = acompPacIds.map(id => `id != "${id}"`).join(' && ');
                filterParts.push(`(${idFilter})`);
              }
            } else if (filterBuscaAtiva === true) {
              // Nenhum acompanhamento → resultado vazio
              filterParts.push('id = "__none__"');
            }
            // Rebuild filter
            const finalFilter = filterParts.join(' && ').trim();
            if (finalFilter) options.filter = finalFilter;
          } catch { /* ignora erro */ }
        }

        // Parallel queries — pacientes + acompanhamentos ao mesmo tempo
        const resultList = await pb.collection('amarcap53_pacientes').getList(effectivePage, pageSize, options);
        if (cancelled) return;

        const allRecords = resultList.items;
        const patientIds = allRecords.map(r => r.id).filter(Boolean);

        // Buscar acompanhamentos em paralelo (não bloqueia)
        let acompResults: any[] = [];
        if (patientIds.length > 0) {
          try {
            const raw: any = await pb.collection('amarcap53_acompanhamentos').getFullList({
              filter: `(${patientIds.slice(0, 200).map(id => `paciente = "${id}"`).join(' || ')})`,
              fields: 'id,paciente',
              requestKey: null
            });
            acompResults = Array.isArray(raw) ? raw : (raw?.items ?? []);
          } catch { acompResults = []; }
        }
        if (cancelled) return;
        const countMap = new Map<string, number>();
        acompResults.forEach((r: any) => {
          countMap.set(r.paciente, (countMap.get(r.paciente) || 0) + 1);
        });

        let pacientesFormatados = allRecords.map(record => {
          const count = countMap.get(record.id) || 0;
          const p: Paciente = {
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
            total_acompanhamentos: count,
            isFavorite: favorites.includes(record.id),
          };
          
          p.alertas = determinarAlerta(p);
          return p;
        });


        setPacientes(pacientesFormatados);
        setTotalItems(resultList.totalItems);
        setPatCache({ pacientes: pacientesFormatados, totalItems: resultList.totalItems });
      } catch (error) {
        console.error("Erro ao buscar pacientes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPacientes();
    return () => { cancelled = true; };
  }, [user?.id, user?.role, user?.unidade_saude, user?.equipe, user?.microarea, currentPage, isAdmin, searchTerm, filterStatus, filterGrupo, filterTipoBusca, filterTipoContato, filterSituacao, filterEntraves, filterDataInicio, filterDataFim, filterUnidade, filterEquipe, filterMicroarea, filterDnaHpvPep, filterCitoLab, filterCitoPep, filterDnaHpvGal]);

  // CSV Import handlers
  const convertDateToISO = (value: string): string => {
    if (!value || value === '--' || value.trim() === '') return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value;
    const parts = value.split('/');
    if (parts.length === 3) {
      let [d, m, y] = parts;
      if (y.length === 2) y = '20' + y;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return value;
  };

  const handleCsvFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCsvFile(file);
    setCsvFileName(file.name);
    setCsvResult(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setCsvText(text);
      const result = Papa.parse(text, {
        header: true,
        skipEmptyLines: true,
        transformHeader: (h: string) => h.replace(/,+$/, '').trim(),
      });
      const records = (result.data as any[]).filter(r => r.nome && r.nome.trim());
      setCsvRecords(records);
      setCsvPreview(records.slice(0, 5));
    };
    reader.readAsText(file);
  };

  const handleCsvImport = async () => {
    if (!csvRecords.length || !csvFileName) return;

    console.log('[PATIENTS] handleCsvImport V3 - build novo carregado');
    setIsCsvUploading(true);
    const totalRecords = csvRecords.length;

    // ─── MODO SUBSTITUIR: envia CSV inteiro pro backend ─────
    // Backend faz DELETE + INSERT na mesma transação SQL (atômico)
    if (csvReplaceExisting) {
      setCsvProgress({ current: 1, total: 1 });

      try {
        const baseUrl = pb.baseURL;
        const token = pb.authStore.token;
        const res = await fetch(`${baseUrl}/api/custom/import-pacientes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            csvText: csvText,
            fileName: csvFileName,
            mode: 'replace',
          }),
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          throw new Error(data.message || `Erro HTTP ${res.status}`);
        }

        console.log(`[IMPORT] Backend: ${data.oldCount} antigos deletados, ${data.imported} novos inseridos, ${data.errors} erros`);
        setIsCsvUploading(false);
        setCsvResult({ success: data.imported, errors: data.errors, total: totalRecords });
      } catch (err: any) {
        console.error('[IMPORT] Erro:', err);
        setIsCsvUploading(false);
        setCsvResult({ success: 0, errors: totalRecords, total: totalRecords });
      }
      return;
    }

    // ─── MODO ADICIONAR: insere registros novos pelo SDK ─────
    const BATCH_SIZE = 500;
    const chunks: any[][] = [];

    for (let i = 0; i < totalRecords; i += BATCH_SIZE) {
      chunks.push(csvRecords.slice(i, i + BATCH_SIZE));
    }

    setCsvProgress({ current: 0, total: chunks.length });

    let totalSuccess = 0;
    let totalErrors = 0;
    const DATE_FIELDS = new Set(['data_nascimento', 'cito_lab', 'cito_pep', 'dna_hpv_gal', 'dna_hpv_pep']);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i].map((r: any) => {
        const record: Record<string, any> = {};
        for (const key in r) {
          if (r.hasOwnProperty(key) && key) record[key] = r[key];
        }
        for (const field of DATE_FIELDS) {
          if (record[field]) record[field] = convertDateToISO(record[field]);
        }
        if (record.cns) record.cns = String(record.cns).replace(/\D/g, '').padStart(15, '0').slice(-15);
        if (record.idade) record.idade = parseInt(record.idade, 10) || 0;
        if (record.microarea !== undefined && record.microarea !== '') record.microarea = parseInt(record.microarea, 10) || 0;
        return record;
      });

      try {
        const batchSize = chunk.length;
        const batch: any[] = [];
        for (const rec of chunk) {
          batch.push(pb.collection('amarcap53_pacientes').create(rec, { requestKey: null }));
        }
        const results = await Promise.allSettled(batch);
        let chunkOk = 0;
        let chunkFail = 0;
        results.forEach((r, idx) => {
          if (r.status === 'fulfilled') {
            chunkOk++;
          } else {
            chunkFail++;
            if (chunkFail <= 3) console.warn(`Lote ${i + 1} #${idx + 1}:`, r.reason?.message || r.reason);
          }
        });
        totalSuccess += chunkOk;
        totalErrors += chunkFail;
      } catch (error: any) {
        console.error(`Erro no lote ${i + 1}:`, error);
        totalErrors += chunk.length;
      }

      setCsvProgress({ current: i + 1, total: chunks.length });
    }

    setIsCsvUploading(false);
    setCsvResult({ success: totalSuccess, errors: totalErrors, total: totalRecords });
  };

  const resetCsvState = () => {
    setIsCsvModalOpen(false);
    setCsvFile(null);
    setCsvRecords([]);
    setCsvText('');
    setCsvFileName('');
    setCsvResult(null);
    setCsvPreview([]);
    setCsvProgress({ current: 0, total: 0 });
  };

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
    setCurrentPage(1);
  };

  const calcularIdade = (dataNascimento: string) => {
    if (!dataNascimento) return 0;
    // Tenta interpretar DD/MM/YYYY ou YYYY-MM-DD
    let dataFormatada = dataNascimento;
    if (dataNascimento.includes('/')) {
      const [dia, mes, ano] = dataNascimento.split('/');
      dataFormatada = `${ano}-${mes}-${dia}`;
    }
    
    const hoje = new Date();
    const nascimento = new Date(dataFormatada);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return isNaN(idade) ? 0 : idade;
  };

  const formatarData = (dataStr: string | undefined) => {
    if (!dataStr || dataStr === '--') return '--';
    
    // Se já estiver no formato DD/MM/YYYY, retorna
    if (/^\d{2}\/\d{2}\/\d{4}$/.test(dataStr)) return dataStr;
    
    // Remove a parte do horário (espaço ou T)
    let dateOnly = dataStr;
    if (dateOnly.includes(' ')) {
      dateOnly = dateOnly.split(' ')[0];
    }
    if (dateOnly.includes('T')) {
      dateOnly = dateOnly.split('T')[0];
    }
    
    // Se estiver em YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}/.test(dateOnly)) {
      const [ano, mes, dia] = dateOnly.split('-');
      return `${dia}/${mes}/${ano}`;
    }
    
    return dateOnly;
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <Header 
        title="Meus Pacientes" 
        pageTitle="Meus Pacientes" 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 no-scrollbar">
        <div className="max-w-[1600px] mx-auto">
          
          <div className="grid grid-cols-1 gap-4 md:gap-6 mb-8 md:mb-10">
            <div className="bg-gradient-to-br from-[#001b3d] to-[#002b5c] p-4 md:p-10 rounded-2xl md:rounded-[2.5rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4 md:gap-10 relative overflow-hidden group">
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-700"></div>
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700"></div>

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full md:w-auto">
                <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner group-hover:scale-105 transition-transform duration-500">
                  <Users className="w-8 h-8 md:w-10 md:h-10 text-white" />
                </div>
                <div className="text-center md:text-left">
                  <p className="text-[10px] md:text-sm font-black text-white/40 uppercase tracking-[0.3em] mb-2">Painel de Controle</p>
                  <p className="text-2xl md:text-[3.5rem] font-black text-white leading-none tracking-tighter">
                    {totalItems} <span className="text-sm md:text-lg font-bold text-white/60 ml-2 tracking-normal uppercase">Pacientes Ativos</span>
                  </p>
                </div>
              </div>

              {/* Botões de Ação */}
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

                {/* Importação CSV removida — agora disponível apenas em Configurações */}
              </div>
            </div>

            {/* Barra de Busca Animada */}
            {isSearchVisible && (
              <div className="bg-white p-6 rounded-3xl shadow-xl border border-primary/5 animate-in slide-in-from-top-6 fade-in duration-500">
                <div className="relative group">
                  <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/30 group-focus-within:text-primary transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Quem você está procurando hoje? Digite nome ou CNS..." 
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

                  {/* Status + Grupo na linha 1 */}
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

                  {/* Exames SIM/NÃO — linha 2 completa */}
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

                  {/* Filtros Regionais — ocupam ate 3 colunas quando visiveis */}
                  {(isAdmin || user?.role === 'cap') && (
                    <div>
                      <MultiSelect 
                        label="Unidade"
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
                    <div className="space-y-2">
                      <MultiSelect 
                        label="Equipe"
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
                    <div className="space-y-2">
                      <MultiSelect 
                        label="Microárea"
                        placeholder="Todas as Microáreas"
                        options={MICROAREAS.map(ma => ma.toString())}
                        value={filterMicroarea}
                        onChange={setFilterMicroarea}
                        disabled={filterEquipe.length === 0 && (isAdmin || user?.role === 'cap')}
                      />
                    </div>
                  )}

                  {/* Acompanhamento filters — linha completa */}
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
                    <button 
                      onClick={resetFilters}
                      className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-surface-container-high text-on-surface-variant text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-surface-container-highest transition-all duration-300"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Resetar
                    </button>
                    <button 
                      onClick={() => setIsFilterVisible(false)}
                      className="flex-1 py-3.5 bg-primary text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all duration-300 shadow-lg shadow-primary/20"




                    >
                      Aplicar Filtros
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

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
                    <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[140px] border-r border-white/5">
                      <div className="flex flex-col items-center gap-1">
                        <TestTube className="w-4 h-4 text-blue-400/60" />
                        <div className="flex items-center gap-1.5">
                          <span>DNA-HPV (PEP)</span>
                          <InfoTooltip content="Data de registro do resultado do teste molecular de DNA-HPV no PEP." />
                        </div>
                        <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">Data do registro do resultado</span>
                      </div>
                    </th>
                      {(isAdmin || user?.role === 'cap' || user?.role === 'unidade' || user?.role === 'equipe' || user?.role === 'microarea') && (
                        <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[240px] border-r border-white/5">
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
                        <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">Data do cadastro</span>
                      </div>
                    </th>
                    <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[180px]">
                      <div className="flex flex-col items-center gap-1">
                        <FileText className="w-4 h-4 text-blue-400/60" />
                        <div className="flex items-center gap-1.5">
                          <span>Cito (PEP)</span>
                          <InfoTooltip content="Data de coleta do exame citopatológico registrada no PEP." />
                        </div>
                        <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">Data da coleta dos resultados registrados</span>
                      </div>
                    </th>
                    <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[180px]">
                      <div className="flex flex-col items-center gap-1">
                        <TestTube className="w-4 h-4 text-blue-400/60" />
                        <div className="flex items-center gap-1.5">
                          <span>DNA-HPV (GAL)</span>
                          <InfoTooltip content="Data do resultado do teste molecular de DNA-HPV registrada no GAL." />
                        </div>
                        <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">Data da coleta</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {pacientes.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin || user?.role === 'cap' || user?.role === 'unidade' || user?.role === 'equipe' || user?.role === 'microarea' ? 9 : 8} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center opacity-30">
                          <SearchX className="w-16 h-16 mb-4" />
                          <p className="text-sm font-black uppercase tracking-widest">Nenhum registro encontrado</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pacientes.map((paciente) => (
                      <tr key={paciente.id} className="hover:bg-primary/[0.03] transition-all group">
                        {/* 1. PACIENTE */}
                        <td className="px-4 py-6 text-center relative">
                          <button 
                            onClick={() => toggleFavorite(paciente.id)}
                            className={`absolute left-2 top-2 p-1.5 rounded-lg transition-all duration-300 ${
                              favorites.includes(paciente.id) 
                                ? 'text-amber-400 bg-amber-50 shadow-sm border border-amber-100' 
                                : 'text-slate-300 hover:text-amber-300 bg-slate-50 border border-slate-100'
                            }`}
                            title={favorites.includes(paciente.id) ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                          >
                            <Star className={`w-3.5 h-3.5 ${favorites.includes(paciente.id) ? 'fill-current' : ''}`} />
                          </button>
                          <div className="flex flex-col items-center gap-0.5 mt-2">
                            <p className="text-[11px] md:text-[12px] font-black text-primary uppercase leading-tight break-words" title={paciente.nome}>
                              {paciente.nome}
                            </p>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-tighter leading-none">
                              {paciente.cns}
                            </p>
                            <p className="text-[9px] md:text-[10px] font-bold text-slate-500 uppercase tracking-tighter leading-none">
                              {formatarData(paciente.data_nascimento)}
                            </p>
                          </div>
                        </td>

                        {/* 3. STATUS */}
                        <td className="px-2 py-6 text-center">
                          {paciente.alertas && ALERT_CONFIGS[paciente.alertas] ? (
                            <div className={`inline-flex flex-col items-center justify-center px-2 py-2 rounded-lg border border-white/10 shadow-lg min-h-[50px] w-full max-w-[140px] mx-auto ${ALERT_CONFIGS[paciente.alertas].bg}`}>
                              <span className={`text-[8px] md:text-[10px] font-bold uppercase leading-tight tracking-normal text-center ${ALERT_CONFIGS[paciente.alertas].color}`}>
                                {ALERT_CONFIGS[paciente.alertas].label}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 italic text-[10px] md:text-[12px] font-black uppercase tracking-tight">--</span>
                          )}
                        </td>

                        {/* 4. AÇÃO */}
                        <td className="px-2 py-4 text-center">
                          <div className="flex flex-col items-center justify-center gap-1.5">
                            <button 
                              onClick={() => handleOpenDetails(paciente)}
                              className="h-10 w-24 bg-white border border-slate-200 text-slate-500 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-tight shadow-sm transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 hover:shadow-md"
                              title="Ver Detalhes"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Detalhes</span>
                            </button>

                            <button 
                              onClick={() => handleOpenModal(paciente)}
                              className="h-10 w-24 bg-[#001b3d] hover:bg-[#002b5c] text-white rounded-lg text-[8px] md:text-[9px] font-black uppercase tracking-tight shadow-md shadow-blue-900/15 transition-all duration-300 active:scale-95 flex items-center justify-center gap-2 border border-white/10 hover:shadow-lg hover:shadow-blue-900/20 hover:-translate-y-0.5 relative"
                              title="Acompanhamento"
                            >
                              <ClipboardList className="w-3.5 h-3.5 text-blue-300" />
                              <span>Acomp.</span>
                              {paciente.total_acompanhamentos !== undefined && paciente.total_acompanhamentos > 0 && (
                                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-5 px-1 flex items-center justify-center bg-red-500 text-white text-[9px] font-black rounded-full border-2 border-[#001b3d] shadow-md z-10">
                                  {paciente.total_acompanhamentos}
                                </span>
                              )}
                            </button>
                          </div>
                        </td>

                        {/* 6. RESULTADO DE DNA- HPV REGISTRADO EM PRONTUÁRIO */}
                        <td className="px-4 py-6 text-center">
                          <DatePickerPTBR
                            value={paciente.dna_hpv_pep || ''}
                            isISO={false}
                            onChange={(displayDate) => handleUpdateCitoLaboratorio(paciente.id, displayDate)}
                          />
                        </td>

                        {/* UNIDADE/EQUIPE */}
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

                        {/* 7. IDADE / GRUPO */}
                        <td className="px-4 py-6 text-center">
                          <div className="flex flex-col items-center gap-1.5">
                            <p className="text-[14px] md:text-[16px] font-black text-[#001b3d] leading-none">{paciente.idade}</p>
                            <span className={`inline-block px-2.5 py-1 rounded text-[11px] md:text-[12px] font-black uppercase tracking-tighter ${paciente.grupo !== '--' ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'text-slate-300 italic'}`}>
                              {paciente.grupo}
                            </span>
                          </div>
                        </td>

                        {/* 8. RESULTADO DE CITO LABORATÓRIO */}
                        <td className="px-4 py-6 text-center">
                          <span className={`inline-block px-3.5 py-2 rounded-lg text-[11px] md:text-[12px] font-black uppercase tracking-tight shadow-sm ${paciente.cito_lab !== '--' ? 'bg-yellow-50 text-yellow-700 border border-yellow-100' : 'text-slate-300 italic'}`}>
                            {formatarData(paciente.cito_lab)}
                          </span>
                        </td>

                        {/* 9. RESULTADO DE CITO REGISTRADO NO PEP */}
                        <td className="px-4 py-6 text-center">
                          <span className={`inline-block px-3.5 py-2 rounded-lg text-[11px] md:text-[12px] font-black uppercase tracking-tight shadow-sm ${paciente.cito_pep !== '--' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'text-slate-300 italic'}`}>
                            {formatarData(paciente.cito_pep)}
                          </span>
                        </td>

                        {/* 10. TESTE MOLECULAR DNA-HPV */}
                        <td className="px-4 py-6 text-center">
                          <span className={`inline-block px-3.5 py-2 rounded-lg text-[11px] md:text-[12px] font-black uppercase tracking-tight shadow-sm ${paciente.dna_hpv_gal !== '--' ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'text-slate-300 italic'}`}>
                            {formatarData(paciente.dna_hpv_gal)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Paginação */}
          {totalItems > 0 && (
            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 bg-surface-container-lowest p-4 rounded-xl shadow-sm border border-outline-variant/20">
              <p className="text-[10px] sm:text-xs font-bold text-on-surface-variant uppercase tracking-widest">
                Mostrando <span className="text-primary">{Math.min((currentPage - 1) * pageSize + 1, totalItems)}</span> a <span className="text-primary">{Math.min(currentPage * pageSize, totalItems)}</span> de <span className="text-primary">{totalItems}</span> pacientes
              </p>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1 || isLoading}
                  className="p-2 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-primary/5 hover:text-primary hover:border-primary/30 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant disabled:hover:border-outline-variant/30 transition-all"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, Math.ceil(totalItems / pageSize)) }, (_, i) => {
                    const totalPages = Math.ceil(totalItems / pageSize);
                    let pageNum = currentPage;
                    
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-8 h-8 rounded-lg text-[10px] font-black transition-all ${
                          currentPage === pageNum
                            ? 'bg-primary text-white shadow-md shadow-primary/20'
                            : 'text-on-surface-variant hover:bg-primary/5 hover:text-primary'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(totalItems / pageSize)))}
                  disabled={currentPage === Math.ceil(totalItems / pageSize) || isLoading}
                  className="p-2 rounded-lg border border-outline-variant/30 text-on-surface-variant hover:bg-primary/5 hover:text-primary hover:border-primary/30 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-on-surface-variant disabled:hover:border-outline-variant/30 transition-all"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
          <Footer />
        </div>
      </div>

      <LoadingOverlay visible={isLoading} message="Sincronizando pacientes..." />

      {/* Modal Premium */}
      {isModalOpen && selectedPaciente && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div data-dropdown-root="true" className="relative bg-surface-container-lowest w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-[0px_24px_48px_rgba(0,0,0,0.15)] overflow-visible border border-white/20 animate-in zoom-in-95 duration-300">
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-[#1c2e4a] to-[#253c61] px-5 sm:px-8 md:px-10 py-5 sm:py-6 flex justify-between items-center relative shrink-0">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white text-base sm:text-lg md:text-xl font-black tracking-tight leading-tight">Registro de Acompanhamento</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></div>
                    <p className="text-white/60 text-[10px] sm:text-xs font-medium uppercase tracking-widest truncate max-w-[200px] sm:max-w-[300px]">
                      Paciente: {selectedPaciente.nome}
                    </p>
                  </div>
                </div>
              </div>
              <button 
                onClick={handleCloseModal} 
                className="p-2 -mr-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all duration-300 hover:rotate-90"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            
            {/* Corpo do Modal com Rolagem Independente */}
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

                  {/* Situação Pós Busca */}
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
                    placeholder="Descreva aqui detalhes relevantes do atendimento, informações adicionais repassadas pelo paciente ou qualquer outro ponto importante..." 
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
      {/* Modal de Detalhes do Paciente */}
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

      {/* Modal de Importação CSV */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[120] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-[0px_24px_48px_rgba(0,0,0,0.15)] flex flex-col border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="bg-gradient-to-r from-emerald-800 to-emerald-700 px-6 py-5 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Upload className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white text-lg font-black tracking-tight leading-tight">Importar Pacientes (CSV)</h3>
                  <p className="text-white/60 text-[10px] uppercase tracking-widest mt-1">Upload por lotes de 500 registros</p>
                </div>
              </div>
              <button onClick={resetCsvState} disabled={isCsvUploading} className="p-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 sm:p-8 overflow-y-auto no-scrollbar">
              {!csvFile ? (
                <label className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-emerald-300/40 rounded-2xl cursor-pointer hover:border-emerald-400/60 hover:bg-emerald-50/50 transition-all bg-emerald-50/20 group">
                  <Upload className="w-10 h-10 text-emerald-400 group-hover:text-emerald-500 transition-colors mb-3" />
                  <p className="text-sm font-bold text-emerald-700 group-hover:text-emerald-800">Clique para selecionar arquivo CSV</p>
                  <p className="text-[10px] font-medium text-emerald-500 mt-1">Cabeçalhos: unidade, equipe, microarea, cns, nome, data_nascimento, idade, grupo, cito_lab, cito_pep, dna_hpv_gal</p>
                  <input type="file" accept=".csv" onChange={handleCsvFileSelect} className="hidden" />
                </label>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-center justify-between bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-emerald-600" />
                      <div>
                        <p className="text-sm font-bold text-emerald-800">{csvFileName}</p>
                        <p className="text-[10px] font-medium text-emerald-600">{csvRecords.length} registros encontrados</p>
                      </div>
                    </div>
                    {!isCsvUploading && !csvResult && (
                      <button onClick={resetCsvState} className="text-[10px] font-black text-emerald-600 uppercase tracking-wider hover:text-emerald-800 transition-colors">
                        Trocar arquivo
                      </button>
                    )}
                  </div>

                  {csvPreview.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-2">Pré-visualização (primeiros {csvPreview.length})</p>
                      <div className="overflow-x-auto rounded-xl border border-outline-variant/20">
                        <table className="w-full text-[10px]">
                          <thead>
                            <tr className="bg-slate-50">
                              {Object.keys(csvPreview[0]).map(key => (
                                <th key={key} className="px-2 py-2 font-bold text-slate-500 uppercase tracking-wider text-left whitespace-nowrap">{key}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {csvPreview.map((row, i) => (
                              <tr key={i} className="border-t border-outline-variant/10">
                                {Object.values(row).map((val: any, j) => (
                                  <td key={j} className="px-2 py-1.5 font-medium text-slate-700 truncate max-w-[120px]">{val || '--'}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {isCsvUploading && (
                    <div className="space-y-3">
                      <div className="flex justify-between text-[10px] font-bold text-primary uppercase tracking-wider">
                        <span>Processando lote {csvProgress.current} de {csvProgress.total}</span>
                        <span>{Math.round((csvProgress.current / csvProgress.total) * 100)}%</span>
                      </div>
                      <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-full transition-all duration-500"
                          style={{ width: `${(csvProgress.current / csvProgress.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {csvResult && (
                    <div className={`p-4 rounded-xl border ${csvResult.errors > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                      <p className="text-sm font-black text-slate-800 mb-1">
                        {csvResult.errors > 0 ? 'Importação concluída com avisos' : 'Importação concluída com sucesso!'}
                      </p>
                      <p className="text-[11px] font-medium text-slate-600">
                        {csvResult.success} de {csvResult.total} registros importados
                        {csvResult.errors > 0 && ` · ${csvResult.errors} erros`}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-outline-variant/10 bg-surface-container-lowest flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
              <label className="flex items-center gap-3 cursor-pointer select-none group/toggle">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={csvReplaceExisting}
                    onChange={(e) => setCsvReplaceExisting(e.target.checked)}
                    disabled={isCsvUploading}
                    className="sr-only peer"
                  />
                  <div className="w-10 h-6 bg-slate-200 rounded-full peer-checked:bg-red-500 transition-colors shadow-inner"></div>
                  <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform peer-checked:translate-x-4"></div>
                </div>
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider group-hover/toggle:text-red-600 transition-colors">
                  Substituir existentes
                </span>
                {csvReplaceExisting && (
                  <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded text-[8px] font-black uppercase">
                    Todos os dados atuais serao deletados
                  </span>
                )}
              </label>
              <div className="flex gap-3 w-full sm:w-auto">
              {!csvFile && (
                <button onClick={resetCsvState} className="px-8 py-2.5 rounded-xl text-sm font-black text-slate-600 hover:bg-slate-100 transition-all w-full sm:w-auto">
                  Cancelar
                </button>
              )}
              {csvFile && !isCsvUploading && !csvResult && (
                <button
                  onClick={handleCsvImport}
                  disabled={csvRecords.length === 0}
                  className="px-8 py-2.5 rounded-xl text-sm font-black text-white bg-gradient-to-r from-emerald-600 to-emerald-700 shadow-lg hover:shadow-xl transition-all active:scale-95 w-full sm:w-auto disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  Iniciar Importação ({csvRecords.length} registros em {Math.ceil(csvRecords.length / 500)} lotes)
                </button>
              )}
              {csvResult && (
                <button onClick={resetCsvState} className="px-8 py-2.5 rounded-xl text-sm font-black text-white bg-[#001b3d] shadow-lg hover:shadow-xl transition-all active:scale-95 w-full sm:w-auto">
                  Concluído
                </button>
              )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
