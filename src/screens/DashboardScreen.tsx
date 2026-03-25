import React from 'react';
import { Users, Clock, CheckCircle2, AlertTriangle, ArrowRight, Download, BellRing, Plus, Activity, HeartPulse } from 'lucide-react';
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
            <h2 className="text-xl md:text-[1.5rem] font-bold text-primary font-headline tracking-tight">Painel de Acompanhamento</h2>
            <p className="text-sm text-on-surface-variant max-w-3xl leading-relaxed">
              Bem-vindo, <span className="font-bold text-primary">{user?.email || 'Profissional'}</span>. 
              Este é o panorama geral das ações de rastreio de câncer de colo de útero da sua microárea hoje.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-5 md:p-6 rounded-2xl flex flex-col justify-between h-36 md:h-40 border border-outline-variant/30 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-xl group-hover:bg-primary/10 transition-colors"></div>
              <div className="flex justify-between items-start relative z-10">
                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.15em] text-on-surface-variant/80">Mulheres na Microárea</span>
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Users className="w-4 h-4 md:w-5 md:h-5 text-primary" strokeWidth={2.5} />
                </div>
              </div>
              <div className="relative z-10">
                <div className="text-4xl md:text-[3.5rem] font-black text-primary leading-none tracking-tighter">1.240</div>
                <div className="text-[0.625rem] md:text-[0.6875rem] text-primary/70 font-bold mt-1 flex items-center gap-1">
                  <span className="text-tertiary-container">+12</span> novos cadastros
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-5 md:p-6 rounded-2xl flex flex-col justify-between h-36 md:h-40 border border-outline-variant/30 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-tertiary/5 rounded-full blur-xl group-hover:bg-tertiary/10 transition-colors"></div>
              <div className="flex justify-between items-start relative z-10">
                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.15em] text-on-surface-variant/80">Coletas Atrasadas</span>
                <div className="p-2 bg-tertiary/10 rounded-lg">
                  <Clock className="w-4 h-4 md:w-5 md:h-5 text-tertiary" strokeWidth={2.5} />
                </div>
              </div>
              <div className="relative z-10">
                <div className="text-4xl md:text-[3.5rem] font-black text-tertiary leading-none tracking-tighter">48</div>
                <div className="text-[0.625rem] md:text-[0.6875rem] text-tertiary/70 font-bold mt-1">Busca ativa necessária</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-surface-container-lowest to-surface-container-low p-5 md:p-6 rounded-2xl flex flex-col justify-between h-36 md:h-40 border border-outline-variant/30 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.05)] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-secondary/5 rounded-full blur-xl group-hover:bg-secondary/10 transition-colors"></div>
              <div className="flex justify-between items-start relative z-10">
                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.15em] text-on-surface-variant/80">Exames em Dia</span>
                <div className="p-2 bg-secondary/10 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 md:w-5 md:h-5 text-secondary" strokeWidth={2.5} />
                </div>
              </div>
              <div className="relative z-10">
                <div className="text-4xl md:text-[3.5rem] font-black text-secondary leading-none tracking-tighter">89%</div>
                <div className="text-[0.625rem] md:text-[0.6875rem] text-secondary/70 font-bold mt-1">Cobertura da equipe</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-error/5 to-error/10 p-5 md:p-6 rounded-2xl flex flex-col justify-between h-36 md:h-40 border border-error/20 shadow-[0_4px_20px_-4px_rgba(186,26,26,0.1)] relative overflow-hidden group hover:-translate-y-1 transition-transform duration-300">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-error/10 rounded-full blur-xl group-hover:bg-error/20 transition-colors"></div>
              <div className="flex justify-between items-start relative z-10">
                <span className="text-[10px] md:text-xs font-black uppercase tracking-[0.15em] text-error">Resultados Alterados</span>
                <div className="p-2 bg-error/10 rounded-lg">
                  <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-error" strokeWidth={2.5} />
                </div>
              </div>
              <div className="relative z-10">
                <div className="text-4xl md:text-[3.5rem] font-black text-error leading-none tracking-tighter">03</div>
                <div className="text-[0.625rem] md:text-[0.6875rem] text-error/80 font-bold mt-1 flex items-center gap-1">
                  <Activity className="w-3 h-3" /> Requer encaminhamento
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6 md:space-y-8">
            <div className="space-y-4 md:space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-base md:text-lg font-bold text-primary flex items-center gap-2">
                  <HeartPulse className="w-5 h-5 text-tertiary" />
                  Últimos Exames Processados
                </h3>
                <button className="text-xs font-bold text-primary flex items-center gap-1 hover:text-primary/80 transition-colors bg-primary/5 px-3 py-1.5 rounded-full">
                  Ver todos <ArrowRight className="w-3 h-3" />
                </button>
              </div>
              
              <div className="bg-surface-container-lowest rounded-2xl overflow-hidden border border-outline-variant/30 shadow-[0_8px_30px_-4px_rgba(0,0,0,0.04)]">
                <table className="w-full text-left border-collapse min-w-[600px] lg:min-w-full">
                  <thead>
                    <tr className="bg-surface-container-low/50">
                      <th className="py-4 px-6 text-[0.625rem] font-black uppercase tracking-[0.15em] text-on-surface-variant/70 border-b border-outline-variant/20">Paciente</th>
                      <th className="py-4 px-6 text-[0.625rem] font-black uppercase tracking-[0.15em] text-on-surface-variant/70 border-b border-outline-variant/20">Idade</th>
                      <th className="py-4 px-6 text-[0.625rem] font-black uppercase tracking-[0.15em] text-on-surface-variant/70 border-b border-outline-variant/20">Data da Coleta</th>
                      <th className="py-4 px-6 text-[0.625rem] font-black uppercase tracking-[0.15em] text-on-surface-variant/70 border-b border-outline-variant/20">Resultado</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm divide-y divide-outline-variant/10">
                    <tr className="hover:bg-surface-container-low/50 transition-colors group">
                      <td className="py-4 px-6 font-bold text-primary">Ana Maria Oliveira</td>
                      <td className="py-4 px-6 text-on-surface-variant font-medium">42 anos</td>
                      <td className="py-4 px-6 text-on-surface-variant font-medium">10/10/2024</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">NEGATIVO</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-surface-container-low/50 transition-colors group">
                      <td className="py-4 px-6 font-bold text-primary">Juliana Costa</td>
                      <td className="py-4 px-6 text-on-surface-variant font-medium">35 anos</td>
                      <td className="py-4 px-6 text-on-surface-variant font-medium">08/10/2024</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-error/10 text-error border border-error/20">ASC-US</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-surface-container-low/50 transition-colors group">
                      <td className="py-4 px-6 font-bold text-primary">Marta Pereira Souza</td>
                      <td className="py-4 px-6 text-on-surface-variant font-medium">55 anos</td>
                      <td className="py-4 px-6 text-on-surface-variant font-medium">05/10/2024</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">NEGATIVO</span>
                      </td>
                    </tr>
                    <tr className="hover:bg-surface-container-low/50 transition-colors group">
                      <td className="py-4 px-6 font-bold text-primary">Beatriz Silva</td>
                      <td className="py-4 px-6 text-on-surface-variant font-medium">28 anos</td>
                      <td className="py-4 px-6 text-on-surface-variant font-medium">01/10/2024</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-[10px] font-bold bg-surface-container-highest text-on-surface-variant border border-outline-variant/30">AGUARDANDO LAUDO</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
