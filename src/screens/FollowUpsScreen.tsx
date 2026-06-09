import React, { useState, useEffect, useMemo } from 'react';
import { Header } from '../components/Header';
import { ScrollIndicator } from '../components/ScrollIndicator';
import { Footer } from '../components/Footer';
import { TrendingUp, BadgeCheck, Search, Filter, Download, Phone, Home, FileText, Eye, ChevronLeft, ChevronRight, Edit, Trash2, X, ClipboardList, Calendar, Info, Building, AlertTriangle, MessageSquare, CheckCircle2, RotateCcw, Users, MapPin } from 'lucide-react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../contexts/AuthContext';
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
  getSelectLabel,
  matchesSelectFilter,
  getCanonicalValue
} from '../constants/followUpOptions';

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
  return values.some(v => selectedValues.includes(v));
};

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
  const [filterTipoBusca, setFilterTipoBusca] = useState<string[]>([]);
  const [filterTipoContato, setFilterTipoContato] = useState<string[]>([]);
  const [filterSituacao, setFilterSituacao] = useState<string[]>([]);
  const [filterEntraves, setFilterEntraves] = useState<string[]>([]);
  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');
  const [filterUnidade, setFilterUnidade] = useState<string[]>([]);
  const [filterEquipe, setFilterEquipe] = useState<string[]>([]);
  const [filterMicroarea, setFilterMicroarea] = useState<string[]>([]);

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
  };

  const normalizeCanalLabel = (value?: string) => value || '';

  const getCanalLabel = (acomp: Acompanhamento) => {
    const canonical = getCanonicalValue('tipo_contato', acomp.tipo_contato || '');
    const lower = canonical.toLowerCase();
    
    if (lower.includes('não houve contato')) return 'Sem Contato';
    if (lower.includes('contato direto')) return 'Contato Direto';
    if (lower.includes('contato indireto')) return 'Contato Indireto';

    return acomp.tipo_contato || '';
  };

  // Estatísticas Calculadas com useMemo para persistência e performance
  const stats = useMemo(() => {
    const total = acompanhamentos.length;
    const contatos = acompanhamentos.filter(a => {
      const val = (a.tipo_contato || '').toLowerCase();
      return val && !val.includes('não houve contato');
    }).length;
    
    const falhas = acompanhamentos.filter(a => {
      const val = (a.tipo_contato || '').toLowerCase();
      return val && val.includes('não houve contato');
    }).length;
    
    const agendamentos = acompanhamentos.filter(a => {
      const val = (a.situacao_pos_busca || '').toLowerCase();
      return val && val.includes('agendamento');
    }).length;
    
    const counts: Record<string, number> = {};
    const totalCounts: Record<string, number> = {};

    const validAcomps = acompanhamentos
      .map(a => ({ ...a, canal_label: getCanalLabel(a) }))
      .filter(a => a.canal_label);

    validAcomps.forEach(a => {
      totalCounts[a.canal_label] = (totalCounts[a.canal_label] || 0) + 1;
      const situacaoLower = (a.situacao_pos_busca || '').toLowerCase();
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
        if (filterUnidade.length > 0) {
          acompFilters.push(`(${filterUnidade.map(u => `paciente.unidade = "${u}"`).join(' || ')})`);
        }
        if (filterEquipe.length > 0) {
          acompFilters.push(`(${filterEquipe.map(e => `paciente.equipe = "${e}"`).join(' || ')})`);
        }
        if (filterMicroarea.length > 0) {
          acompFilters.push(`(${filterMicroarea.map(m => `paciente.microarea ~ "${m}"`).join(' || ')})`);
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
          acompFilters.push(`(${filterEntraves.map(v => `entraves_identificados ~ "${v}"`).join(' || ')})`);
        }

        if (filterDataInicio) {
          acompFilters.push(`data_busca >= "${filterDataInicio} 00:00:00"`);
        }
        if (filterDataFim) {
          acompFilters.push(`data_busca <= "${filterDataFim} 23:59:59"`);
        }

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
  }, [user, filterUnidade, filterEquipe, filterMicroarea, filterTipoBusca, filterTipoContato, filterSituacao, filterEntraves, filterDataInicio, filterDataFim]);

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
        tipo_busca: getCanonicalSelectValue(acompToEdit.tipo_busca, TIPO_BUSCA_OPTIONS),
        tipo_contato: getCanonicalSelectValue(acompToEdit.tipo_contato, TIPO_CONTATO_OPTIONS),
        situacao_pos_busca: getCanonicalSelectValue(acompToEdit.situacao_pos_busca, SITUACAO_POS_BUSCA_OPTIONS),
        entraves_identificados: acompToEdit.entraves_identificados
          ? (Array.isArray(acompToEdit.entraves_identificados)
            ? acompToEdit.entraves_identificados.map(v => getCanonicalSelectValue(v, ENTRAVES_IDENTIFICADOS_OPTIONS))
            : acompToEdit.entraves_identificados.split('; ').map(v => getCanonicalSelectValue(v, ENTRAVES_IDENTIFICADOS_OPTIONS)))
          : [],
        entraves_informado_por: getCanonicalSelectValue(acompToEdit.entraves_informado_por, ENTRAVES_INFORMADO_POR_OPTIONS)
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
    
    if (!selectedAcompanhamento.data_busca_formatada || !selectedAcompanhamento.tipo_busca || !selectedAcompanhamento.tipo_contato || !selectedAcompanhamento.situacao_pos_busca) {
      alert('Preencha todos os campos obrigatórios: Data da Busca, Tipo de Busca, Tipo de Contato e Situação Pós Busca.');
      return;
    }
    
    if (selectedAcompanhamento.entraves_informado_por && (!selectedAcompanhamento.entraves_identificados || selectedAcompanhamento.entraves_identificados.length === 0)) {
      alert('Por favor, selecione ao menos um entrave identificado.');
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
    console.log('[DEBUG] tipo_contato raw:', rawTipoContato, '| length:', rawTipoContato.length, '| last chars:', JSON.stringify(rawTipoContato.slice(-10)));

    const data = {
      tipo_busca: getSelectLabel(selectedAcompanhamento.tipo_busca, TIPO_BUSCA_OPTIONS),
      data_busca: dataBuscaIso || rawDate,
      tipo_contato: rawTipoContato.normalize('NFC'),
      situacao_pos_busca: getSelectLabel(selectedAcompanhamento.situacao_pos_busca, SITUACAO_POS_BUSCA_OPTIONS),
      entraves_identificados: Array.isArray(selectedAcompanhamento.entraves_identificados) 
        ? selectedAcompanhamento.entraves_identificados.filter(v => v)
        : selectedAcompanhamento.entraves_identificados ? [selectedAcompanhamento.entraves_identificados] : [],
      entraves_informado_por: getSelectLabel(selectedAcompanhamento.entraves_informado_por, ENTRAVES_INFORMADO_POR_OPTIONS),
      observacoes: selectedAcompanhamento.observacoes || '',
    };

    console.log('[SAVE EDIT] Payload:', JSON.stringify(data, null, 2));

    try {
      const result = await pb.collection('amarcap53_acompanhamentos').update(selectedAcompanhamento.id, data);
      console.log('[SAVE EDIT] Sucesso:', result);
      
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
                    isFilterVisible || filterTipoBusca.length > 0 || filterTipoContato.length > 0 || filterSituacao.length > 0 || filterEntraves.length > 0 || filterDataInicio || filterDataFim
                      ? 'bg-primary text-white border-primary shadow-[0_0_25px_rgba(var(--primary-rgb),0.4)]' 
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  <Filter className="w-6 h-6" />
                  <span>Filtros</span>
                  {(filterTipoBusca.length > 0 || filterTipoContato.length > 0 || filterSituacao.length > 0 || filterEntraves.length > 0 || filterDataInicio || filterDataFim) && (
                    <div className="w-7 h-7 flex items-center justify-center bg-white text-primary text-[11px] rounded-full font-black animate-pulse">
                      {[filterTipoBusca, filterTipoContato, filterSituacao, filterEntraves].filter(f => f.length > 0).length + (filterDataInicio || filterDataFim ? 1 : 0)}
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
                  {/* Período de Busca */}
                  <div className="md:col-span-2 space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                      <Calendar className="w-3.5 h-3.5" />
                      Período da Busca (Início e Fim)
                    </label>
                    <div className="flex gap-4">
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

                  {/* Filtros Regionais Condicionais */}
                  {(isAdmin || user?.role === 'cap') && (
                    <div className="space-y-3">
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
                    <div className="space-y-3">
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
                    <div className="space-y-3">
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

                  <div className="space-y-3">
                    <MultiSelect 
                      label="Tipo de Busca"
                      placeholder="Todos os Tipos"
                      options={TIPO_BUSCA_OPTIONS}
                      value={filterTipoBusca}
                      onChange={setFilterTipoBusca}
                    />
                  </div>

                  <div className="space-y-3">
                    <MultiSelect 
                      label="Tipo de Contato"
                      placeholder="Todos os Contatos"
                      options={TIPO_CONTATO_OPTIONS}
                      value={filterTipoContato}
                      onChange={setFilterTipoContato}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-3">
                    <MultiSelect 
                      label="Situação Pós Busca"
                      placeholder="Todas as Situações"
                      options={SITUACAO_POS_BUSCA_OPTIONS}
                      value={filterSituacao}
                      onChange={setFilterSituacao}
                    />
                  </div>

                  <div className="md:col-span-2 space-y-3">
                    <MultiSelect 
                      label="Entraves Identificados"
                      placeholder="Todos os Entraves"
                      options={ENTRAVES_IDENTIFICADOS_OPTIONS}
                      value={filterEntraves}
                      onChange={setFilterEntraves}
                    />
                  </div>

                  <div className="flex items-end gap-4 md:col-span-2 lg:col-span-4 mt-2">
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
                        const matchesTipoBusca = matchesSelectFilter(acomp.tipo_busca, filterTipoBusca, TIPO_BUSCA_OPTIONS);
                        const matchesTipoContato = matchesSelectFilter(acomp.tipo_contato, filterTipoContato, TIPO_CONTATO_OPTIONS);
                        const matchesSituacao = matchesSelectFilter(acomp.situacao_pos_busca, filterSituacao, SITUACAO_POS_BUSCA_OPTIONS);
                        const matchesEntraves = matchesMultiValueField(acomp.entraves_identificados, filterEntraves);
                        
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
          <Footer />
        </div>
      </div>

      {/* Modal de Edição */}
      {isEditModalOpen && selectedAcompanhamento && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div data-dropdown-root="true" className="relative bg-surface-container-lowest w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-[0px_24px_48px_rgba(0,0,0,0.15)] overflow-visible border border-white/20 animate-in zoom-in-95 duration-300">
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
            
            <div className="overflow-y-auto custom-scrollbar-modal flex-1 p-5 sm:p-8 md:p-10">
              <form id="edit-acompanhamento-form" onSubmit={handleSaveEdit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 sm:gap-y-6">
                  <div className="space-y-2 group/field">
                    <DatePickerPTBR 
                      label="Data da Busca"
                      value={selectedAcompanhamento.data_busca_formatada} 
                      isISO={false}
                      onChange={(val) => setSelectedAcompanhamento({...selectedAcompanhamento, data_busca_formatada: val})} 
                    />
                  </div>

                  {/* Tipo de Busca */}
                  <SingleSelect 
                    label="Tipo de Busca"
                    placeholder="Selecione"
                    options={TIPO_BUSCA_OPTIONS}
                    value={selectedAcompanhamento.tipo_busca || ''}
                    onChange={(val) => setSelectedAcompanhamento({...selectedAcompanhamento, tipo_busca: val})}
                    required
                    icon={<Search className="w-3.5 h-3.5" />}
                    showSearch={false}
                  />

                  {/* Tipo de Contato */}
                  <SingleSelect 
                    label="Tipo de Contato"
                    placeholder="Selecione uma modalidade"
                    options={TIPO_CONTATO_OPTIONS}
                    value={selectedAcompanhamento.tipo_contato || ''}
                    onChange={(val) => setSelectedAcompanhamento({...selectedAcompanhamento, tipo_contato: val})}
                    required
                    icon={<Phone className="w-3.5 h-3.5" />}
                    showSearch={false}
                  />

                  {/* Entraves Informado Por */}
                  <SingleSelect 
                    label="Entrave(s) Informado Por"
                    placeholder="Selecione"
                    options={ENTRAVES_INFORMADO_POR_OPTIONS}
                    value={selectedAcompanhamento.entraves_informado_por || ''}
                    onChange={(val) => setSelectedAcompanhamento({...selectedAcompanhamento, entraves_informado_por: val})}
                    icon={<Info className="w-3.5 h-3.5" />}
                    showSearch={false}
                  />

                  {/* Situação Pós Busca */}
                  <SingleSelect 
                    label="Situação Pós Busca Ativa"
                    placeholder="Selecione o desfecho da busca"
                    className="col-span-1 md:col-span-2"
                    options={SITUACAO_POS_BUSCA_OPTIONS}
                    value={selectedAcompanhamento.situacao_pos_busca || ''}
                    onChange={(val) => setSelectedAcompanhamento({...selectedAcompanhamento, situacao_pos_busca: val})}
                    required
                    icon={<Info className="w-3.5 h-3.5" />}
                    showSearch={false}
                  />

                  {/* Entraves Identificados */}
                  <MultiSelect 
                    label="Entraves Identificados"
                    placeholder={selectedAcompanhamento.entraves_informado_por ? "Selecione" : "Selecione quem informou primeiro"}
                    className="col-span-1 md:col-span-2"
                    options={ENTRAVES_IDENTIFICADOS_OPTIONS}
                    value={selectedAcompanhamento.entraves_identificados || []}
                    onChange={(val) => setSelectedAcompanhamento({...selectedAcompanhamento, entraves_identificados: val})}
                    showSearch={false}
                    disabled={!selectedAcompanhamento.entraves_informado_por}
                    required={!!selectedAcompanhamento.entraves_informado_por}
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
                      value={selectedAcompanhamento.observacoes || ''} 
                      onChange={(e) => setSelectedAcompanhamento({...selectedAcompanhamento, observacoes: e.target.value})}
                      className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-4 resize-none transition-all outline-none placeholder:text-outline-variant/60 shadow-sm hover:border-primary/40 min-h-[120px]" 
                      rows={4}
                      placeholder="Informações adicionais relevantes..."
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
