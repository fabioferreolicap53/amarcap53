import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header';
import { X, Search, AlertTriangle, Calendar, Phone, ClipboardList, MapPin, MessageSquare, Info, CheckCircle2, Building, TestTube, Microscope, SearchX, FileText, ChevronLeft, ChevronRight, Eye, Users, Filter, RotateCcw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { pb } from '../lib/pocketbase';

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
  cito_laboratorio?: string; // Data (Novo campo)
  alertas_rastreamento?: string;
  alertas?: string; 
  total_acompanhamentos?: number;
}

interface PatientsScreenProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const DatePickerPTBR: React.FC<{ value: string; onChange: (val: string) => void }> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const days = [];
  const totalDays = getDaysInMonth(currentMonth.getFullYear(), currentMonth.getMonth());
  const firstDay = getFirstDayOfMonth(currentMonth.getFullYear(), currentMonth.getMonth());

  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let i = 1; i <= totalDays; i++) days.push(i);

  const handleDateSelect = (day: number) => {
    const selected = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    const d = String(selected.getDate()).padStart(2, '0');
    const m = String(selected.getMonth() + 1).padStart(2, '0');
    const y = selected.getFullYear();
    onChange(`${d}/${m}/${y}`);
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, '');
    if (val.length > 8) val = val.slice(0, 8);
    
    if (val.length > 4) {
      val = `${val.slice(0, 2)}/${val.slice(2, 4)}/${val.slice(4)}`;
    } else if (val.length > 2) {
      val = `${val.slice(0, 2)}/${val.slice(2)}`;
    }
    
    onChange(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (value === '' || value === '--' || value.length === 10) {
        setIsOpen(false);
        (e.target as HTMLInputElement).blur();
      }
    }
  };

  const handleBlur = () => {
    // Força salvamento ao sair do campo se a data for válida ou vazia
    if (value === '' || value === '--' || value.length === 10) {
      onChange(value);
    }
  };

  const setQuickDate = (offset: number | null) => {
    if (offset === null) {
      onChange('');
    } else {
      const date = new Date();
      date.setDate(date.getDate() + offset);
      const d = String(date.getDate()).padStart(2, '0');
      const m = String(date.getMonth() + 1).padStart(2, '0');
      const y = date.getFullYear();
      onChange(`${d}/${m}/${y}`);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block w-full max-w-[150px]" ref={containerRef}>
      <div 
        className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-[11px] md:text-[12px] font-black text-[#001b3d] flex items-center justify-between gap-2 hover:border-primary/40 hover:bg-white transition-all shadow-sm focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary focus-within:bg-white"
      >
        <input
          type="text"
          value={value === '--' ? '' : value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          placeholder="DD/MM/YYYY"
          className="bg-transparent border-none outline-none w-full text-[#001b3d] placeholder:text-slate-300 font-black uppercase tracking-tight"
          onFocus={() => setIsOpen(true)}
        />
        <Calendar 
          className="w-4 h-4 text-slate-400 cursor-pointer hover:text-primary transition-colors shrink-0" 
          onClick={() => setIsOpen(!isOpen)}
        />
      </div>

      {isOpen && (
        <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 bg-white border border-slate-200 rounded-2xl shadow-[0px_20px_50px_rgba(0,0,0,0.15)] z-[100] p-4 w-[240px] animate-in fade-in zoom-in-95 duration-200">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button 
              onClick={() => setQuickDate(0)}
              className="py-1.5 px-3 bg-primary/5 hover:bg-primary/10 text-primary text-[9px] font-black uppercase rounded-lg transition-all border border-primary/10"
            >
              Hoje
            </button>
            <button 
              onClick={() => setQuickDate(null)}
              className="py-1.5 px-3 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[9px] font-black uppercase rounded-lg transition-all border border-rose-100"
            >
              Limpar
            </button>
          </div>
          <div className="flex items-center justify-between mb-4 px-1">
            <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors"><ChevronLeft className="w-4 h-4 text-primary" /></button>
            <span className="text-[11px] font-black uppercase text-primary tracking-widest">{months[currentMonth.getMonth()]} {currentMonth.getFullYear()}</span>
            <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className="p-1.5 hover:bg-slate-100 rounded-xl transition-colors"><ChevronRight className="w-4 h-4 text-primary" /></button>
          </div>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {daysOfWeek.map(d => <div key={d} className="text-[9px] font-black text-slate-400 uppercase text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, i) => (
              <div 
                key={i} 
                onClick={() => day && handleDateSelect(day)}
                className={`
                  text-[10px] font-black h-7 flex items-center justify-center rounded-lg transition-all
                  ${day ? 'cursor-pointer hover:bg-primary/10 hover:text-primary' : ''}
                  ${day && value === `${String(day).padStart(2, '0')}/${String(currentMonth.getMonth() + 1).padStart(2, '0')}/${currentMonth.getFullYear()}` ? 'bg-primary !text-white shadow-md shadow-primary/20' : 'text-slate-600'}
                `}
              >
                {day}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ALERT_CONFIGS: Record<string, { label: string; icon: any; color: string; bg: string; description: string }> = {
  'PEP_MOLECULAR': {
    label: 'IDENTIFICADO REGISTRO DE RESULTADO NO PEP DE TESTE MOLECULAR',
    icon: TestTube,
    color: 'text-white',
    bg: 'bg-blue-600 border-blue-700 shadow-md shadow-blue-600/20',
    description: 'Identificado registro de resultado no PEP de teste molecular.'
  },
  'COLETA_MOLECULAR': {
    label: 'IDENTIFICADO COLETA/RESULTADO DE TESTE MOLECULAR.',
    icon: TestTube,
    color: 'text-white',
    bg: 'bg-orange-500 border-orange-600 shadow-md shadow-orange-500/20',
    description: 'Identificado coleta/resultado de teste molecular.'
  },
  'PEP_CITO': {
    label: 'IDENTIFICADO REGISTRO DE RESULTADO NO PEP DE CITO.',
    icon: Microscope,
    color: 'text-white',
    bg: 'bg-emerald-600 border-emerald-700 shadow-md shadow-emerald-600/20',
    description: 'Identificado registro de resultado no PEP de cito.'
  },
  'COLETA_CITO': {
    label: 'IDENTIFICADO COLETA/ RESULTADO DE CITO',
    icon: Microscope,
    color: 'text-white',
    bg: 'bg-yellow-500 border-yellow-600 shadow-md shadow-yellow-500/20',
    description: 'Identificado coleta/resultado de cito.'
  },
  'NAO_IDENTIFICADO': {
    label: 'NÃO IDENTIFICADO COLETA OU RESULTADO DE EXAME DE RASTREAMENTO',
    icon: SearchX,
    color: 'text-white',
    bg: 'bg-red-600 border-red-700 shadow-md shadow-red-600/20',
    description: 'Não identificado coleta ou resultado de exame de rastreamento.'
  },
  'URGENTE': {
    label: 'URGENTE',
    icon: AlertTriangle,
    color: 'text-white',
    bg: 'bg-error shadow-[0_2px_8px_rgba(185,28,28,0.4)]',
    description: 'Ação imediata recomendada para este caso.'
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

  // Estados para Busca e Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterGrupo, setFilterGrupo] = useState('ALL');
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
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveFollowUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPaciente || !user) return;
    
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    
    const data = {
      paciente: selectedPaciente.id,
      profissional: user.id,
      data_busca: formData.get('data_busca') || '',
      tipo_busca: formData.get('tipo_busca') || '',
      tipo_contato: formData.get('tipo_contato') || '',
      situacao_pos_busca: formData.get('situacao_pos_busca') || '',
      entraves_identificados: formData.get('entraves_identificados') || '',
      observacoes: formData.get('observacoes') || '',
    };

    try {
      await pb.collection('amarcap53_acompanhamentos').create(data);
      alert('Acompanhamento registrado com sucesso!');
      handleCloseModal();
    } catch (error) {
      console.error('Erro ao salvar acompanhamento:', error);
      alert('Erro ao salvar o acompanhamento. Verifique se a coleção foi criada no PocketBase.');
    } finally {
      setIsSaving(false);
    }
  };

  const determinarAlerta = (p: any) => {
    // Ordem de prioridade baseada na eficiência da identificação
    if (p.alertas_rastreamento?.toUpperCase().includes('URGENTE')) return 'URGENTE';
    
    // 1. RESULTADO DE DNA- HPV REGISTRADO EM PRONTUÁRIO (DATA DO REGISTRO) -> Azul
    // Campo interativo: cito_laboratorio
    if (p.cito_laboratorio && p.cito_laboratorio !== '--' && p.cito_laboratorio !== '') return 'PEP_MOLECULAR';
    
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

  useEffect(() => {
    const fetchPacientes = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        const options: any = { sort: 'nome' };
        
        // Filtros baseados no usuário logado
        let filterStr = '';
        if (!isAdmin) {
          filterStr = `unidade = "${user.unidade_saude}" && equipe = "${user.equipe}" && microarea = ${parseInt(user.microarea)}`;
        }

        // Filtro de Busca (Nome ou CNS)
        if (searchTerm) {
          const searchFilter = `(nome ~ "${searchTerm}" || cns ~ "${searchTerm}")`;
          filterStr = filterStr ? `${filterStr} && ${searchFilter}` : searchFilter;
        }

        // Filtro de Grupo
        if (filterGrupo !== 'ALL') {
          const grupoFilter = `grupo = "${filterGrupo}"`;
          filterStr = filterStr ? `${filterStr} && ${grupoFilter}` : grupoFilter;
        }

        // Filtro de Status (Alerta)
        // Como o status é calculado dinamicamente no front, o filtro de status idealmente seria no front
        // Mas para manter a paginação, vamos aplicar os filtros de campos relacionados se possível
        // Por simplicidade e eficiência com paginação, filtramos o que dá no PocketBase
        
        options.filter = filterStr;
        
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
            cito_laboratorio: formatarData(record.cito_laboratorio) || '--',
            alertas_rastreamento: record.alertas_rastreamento || '--',
            total_acompanhamentos: count,
          };
          
          p.alertas = determinarAlerta(p);
          return p;
        });

        // Filtro de Status no Frontend (após calcular o status)
        if (filterStatus !== 'ALL') {
          pacientesFormatados = pacientesFormatados.filter(p => p.alertas === filterStatus);
        }

        setPacientes(pacientesFormatados);
        setTotalItems(resultList.totalItems);
      } catch (error) {
        console.error("Erro ao buscar pacientes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPacientes();
  }, [user, currentPage, isAdmin, searchTerm, filterStatus, filterGrupo]);

  const resetFilters = () => {
    setSearchTerm('');
    setFilterStatus('ALL');
    setFilterGrupo('ALL');
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
                    isFilterVisible || filterStatus !== 'ALL' || filterGrupo !== 'ALL'
                      ? 'bg-primary text-white border-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]' 
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  <Filter className="w-5 h-5" />
                  <span>Filtros</span>
                  {(filterStatus !== 'ALL' || filterGrupo !== 'ALL') && (
                    <div className="w-6 h-6 flex items-center justify-center bg-white text-primary text-[10px] rounded-full font-black animate-pulse">
                      {(filterStatus !== 'ALL' ? 1 : 0) + (filterGrupo !== 'ALL' ? 1 : 0)}
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
              <div className="bg-white p-8 rounded-3xl shadow-2xl border border-primary/5 animate-in slide-in-from-top-6 fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {/* Filtro de Status */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                      <Info className="w-3.5 h-3.5" />
                      Status de Rastreamento
                    </label>
                    <select 
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                      className="w-full p-4 bg-surface-container-low border-2 border-transparent rounded-2xl text-sm font-bold text-on-surface outline-none focus:border-primary/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="ALL">Todos os Status</option>
                      {Object.entries(ALERT_CONFIGS).map(([key, config]) => (
                        <option key={key} value={key}>{config.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Filtro de Grupo */}
                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                      <Users className="w-3.5 h-3.5" />
                      Grupo de Idade
                    </label>
                    <select 
                      value={filterGrupo}
                      onChange={(e) => setFilterGrupo(e.target.value)}
                      className="w-full p-4 bg-surface-container-low border-2 border-transparent rounded-2xl text-sm font-bold text-on-surface outline-none focus:border-primary/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="ALL">Todos os Grupos</option>
                      <option value="25 a 64 anos">25 a 64 anos</option>
                      <option value="Fora da faixa etária">Fora da faixa etária</option>
                    </select>
                  </div>

                  {/* Botões de Ação */}
                  <div className="flex items-end gap-4">
                    <button 
                      onClick={resetFilters}
                      className="flex-1 flex items-center justify-center gap-2 py-4 bg-surface-container-high text-on-surface-variant text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-surface-container-highest transition-all duration-300"
                    >
                      <RotateCcw className="w-4 h-4" />
                      Resetar
                    </button>
                    <button 
                      onClick={() => setIsFilterVisible(false)}
                      className="flex-1 py-4 bg-primary text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all duration-300 shadow-lg shadow-primary/20"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_20px_50px_rgba(0,0,0,0.06)] border border-outline-variant/15">
            <div className="w-full overflow-x-auto custom-scrollbar-horizontal">
              <table className="w-full text-center border-collapse">
                <thead>
                  <tr className="bg-[#001b3d] border-b border-white/10 shadow-sm">
                    <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[200px] border-r border-white/5">
                      <div className="flex flex-col items-center gap-1">
                        <Users className="w-4 h-4 text-blue-400/60" />
                        <span>Paciente</span>
                      </div>
                    </th>
                    {isAdmin && (
                      <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[180px] border-r border-white/5">
                        <div className="flex flex-col items-center gap-1">
                          <Building className="w-4 h-4 text-blue-400/60" />
                          <span>Unidade/Equipe</span>
                        </div>
                      </th>
                    )}
                    <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[120px] border-r border-white/5">
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
                    <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[180px] border-r border-white/5">
                      <div className="flex flex-col items-center gap-1">
                        <TestTube className="w-4 h-4 text-blue-400/60" />
                        <span>DNA-HPV (PEP)</span>
                        <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">(Data Registro)</span>
                      </div>
                    </th>
                    <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[110px] border-r border-white/5">
                      <div className="flex flex-col items-center gap-1">
                        <Calendar className="w-4 h-4 text-blue-400/60" />
                        <span>Idade/Grupo</span>
                      </div>
                    </th>
                    <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[180px] border-r border-white/5">
                      <div className="flex flex-col items-center gap-1">
                        <Microscope className="w-4 h-4 text-blue-400/60" />
                        <span>Cito (Lab)</span>
                        <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">(Data Cadastro)</span>
                      </div>
                    </th>
                    <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[180px] border-r border-white/5">
                      <div className="flex flex-col items-center gap-1">
                        <FileText className="w-4 h-4 text-blue-400/60" />
                        <span>Cito (PEP)</span>
                        <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">(Data Coleta)</span>
                      </div>
                    </th>
                    <th className="px-4 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center w-[180px]">
                      <div className="flex flex-col items-center gap-1">
                        <TestTube className="w-4 h-4 text-blue-400/60" />
                        <span>DNA-HPV (Solic.)</span>
                        <span className="text-[8px] text-blue-200/40 normal-case tracking-normal">(Data Solicitação)</span>
                      </div>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {isLoading ? (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 9} className="px-6 py-20 text-center text-on-surface-variant text-base font-medium italic">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                          <span className="text-xs font-black uppercase tracking-widest text-primary/40 mt-2">Sincronizando pacientes...</span>
                        </div>
                      </td>
                    </tr>
                  ) : pacientes.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 9} className="px-6 py-20 text-center">
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
                        <td className="px-4 py-6 text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <p className="text-[11px] md:text-[13px] font-black text-primary uppercase leading-tight break-words" title={paciente.nome}>
                              {paciente.nome}
                            </p>
                            <p className="text-[9px] md:text-[11px] font-bold text-slate-500 uppercase tracking-tighter leading-none">
                              {paciente.cns}
                            </p>
                            <p className="text-[9px] md:text-[11px] font-bold text-slate-500 uppercase tracking-tighter leading-none">
                              {formatarData(paciente.data_nascimento)}
                            </p>
                          </div>
                        </td>

                        {/* 2. UNIDADE/EQUIPE (Admin Only) */}
                        {isAdmin && (
                          <td className="px-4 py-6 text-center">
                            <div className="flex flex-col items-center gap-1.5">
                              <p className="text-[11px] md:text-[13px] font-black text-primary uppercase leading-tight break-words" title={paciente.unidade}>
                                {paciente.unidade}
                              </p>
                              <p className="text-[10px] md:text-[12px] font-bold text-slate-500 uppercase tracking-tighter">
                                {paciente.equipe}
                              </p>
                              <p className="text-[10px] md:text-[12px] font-bold text-slate-500 uppercase tracking-tighter">
                                MA: {paciente.microarea}
                              </p>
                            </div>
                          </td>
                        )}

                        {/* 3. STATUS */}
                        <td className="px-2 py-6 text-center">
                          {paciente.alertas && ALERT_CONFIGS[paciente.alertas] ? (
                            <div className={`inline-flex flex-col items-center justify-center px-2 py-2 rounded-lg border border-white/10 shadow-lg min-h-[50px] w-full max-w-[140px] mx-auto ${ALERT_CONFIGS[paciente.alertas].bg}`}>
                              <span className={`text-[8px] md:text-[10px] font-black uppercase leading-tight tracking-normal text-center ${ALERT_CONFIGS[paciente.alertas].color}`}>
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
                                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-5 px-1 flex items-center justify-center bg-blue-500 text-white text-[9px] font-black rounded-full border-2 border-[#001b3d] shadow-md z-10">
                                  {paciente.total_acompanhamentos}
                                </span>
                              )}
                            </button>
                          </div>
                        </td>

                        {/* 6. RESULTADO DE DNA- HPV REGISTRADO EM PRONTUÁRIO */}
                        <td className="px-4 py-6 text-center">
                          <DatePickerPTBR
                            value={paciente.cito_laboratorio || ''}
                            onChange={async (displayDate) => {
                              // Atualização local imediata com recalculo de status
                              setPacientes(prev => prev.map(p => {
                                if (p.id === paciente.id) {
                                  const updated = { ...p, cito_laboratorio: displayDate === '' ? '--' : displayDate };
                                  updated.alertas = determinarAlerta(updated);
                                  return updated;
                                }
                                return p;
                              }));
                              
                              // Salva no banco apenas se estiver completo ou vazio
                              if (displayDate === '' || displayDate === '--' || displayDate.length === 10) {
                                try {
                                  const valueToSave = displayDate === '--' ? '' : displayDate;
                                  await pb.collection('amarcap53_pacientes').update(paciente.id, { cito_laboratorio: valueToSave });
                                } catch (err) {
                                  console.error('Erro ao atualizar data no PocketBase:', err);
                                }
                              }
                            }}
                          />
                        </td>

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
        </div>
      </div>

      {/* Modal Premium */}
      {isModalOpen && selectedPaciente && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-[0px_24px_48px_rgba(0,0,0,0.15)] overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
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
                {/* Data da Busca */}
                <div className="space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                    Data da Busca
                  </label>
                  <div className="relative">
                    <input type="hidden" name="data_busca" value={selectedDate} />
                    <DatePickerPTBR 
                      value={selectedDate} 
                      onChange={(val) => setSelectedDate(val)} 
                    />
                  </div>
                </div>

                {/* Tipo de Busca */}
                <div className="space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <Search className="w-3.5 h-3.5" />
                    </div>
                    Tipo de Busca
                  </label>
                  <div className="relative">
                    <select name="tipo_busca" required className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none appearance-none cursor-pointer shadow-sm hover:border-primary/40">
                      <option value="" disabled selected>Selecione</option>
                      <option value="1 - Busca ativa- Visita domiciliar registrada em prontuário">1 - Busca ativa- Visita domiciliar registrada em prontuário</option>
                      <option value="2 - Busca ativa - Contato Telefônico (ligação) registrada em prontuário">2 - Busca ativa - Contato Telefônico (ligação) registrada em prontuário</option>
                      <option value="3 - Busca ativa - Mensagem registrada em prontuário">3 - Busca ativa - Mensagem registrada em prontuário</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-on-surface-variant">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                {/* Tipo de Contato */}
                <div className="space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    Tipo de Contato
                  </label>
                  <div className="relative">
                    <select name="tipo_contato" required className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none appearance-none cursor-pointer shadow-sm hover:border-primary/40">
                      <option value="" disabled selected>Selecione uma modalidade</option>
                      <option value="Contato direto (conversa)">Contato direto (conversa)</option>
                      <option value="Contato indireto (mensagem)">Contato indireto (mensagem)</option>
                      <option value="Não houve contato ( não localizada, ligação não atendida...)">Não houve contato ( não localizada, ligação não atendida...)</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-on-surface-variant">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                {/* Situação Pós Busca */}
                <div className="col-span-1 md:col-span-2 space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <Info className="w-3.5 h-3.5" />
                    </div>
                    Situação Pós Busca Ativa
                  </label>
                  <div className="relative">
                    <select name="situacao_pos_busca" required className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none appearance-none cursor-pointer shadow-sm hover:border-primary/40">
                      <option value="" disabled selected>Selecione o desfecho da busca</option>
                      <option value="1- Agendamento após contato direto">1- Agendamento após contato direto</option>
                      <option value="2 - Convite para demanda livre">2 - Convite para demanda livre</option>
                      <option value="3 - Citopatológico realizado nos últimos 3 anos, em outra unidade do SUS com fornecimento do laudo e resultado registrado no PEP">3 - Citopatológico realizado nos últimos 3 anos, em outra unidade do SUS com fornecimento do laudo e resultado registrado no PEP</option>
                      <option value="4 - Citopatológico realizado nos últimos 3 anos, em outra unidade da rede privada com fornecimento do laudo e resultado registrado no PEP">4 - Citopatológico realizado nos últimos 3 anos, em outra unidade da rede privada com fornecimento do laudo e resultado registrado no PEP</option>
                      <option value="5 - Teste molecular/ DNA-HPV oncogênico realizado nos últimos 5 anos, em outra unidade do SUS com resultado registrado no PEP">5 - Teste molecular/ DNA-HPV oncogênico realizado nos últimos 5 anos, em outra unidade do SUS com resultado registrado no PEP</option>
                      <option value="6 - Teste molecular/ DNA-HPV oncogênico realizado nos últimos 5 anos, em outra unidade da rede privada com resultado registrado no PEP">6 - Teste molecular/ DNA-HPV oncogênico realizado nos últimos 5 anos, em outra unidade da rede privada com resultado registrado no PEP</option>
                      <option value="7 - Mudança de território (situação atualizada no PEP)">7 - Mudança de território (situação atualizada no PEP)</option>
                      <option value="8 - Óbito (situação atualizada no PEP)">8 - Óbito (situação atualizada no PEP)</option>
                      <option value="9 - Não localizada">9 - Não localizada</option>
                      <option value="10 - Recusa">10 - Recusa</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-on-surface-variant">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                {/* Entraves Identificados */}
                <div className="col-span-1 md:col-span-2 space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    Entraves Identificados
                  </label>
                  <div className="relative">
                    <select name="entraves_identificados" className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none appearance-none cursor-pointer shadow-sm hover:border-primary/40">
                      <option value="" disabled selected>Selecione (Opcional)</option>
                      <option value="1 - Horários incompatíveis com a rotina de trabalho">1 - Horários incompatíveis com a rotina de trabalho</option>
                      <option value="2 - Vergonha ou constrangimento durante o exame">2 - Vergonha ou constrangimento durante o exame</option>
                      <option value="3 - Ideia equivocada sobre a necessidade de fazer exame">3 - Ideia equivocada sobre a necessidade de fazer exame</option>
                      <option value="4 - Faz o rastreamento pela rede privada">4 - Faz o rastreamento pela rede privada</option>
                      <option value="5 - Dificuldade de locomoção ( ex: acamada)">5 - Dificuldade de locomoção ( ex: acamada)</option>
                      <option value="6 - Distância da Unidade">6 - Distância da Unidade</option>
                      <option value="7 - Se recusa a fazer o exame com o profissional da equipe">7 - Se recusa a fazer o exame com o profissional da equipe</option>
                      <option value="8 - Esquece a data do agendamento">8 - Esquece a data do agendamento</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-on-surface-variant">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

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
      {isDetailsModalOpen && patientForDetails && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[110] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-2xl shadow-[0px_24px_48px_rgba(0,0,0,0.15)] overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
            <div className="bg-gradient-to-r from-[#001b3d] to-[#002b5c] px-6 py-5 flex justify-between items-center">
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

            <div className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">Nome Completo</p>
                    <p className="text-sm font-bold text-primary">{patientForDetails.nome}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">Cartão Nacional de Saúde (CNS)</p>
                    <code className="text-xs font-bold text-on-surface-variant bg-surface-container-high px-2 py-1 rounded">{patientForDetails.cns}</code>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">Data de Nascimento / Idade</p>
                    <p className="text-sm font-bold text-primary">{formatarData(patientForDetails.data_nascimento)} ({patientForDetails.idade} anos)</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">Grupo</p>
                    <p className="text-sm font-bold text-primary">{patientForDetails.grupo}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">Unidade de Saúde</p>
                    <p className="text-sm font-bold text-primary">{patientForDetails.unidade}</p>
                  </div>
                  <div className="flex gap-8">
                    <div>
                      <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">Equipe</p>
                      <p className="text-sm font-bold text-primary">{patientForDetails.equipe}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-1">Microárea</p>
                      <p className="text-sm font-bold text-primary">{patientForDetails.microarea}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-outline-variant/10">
                    <p className="text-[10px] font-black text-primary/50 uppercase tracking-widest mb-2">Status de Rastreamento</p>
                    <div className="flex flex-wrap gap-2">
                      {patientForDetails.cito_lab !== '--' && (
                        <span className="px-2 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-black">CITO LAB: {formatarData(patientForDetails.cito_lab)}</span>
                      )}
                      {patientForDetails.cito_pep !== '--' && (
                        <span className="px-2 py-1 rounded-md bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-black">CITO PEP: {formatarData(patientForDetails.cito_pep)}</span>
                      )}
                      {patientForDetails.dna_hpv !== '--' && (
                        <span className="px-2 py-1 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-black">DNA-HPV: {formatarData(patientForDetails.dna_hpv)}</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {patientForDetails.alertas_rastreamento && patientForDetails.alertas_rastreamento !== '--' && (
                <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-[10px] font-black text-amber-700 uppercase tracking-widest mb-1">Observações de Alerta (Coluna N)</p>
                  <p className="text-xs font-bold text-amber-900">{patientForDetails.alertas_rastreamento}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-outline-variant/10 bg-surface-container-lowest flex justify-end">
              <button onClick={handleCloseDetails} className="px-8 py-2.5 rounded-xl text-sm font-black text-white bg-[#001b3d] shadow-lg hover:shadow-xl transition-all active:scale-95">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
