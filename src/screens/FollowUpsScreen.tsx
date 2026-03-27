import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { TrendingUp, BadgeCheck, Search, Filter, Download, Phone, Home, FileText, Eye, ChevronLeft, ChevronRight, Edit, Trash2 } from 'lucide-react';
import { pb } from '../lib/pocketbase';
import { useAuth } from '../contexts/AuthContext';

export const FollowUpsScreen = () => {
  const { user } = useAuth();
  const [acompanhamentos, setAcompanhamentos] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
    alert('Funcionalidade de edição em desenvolvimento.');
    // Aqui você implementaria a lógica para abrir um modal de edição
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <Header 
        title="AMAR - ACOMPANHAMENTO DA MULHER NAS AÇÕES DE RASTREIO" 
        pageTitle="Acompanhamentos"
        subtitle="Unidade de Saúde: SMS RJ" 
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
              <p className="text-xl md:text-2xl font-bold text-primary">1.284</p>
              <div className="mt-3 md:mt-4 flex items-center text-[10px] md:text-xs text-green-600 font-semibold">
                <TrendingUp className="w-3 h-3 md:w-4 md:h-4 mr-1" />
                +12% vs anterior
              </div>
            </div>
            
            <div className="bg-surface-container-lowest p-5 md:p-6 rounded-xl shadow-sm">
              <p className="text-[10px] md:text-[0.6875rem] font-medium text-on-surface-variant uppercase tracking-wider mb-1">Contatos Telefônicos</p>
              <p className="text-xl md:text-2xl font-bold text-primary">842</p>
              <div className="mt-3 md:mt-4 w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[65%]"></div>
              </div>
            </div>
            
            <div className="bg-surface-container-lowest p-5 md:p-6 rounded-xl shadow-sm">
              <p className="text-[10px] md:text-[0.6875rem] font-medium text-on-surface-variant uppercase tracking-wider mb-1">Visitas Domiciliares</p>
              <p className="text-xl md:text-2xl font-bold text-primary">312</p>
              <div className="mt-3 md:mt-4 w-full bg-surface-container-low h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full w-[24%]"></div>
              </div>
            </div>
            
            <div className="bg-surface-container-lowest p-5 md:p-6 rounded-xl shadow-sm">
              <p className="text-[10px] md:text-[0.6875rem] font-medium text-on-surface-variant uppercase tracking-wider mb-1">Taxa de Sucesso</p>
              <p className="text-xl md:text-2xl font-bold text-primary">94.2%</p>
              <div className="mt-3 md:mt-4 flex items-center text-[10px] md:text-xs text-primary font-semibold">
                <BadgeCheck className="w-3 h-3 md:w-4 md:h-4 mr-1 fill-primary text-white" />
                Meta Atingida
              </div>
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
    </div>
  );
};
