import React, { useState, useEffect, useMemo } from 'react';
import { Header } from '../components/Header';
import { TrendingUp, BadgeCheck, Search, Filter, Download, Phone, Home, FileText, Eye, ChevronLeft, ChevronRight, Edit, Trash2, X, ClipboardList, Calendar, Info, Building, AlertTriangle, MessageSquare, CheckCircle2, RotateCcw, Users, MapPin } from 'lucide-react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../contexts/AuthContext';
import { DatePickerPTBR } from './PatientsScreen';
import { UNIDADES_EQUIPES, MICROAREAS } from '../constants/regionalData';

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
  entraves_identificados?: string;
  entraves_informado_por?: string; // Novo campo
  observacoes?: string;
  profissional: string; // ID do profissional
}

interface FollowUpsScreenProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const FollowUpsScreen: React.FC<FollowUpsScreenProps> = ({ activeTab, setActiveTab }) => {
  const { user, isAdmin } = useAuth();
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
  const [filterTipoContato, setFilterTipoContato] = useState('ALL');
  const [filterSituacao, setFilterSituacao] = useState('ALL');
  const [filterEntraves, setFilterEntraves] = useState('ALL');
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');
  const [filterUnidade, setFilterUnidade] = useState('');
  const [filterEquipe, setFilterEquipe] = useState('');
  const [filterMicroarea, setFilterMicroarea] = useState('');

  const resetFilters = () => {
    setSearchTerm('');
    setFilterTipoBusca('ALL');
    setFilterTipoContato('ALL');
    setFilterSituacao('ALL');
    setFilterEntraves('ALL');
    setFilterDataInicio('');
    setFilterDataFim('');
    setFilterUnidade('');
    setFilterEquipe('');
    setFilterMicroarea('');
  };

  const normalizeCanalLabel = (value?: string) => value || '';

  const getCanalLabel = (acomp: Acompanhamento) => {
    const contato = acomp.tipo_contato || '';
    if (contato.toLowerCase().includes('mensagem')) return 'Mensagem';
    if (contato.toLowerCase().includes('direto')) return 'Contato Direto';
    if (contato.toLowerCase().includes('indireto')) return 'Contato Indireto';
    if (contato.toLowerCase().includes('não houve contato')) return 'Sem Contato';

    return normalizeCanalLabel(acomp.tipo_contato);
  };

  // Estatísticas Calculadas com useMemo para persistência e performance
  const stats = useMemo(() => {
    const total = acompanhamentos.length;
    const contatos = acompanhamentos.filter(a => a.tipo_contato && !a.tipo_contato.includes('Não houve contato')).length;
    const falhas = acompanhamentos.filter(a => a.tipo_contato && a.tipo_contato.includes('Não houve contato')).length;
    const agendamentos = acompanhamentos.filter(a => a.situacao_pos_busca && a.situacao_pos_busca.includes('1- Agendamento')).length;
    
    const counts: Record<string, number> = {};
    const totalCounts: Record<string, number> = {};

    // Usa apenas tipo_contato para o canal
    const validAcomps = acompanhamentos
      .map(a => ({ ...a, canal_label: getCanalLabel(a) }))
      .filter(a => a.canal_label);

    validAcomps.forEach(a => {
      totalCounts[a.canal_label] = (totalCounts[a.canal_label] || 0) + 1;
      if (a.situacao_pos_busca?.includes('1-') || a.situacao_pos_busca?.includes('Agendamento')) {
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
      // Fallback para o canal mais usado geral, mesmo sem agendamento
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
  }, [acompanhamentos]);

  useEffect(() => {
    const fetchAcompanhamentos = async () => {
      if (!user) return;
      try {
        setIsLoading(true);

        const acompFilters = [];
        if (!isAdmin) {
          if (user.role === 'unidade') {
            acompFilters.push(`paciente.unidade = "${user.unidade_saude}"`);
          } else if (user.role === 'equipe') {
            acompFilters.push(`paciente.unidade = "${user.unidade_saude}"`);
            acompFilters.push(`paciente.equipe = "${user.equipe}"`);
          } else if (user.role === 'microarea') {
            acompFilters.push(`paciente.unidade = "${user.unidade_saude}"`);
            acompFilters.push(`paciente.equipe = "${user.equipe}"`);
            acompFilters.push(`paciente.microarea ~ "${user.microarea}"`);
          }
        }

        // Regional UI Filters
        if (filterUnidade) acompFilters.push(`paciente.unidade = "${filterUnidade}"`);
        if (filterEquipe) acompFilters.push(`paciente.equipe = "${filterEquipe}"`);
        if (filterMicroarea) acompFilters.push(`paciente.microarea ~ "${filterMicroarea}"`);

        const filterString = acompFilters.join(' && ');

        // Expandimos o paciente para pegar o nome e cns
        const records = await pb.collection('amarcap53_acompanhamentos').getFullList({
          sort: '-created',
          expand: 'paciente',
          filter: filterString,
          requestKey: null
        });
        setAcompanhamentos(records);
      } catch (error) {
        console.error('Erro ao buscar acompanhamentos:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAcompanhamentos();
  }, [user, filterUnidade, filterEquipe, filterMicroarea]);

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
        data_busca_formatada: dataBuscaFormatada,
        entraves_informado_por: acompToEdit.entraves_informado_por // Novo campo
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
    
    const rawDate = formData.get('data_busca') as string;
    let dataBuscaIso = '';
    if (rawDate && rawDate.includes('/')) {
      const [d, m, y] = rawDate.split('/');
      dataBuscaIso = `${y}-${m}-${d} 12:00:00`;
    }

    const data = {
      tipo_busca: formData.get('tipo_busca') || '',
      data_busca: dataBuscaIso || rawDate,
      tipo_contato: formData.get('tipo_contato') || '',
      situacao_pos_busca: formData.get('situacao_pos_busca') || '',
      entraves_identificados: formData.get('entraves_identificados') || '',
      entraves_informado_por: formData.get('entraves_informado_por') || '', // Novo campo
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
        title="Meus Acompanhamentos" 
        pageTitle="Meus Acompanhamentos" 
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
                    {stats.total} <span className="text-lg font-bold text-white/60 ml-2 tracking-normal uppercase">Registros</span>
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
                    isFilterVisible || filterTipoBusca !== 'ALL' || filterTipoContato !== 'ALL' || filterSituacao !== 'ALL' || filterEntraves !== 'ALL' || filterDataInicio || filterDataFim
                      ? 'bg-primary text-white border-primary shadow-[0_0_25px_rgba(var(--primary-rgb),0.4)]' 
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  <Filter className="w-6 h-6" />
                  <span>Filtros</span>
                  {(filterTipoBusca !== 'ALL' || filterTipoContato !== 'ALL' || filterSituacao !== 'ALL' || filterEntraves !== 'ALL' || filterDataInicio || filterDataFim) && (
                    <div className="w-7 h-7 flex items-center justify-center bg-white text-primary text-[11px] rounded-full font-black animate-pulse">
                      {[filterTipoBusca, filterTipoContato, filterSituacao, filterEntraves, filterDataInicio, filterDataFim].filter(f => f && f !== 'ALL').length}
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Barra de Busca Animada */}
            {isSearchVisible && (
              <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-white p-6 rounded-[2rem] shadow-xl border border-primary/5 animate-in slide-in-from-top-6 fade-in duration-500">
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
              <div className="col-span-1 md:col-span-2 lg:col-span-4 bg-white p-8 rounded-[2rem] shadow-2xl border border-primary/5 animate-in slide-in-from-top-6 fade-in duration-500">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {/* Filtros Regionais Condicionais */}
                  {(isAdmin || user?.role === 'cap') && (
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                        <Building className="w-3.5 h-3.5" />
                        Unidade
                      </label>
                      <select 
                        value={filterUnidade}
                        onChange={(e) => {
                          setFilterUnidade(e.target.value);
                          setFilterEquipe('');
                          setFilterMicroarea('');
                        }}
                        className="w-full p-4 bg-surface-container-low border-2 border-transparent rounded-2xl text-sm font-bold text-on-surface outline-none focus:border-primary/20 transition-all appearance-none cursor-pointer"
                      >
                        <option value="">Todas</option>
                        {Object.keys(UNIDADES_EQUIPES).map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                  )}

                  {(isAdmin || user?.role === 'cap' || user?.role === 'unidade') && (
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                        <Users className="w-3.5 h-3.5" />
                        Equipe
                      </label>
                      <select 
                        value={filterEquipe}
                        onChange={(e) => {
                          setFilterEquipe(e.target.value);
                          setFilterMicroarea('');
                        }}
                        disabled={!filterUnidade && (isAdmin || user?.role === 'cap')}
                        className="w-full p-4 bg-surface-container-low border-2 border-transparent rounded-2xl text-sm font-bold text-on-surface outline-none focus:border-primary/20 transition-all appearance-none cursor-pointer disabled:opacity-30"
                      >
                        <option value="">Todas</option>
                        {filterUnidade ? UNIDADES_EQUIPES[filterUnidade]?.map(eq => (
                          <option key={eq} value={eq}>{eq}</option>
                        )) : user?.role === 'unidade' ? UNIDADES_EQUIPES[user.unidade_saude]?.map(eq => (
                          <option key={eq} value={eq}>{eq}</option>
                        )) : null}
                      </select>
                    </div>
                  )}

                  {(isAdmin || user?.role === 'cap' || user?.role === 'unidade' || user?.role === 'equipe') && (
                    <div className="space-y-3">
                      <label className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                        <MapPin className="w-3.5 h-3.5" />
                        Microárea
                      </label>
                      <select 
                        value={filterMicroarea}
                        onChange={(e) => setFilterMicroarea(e.target.value)}
                        disabled={!filterEquipe && (isAdmin || user?.role === 'cap' || user?.role === 'unidade')}
                        className="w-full p-4 bg-surface-container-low border-2 border-transparent rounded-2xl text-sm font-bold text-on-surface outline-none focus:border-primary/20 transition-all appearance-none cursor-pointer disabled:opacity-30"
                      >
                        <option value="">Todas</option>
                        {MICROAREAS.map(ma => <option key={ma} value={ma}>{ma}</option>)}
                      </select>
                    </div>
                  )}

                  {/* Período de Busca */}
                  <div className="lg:col-span-2 space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                      <Calendar className="w-3.5 h-3.5" />
                      Período da Busca (Início e Fim)
                    </label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="relative group/date">
                        <input 
                          type="date"
                          value={filterDataInicio}
                          onChange={(e) => setFilterDataInicio(e.target.value)}
                          className="w-full p-4 bg-surface-container-low border-2 border-transparent rounded-2xl text-sm font-bold text-on-surface outline-none focus:border-primary/20 transition-all appearance-none cursor-pointer"
                        />
                        {!filterDataInicio && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/30 text-xs font-bold pointer-events-none uppercase">Data Inicial</span>}
                      </div>
                      <div className="relative group/date">
                        <input 
                          type="date"
                          value={filterDataFim}
                          onChange={(e) => setFilterDataFim(e.target.value)}
                          className="w-full p-4 bg-surface-container-low border-2 border-transparent rounded-2xl text-sm font-bold text-on-surface outline-none focus:border-primary/20 transition-all appearance-none cursor-pointer"
                        />
                        {!filterDataFim && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant/30 text-xs font-bold pointer-events-none uppercase">Data Final</span>}
                      </div>
                    </div>
                  </div>

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
                      <option value="1 - Busca ativa- Visita domiciliar registrada em prontuário">1 - Busca ativa- Visita domiciliar registrada em prontuário</option>
                      <option value="2 - Busca ativa - Contato Telefônico (ligação) registrada em prontuário">2 - Busca ativa - Contato Telefônico (ligação) registrada em prontuário</option>
                      <option value="3 - Busca ativa - Mensagem registrada em prontuário">3 - Busca ativa - Mensagem registrada em prontuário</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                      <Phone className="w-3.5 h-3.5" />
                      Tipo de Contato
                    </label>
                    <select 
                      value={filterTipoContato}
                      onChange={(e) => setFilterTipoContato(e.target.value)}
                      className="w-full p-4 bg-surface-container-low border-2 border-transparent rounded-2xl text-sm font-bold text-on-surface outline-none focus:border-primary/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="ALL">Todos os Contatos</option>
                      <option value="Contato direto (conversa)">Contato direto (conversa)</option>
                      <option value="Contato indireto (mensagem)">Contato indireto (mensagem)</option>
                      <option value="Não houve contato ( não localizada, ligação não atendida...)">Não houve contato ( não localizada, ligação não atendida...)</option>
                    </select>
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                      <BadgeCheck className="w-3.5 h-3.5" />
                      Situação Pós Busca
                    </label>
                    <select 
                      value={filterSituacao}
                      onChange={(e) => setFilterSituacao(e.target.value)}
                      className="w-full p-4 bg-surface-container-low border-2 border-transparent rounded-2xl text-sm font-bold text-on-surface outline-none focus:border-primary/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="ALL">Todas as Situações</option>
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
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Entraves Identificados
                    </label>
                    <select 
                      value={filterEntraves}
                      onChange={(e) => setFilterEntraves(e.target.value)}
                      className="w-full p-4 bg-surface-container-low border-2 border-transparent rounded-2xl text-sm font-bold text-on-surface outline-none focus:border-primary/20 transition-all appearance-none cursor-pointer"
                    >
                      <option value="ALL">Todos os Entraves</option>
                      <option value="1 - Horários incompatíveis com a rotina de trabalho">1 - Horários incompatíveis com a rotina de trabalho</option>
                      <option value="2 - Vergonha ou constrangimento durante o exame">2 - Vergonha ou constrangimento durante o exame</option>
                      <option value="3 - Ideia equivocada sobre a necessidade de fazer exame">3 - Ideia equivocada sobre a necessidade de fazer exame</option>
                      <option value="4 - Faz o rastreamento pela rede privada">4 - Faz o rastreamento pela rede privada</option>
                      <option value="5 - Dificuldade de locomoção ( ex: acamada)">5 - Dificuldade de locomoção ( ex: acamada)</option>
                      <option value="6 - Distância da Unidade">6 - Distância da Unidade</option>
                      <option value="7 - Se recusa a fazer o exame com o profissional da equipe">7 - Se recusa a fazer o exame com o profissional da equipe</option>
                      <option value="8 - Esquece a data do agendamento">8 - Esquece a data do agendamento</option>
                      <option value="9 - Indisponibilidade de tempo">9 - Indisponibilidade de tempo</option>
                      <option value="10 - Não identificado entrave">10 - Não identificado entrave</option>
                    </select>
                  </div>

                  <div className="flex items-end gap-4 lg:col-span-2">
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
                        <span>Contato / Entrave</span>
                      </div>
                    </th>
                    <th className="px-6 py-6 text-[10px] md:text-[11px] font-black uppercase tracking-[0.1em] text-blue-200/80 text-center border-r border-white/5">
                      <div className="flex flex-col items-center gap-1">
                        <BadgeCheck className="w-4 h-4 text-blue-400/60" />
                        <span>Desfecho / Tipo</span>
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
                        const matchesTipoBusca = filterTipoBusca === 'ALL' || (acomp.tipo_busca && acomp.tipo_busca.includes(filterTipoBusca));
                        const matchesTipoContato = filterTipoContato === 'ALL' || (acomp.tipo_contato && acomp.tipo_contato.includes(filterTipoContato));
                        const matchesSituacao = filterSituacao === 'ALL' || (acomp.situacao_pos_busca && acomp.situacao_pos_busca.includes(filterSituacao));
                        const matchesEntraves = filterEntraves === 'ALL' || (acomp.entraves_identificados && acomp.entraves_identificados.includes(filterEntraves));
                        
                        // Filtro de Data
                        let matchesData = true;
                        if (acomp.data_busca) {
                          const dataAcomp = new Date(acomp.data_busca);
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
                        } else if (filterDataInicio || filterDataFim) {
                          matchesData = false;
                        }

                        return matchesSearch && matchesTipoBusca && matchesTipoContato && matchesSituacao && matchesEntraves && matchesData;
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
                              <div className="flex flex-col items-center gap-1.5">
                                <span className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-[10px] font-black uppercase tracking-tight border border-blue-100 shadow-sm">
                                  <Phone className="w-3.5 h-3.5" />
                                  {acomp.tipo_contato || '--'}
                                </span>
                                {acomp.entraves_identificados && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-bold text-rose-500 uppercase tracking-tighter bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-100">
                                    <AlertTriangle className="w-3 h-3" />
                                    {acomp.entraves_identificados}
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
                              </div>
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
            <div className="bg-gradient-to-r from-[#1c2e4a] to-[#253c61] px-10 py-6 flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white text-xl font-black tracking-tight leading-tight">Editar Acompanhamento</h3>
                  <p className="text-white/60 text-xs font-medium uppercase tracking-widest mt-1">
                    Paciente: {selectedAcompanhamento.expand?.paciente?.nome || 'Desconhecido'}
                  </p>
                </div>
              </div>
              <button onClick={handleCloseModal} className="p-2 -mr-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all duration-300 hover:rotate-90">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="overflow-y-auto custom-scrollbar-modal flex-1 p-10">
              <form id="edit-acompanhamento-form" onSubmit={handleSaveEdit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em]">
                      <Calendar className="w-3.5 h-3.5" /> Data da Busca
                    </label>
                    <DatePickerPTBR 
                      value={selectedAcompanhamento.data_busca_formatada} 
                      onChange={(val) => setSelectedAcompanhamento({...selectedAcompanhamento, data_busca_formatada: val})} 
                    />
                    <input type="hidden" name="data_busca" value={selectedAcompanhamento.data_busca_formatada} />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em]">
                      <Search className="w-3.5 h-3.5" /> Tipo de Busca
                    </label>
                    <select name="tipo_busca" defaultValue={selectedAcompanhamento.tipo_busca} required className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium p-3.5 outline-none focus:border-primary">
                      <option value="" disabled>Selecione</option>
                      <option value="1 - Busca ativa- Visita domiciliar registrada em prontuário">1 - Busca ativa- Visita domiciliar registrada em prontuário</option>
                      <option value="2 - Busca ativa - Contato Telefônico (ligação) registrada em prontuário">2 - Busca ativa - Contato Telefônico (ligação) registrada em prontuário</option>
                      <option value="3 - Busca ativa - Mensagem registrada em prontuário">3 - Busca ativa - Mensagem registrada em prontuário</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em]">
                      <Phone className="w-3.5 h-3.5" /> Tipo de Contato
                    </label>
                    <select name="tipo_contato" defaultValue={selectedAcompanhamento.tipo_contato} required className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium p-3.5 outline-none focus:border-primary">
                      <option value="" disabled>Selecione</option>
                      <option value="Contato direto (conversa)">Contato direto (conversa)</option>
                      <option value="Contato indireto (mensagem)">Contato indireto (mensagem)</option>
                      <option value="Não houve contato ( não localizada, ligação não atendida...)">Não houve contato ( não localizada, ligação não atendida...)</option>
                    </select>
                  </div>

                  <div className="col-span-2 space-y-2">
                    <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em]">
                      <Info className="w-3.5 h-3.5" /> Situação Pós Busca
                    </label>
                    <select name="situacao_pos_busca" defaultValue={selectedAcompanhamento.situacao_pos_busca} required className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium p-3.5 outline-none focus:border-primary">
                      <option value="" disabled>Selecione</option>
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
                  </div>

                  <div className="col-span-2 space-y-2">
                    <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em]">
                      <AlertTriangle className="w-3.5 h-3.5" /> Entraves Identificados
                    </label>
                    <select name="entraves_identificados" defaultValue={selectedAcompanhamento.entraves_identificados} className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium p-3.5 outline-none focus:border-primary">
                      <option value="">Nenhum</option>
                      <option value="1 - Horários incompatíveis com a rotina de trabalho">1 - Horários incompatíveis com a rotina de trabalho</option>
                      <option value="2 - Vergonha ou constrangimento durante o exame">2 - Vergonha ou constrangimento durante o exame</option>
                      <option value="3 - Ideia equivocada sobre a necessidade de fazer exame">3 - Ideia equivocada sobre a necessidade de fazer exame</option>
                      <option value="4 - Faz o rastreamento pela rede privada">4 - Faz o rastreamento pela rede privada</option>
                      <option value="5 - Dificuldade de locomoção ( ex: acamada)">5 - Dificuldade de locomoção ( ex: acamada)</option>
                      <option value="6 - Distância da Unidade">6 - Distância da Unidade</option>
                      <option value="7 - Se recusa a fazer o exame com o profissional da equipe">7 - Se recusa a fazer o exame com o profissional da equipe</option>
                      <option value="8 - Esquece a data do agendamento">8 - Esquece a data do agendamento</option>
                      <option value="9 - Indisponibilidade de tempo">9 - Indisponibilidade de tempo</option>
                      <option value="10 - Não identificado entrave">10 - Não identificado entrave</option>
                    </select>
                  </div>

                  {/* Entraves Informado Por */}
                  <div className="col-span-2 space-y-2">
                    <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em]">
                      <Info className="w-3.5 h-3.5" /> Entrave(s) Informado Por
                    </label>
                    <select name="entraves_informado_por" defaultValue={selectedAcompanhamento.entraves_informado_por} className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium p-3.5 outline-none focus:border-primary">
                      <option value="">Selecione (Opcional)</option>
                      <option value="1 - Informado por paciente">1 - Informado por paciente</option>
                      <option value="2 - Identificado por profissional">2 - Identificado por profissional</option>
                    </select>
                  </div>

                  <div className="col-span-2 space-y-2">
                    <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em]">
                      <MessageSquare className="w-3.5 h-3.5" /> Observações
                    </label>
                    <textarea name="observacoes" defaultValue={selectedAcompanhamento.observacoes} className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium p-4 resize-none outline-none focus:border-primary min-h-[120px]" rows={4}></textarea>
                  </div>
                </div>
              </form>
            </div>
              
            <div className="flex justify-end gap-4 p-6 border-t border-outline-variant/10 bg-surface-container-lowest shrink-0">
              <button type="button" onClick={handleCloseModal} disabled={isSaving} className="px-8 py-3 rounded-xl text-sm font-bold text-primary hover:bg-primary/5 transition-all disabled:opacity-50">Descartar</button>
              <button form="edit-acompanhamento-form" type="submit" disabled={isSaving} className="px-10 py-3 rounded-xl text-sm font-black text-white bg-gradient-to-r from-[#1c2e4a] to-[#253c61] shadow-lg transition-all flex items-center gap-2 disabled:opacity-50">
                {isSaving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <CheckCircle2 className="w-4 h-4" />}
                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
