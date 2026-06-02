import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { TrendingUp, BadgeCheck, Search, Filter, Download, Phone, Home, FileText, Eye, ChevronLeft, ChevronRight, Edit, Trash2, X, ClipboardList, Calendar, Info, Building, AlertTriangle, MessageSquare, CheckCircle2, RotateCcw, Users } from 'lucide-react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../contexts/AuthContext';
import { DatePickerPTBR } from './PatientsScreen';

interface FollowUpsScreenProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const FollowUpsScreen: React.FC<FollowUpsScreenProps> = ({ activeTab, setActiveTab }) => {
  const { user } = useAuth();
  const [acompanhamentos, setAcompanhamentos] = useState<Acompanhamento[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal de edição state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAcompanhamento, setSelectedAcompanhamento] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Estados para Busca e Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [filterTipoBusca, setFilterTipoBusca] = useState('ALL');

  useEffect(() => {
    const fetchAcompanhamentos = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        // Expandimos o paciente para pegar o nome e cns
        const records = await pb.collection('amarcap53_acompanhamentos').getFullList({
          sort: '-created',
          expand: 'paciente',
          filter: `profissional = "${user.id}"`
        });
        setAcompanhamentos(records);
      } catch (error) {
        console.error('Erro ao buscar acompanhamentos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAcompanhamentos();
  }, [user]);

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
        const date = new Date(acompToEdit.data_busca);
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        dataBuscaFormatada = `${d}/${m}/${y}`;
      }

      setSelectedAcompanhamento({
        ...acompToEdit,
        data_busca_formatada: dataBuscaFormatada
      });
      setIsEditModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsEditModalOpen(false);
    setSelectedAcompanhamento(null);
  };

  const handleSaveEdit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedAcompanhamento) return;
    
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    
    const data = {
      teste_molecular: formData.get('teste_molecular') || '',
      tipo_busca: formData.get('tipo_busca') || '',
      data_busca: formData.get('data_busca') || '',
      tipo_contato: formData.get('tipo_contato') || '',
      situacao_pos_busca: formData.get('situacao_pos_busca') || '',
      entraves_identificados: formData.get('entraves_identificados') || '',
      observacoes: formData.get('observacoes') || '',
    };

    try {
      const record = await pb.collection('amarcap53_acompanhamentos').update(selectedAcompanhamento.id, data);
      
      // Atualiza o estado local para refletir as mudanças na tabela
      setAcompanhamentos(prev => prev.map(item => {
        if (item.id === selectedAcompanhamento.id) {
          return { ...item, ...data };
        }
        return item;
      }));
      
      alert('Acompanhamento atualizado com sucesso!');
      handleCloseModal();
    } catch (error) {
      console.error('Erro ao atualizar acompanhamento:', error);
      alert('Erro ao atualizar o registro.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <Header 
        title="AMAR - ACOMPANHAMENTO DA MULHER NAS AÇÕES DE RASTREIO" 
        pageTitle="Acompanhamentos"
        subtitle={user ? `Unidade de Saúde: ${user.unidade_saude}` : 'Carregando...'} 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 no-scrollbar">
        <div className="max-w-7xl mx-auto">
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
            <div className="bg-gradient-to-br from-[#001b3d] to-[#002b5c] p-10 rounded-[2.5rem] shadow-2xl col-span-1 md:col-span-2 lg:col-span-4 flex flex-col md:flex-row items-center justify-between gap-10 relative overflow-hidden group">
              {/* Efeitos de luz no fundo */}
              <div className="absolute -top-24 -right-24 w-80 h-80 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-1000"></div>
              <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-1000"></div>

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-10 w-full md:w-auto">
                <div className="w-24 h-24 rounded-[2rem] bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner group-hover:scale-105 transition-transform duration-500">
                  <ClipboardList className="w-12 h-12 text-white" />
                </div>
                <div className="text-center md:text-left">
                  <p className="text-xs md:text-sm font-black text-white/40 uppercase tracking-[0.4em] mb-3">Histórico de Ações</p>
                  <p className="text-4xl md:text-[3.5rem] font-black text-white leading-none tracking-tighter">
                    {acompanhamentos.length} <span className="text-lg font-bold text-white/60 ml-2 tracking-normal uppercase">Registros</span>
                  </p>
                </div>
              </div>

              {/* Botões de Ação Criativos */}
              <div className="relative z-10 flex items-center gap-4 w-full md:w-auto justify-center md:justify-end">
                <button 
                  onClick={() => setIsSearchVisible(!isSearchVisible)}
                  className={`w-16 h-16 flex items-center justify-center rounded-[1.5rem] transition-all duration-500 border ${
                    isSearchVisible 
                      ? 'bg-white text-primary border-white shadow-[0_0_25px_rgba(255,255,255,0.4)]' 
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                  title="Ativar Busca"
                >
                  <Search className={`w-7 h-7 transition-transform duration-500 ${isSearchVisible ? 'scale-110' : ''}`} />
                </button>

                <button 
                  onClick={() => setIsFilterVisible(!isFilterVisible)}
                  className={`flex items-center gap-4 px-10 h-16 rounded-[1.5rem] text-sm font-black uppercase tracking-widest transition-all duration-500 border ${
                    isFilterVisible || filterTipoBusca !== 'ALL'
                      ? 'bg-primary text-white border-primary shadow-[0_0_25px_rgba(var(--primary-rgb),0.4)]' 
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  <Filter className="w-6 h-6" />
                  <span>Filtros</span>
                  {filterTipoBusca !== 'ALL' && (
                    <div className="w-7 h-7 flex items-center justify-center bg-white text-primary text-[11px] rounded-full font-black animate-pulse">
                      1
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Cards de Resumo Estilizados */}
            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-primary/5 hover:border-primary/20 transition-all duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
                  <BadgeCheck className="w-6 h-6 text-emerald-500" />
                </div>
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest leading-none">Contatos<br/>Realizados</p>
              </div>
              <p className="text-3xl font-black text-primary">
                {acompanhamentos.filter(a => a.tipo_contato && !a.tipo_contato.includes('Não houve contato')).length}
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
                {acompanhamentos.filter(a => a.tipo_contato && a.tipo_contato.includes('Não houve contato')).length}
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
                {acompanhamentos.filter(a => a.situacao_pos_busca && a.situacao_pos_busca.includes('1- Agendamento')).length}
              </p>
            </div>

            <div className="bg-white p-8 rounded-[2rem] shadow-xl border border-primary/5 hover:border-primary/20 transition-all duration-300">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-purple-500" />
                </div>
                <p className="text-[10px] font-black text-on-surface-variant uppercase tracking-widest leading-none">Taxa de<br/>Conversão</p>
              </div>
              <p className="text-3xl font-black text-primary">
                {acompanhamentos.length > 0 
                  ? Math.round((acompanhamentos.filter(a => a.situacao_pos_busca && a.situacao_pos_busca.includes('1- Agendamento')).length / acompanhamentos.length) * 100) 
                  : 0}%
              </p>
            </div>
          </div>

          {/* Barra de Busca Animada */}
          {isSearchVisible && (
            <div className="bg-white p-6 rounded-[2rem] shadow-xl border border-primary/5 mb-6 animate-in slide-in-from-top-6 fade-in duration-500">
              <div className="relative group">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-primary/30 group-focus-within:text-primary transition-colors" />
                <input 
                  type="text" 
                  placeholder="Buscar paciente ou data específica..." 
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
            <div className="bg-white p-8 rounded-[2rem] shadow-2xl border border-primary/5 mb-6 animate-in slide-in-from-top-6 fade-in duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-3">
                  <label className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                    <FileText className="w-3.5 h-3.5" />
                    Tipo de Busca
                  </label>
                  <select 
                    value={filterTipoBusca}
                    onChange={(e) => setFilterTipoBusca(e.target.value)}
                    className="w-full p-4 bg-surface-container-low border-2 border-transparent rounded-2xl text-sm font-bold text-on-surface outline-none focus:border-primary/20 transition-all appearance-none cursor-pointer"
                  >
                    <option value="ALL">Todos os Tipos</option>
                    <option value="Visita domiciliar">Visita domiciliar</option>
                    <option value="Contato Telefônico">Contato Telefônico</option>
                    <option value="Mensagem">Mensagem</option>
                  </select>
                </div>

                <div className="flex items-end gap-4 lg:col-span-2">
                  <button 
                    onClick={() => {setFilterTipoBusca('ALL'); setSearchTerm('');}}
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

          <div className="bg-white rounded-[2rem] overflow-hidden shadow-2xl border border-outline-variant/10">
            <div className="overflow-x-auto custom-scrollbar-horizontal">
              <table className="w-full text-center border-collapse min-w-[900px] lg:min-w-full">
                <thead>
                  <tr className="bg-[#001b3d] border-b border-white/10 shadow-sm">
                    <th className="px-6 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center border-r border-white/5">
                      <div className="flex flex-col items-center gap-1">
                        <Users className="w-4 h-4 text-blue-400/60" />
                        <span>Paciente</span>
                      </div>
                    </th>
                    <th className="px-6 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center border-r border-white/5">
                      <div className="flex flex-col items-center gap-1">
                        <Calendar className="w-4 h-4 text-blue-400/60" />
                        <span>Data da Ação</span>
                      </div>
                    </th>
                    <th className="px-6 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center border-r border-white/5">
                      <div className="flex flex-col items-center gap-1">
                        <Phone className="w-4 h-4 text-blue-400/60" />
                        <span>Tipo de Contato</span>
                      </div>
                    </th>
                    <th className="px-6 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center border-r border-white/5">
                      <div className="flex flex-col items-center gap-1">
                        <BadgeCheck className="w-4 h-4 text-blue-400/60" />
                        <span>Desfecho</span>
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
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center gap-4 opacity-30">
                          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                          <span className="text-xs font-black uppercase tracking-widest text-primary mt-2">Sincronizando registros...</span>
                        </div>
                      </td>
                    </tr>
                  ) : acompanhamentos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-20 text-center">
                        <div className="flex flex-col items-center opacity-30">
                          <ClipboardList className="w-16 h-16 mb-4" />
                          <p className="text-sm font-black uppercase tracking-widest">Nenhum registro encontrado</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    acompanhamentos
                      .filter(acomp => {
                        const search = searchTerm.toLowerCase();
                        const patientName = (acomp.expand?.paciente?.nome || '').toLowerCase();
                        const cns = (acomp.expand?.paciente?.cns || '').toLowerCase();
                        const date = acomp.data_busca ? new Date(acomp.data_busca).toLocaleDateString('pt-BR').toLowerCase() : '';
                        
                        const matchesSearch = patientName.includes(search) || cns.includes(search) || date.includes(search);
                        const matchesFilter = filterTipoBusca === 'ALL' || (acomp.tipo_busca && acomp.tipo_busca.includes(filterTipoBusca));
                        
                        return matchesSearch && matchesFilter;
                      })
                      .map((acomp) => {
                        const pacienteNome = acomp.expand?.paciente?.nome || 'Paciente Desconhecido';
                        const pacienteIniciais = pacienteNome.substring(0, 2).toUpperCase();
                        const cns = acomp.expand?.paciente?.cns || '--';
                        
                        // Formatando a data
                        const dataFormatada = acomp.data_busca 
                          ? new Date(acomp.data_busca).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                          : '--';

                        return (
                          <tr key={acomp.id} className="hover:bg-primary/[0.03] transition-all group">
                            <td className="px-6 py-6">
                              <div className="flex items-center justify-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black text-xs shadow-inner">
                                  {pacienteIniciais}
                                </div>
                                <div className="text-left">
                                  <p className="text-sm font-black text-primary uppercase leading-tight truncate max-w-[150px]" title={pacienteNome}>{pacienteNome}</p>
                                  <p className="text-[10px] font-bold text-on-surface-variant/60 uppercase tracking-tighter mt-0.5">CNS: {cns}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-6 text-center">
                              <span className="text-[13px] font-black text-[#001b3d] uppercase whitespace-nowrap bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/10">
                                {dataFormatada}
                              </span>
                            </td>
                            <td className="px-6 py-6 text-center">
                              <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-tight border border-blue-100 shadow-sm">
                                <Phone className="w-3.5 h-3.5" />
                                {acomp.tipo_contato || '--'}
                              </span>
                            </td>
                            <td className="px-6 py-6 text-center">
                              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight border shadow-sm ${
                                acomp.situacao_pos_busca?.includes('Sucesso') || acomp.situacao_pos_busca?.includes('Agendamento')
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
                                  : 'bg-amber-50 text-amber-700 border-amber-100'
                              }`}>
                                {acomp.situacao_pos_busca || '--'}
                              </span>
                            </td>
                            <td className="px-6 py-6 text-center">
                              <div className="flex items-center justify-center gap-3">
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
        </div>
      </div>

      {/* Modal de Edição */}
      {isEditModalOpen && selectedAcompanhamento && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-[0px_24px_48px_rgba(0,0,0,0.15)] overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-[#1c2e4a] to-[#253c61] px-5 sm:px-8 md:px-10 py-5 sm:py-6 flex justify-between items-center relative shrink-0">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white text-base sm:text-lg md:text-xl font-black tracking-tight leading-tight">Editar Acompanhamento</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></div>
                    <p className="text-white/60 text-[10px] sm:text-xs font-medium uppercase tracking-widest truncate max-w-[200px] sm:max-w-[300px]">
                      Paciente: {selectedAcompanhamento.expand?.paciente?.nome || 'Desconhecido'}
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
              <form id="edit-acompanhamento-form" onSubmit={handleSaveEdit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 sm:gap-y-6">
                {/* Teste Molecular DNA-HPV */}
                <div className="space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <FileText className="w-3.5 h-3.5" />
                    </div>
                    Teste Molecular DNA-HPV
                  </label>
                  <div className="relative">
                    <select 
                      name="teste_molecular" 
                      defaultValue={selectedAcompanhamento.teste_molecular}
                      required 
                      className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none appearance-none cursor-pointer shadow-sm hover:border-primary/40"
                    >
                      <option value="" disabled>Selecione</option>
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
                    <input type="hidden" name="data_busca" value={selectedAcompanhamento.data_busca_formatada} />
                    <DatePickerPTBR 
                      value={selectedAcompanhamento.data_busca_formatada}
                      onChange={(val) => setSelectedAcompanhamento({...selectedAcompanhamento, data_busca_formatada: val})}
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
                    <select 
                      name="tipo_busca" 
                      defaultValue={selectedAcompanhamento.tipo_busca}
                      required 
                      className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none appearance-none cursor-pointer shadow-sm hover:border-primary/40"
                    >
                      <option value="" disabled>Selecione</option>
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
                    <select 
                      name="tipo_contato" 
                      defaultValue={selectedAcompanhamento.tipo_contato}
                      required 
                      className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none appearance-none cursor-pointer shadow-sm hover:border-primary/40"
                    >
                      <option value="" disabled>Selecione uma modalidade</option>
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
                    <select 
                      name="situacao_pos_busca" 
                      defaultValue={selectedAcompanhamento.situacao_pos_busca}
                      required 
                      className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none appearance-none cursor-pointer shadow-sm hover:border-primary/40"
                    >
                      <option value="" disabled>Selecione o desfecho da busca</option>
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
                    <select 
                      name="entraves_identificados" 
                      defaultValue={selectedAcompanhamento.entraves_identificados}
                      className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none appearance-none cursor-pointer shadow-sm hover:border-primary/40"
                    >
                      <option value="" disabled>Selecione (Opcional)</option>
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
                    defaultValue={selectedAcompanhamento.observacoes}
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
                Cancelar
              </button>
              <button 
                form="edit-acompanhamento-form"
                type="submit" 
                disabled={isSaving}
                className="px-6 sm:px-10 py-3 rounded-xl text-sm font-black text-white bg-gradient-to-r from-[#1c2e4a] to-[#253c61] shadow-[0_10px_20px_rgba(28,46,74,0.3)] hover:shadow-[0_15px_30px_rgba(28,46,74,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 group w-full sm:w-auto order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                )}
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
