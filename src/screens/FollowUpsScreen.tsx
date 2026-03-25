import React from 'react';
import { Header } from '../components/Header';
import { TrendingUp, BadgeCheck, Search, Filter, Download, Phone, Home, FileText, Eye, ChevronLeft, ChevronRight } from 'lucide-react';

export const FollowUpsScreen = () => {
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

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-surface-container-low/50">
                    <th className="px-8 py-4 text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest">Paciente</th>
                    <th className="px-8 py-4 text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest">Data da Ação</th>
                    <th className="px-8 py-4 text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest">Tipo de Contato</th>
                    <th className="px-8 py-4 text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest">Desfecho</th>
                    <th className="px-8 py-4 text-[0.6875rem] font-bold text-on-surface-variant uppercase tracking-widest text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  <tr className="hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-primary font-bold text-xs">MA</div>
                        <div>
                          <p className="text-sm font-bold text-primary">Maria Aparecida Silva</p>
                          <p className="text-xs text-on-surface-variant">SUS: 890 1234 5678 0001</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-on-surface">14 Out 2023, 09:30</td>
                    <td className="px-8 py-5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-[0.75rem] font-semibold">
                        <Phone className="w-4 h-4" />
                        Telefônico
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-800 text-[0.75rem] font-semibold">
                        Consulta Agendada
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="text-primary hover:bg-primary/5 p-2 rounded-full transition-colors">
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                  
                  <tr className="bg-surface-container-low/20 hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-primary font-bold text-xs">JS</div>
                        <div>
                          <p className="text-sm font-bold text-primary">João Soares Pereira</p>
                          <p className="text-xs text-on-surface-variant">SUS: 231 9901 4452 1109</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-on-surface">14 Out 2023, 11:15</td>
                    <td className="px-8 py-5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary-container text-on-secondary-container text-[0.75rem] font-semibold">
                        <Home className="w-4 h-4" />
                        Visita Domiciliar
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-800 text-[0.75rem] font-semibold">
                        Medicação Entregue
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="text-primary hover:bg-primary/5 p-2 rounded-full transition-colors">
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                  
                  <tr className="hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-primary font-bold text-xs">RL</div>
                        <div>
                          <p className="text-sm font-bold text-primary">Ricardo Lemos</p>
                          <p className="text-xs text-on-surface-variant">SUS: 450 7821 0092 3341</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-on-surface">13 Out 2023, 16:45</td>
                    <td className="px-8 py-5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-fixed text-on-primary-fixed text-[0.75rem] font-semibold">
                        <Phone className="w-4 h-4" />
                        Telefônico
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-error-container text-on-error-container text-[0.75rem] font-semibold">
                        Sem Contato (3ª Tentativa)
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="text-primary hover:bg-primary/5 p-2 rounded-full transition-colors">
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                  
                  <tr className="bg-surface-container-low/20 hover:bg-surface-container-low/30 transition-colors">
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-secondary-fixed flex items-center justify-center text-primary font-bold text-xs">BT</div>
                        <div>
                          <p className="text-sm font-bold text-primary">Beatriz Taveira</p>
                          <p className="text-xs text-on-surface-variant">SUS: 102 3345 8890 2217</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-sm font-medium text-on-surface">13 Out 2023, 14:00</td>
                    <td className="px-8 py-5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed text-[0.75rem] font-semibold">
                        <FileText className="w-4 h-4" />
                        UBS (Presencial)
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-100 text-green-800 text-[0.75rem] font-semibold">
                        Check-up Concluído
                      </span>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <button className="text-primary hover:bg-primary/5 p-2 rounded-full transition-colors">
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="px-8 py-4 border-t border-outline-variant/10 flex items-center justify-between">
              <p className="text-xs text-on-surface-variant">Mostrando 1-10 de 1.284 registros</p>
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
