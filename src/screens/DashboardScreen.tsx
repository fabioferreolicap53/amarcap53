import React from 'react';
import { Users, Clock, CheckCircle2, AlertTriangle, ArrowRight, Download, BellRing, Plus } from 'lucide-react';
import { Header } from '../components/Header';
import { useAuth } from '../contexts/AuthContext';

export const DashboardScreen = () => {
  const { user } = useAuth();
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <Header title="Resumo" pageTitle="Resumo" />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-11 no-scrollbar relative">
        <div className="max-w-7xl mx-auto space-y-6 md:space-y-11">
          
          <div className="space-y-2">
            <h2 className="text-xl md:text-[1.5rem] font-bold text-primary font-headline">Resumo Geral</h2>
            <p className="text-sm text-on-surface-variant">Bem-vindo, {user?.email || 'Dr(a)'}. Aqui estão as métricas de hoje para sua unidade.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-surface-container-lowest p-5 md:p-6 rounded-xl flex flex-col justify-between h-36 md:h-40 border-l-4 border-primary shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-on-surface-variant">Total Pacientes</span>
                <Users className="w-4 h-4 md:w-5 md:h-5 text-primary/40" />
              </div>
              <div>
                <div className="text-4xl md:text-[3.5rem] font-black text-primary leading-none tracking-tighter">1.240</div>
                <div className="text-[0.625rem] md:text-[0.6875rem] text-on-surface-variant font-medium mt-1">+12 esta semana</div>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-5 md:p-6 rounded-xl flex flex-col justify-between h-36 md:h-40 border-l-4 border-on-tertiary-container shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-on-surface-variant">Rastreios Pendentes</span>
                <Clock className="w-4 h-4 md:w-5 md:h-5 text-on-tertiary-container/40" />
              </div>
              <div>
                <div className="text-4xl md:text-[3.5rem] font-black text-primary leading-none tracking-tighter">48</div>
                <div className="text-[0.625rem] md:text-[0.6875rem] text-on-tertiary-container font-medium mt-1">Ação requerida imediata</div>
              </div>
            </div>

            <div className="bg-surface-container-lowest p-5 md:p-6 rounded-xl flex flex-col justify-between h-36 md:h-40 border-l-4 border-secondary shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-on-surface-variant">Concluídos (Hoje)</span>
                <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-secondary/40" />
              </div>
              <div>
                <div className="text-4xl md:text-[3.5rem] font-black text-primary leading-none tracking-tighter">14</div>
                <div className="text-[0.625rem] md:text-[0.6875rem] text-on-surface-variant font-medium mt-1">Meta diária: 20</div>
              </div>
            </div>

            <div className="bg-error-container p-5 md:p-6 rounded-xl flex flex-col justify-between h-36 md:h-40 border-l-4 border-error shadow-sm">
              <div className="flex justify-between items-start">
                <span className="text-[10px] md:text-xs font-bold uppercase tracking-widest text-error">Alertas Críticos</span>
                <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-error/40 fill-error/20" />
              </div>
              <div>
                <div className="text-4xl md:text-[3.5rem] font-black text-error leading-none tracking-tighter">03</div>
                <div className="text-[0.625rem] md:text-[0.6875rem] text-error font-bold mt-1">Casos de alta prioridade</div>
              </div>
            </div>
          </div>

          <div className="space-y-6 md:space-y-8">
            <div className="space-y-4 md:space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-base md:text-lg font-bold text-primary">Acompanhamentos Recentes</h3>
                <button className="text-xs font-bold text-primary flex items-center gap-1 hover:underline">
                  Ver todos <ArrowRight className="w-4 h-4" />
                </button>
              </div>
              
              <div className="bg-surface-container-lowest rounded-xl overflow-x-auto shadow-sm">
                <table className="w-full text-left border-collapse min-w-[600px] lg:min-w-full">
                  <thead>
                    <tr className="bg-surface-container-low">
                      <th className="py-3 md:py-4 px-4 md:px-6 text-[0.625rem] md:text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant">Paciente</th>
                      <th className="py-3 md:py-4 px-4 md:px-6 text-[0.625rem] md:text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant">Procedimento</th>
                      <th className="py-3 md:py-4 px-4 md:px-6 text-[0.625rem] md:text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant">Data/Hora</th>
                      <th className="py-3 md:py-4 px-4 md:px-6 text-[0.625rem] md:text-[0.6875rem] font-bold uppercase tracking-widest text-on-surface-variant">Status</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-outline-variant/10">
                    <tr className="hover:bg-surface-container-low transition-colors">
                      <td className="py-3 md:py-4 px-4 md:px-6 font-semibold">Ana Maria Oliveira</td>
                      <td className="py-3 md:py-4 px-4 md:px-6 text-on-surface-variant">Rastreio Cardiovascular</td>
                      <td className="py-3 md:py-4 px-4 md:px-6 text-on-surface-variant">Hoje, 10:30</td>
                      <td className="py-3 md:py-4 px-4 md:px-6">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] md:text-xs font-medium bg-primary-fixed text-on-primary-fixed">Concluído</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-surface-container-low transition-colors">
                      <td className="py-4 px-6 font-semibold">Roberto Silva Junior</td>
                      <td className="py-4 px-6 text-on-surface-variant">Acompanhamento Diabetes</td>
                      <td className="py-4 px-6 text-on-surface-variant">Hoje, 09:15</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-secondary-container text-on-secondary-container">Em Análise</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-surface-container-low transition-colors">
                      <td className="py-4 px-6 font-semibold">Juliana Costa</td>
                      <td className="py-4 px-6 text-on-surface-variant">Rastreio Oncológico</td>
                      <td className="py-4 px-6 text-on-surface-variant">Ontem, 16:40</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-error-container text-on-error-container">Crítico</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-surface-container-low transition-colors">
                      <td className="py-4 px-6 font-semibold">Marcos Pereira</td>
                      <td className="py-4 px-6 text-on-surface-variant">Triagem Geral</td>
                      <td className="py-4 px-6 text-on-surface-variant">Ontem, 14:20</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary-fixed text-on-primary-fixed">Concluído</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
        
        <button className="fixed bottom-8 right-8 bg-gradient-to-r from-primary to-primary-container text-white w-14 h-14 rounded-full shadow-lg flex items-center justify-center hover:scale-105 transition-transform z-50">
          <Plus className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
};
