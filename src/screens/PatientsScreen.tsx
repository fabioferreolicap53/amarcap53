import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { X, Search, AlertTriangle, Calendar, Phone, ClipboardList, MapPin, MessageSquare, Info, CheckCircle2, Building, TestTube, Microscope, SearchX, FileText, ChevronLeft, ChevronRight, Eye, Users } from 'lucide-react';
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
  alertas_rastreamento?: string;
  alertas?: string; 
}

interface PatientsScreenProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const ALERT_CONFIGS: Record<string, { label: string; icon: any; color: string; bg: string; description: string }> = {
  'PEP_MOLECULAR': {
    label: 'RESULTADO PEP MOLECULAR',
    icon: TestTube,
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    description: 'Identificado registro de resultado no PEP de teste molecular.'
  },
  'COLETA_MOLECULAR': {
    label: 'COLETA MOLECULAR',
    icon: TestTube,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 border-indigo-200',
    description: 'Identificado coleta/resultado de teste molecular.'
  },
  'PEP_CITO': {
    label: 'RESULTADO PEP CITO',
    icon: Microscope,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50 border-emerald-200',
    description: 'Identificado registro de resultado no PEP de cito.'
  },
  'COLETA_CITO': {
    label: 'COLETA CITO',
    icon: Microscope,
    color: 'text-teal-600',
    bg: 'bg-teal-50 border-teal-200',
    description: 'Identificado coleta/resultado de cito.'
  },
  'NAO_IDENTIFICADO': {
    label: 'SEM REGISTRO',
    icon: SearchX,
    color: 'text-rose-600',
    bg: 'bg-rose-50 border-rose-200',
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
      teste_molecular: formData.get('teste_molecular') || '',
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
    
    // Teste Molecular DNA-HPV
    if (p.dna_hpv && p.dna_hpv !== '--') return 'COLETA_MOLECULAR';
    
    // Cito registrado no PEP
    if (p.cito_pep && p.cito_pep !== '--') return 'PEP_CITO';
    
    // Cito Laboratório
    if (p.cito_lab && p.cito_lab !== '--') return 'COLETA_CITO';
    
    // Se não houver nenhum registro identificado em nenhum dos campos de data
    if ((!p.dna_hpv || p.dna_hpv === '--') && 
        (!p.cito_pep || p.cito_pep === '--') && 
        (!p.cito_lab || p.cito_lab === '--')) return 'NAO_IDENTIFICADO';
        
    return p.alertas_rastreamento || 'NORMAL';
  };

  useEffect(() => {
    const fetchPacientes = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        const options: any = { sort: 'nome' };
        if (!isAdmin) {
          options.filter = `unidade = "${user.unidade_saude}" && equipe = "${user.equipe}" && microarea = "${user.microarea}"`;
        }
        
        const resultList = await pb.collection('amarcap53_pacientes').getList(currentPage, pageSize, options);
        
        const pacientesFormatados = resultList.items.map(record => {
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
            alertas_rastreamento: record.alertas_rastreamento || '--',
          };
          
          // Sobrescreve o alerta com a lógica dinâmica (mantendo compatibilidade)
          p.alertas = determinarAlerta(p);
          
          return p;
        });

        setPacientes(pacientesFormatados);
        setTotalItems(resultList.totalItems);
      } catch (error) {
        console.error("Erro ao buscar pacientes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPacientes();
  }, [user, currentPage, isAdmin]);

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
          
          <div className="mb-8 md:mb-12">
            <h2 className="text-2xl md:text-[2rem] font-black text-primary mb-3 tracking-tight">Meus Pacientes</h2>
            <p className="text-on-surface-variant text-base md:text-lg font-medium max-w-3xl leading-relaxed">
              Gerencie o fluxo de acompanhamento e rastreio citopatológico. Utilize as ações para registrar novas interações e buscas ativas.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:gap-6 mb-8 md:mb-10">
            <div className="bg-surface-container-lowest p-6 md:p-8 rounded-2xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between border-l-[6px] border-primary gap-4">
              <div>
                <p className="text-xs md:text-sm font-black text-primary/60 uppercase tracking-[0.2em] mb-2">Total sob sua responsabilidade</p>
                <p className="text-4xl md:text-[3.5rem] font-black text-primary leading-none">
                  {pacientes.length} <span className="text-lg font-bold text-on-surface-variant ml-2 tracking-normal">Pacientes Ativos</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-2xl overflow-hidden shadow-[0px_20px_50px_rgba(0,0,0,0.06)] border border-outline-variant/15">
            <div className="w-full overflow-x-auto no-scrollbar">
              <table className="w-full text-center border-collapse table-auto min-w-[900px]">
                <thead>
                  <tr className="bg-[#001b3d] text-white">
                    <th className="px-4 py-6 text-xs font-black uppercase tracking-widest text-center sticky left-0 z-20 bg-[#001b3d]">AÇÃO</th>
                    <th className="px-4 py-6 text-xs font-black uppercase tracking-widest text-center">UNIDADE/EQUIPE</th>
                    <th className="px-4 py-6 text-xs font-black uppercase tracking-widest text-center">PACIENTE</th>
                    <th className="px-4 py-6 text-xs font-black uppercase tracking-widest text-center">IDADE</th>
                    <th className="px-4 py-6 text-xs font-black uppercase tracking-widest text-center">GRUPO</th>
                    <th className="px-4 py-6 text-xs font-black uppercase tracking-widest text-center">STATUS</th>
                    <th className="px-4 py-6 text-xs font-black uppercase tracking-widest text-center">CITO LAB</th>
                    <th className="px-4 py-6 text-xs font-black uppercase tracking-widest text-center">CITO PEP</th>
                    <th className="px-4 py-6 text-xs font-black uppercase tracking-widest text-center">DNA-HPV</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-20 text-center text-on-surface-variant text-base font-medium italic">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                          <span className="text-xs font-black uppercase tracking-widest text-primary/40 mt-2">Sincronizando pacientes...</span>
                        </div>
                      </td>
                    </tr>
                  ) : pacientes.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center opacity-30">
                          <SearchX className="w-16 h-16 mb-4" />
                          <p className="text-sm font-black uppercase tracking-widest">Nenhum registro encontrado</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pacientes.map((paciente) => (
                      <tr key={paciente.id} className="hover:bg-primary/[0.03] transition-all group">
                        <td className="px-8 py-6 text-center sticky left-0 z-10 bg-surface-container-lowest group-hover:bg-slate-50 transition-colors shadow-[4px_0_10px_rgba(0,0,0,0.03)]">
                          <div className="flex items-center justify-center gap-4">
                            <button 
                              onClick={() => handleOpenModal(paciente)}
                              className="h-10 px-5 bg-[#001b3d] text-white hover:bg-[#002b5c] rounded-[14px] text-[10px] font-black uppercase tracking-[0.15em] shadow-lg shadow-blue-900/20 transition-all active:scale-95 flex items-center gap-2 border border-white/10 group/acomp"
                            >
                              <ClipboardList className="w-4 h-4 text-blue-400 group-hover/acomp:scale-110 transition-transform" />
                              <span>Acomp.</span>
                            </button>
                            
                            <button 
                              onClick={() => handleOpenDetails(paciente)}
                              className="w-10 h-10 flex items-center justify-center rounded-[14px] bg-white border-2 border-slate-100 text-slate-400 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 transition-all shadow-sm group/eye"
                              title="Ver Detalhes"
                            >
                              <Eye className="w-4.5 h-4.5 group-hover/eye:scale-110 transition-transform" />
                            </button>
                          </div>
                        </td>

                        <td className="px-4 py-6 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <p className="text-[10px] font-black text-primary uppercase leading-tight break-words" title={paciente.unidade}>
                              {paciente.unidade}
                            </p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                              {paciente.equipe} • MA: {paciente.microarea}
                            </p>
                          </div>
                        </td>

                        <td className="px-4 py-6 text-center">
                          <div className="flex flex-col items-center gap-1">
                            <p className="text-[10px] font-black text-primary uppercase leading-tight break-words" title={paciente.nome}>
                              {paciente.nome}
                            </p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                              {paciente.cns}
                            </p>
                            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-tighter">
                              {formatarData(paciente.data_nascimento)}
                            </p>
                          </div>
                        </td>
                        
                        <td className="px-4 py-6 text-center">
                          <p className="text-[13px] font-black text-[#001b3d] leading-none">{paciente.idade}</p>
                        </td>

                        <td className="px-4 py-6 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-tighter ${paciente.grupo !== '--' ? 'bg-slate-100 text-slate-600 border border-slate-200' : 'text-slate-300 italic'}`}>
                            {paciente.grupo}
                          </span>
                        </td>

                        <td className="px-4 py-6 text-center">
                          {paciente.alertas && ALERT_CONFIGS[paciente.alertas] ? (
                            <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border shadow-sm ${ALERT_CONFIGS[paciente.alertas].bg}`}>
                              {(() => {
                                const Icon = ALERT_CONFIGS[paciente.alertas].icon;
                                return <Icon className={`w-3.5 h-3.5 ${ALERT_CONFIGS[paciente.alertas].color}`} />;
                              })()}
                              <span className={`text-[10px] font-black uppercase tracking-tight ${ALERT_CONFIGS[paciente.alertas].color}`}>
                                {ALERT_CONFIGS[paciente.alertas].label}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300 italic text-[10px] font-black uppercase tracking-tight">--</span>
                          )}
                        </td>
                        
                        <td className="px-4 py-6 text-center">
                          <span className={`inline-block px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-sm ${paciente.cito_lab !== '--' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'text-slate-300 italic'}`}>
                            {formatarData(paciente.cito_lab)}
                          </span>
                        </td>

                        <td className="px-4 py-6 text-center">
                          <span className={`inline-block px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-sm ${paciente.cito_pep !== '--' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'text-slate-300 italic'}`}>
                            {formatarData(paciente.cito_pep)}
                          </span>
                        </td>

                        <td className="px-4 py-6 text-center">
                          <span className={`inline-block px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-tight shadow-sm ${paciente.dna_hpv !== '--' ? 'bg-indigo-50 text-indigo-700 border border-indigo-100' : 'text-slate-300 italic'}`}>
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
                {/* Teste Molecular DNA-HPV */}
                <div className="space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <TestTube className="w-3.5 h-3.5" />
                    </div>
                    Teste Molecular DNA-HPV
                  </label>
                  <div className="relative">
                    <select name="teste_molecular" required className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none appearance-none cursor-pointer shadow-sm hover:border-primary/40">
                      <option value="" disabled selected>Selecione</option>
                      <option value="SIM">SIM</option>
                      <option value="NÃO">NÃO</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-on-surface-variant">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                {/* Data da Busca */}
                <div className="space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                    Data da Busca
                  </label>
                  <div className="relative">
                    <input 
                      name="data_busca"
                      required
                      className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none shadow-sm hover:border-primary/40" 
                      type="date" 
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
