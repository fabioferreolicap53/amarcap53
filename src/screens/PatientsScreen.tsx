import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Header } from '../components/Header';
import { Footer } from '../components/Footer';
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
  dna_hpv?: string;  // Data
  dna_hpv_pep?: string; // Data (Novo campo)
  alertas_rastreamento?: string;
  alertas?: string; 
  total_acompanhamentos?: number;
  isFavorite?: boolean;
}

const DNA_HPV_PEP_SYNC_EVENT = 'amarcap53:dna-hpv-pep-updated';

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
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
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
  const [filterDnaHpvPep, setFilterDnaHpvPep] = useState<string[]>([]);
  const [filterCitoLab, setFilterCitoLab] = useState<string[]>([]);
  const [filterCitoPep, setFilterCitoPep] = useState<string[]>([]);
  const [filterDnaHpvGal, setFilterDnaHpvGal] = useState<string[]>([]);

  const [availableGroups, setAvailableGroups] = useState<string[]>([]);
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

  // Derive available groups from already-loaded patients instead of a separate API call
  useEffect(() => {
    if (pacientes.length > 0) {
      const groups = Array.from(new Set(pacientes.map(p => p.grupo))).filter(g => g && g !== '--');
      setAvailableGroups(groups);
    }
  }, [pacientes]);

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
      entraves_identificados: Array.isArray(modalEntraves) 
        ? modalEntraves.filter(v => v)
        : modalEntraves ? [modalEntraves] : [],
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
    // Campo fixo: dna_hpv
    if (p.dna_hpv && p.dna_hpv !== '--' && p.dna_hpv !== '') return 'COLETA_MOLECULAR';
    
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
        const valueToSave = displayDate === '--' ? '' : displayDate;
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

  useEffect(() => {
    const fetchPacientes = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        const options: any = { sort: 'nome' };
        
        const filterParts = [];
        if (!isAdmin && user) {
          if (user.role === 'unidade') {
            filterParts.push(`unidade = "${user.unidade_saude}"`);
          } else if (user.role === 'equipe') {
            filterParts.push(`unidade = "${user.unidade_saude}"`);
            filterParts.push(`equipe = "${user.equipe}"`);
          } else if (user.role === 'microarea') {
            filterParts.push(`unidade = "${user.unidade_saude}"`);
            filterParts.push(`equipe = "${user.equipe}"`);
            filterParts.push(`microarea ~ "${user.microarea}"`);
          }
        }

        // Regional UI Filters
        if (filterUnidade.length > 0) {
          filterParts.push(`(${filterUnidade.map(u => `unidade = "${u}"`).join(' || ')})`);
        }
        if (filterEquipe.length > 0) {
          filterParts.push(`(${filterEquipe.map(e => `equipe = "${e}"`).join(' || ')})`);
        }
        if (filterMicroarea.length > 0) {
          filterParts.push(`(${filterMicroarea.map(m => `microarea ~ "${m}"`).join(' || ')})`);
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
            acompFilters.push(`(${filterEntraves.map(v => `entraves_identificados ~ "${v}"`).join(' || ')})`);
          }
          
          if (filterDataInicio) {
            acompFilters.push(`data_busca >= "${filterDataInicio} 00:00:00"`);
          }
          if (filterDataFim) {
            acompFilters.push(`data_busca <= "${filterDataFim} 23:59:59"`);
          }
          
          // Mirror regional filters to acomp query for accuracy
          if (!isAdmin && user) {
            if (user.role === 'unidade') acompFilters.push(`paciente.unidade = "${user.unidade_saude}"`);
            else if (user.role === 'equipe') {
              acompFilters.push(`paciente.unidade = "${user.unidade_saude}"`);
              acompFilters.push(`paciente.equipe = "${user.equipe}"`);
            } else if (user.role === 'microarea') {
              acompFilters.push(`paciente.unidade = "${user.unidade_saude}"`);
              acompFilters.push(`paciente.equipe = "${user.equipe}"`);
              acompFilters.push(`paciente.microarea ~ "${user.microarea}"`);
            }
          }
          
          if (filterUnidade.length > 0) {
            acompFilters.push(`(${filterUnidade.map(u => `paciente.unidade = "${u}"`).join(' || ')})`);
          }
          if (filterEquipe.length > 0) {
            acompFilters.push(`(${filterEquipe.map(e => `paciente.equipe = "${e}"`).join(' || ')})`);
          }
          if (filterMicroarea.length > 0) {
            acompFilters.push(`(${filterMicroarea.map(m => `paciente.microarea ~ "${m}"`).join(' || ')})`);
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

        // Filtro de Busca (Nome ou CNS)
        if (searchTerm) {
          filterParts.push(`(nome ~ "${searchTerm}" || cns ~ "${searchTerm}")`);
        }

        // Filtro de Grupo
        if (filterGrupo.length > 0) {
          filterParts.push(`(${filterGrupo.map(g => `grupo = "${g}"`).join(' || ')})`);
        }

        if (filterParts.length > 0) {
          options.filter = filterParts.join(' && ');
        }
        
        const resultList = await pb.collection('amarcap53_pacientes').getList(currentPage, pageSize, options);
        
        // Busca contagem de acompanhamentos para os pacientes da página
        const counts = await Promise.all(
          resultList.items.map(async (record) => {
            const result = await pb.collection('amarcap53_acompanhamentos').getList(1, 1, {
              filter: `paciente = "${record.id}"`,
              fields: 'id'
            });
            return { id: record.id, total: result.totalItems };
          })
        );

        let pacientesFormatados = resultList.items.map(record => {
          const count = counts.find(c => c.id === record.id)?.total || 0;
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
            dna_hpv: record.dna_hpv || '--',
            dna_hpv_pep: formatarData(record.dna_hpv_pep) || '--',
            alertas_rastreamento: record.alertas_rastreamento || '--',
            total_acompanhamentos: count,
            isFavorite: favorites.includes(record.id),
          };
          
          p.alertas = determinarAlerta(p);
          return p;
        });

        // Filtro de Status no Frontend (após calcular o status)
        if (filterStatus.length > 0) {
          pacientesFormatados = pacientesFormatados.filter(p => p.alertas && filterStatus.includes(p.alertas));
        }
        
        // Filtros de data dos exames (SIM/NÃO)
        const dateFilter = (field: string | undefined, filterVals: string[]) => {
          if (filterVals.length === 0) return true;
          const hasVal = field && field !== '--' && field !== '';
          const wantSim = filterVals.includes('SIM');
          const wantNao = filterVals.includes('NÃO');
          if (wantSim && wantNao) return true;
          if (wantSim) return !!hasVal;
          if (wantNao) return !hasVal;
          return true;
        };
        pacientesFormatados = pacientesFormatados.filter(p =>
          dateFilter(p.dna_hpv_pep, filterDnaHpvPep) &&
          dateFilter(p.cito_lab, filterCitoLab) &&
          dateFilter(p.cito_pep, filterCitoPep) &&
          dateFilter(p.dna_hpv, filterDnaHpvGal)
        );

        setPacientes(pacientesFormatados);
        setTotalItems(resultList.totalItems);
      } catch (error) {
        console.error("Erro ao buscar pacientes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPacientes();
  }, [user?.id, user?.role, user?.unidade_saude, user?.equipe, user?.microarea, currentPage, isAdmin, searchTerm, filterStatus, filterGrupo, filterTipoBusca, filterTipoContato, filterSituacao, filterEntraves, filterDataInicio, filterDataFim, filterUnidade, filterEquipe, filterMicroarea, filterDnaHpvPep, filterCitoLab, filterCitoPep, filterDnaHpvGal]);

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
    setFilterDnaHpvPep([]);
    setFilterCitoLab([]);
    setFilterCitoPep([]);
    setFilterDnaHpvGal([]);
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
            <div className="bg-gradient-to-br from-[#001b3d] to-[#002b5c] p-8 md:p-10 rounded-[2rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-8 relative overflow-hidden group">
              {/* Efeito de luz no fundo */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-700"></div>
              <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700"></div>

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 w-full md:w-auto">
                <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner group-hover:scale-105 transition-transform duration-500">
                  <Users className="w-10 h-10 text-white" />
                </div>
                <div className="text-center md:text-left">
                  <p className="text-xs md:text-sm font-black text-white/40 uppercase tracking-[0.3em] mb-2">Painel de Controle</p>
                  <p className="text-4xl md:text-[3.5rem] font-black text-white leading-none tracking-tighter">
                    {totalItems} <span className="text-lg font-bold text-white/60 ml-2 tracking-normal uppercase">Pacientes Ativos</span>
                  </p>
                </div>
              </div>

              {/* Botões de Ação Criativos */}
              <div className="relative z-10 flex items-center gap-4 w-full md:w-auto justify-center md:justify-end">
                <button 
                  onClick={() => setIsSearchVisible(!isSearchVisible)}
                  className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all duration-500 border ${
                    isSearchVisible 
                      ? 'bg-white text-primary border-white shadow-[0_0_20px_rgba(255,255,255,0.3)]' 
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                  title="Ativar Busca"
                >
                  <Search className={`w-6 h-6 transition-transform duration-500 ${isSearchVisible ? 'scale-110' : ''}`} />
                </button>

                <button 
                  onClick={() => setIsFilterVisible(!isFilterVisible)}
                  className={`flex items-center gap-3 px-8 h-14 rounded-2xl text-sm font-black uppercase tracking-widest transition-all duration-500 border ${
                    isFilterVisible || filterStatus.length > 0 || filterGrupo.length > 0 || filterTipoBusca.length > 0 || filterTipoContato.length > 0 || filterSituacao.length > 0 || filterEntraves.length > 0 || filterDnaHpvPep.length > 0 || filterCitoLab.length > 0 || filterCitoPep.length > 0 || filterDnaHpvGal.length > 0
                      ? 'bg-primary text-white border-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]' 
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  <Filter className="w-5 h-5" />
                  <span>Filtros</span>
                  {(filterStatus.length > 0 || filterGrupo.length > 0 || filterTipoBusca.length > 0 || filterTipoContato.length > 0 || filterSituacao.length > 0 || filterEntraves.length > 0 || filterDnaHpvPep.length > 0 || filterCitoLab.length > 0 || filterCitoPep.length > 0 || filterDnaHpvGal.length > 0) && (
                    <div className="w-6 h-6 flex items-center justify-center bg-white text-primary text-[10px] rounded-full font-black animate-pulse">
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
                    <MultiSelect 
                      label="DNA-HPV (PEP)"
                      placeholder="SIM / NÃO"
                      options={SIM_NAO_OPTIONS}
                      value={filterDnaHpvPep}
                      onChange={setFilterDnaHpvPep}
                    />
                  </div>
                  <div className="space-y-2">
                    <MultiSelect 
                      label="Cito (Lab)"
                      placeholder="SIM / NÃO"
                      options={SIM_NAO_OPTIONS}
                      value={filterCitoLab}
                      onChange={setFilterCitoLab}
                    />
                  </div>
                  <div className="space-y-2">
                    <MultiSelect 
                      label="Cito (PEP)"
                      placeholder="SIM / NÃO"
                      options={SIM_NAO_OPTIONS}
                      value={filterCitoPep}
                      onChange={setFilterCitoPep}
                    />
                  </div>
                  <div className="space-y-2">
                    <MultiSelect 
                      label="DNA-HPV (GAL)"
                      placeholder="SIM / NÃO"
                      options={SIM_NAO_OPTIONS}
                      value={filterDnaHpvGal}
                      onChange={setFilterDnaHpvGal}
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
                        disabled={filterUnidade.length === 0 && (isAdmin || user?.role === 'cap')}
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
                        disabled={filterEquipe.length === 0 && (isAdmin || user?.role === 'cap' || user?.role === 'unidade')}
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
                          <InfoTooltip content="Data de registro do resultado do teste molecular de DNA-HPV no PEP (Prontuário Eletrônico do Paciente)." />
                        </div>
                        <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">(Data Registro)</span>
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
                        <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">(Data Cadastro)</span>
                      </div>
                    </th>
                    <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[180px]">
                      <div className="flex flex-col items-center gap-1">
                        <FileText className="w-4 h-4 text-blue-400/60" />
                        <div className="flex items-center gap-1.5">
                          <span>Cito (PEP)</span>
                          <InfoTooltip content="Data de coleta do exame citopatológico registrada no PEP (Prontuário Eletrônico do Paciente)." />
                        </div>
                        <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">(Data Coleta)</span>
                      </div>
                    </th>
                    <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[180px]">
                      <div className="flex flex-col items-center gap-1">
                        <TestTube className="w-4 h-4 text-blue-400/60" />
                        <div className="flex items-center gap-1.5">
                          <span>DNA-HPV (GAL)</span>
                          <InfoTooltip content="Data do resultado do teste molecular de DNA-HPV registrada no GAL (Gerenciador de Ambiente Laboratorial)." />
                        </div>
                        <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">(Data GAL)</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {isLoading ? (
                    <tr>
                      <td colSpan={isAdmin || user?.role === 'cap' || user?.role === 'unidade' || user?.role === 'equipe' || user?.role === 'microarea' ? 9 : 8} className="px-6 py-20 text-center text-on-surface-variant text-base font-medium italic">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                          <span className="text-xs font-black uppercase tracking-widest text-primary/40 mt-2">Sincronizando pacientes...</span>
                        </div>
                      </td>
                    </tr>
                  ) : pacientes.length === 0 ? (
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
                          <span className={`inline-block px-3.5 py-2 rounded-lg text-[11px] md:text-[12px] font-black uppercase tracking-tight shadow-sm ${paciente.dna_hpv !== '--' ? 'bg-orange-50 text-orange-700 border border-orange-100' : 'text-slate-300 italic'}`}>
                            {formatarData(paciente.dna_hpv)}
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
                    placeholder={modalEntravesInformadoPor ? "Selecione" : "Selecione quem informou primeiro"}
                    className="col-span-1 md:col-span-2"
                    options={ENTRAVES_IDENTIFICADOS_OPTIONS}
                    value={modalEntraves}
                    onChange={setModalEntraves}
                    showSearch={false}
                    disabled={!modalEntravesInformadoPor}
                    required={!!modalEntravesInformadoPor}
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
                        {activePatientForDetails.dna_hpv !== '--' && (
                          <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-black uppercase">DNA-HPV (GAL): {formatarData(activePatientForDetails.dna_hpv)}</span>
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
