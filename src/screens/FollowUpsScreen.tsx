import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { TrendingUp, BadgeCheck, Search, Filter, Download, Phone, Home, FileText, Eye, ChevronLeft, ChevronRight, Edit, Trash2, X, ClipboardList, Calendar, Info, Building, AlertTriangle, MessageSquare, CheckCircle2 } from 'lucide-react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../contexts/AuthContext';

export const FollowUpsScreen = () => {
  const { user } = useAuth();
  const [acompanhamentos, setAcompanhamentos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Modal de edição state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedAcompanhamento, setSelectedAcompanhamento] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

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
      // Ajuste de data para o input type="date" (YYYY-MM-DD)
      const dataBuscaFormatada = acompToEdit.data_busca 
        ? new Date(acompToEdit.data_busca).toISOString().split('T')[0]
        : '';

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
      data_busca: formData.get('data_busca') || '',
      tipo_contato: formData.get('tipo_contato') || '',
      situacao_pos_busca: formData.get('situacao_pos_busca') || '',
      identificacao_rede: formData.get('identificacao_rede') || '',
      principais_entraves: formData.get('principais_entraves') || '',
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
      />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 no-scrollbar">
        <div className="max-w-7xl mx-auto">
          
          <div className="mb-6 md:mb-12">
            <h2 className="text-xl md:text-2xl font-bold font-headline text-primary mb-2">Acompanhamentos Realizados</h2>
            <p className="text-sm text-on-surface-variant max-w-2xl">
              Histórico detalhado das interações clínicas e ações preventivas executadas pela equipe de rastreio de saúde.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-12">
            <div className="bg-surface-container-lowest p-5 md:p-6 rounded-xl border-l-4 border-primary shadow-sm">
              <p className="text-[10px] md:text-[0.6875rem] font-medium text-on-surface-variant uppercase tracking-wider mb-1">Total este mês</p>
              <p className="text-xl md:text-2xl font-bold text-primary">{acompanhamentos.length}</p>
            </div>
            
            <div className="bg-surface-container-lowest p-5 md:p-6 rounded-xl shadow-sm">
              <p className="text-[10px] md:text-[0.6875rem] font-medium text-on-surface-variant uppercase tracking-wider mb-1">Contatos Realizados</p>
              <p className="text-xl md:text-2xl font-bold text-primary">
                {acompanhamentos.filter(a => a.tipo_contato && a.tipo_contato !== 'Não houve contato (não localizada, ligação não atendida...)').length}
              </p>
            </div>
            
            <div className="bg-surface-container-lowest p-5 md:p-6 rounded-xl shadow-sm">
              <p className="text-[10px] md:text-[0.6875rem] font-medium text-on-surface-variant uppercase tracking-wider mb-1">Buscas sem Sucesso</p>
              <p className="text-xl md:text-2xl font-bold text-primary">
                {acompanhamentos.filter(a => a.tipo_contato === 'Não houve contato (não localizada, ligação não atendida...)').length}
              </p>
            </div>
            
            <div className="bg-surface-container-lowest p-5 md:p-6 rounded-xl shadow-sm">
              <p className="text-[10px] md:text-[0.6875rem] font-medium text-on-surface-variant uppercase tracking-wider mb-1">Sucesso no Agendamento</p>
              <p className="text-xl md:text-2xl font-bold text-primary">
                {acompanhamentos.filter(a => a.situacao_pos_busca === 'Sucesso no agendamento').length}
              </p>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm">
            <div className="px-4 md:px-8 py-4 md:py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-outline-variant/10 gap-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 w-full sm:w-auto">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4 md:w-5 md:h-5" />
                  <input 
                    className="pl-9 md:pl-10 pr-4 py-2 bg-surface-container-low border-none rounded-md text-sm focus:ring-1 focus:ring-primary w-full sm:w-48 md:w-64 transition-all" 
                    placeholder="Buscar paciente ou data..." 
                    type="text" 
                  />
                </div>
                <button className="flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-primary hover:bg-surface-container-low rounded-md transition-colors border border-primary/10 sm:border-none">
                  <Filter className="w-4 h-4 md:w-5 md:h-5" />
                  Filtros
                </button>
              </div>
              <button className="w-full sm:w-auto bg-gradient-to-r from-[#051934] to-[#1c2e4a] text-white px-5 py-2 rounded-md text-sm font-semibold flex items-center justify-center gap-2 shadow-sm hover:opacity-90 transition-all">
                <Download className="w-4 h-4 md:w-5 md:h-5" />
                Exportar Relatório
              </button>
            </div>

            <div className="overflow-x-auto custom-scrollbar-horizontal">
              <table className="w-full text-left border-collapse min-w-[900px] lg:min-w-full">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-4 md:px-8 py-4 text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest">Paciente</th>
                    <th className="px-4 md:px-8 py-4 text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest">Data da Ação</th>
                    <th className="px-4 md:px-8 py-4 text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest">Tipo de Contato</th>
                    <th className="px-4 md:px-8 py-4 text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest">Desfecho</th>
                    <th className="px-4 md:px-8 py-4 text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {isLoading ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant text-sm">
                        Carregando acompanhamentos...
                      </td>
                    </tr>
                  ) : acompanhamentos.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-on-surface-variant text-sm">
                        Nenhum acompanhamento registrado ainda.
                      </td>
                    </tr>
                  ) : (
                    acompanhamentos.map((acomp) => {
                      const pacienteNome = acomp.expand?.paciente?.nome || 'Paciente Desconhecido';
                      const pacienteIniciais = pacienteNome.substring(0, 2).toUpperCase();
                      const cns = acomp.expand?.paciente?.cns || '--';
                      
                      // Formatando a data
                      const dataFormatada = acomp.data_busca 
                        ? new Date(acomp.data_busca).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                        : '--';

                      return (
                        <tr key={acomp.id} className="hover:bg-surface-container-low/30 transition-colors group">
                          <td className="px-4 md:px-8 py-5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-primary font-bold text-xs flex-shrink-0">
                                {pacienteIniciais}
                              </div>
                              <div className="min-w-[120px]">
                                <p className="text-sm font-bold text-primary truncate" title={pacienteNome}>{pacienteNome}</p>
                                <p className="text-[10px] text-on-surface-variant">CNS: {cns}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 md:px-8 py-5 text-sm font-medium text-on-surface whitespace-nowrap">
                            {dataFormatada}
                          </td>
                          <td className="px-4 md:px-8 py-5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-[0.75rem] font-semibold">
                              <Phone className="w-4 h-4" />
                              {acomp.tipo_contato || '--'}
                            </span>
                          </td>
                          <td className="px-4 md:px-8 py-5 whitespace-nowrap">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-800 text-[0.75rem] font-semibold">
                              {acomp.situacao_pos_busca || '--'}
                            </span>
                          </td>
                          <td className="px-4 md:px-8 py-5 text-right">
                            <div className="flex items-center justify-end gap-2 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                              <button 
                                onClick={() => handleEdit(acomp.id)}
                                className="text-primary hover:bg-primary/10 p-2 rounded-full transition-colors"
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => handleDelete(acomp.id)}
                                className="text-error hover:bg-error/10 p-2 rounded-full transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
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

            <div className="px-8 py-4 border-t border-outline-variant/10 flex items-center justify-between">
              <p className="text-xs text-on-surface-variant">Mostrando {acompanhamentos.length} registros</p>
              <div className="flex items-center gap-1">
                <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-low text-primary disabled:opacity-30" disabled>
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button className="w-8 h-8 flex items-center justify-center rounded bg-primary text-white text-xs font-bold">1</button>
                <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-low text-primary text-xs font-bold">2</button>
                <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-low text-primary text-xs font-bold">3</button>
                <span className="px-1 text-xs text-on-surface-variant">...</span>
                <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-low text-primary text-xs font-bold">129</button>
                <button className="w-8 h-8 flex items-center justify-center rounded hover:bg-surface-container-low text-primary">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
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
                      defaultValue={selectedAcompanhamento.data_busca_formatada}
                      required
                      className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none shadow-sm hover:border-primary/40" 
                      type="date" 
                    />
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
                      <option value="Contato direto">Contato direto</option>
                      <option value="Contato indireto (mensagem)">Contato indireto (mensagem)</option>
                      <option value="Não houve contato (não localizada, ligação não atendida...)">Não houve contato (não localizada, ligação não atendida...)</option>
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
                      <option value="Sucesso no agendamento">Sucesso no agendamento</option>
                      <option value="Recusa do procedimento">Recusa do procedimento</option>
                      <option value="Não localizada">Não localizada</option>
                      <option value="Óbito">Óbito</option>
                      <option value="Mudança de endereço">Mudança de endereço</option>
                      <option value="Em tratamento particular">Em tratamento particular</option>
                      <option value="Aguardando retorno da rede">Aguardando retorno da rede</option>
                      <option value="Falha de comunicação">Falha de comunicação</option>
                      <option value="Reagendado">Reagendado</option>
                      <option value="Outros">Outros</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-on-surface-variant">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                {/* Identificação da Rede */}
                <div className="space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <Building className="w-3.5 h-3.5" />
                    </div>
                    Identificação da Rede
                  </label>
                  <input 
                    name="identificacao_rede"
                    defaultValue={selectedAcompanhamento.identificacao_rede}
                    className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none placeholder:text-outline-variant/60 shadow-sm hover:border-primary/40" 
                    placeholder="Ex: Hospital Souza Aguiar" 
                    type="text" 
                  />
                </div>

                {/* Principais Entraves */}
                <div className="space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    Principais Entraves
                  </label>
                  <input 
                    name="principais_entraves"
                    defaultValue={selectedAcompanhamento.principais_entraves}
                    className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none placeholder:text-outline-variant/60 shadow-sm hover:border-primary/40" 
                    placeholder="Ex: Falta de transporte, mudança de telefone" 
                    type="text" 
                  />
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
