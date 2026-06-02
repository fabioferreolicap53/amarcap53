import React, { useState, useEffect } from 'react';
import { Users, Clock, CheckCircle2, AlertTriangle, ArrowRight, Download, BellRing, Plus, Activity, HeartPulse, Calendar, BadgeCheck } from 'lucide-react';
import { Header } from '../components/Header';
import { useAuth } from '../contexts/AuthContext';
import { pb } from '../lib/pocketbase';

interface DashboardScreenProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ activeTab, setActiveTab }) => {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    totalPacientes: 0,
    coletasAtrasadas: 0,
    examesEmDia: 0,
    resultadosAlterados: 0,
    coberturaPercent: 0
  });

  const [ultimosExames, setUltimosExames] = useState<any[]>([]);

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      try {
        const records = await pb.collection('amarcap53_pacientes').getFullList({
          filter: isAdmin ? '' : `unidade = "${user?.unidade_saude}" && equipe = "${user?.equipe}" && microarea = ${parseInt(user?.microarea || '0')}`,
          sort: '-created',
          requestKey: null // Desativa auto-cancelamento para evitar erro 0 no log se houver concorrência leve
        });

        const total = records.length;
        const atrasadas = records.filter(p => p.alertas_rastreamento && p.alertas_rastreamento.toUpperCase().includes('NÃO IDENTIFICADO')).length;
        const alterados = records.filter(p => p.alertas_rastreamento && p.alertas_rastreamento.toUpperCase().includes('IDENTIFICADO')).length;
        const emDia = total - atrasadas - alterados;
        const cobertura = total > 0 ? Math.round((emDia / total) * 100) : 0;

        setStats({
          totalPacientes: total,
          coletasAtrasadas: atrasadas,
          examesEmDia: emDia,
          resultadosAlterados: alterados,
          coberturaPercent: cobertura
        });

        // Pegar os 5 últimos exames (usando campos reais do PocketBase)
        const pacientesComData = records
          .filter(p => p.cito_lab || p.cito_pep || p.dna_hpv)
          .slice(0, 5);
        setUltimosExames(pacientesComData);
      } catch (error: any) {
        // Silencia erro 0 (auto-cancelamento do PocketBase)
        if (error?.isAbort) return;
        console.error('Erro ao buscar estatísticas:', error);
      }
    };

    fetchStats();
  }, [user]);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <Header 
        title="Resumo" 
        pageTitle="Resumo" 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-11 no-scrollbar relative">
        <div className="max-w-7xl mx-auto space-y-12 md:space-y-16">
          
          <div className="bg-gradient-to-br from-[#001b3d] to-[#002b5c] p-10 md:p-14 rounded-[3rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-10 relative overflow-hidden group">
            {/* Efeitos de luz no fundo */}
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-1000"></div>
            <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-1000"></div>

            <div className="relative z-10 flex flex-col md:flex-row items-center gap-10 text-center md:text-left">
              <div className="w-24 h-24 rounded-[2.5rem] bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner group-hover:scale-105 transition-transform duration-500">
                <Activity className="w-12 h-12 text-white" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black text-white/40 uppercase tracking-[0.5em] mb-3">Dashboard Geral</h2>
                <p className="text-2xl md:text-4xl font-black text-white leading-tight tracking-tight">
                  Bem-vindo, <span className="text-primary">{user?.name?.split(' ')[0] || 'Profissional'}</span>
                </p>
                <p className="text-sm text-white/50 font-medium mt-3 max-w-xl">
                  Panorama das ações de rastreio de câncer de colo de útero em sua microárea hoje.
                </p>
              </div>
            </div>

            <div className="relative z-10 flex gap-4">
              <div className="bg-white/5 px-6 py-4 rounded-3xl border border-white/10 backdrop-blur-sm">
                <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Status Global</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                  <span className="text-sm font-black text-white uppercase">Sistema Online</span>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8">
            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-primary/5 hover:border-primary/20 transition-all duration-500 group">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <Users className="w-7 h-7 text-primary" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">Microárea</span>
              </div>
              <div className="text-4xl md:text-5xl font-black text-primary tracking-tighter mb-2">{stats.totalPacientes}</div>
              <p className="text-xs font-bold text-on-surface-variant/60 uppercase">Mulheres Ativas</p>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-primary/5 hover:border-tertiary/20 transition-all duration-500 group">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl bg-tertiary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <Clock className="w-7 h-7 text-tertiary" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">Pendências</span>
              </div>
              <div className="text-4xl md:text-5xl font-black text-tertiary tracking-tighter mb-2">{stats.coletasAtrasadas}</div>
              <p className="text-xs font-bold text-on-surface-variant/60 uppercase">Busca Ativa</p>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-primary/5 hover:border-secondary/20 transition-all duration-500 group">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <CheckCircle2 className="w-7 h-7 text-secondary" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/40">Cobertura</span>
              </div>
              <div className="text-4xl md:text-5xl font-black text-secondary tracking-tighter mb-2">{stats.coberturaPercent}%</div>
              <p className="text-xs font-bold text-on-surface-variant/60 uppercase">Exames em Dia</p>
            </div>

            <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-error/10 hover:border-error/30 transition-all duration-500 group">
              <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl bg-error/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                  <AlertTriangle className="w-7 h-7 text-error" strokeWidth={2.5} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-error/40">Crítico</span>
              </div>
              <div className="text-4xl md:text-5xl font-black text-error tracking-tighter mb-2">{stats.resultadosAlterados}</div>
              <p className="text-xs font-bold text-error/60 uppercase">Casos Alterados</p>
            </div>
          </div>

          <div className="space-y-8">
            <div className="flex justify-between items-center px-4">
              <h3 className="text-lg md:text-xl font-black text-primary flex items-center gap-3 uppercase tracking-tighter">
                <HeartPulse className="w-6 h-6 text-tertiary" />
                Exames Processados
              </h3>
              <button 
                onClick={() => setActiveTab('pacientes')}
                className="text-[10px] font-black text-primary flex items-center gap-2 hover:bg-primary hover:text-white transition-all duration-300 bg-primary/5 px-6 py-3 rounded-2xl uppercase tracking-widest border border-primary/10 shadow-sm"
              >
                Gerenciar Pacientes <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="bg-white rounded-[2.5rem] overflow-hidden border border-outline-variant/10 shadow-2xl">
              <div className="overflow-x-auto custom-scrollbar-horizontal">
                <table className="w-full text-center border-collapse min-w-[600px] lg:min-w-full">
                  <thead>
                    <tr className="bg-[#001b3d] border-b border-white/10 shadow-sm">
                      <th className="py-6 px-8 text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] text-blue-200/80 border-r border-white/5">
                        <div className="flex flex-col items-center gap-1">
                          <Users className="w-4 h-4 text-blue-400/60" />
                          <span>Paciente</span>
                        </div>
                      </th>
                      <th className="py-6 px-8 text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] text-blue-200/80 border-r border-white/5">
                        <div className="flex flex-col items-center gap-1">
                          <Calendar className="w-4 h-4 text-blue-400/60" />
                          <span>Data da Coleta</span>
                        </div>
                      </th>
                      <th className="py-6 px-8 text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] text-blue-200/80 border-r border-white/5">
                        <div className="flex flex-col items-center gap-1">
                          <Activity className="w-4 h-4 text-blue-400/60" />
                          <span>Idade</span>
                        </div>
                      </th>
                      <th className="py-6 px-8 text-[10px] md:text-[11px] font-black uppercase tracking-[0.15em] text-blue-200/80">
                        <div className="flex flex-col items-center gap-1">
                          <BadgeCheck className="w-4 h-4 text-blue-400/60" />
                          <span>Resultado</span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/5">
                    {ultimosExames.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-20 px-8 text-center opacity-30">
                          <HeartPulse className="w-16 h-16 mx-auto mb-4" />
                          <p className="text-sm font-black uppercase tracking-widest">Nenhum exame recente</p>
                        </td>
                      </tr>
                    ) : (
                      ultimosExames.map((exame, index) => (
                          <tr key={exame.id || index} className="hover:bg-primary/[0.03] transition-all group">
                            <td className="py-6 px-8 text-center">
                              <p className="text-sm font-black text-primary uppercase leading-tight">{exame.nome}</p>
                            </td>
                            <td className="py-6 px-8 text-center">
                              <span className="text-[13px] font-black text-[#001b3d] uppercase whitespace-nowrap bg-surface-container-low px-3 py-1.5 rounded-lg border border-outline-variant/10">
                                {(() => {
                                  const dataRaw = exame.cito_lab || exame.cito_pep || exame.dna_hpv || '--';
                                  if (dataRaw === '--') return '--';
                                  const datePart = dataRaw.split(' ')[0].split('T')[0];
                                  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
                                    const [y, m, d] = datePart.split('-');
                                    return `${d}/${m}/${y}`;
                                  }
                                  return datePart;
                                })()}
                              </span>
                            </td>
                            <td className="py-6 px-8 text-center">
                              <span className="text-[13px] font-black text-on-surface-variant uppercase">{exame.idade} anos</span>
                            </td>
                            <td className="py-6 px-8 text-center">
                              <span className={`inline-flex items-center px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-tight border shadow-sm ${
                                exame.alertas_rastreamento && exame.alertas_rastreamento.toUpperCase().includes('IDENTIFICADO') 
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                  : 'bg-rose-50 text-rose-700 border-rose-100'
                              }`}>
                                {exame.alertas_rastreamento && exame.alertas_rastreamento.toUpperCase().includes('IDENTIFICADO') ? 'REALIZADO' : 'PENDENTE'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
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
