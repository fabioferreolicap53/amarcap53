import React, { useState, useEffect } from 'react';
import { Users, Clock, CheckCircle2, AlertTriangle, ArrowRight, Download, BellRing, Plus, Activity, HeartPulse, Calendar, BadgeCheck, TrendingUp, Phone, MessageSquare, ClipboardList, PieChart, BarChart3 } from 'lucide-react';
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
    coberturaPercent: 0,
    alertBreakdown: {} as Record<string, number>,
    grupoBreakdown: {} as Record<string, number>,
    examVolume: { cito: 0, hpv: 0, pendente: 0 },
    examTrend: [] as { month: string; cito: number; hpv: number }[],
    acompTrend: [] as { month: string; total: number }[]
  });

  const [filterDataInicio, setFilterDataInicio] = useState('');
  const [filterDataFim, setFilterDataFim] = useState('');
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const [acompStats, setAcompStats] = useState({
    total: 0,
    sucesso: 0,
    contatos: 0,
    tipoBusca: {} as Record<string, number>,
    situacao: {} as Record<string, number>,
    entraves: {} as Record<string, number>
  });

  const formatEnumLabel = (value?: string) => value || '';
  const hasValue = (value: any) => value !== undefined && value !== null && value !== '' && value !== '--';

  const toValidDate = (value: any) => {
    if (!hasValue(value)) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  const getLastSixMonths = () => {
    const months: { key: string; label: string }[] = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      months.push({
        key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
        label: date.toLocaleDateString('pt-BR', { month: 'short' })
      });
    }
    return months;
  };

  const getAcompanhamentoMetodo = (record: any) => {
    if (record.tipo_busca) return formatEnumLabel(record.tipo_busca);
    if (record.tipo_contato) return formatEnumLabel(record.tipo_contato);
    return '';
  };

  useEffect(() => {
    const fetchStats = async () => {
      if (!user) return;
      try {
        const patientFilterParts: string[] = [];
        if (!isAdmin) {
          if (user.unidade_saude) patientFilterParts.push(`unidade = "${user.unidade_saude}"`);
          if (user.equipe) patientFilterParts.push(`equipe = "${user.equipe}"`);
          if (user.microarea) patientFilterParts.push(`microarea ~ "${user.microarea}"`);
        }

        // Fetch Pacientes
        const records = await pb.collection('amarcap53_pacientes').getFullList({
          filter: isAdmin ? '' : patientFilterParts.join(' && '),
          sort: '-created',
          requestKey: null
        });

        // Breakdown de Alertas e Grupos
        const alerts: Record<string, number> = {};
        const groups: Record<string, number> = {};
        const lastSixMonths = getLastSixMonths();
        const examTrendMap = Object.fromEntries(lastSixMonths.map(month => [month.key, { cito: 0, hpv: 0 }])) as Record<string, { cito: number; hpv: number }>;
        let currentCito = 0;
        let currentHpv = 0;
        
        records.forEach(p => {
          let status = 'NAO_IDENTIFICADO';
          if (hasValue(p.cito_laboratorio)) status = 'PEP_MOLECULAR';
          else if (hasValue(p.dna_hpv)) status = 'COLETA_MOLECULAR';
          else if (hasValue(p.cito_pep)) status = 'PEP_CITO';
          else if (hasValue(p.cito_lab)) status = 'COLETA_CITO';
          
          alerts[status] = (alerts[status] || 0) + 1;
          groups[p.grupo || 'NÃO INFORMADO'] = (groups[p.grupo || 'NÃO INFORMADO'] || 0) + 1;

          const citoDates = [toValidDate(p.cito_lab), toValidDate(p.cito_pep)].filter(Boolean) as Date[];
          const hpvDates = [toValidDate(p.dna_hpv), toValidDate(p.cito_laboratorio)].filter(Boolean) as Date[];

          if (citoDates.length > 0) currentCito++;
          if (hpvDates.length > 0) currentHpv++;

          citoDates.forEach(date => {
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (examTrendMap[key]) examTrendMap[key].cito++;
          });

          hpvDates.forEach(date => {
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (examTrendMap[key]) examTrendMap[key].hpv++;
          });
        });

        const total = records.length;
        const atrasadas = alerts['NAO_IDENTIFICADO'] || 0;
        const alterados = records.filter(p => {
          const alerta = (p.alertas_rastreamento || '').toUpperCase();
          return alerta.includes('IDENTIFICADO') && !alerta.includes('NÃO IDENTIFICADO');
        }).length;
        const emDia = Math.max(total - atrasadas - alterados, 0);
        const cobertura = total > 0 ? Math.round((emDia / total) * 100) : 0;
        const examTrend = lastSixMonths.map(month => ({
          month: month.label,
          ...(examTrendMap[month.key] || { cito: 0, hpv: 0 })
        }));
        const examVolume = {
          cito: currentCito,
          hpv: currentHpv,
          pendente: Math.max(total - currentCito - currentHpv, 0)
        };

        // Fetch Acompanhamentos
        const acompFilters = [];
        if (!isAdmin) {
          if (user.unidade_saude) acompFilters.push(`paciente.unidade = "${user.unidade_saude}"`);
          if (user.equipe) acompFilters.push(`paciente.equipe = "${user.equipe}"`);
          if (user.microarea) acompFilters.push(`paciente.microarea ~ "${user.microarea}"`);
        }
        if (filterDataInicio) {
          acompFilters.push(`data_busca >= "${filterDataInicio} 00:00:00"`);
        }
        if (filterDataFim) {
          acompFilters.push(`data_busca <= "${filterDataFim} 23:59:59"`);
        }

        const acompRecords = await pb.collection('amarcap53_acompanhamentos').getFullList({
          filter: acompFilters.join(' && '),
          sort: 'created',
          requestKey: null
        });

        const aStats = {
          total: acompRecords.length,
          sucesso: acompRecords.filter(r => r.situacao_pos_busca && r.situacao_pos_busca.includes('1- Agendamento')).length,
          contatos: acompRecords.filter(r => r.tipo_contato && !r.tipo_contato.includes('Não houve contato')).length,
          tipoBusca: {} as Record<string, number>,
          situacao: {} as Record<string, number>,
          entraves: {} as Record<string, number>
        };

        const acompTrendMap = Object.fromEntries(lastSixMonths.map(month => [month.key, 0])) as Record<string, number>;
        acompRecords.forEach(r => {
          const metodo = getAcompanhamentoMetodo(r);
          if (metodo) aStats.tipoBusca[metodo] = (aStats.tipoBusca[metodo] || 0) + 1;
          if (r.situacao_pos_busca) aStats.situacao[r.situacao_pos_busca] = (aStats.situacao[r.situacao_pos_busca] || 0) + 1;
          
          // Filtrar entraves reais (ignorar "0- Nenhum" ou similares)
          if (r.entraves_identificados && !r.entraves_identificados.startsWith('0')) {
            aStats.entraves[r.entraves_identificados] = (aStats.entraves[r.entraves_identificados] || 0) + 1;
          }

          const date = toValidDate(r.data_busca) || toValidDate(r.created);
          if (!date) return;
          const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          if (key in acompTrendMap) acompTrendMap[key] = (acompTrendMap[key] || 0) + 1;
        });

        const acompTrend = lastSixMonths.map(month => ({ month: month.label, total: acompTrendMap[month.key] || 0 }));

        setStats({
          totalPacientes: total,
          coletasAtrasadas: atrasadas,
          examesEmDia: emDia,
          resultadosAlterados: alterados,
          coberturaPercent: cobertura,
          alertBreakdown: alerts,
          grupoBreakdown: groups,
          examVolume,
          examTrend,
          acompTrend
        });

        setAcompStats(aStats);
      } catch (error: any) {
        if (error?.isAbort) return;
        console.error('Erro ao buscar estatísticas:', error);
      }
    };

    fetchStats();
  }, [user, isAdmin, filterDataInicio, filterDataFim]);

  const ColumnChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
      <div className="relative h-56 pt-8">
        <div className="absolute inset-x-0 bottom-8 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
        <div className="flex items-end justify-between h-full gap-4">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-3 group">
            <div className="relative w-full flex flex-col items-center justify-end h-full pb-8">
              <div 
                className={`w-full max-w-[52px] ${d.color} rounded-t-[1rem] transition-all duration-1000 ease-out shadow-xl relative group-hover:brightness-110 group-hover:scale-[1.03]`}
                style={{ height: `${(d.value / max) * 100}%` }}
              >
                <div className="absolute inset-x-0 top-0 h-10 bg-gradient-to-b from-white/20 to-transparent rounded-t-[1rem]" />
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-black z-20 shadow-xl">
                  {d.value}
                </div>
              </div>
            </div>
            <span className="text-[10px] md:text-[11px] font-black text-primary/80 uppercase tracking-tight truncate w-full text-center leading-tight">
              {d.label}
            </span>
          </div>
        ))}
        </div>
      </div>
    );
  };

  const LineChart: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    return (
      <div className="relative h-56 pt-8">
        <div className="absolute inset-x-0 bottom-8 h-px bg-gradient-to-r from-transparent via-primary/10 to-transparent" />
        <div className="absolute inset-0 flex items-end justify-between px-3">
          {data.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative group pb-8">
              <div 
                className="w-4.5 h-4.5 bg-primary rounded-full border-[3px] border-white shadow-xl z-10 transition-transform group-hover:scale-125"
                style={{ marginBottom: `${(d.value / max) * 100}%` }}
              />
              {i < data.length - 1 && (
                <div 
                  className="absolute h-1 bg-primary/45 origin-left rounded-full"
                  style={{ 
                    left: '50%', 
                    bottom: `${(d.value / max) * 100}%`,
                    width: '100%',
                    transform: `rotate(${Math.atan2((data[i+1].value - d.value) * 48 / max, 100) * 180 / Math.PI}deg)`
                  }}
                />
              )}
              <span className="mt-5 text-[10px] md:text-[11px] font-black text-primary/70 uppercase tracking-tight">
                {d.label}
              </span>
              <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[11px] px-2.5 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity font-black z-20 shadow-xl">
                {d.value}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const SimpleProgressBar: React.FC<{ label: string; value: number; total: number; color: string }> = ({ label, value, total, color }) => (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <span className="text-[11px] md:text-xs font-black uppercase tracking-widest text-primary/70 truncate max-w-[220px]">{label}</span>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm md:text-base font-black text-primary">{value}</span>
          <span className="text-[10px] md:text-[11px] font-black text-primary/50 uppercase bg-primary/5 px-2.5 py-1 rounded-full border border-primary/10">
            {total > 0 ? Math.round((value / total) * 100) : 0}%
          </span>
        </div>
      </div>
      <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden border border-outline-variant/10 shadow-inner">
        <div 
          className={`h-full ${color} transition-all duration-1000 ease-out shadow-lg rounded-full`} 
          style={{ width: `${total > 0 ? (value / total) * 100 : 0}%` }}
        />
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <Header 
        title="Resumo" 
        pageTitle="Resumo" 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-11 no-scrollbar relative">
        <div className="max-w-[1500px] mx-auto space-y-14 md:space-y-16">
          
          <div className="flex flex-col lg:flex-row items-stretch gap-6">
            <div className="flex-1 bg-gradient-to-br from-[#001b3d] via-[#002555] to-[#00346d] p-10 md:p-12 rounded-[3.25rem] shadow-2xl flex flex-col md:flex-row items-center justify-between gap-10 md:gap-12 relative overflow-hidden group border border-white/10">
              <div className="absolute -top-32 -right-32 w-96 h-96 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-all duration-1000"></div>
              <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-1000"></div>

              <div className="relative z-10 flex flex-col md:flex-row items-center gap-10 text-center md:text-left">
                <div className="w-20 h-20 md:w-24 md:h-24 rounded-[2.5rem] bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner group-hover:scale-105 transition-transform duration-500">
                  <Activity className="w-10 h-10 md:w-12 md:h-12 text-white" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-white/40 uppercase tracking-[0.45em] mb-4">Dashboard Geral</h2>
                  <p className="text-3xl md:text-4xl font-black text-white leading-tight tracking-tight">
                    Bem-vindo, <span className="text-blue-300">{user?.name?.split(' ')[0] || 'Profissional'}</span>
                  </p>
                </div>
              </div>

              <div className="relative z-10 flex gap-4 shrink-0">
                <div className="bg-white/10 px-6 py-4 rounded-[1.75rem] border border-white/10 backdrop-blur-sm shadow-xl">
                  <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-1">Status Global</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                    <span className="text-sm font-black text-white uppercase">Online</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Seletor de Período Profissional */}
            <div className="lg:w-[450px] bg-white p-8 rounded-[3.25rem] shadow-2xl border border-primary/5 relative overflow-hidden flex flex-col justify-center">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner">
                  <Calendar className="w-7 h-7 text-primary" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-primary uppercase tracking-tighter">Período de Análise</h3>
                  <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest">Filtrar Acompanhamentos</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary/50 uppercase tracking-widest ml-1">Início</label>
                  <input 
                    type="date"
                    value={filterDataInicio}
                    onChange={(e) => setFilterDataInicio(e.target.value)}
                    className="w-full p-4 bg-surface-container-low border-2 border-transparent rounded-2xl text-sm font-bold text-on-surface outline-none focus:border-primary/20 transition-all cursor-pointer"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-primary/50 uppercase tracking-widest ml-1">Fim</label>
                  <input 
                    type="date"
                    value={filterDataFim}
                    onChange={(e) => setFilterDataFim(e.target.value)}
                    className="w-full p-4 bg-surface-container-low border-2 border-transparent rounded-2xl text-sm font-bold text-on-surface outline-none focus:border-primary/20 transition-all cursor-pointer"
                  />
                </div>
              </div>
              
              {(filterDataInicio || filterDataFim) && (
                <button 
                  onClick={() => { setFilterDataInicio(''); setFilterDataFim(''); }}
                  className="mt-4 text-[10px] font-black text-rose-600 uppercase tracking-widest hover:text-rose-700 transition-colors flex items-center gap-2 justify-center py-2 bg-rose-50 rounded-xl border border-rose-100"
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Limpar Período
                </button>
              )}
            </div>
          </div>

          {/* Seção de Cards Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-7 md:gap-8">
            <div className="bg-white p-8 md:p-9 rounded-[2.75rem] shadow-xl border border-primary/5 hover:border-primary/20 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-primary/5 rounded-full blur-2xl" />
              <div className="flex justify-between items-start mb-7 relative z-10">
                <div className="w-16 h-16 rounded-[1.4rem] bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner">
                  <Users className="w-8 h-8 text-primary" strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.24em] text-on-surface-variant/40">Microárea</span>
              </div>
              <div className="text-5xl md:text-6xl font-black text-primary tracking-tighter mb-3 relative z-10">{stats.totalPacientes}</div>
              <p className="text-sm font-bold text-on-surface-variant/60 uppercase tracking-wide relative z-10">Mulheres Ativas</p>
            </div>

            <div className="bg-white p-8 md:p-9 rounded-[2.75rem] shadow-xl border border-primary/5 hover:border-tertiary/20 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-tertiary/5 rounded-full blur-2xl" />
              <div className="flex justify-between items-start mb-7 relative z-10">
                <div className="w-16 h-16 rounded-[1.4rem] bg-tertiary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner">
                  <Clock className="w-8 h-8 text-tertiary" strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.24em] text-on-surface-variant/40">Pendências</span>
              </div>
              <div className="text-5xl md:text-6xl font-black text-tertiary tracking-tighter mb-3 relative z-10">{stats.coletasAtrasadas}</div>
              <p className="text-sm font-bold text-on-surface-variant/60 uppercase tracking-wide relative z-10">Busca Ativa</p>
            </div>

            <div className="bg-white p-8 md:p-9 rounded-[2.75rem] shadow-xl border border-primary/5 hover:border-secondary/20 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-secondary/5 rounded-full blur-2xl" />
              <div className="flex justify-between items-start mb-7 relative z-10">
                <div className="w-16 h-16 rounded-[1.4rem] bg-secondary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner">
                  <CheckCircle2 className="w-8 h-8 text-secondary" strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.24em] text-on-surface-variant/40">Cobertura</span>
              </div>
              <div className="text-5xl md:text-6xl font-black text-secondary tracking-tighter mb-3 relative z-10">{stats.coberturaPercent}%</div>
              <p className="text-sm font-bold text-on-surface-variant/60 uppercase tracking-wide relative z-10">Exames em Dia</p>
            </div>

            <div className="bg-white p-8 md:p-9 rounded-[2.75rem] shadow-xl border border-error/10 hover:border-error/30 transition-all duration-500 group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-28 h-28 bg-error/5 rounded-full blur-2xl" />
              <div className="flex justify-between items-start mb-7 relative z-10">
                <div className="w-16 h-16 rounded-[1.4rem] bg-error/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner">
                  <AlertTriangle className="w-8 h-8 text-error" strokeWidth={2.5} />
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.24em] text-error/40">Crítico</span>
              </div>
              <div className="text-5xl md:text-6xl font-black text-error tracking-tighter mb-3 relative z-10">{stats.resultadosAlterados}</div>
              <p className="text-sm font-bold text-error/60 uppercase tracking-wide relative z-10">Casos Alterados</p>
            </div>
          </div>

          {/* Nova Seção de Levantamentos Estatísticos Criativos */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
            
            {/* Gráfico de Grupos de Idade */}
            <div className="bg-white p-9 md:p-11 rounded-[3rem] shadow-2xl border border-primary/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
              <div className="flex items-center justify-between mb-10 relative z-10">
                <div>
                  <h3 className="text-2xl md:text-[1.7rem] font-black text-primary uppercase tracking-tight flex items-center gap-4">
                    <Users className="w-7 h-7 text-primary" />
                    Perfil por Faixa Etária
                  </h3>
                  <p className="text-sm font-bold text-on-surface-variant/45 uppercase tracking-widest mt-2">Distribuição das Mulheres</p>
                </div>
              </div>

              <div className="space-y-7 relative z-10">
                {Object.entries(stats.grupoBreakdown)
                  .sort(([, a], [, b]) => b - a)
                  .map(([label, val]) => (
                    <SimpleProgressBar 
                      key={label}
                      label={label} 
                      value={val} 
                      total={stats.totalPacientes} 
                      color="bg-primary" 
                    />
                  ))}
              </div>
            </div>

            {/* Gráfico de Status de Rastreamento Real */}
            <div className="bg-white p-9 md:p-11 rounded-[3rem] shadow-2xl border border-primary/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/5 rounded-full blur-3xl" />
              <div className="flex items-center justify-between mb-10 relative z-10">
                <div>
                  <h3 className="text-2xl md:text-[1.7rem] font-black text-primary uppercase tracking-tight flex items-center gap-4">
                    <BadgeCheck className="w-7 h-7 text-emerald-500" />
                    Status Clínico Atual
                  </h3>
                  <p className="text-sm font-bold text-on-surface-variant/45 uppercase tracking-widest mt-2">Nível de Rastreamento</p>
                </div>
              </div>

              <div className="space-y-7 relative z-10">
                <SimpleProgressBar 
                  label="Resultado PEP Molecular" 
                  value={stats.alertBreakdown['PEP_MOLECULAR'] || 0} 
                  total={stats.totalPacientes} 
                  color="bg-blue-600" 
                />
                <SimpleProgressBar 
                  label="Coleta Molecular" 
                  value={stats.alertBreakdown['COLETA_MOLECULAR'] || 0} 
                  total={stats.totalPacientes} 
                  color="bg-orange-600" 
                />
                <SimpleProgressBar 
                  label="Resultado PEP Cito" 
                  value={stats.alertBreakdown['PEP_CITO'] || 0} 
                  total={stats.totalPacientes} 
                  color="bg-emerald-600" 
                />
                <SimpleProgressBar 
                  label="Coleta Cito (Lab)" 
                  value={stats.alertBreakdown['COLETA_CITO'] || 0} 
                  total={stats.totalPacientes} 
                  color="bg-yellow-600" 
                />
                <SimpleProgressBar 
                  label="Não Identificado" 
                  value={stats.alertBreakdown['NAO_IDENTIFICADO'] || 0} 
                  total={stats.totalPacientes} 
                  color="bg-red-600" 
                />
              </div>
            </div>

            {/* Gráfico de Acompanhamentos */}
            <div className="bg-white p-9 md:p-11 rounded-[3rem] shadow-2xl border border-primary/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-blue-500/5 rounded-full blur-3xl" />
              <div className="flex items-center justify-between mb-10 relative z-10 gap-4">
                <div>
                  <h3 className="text-2xl md:text-[1.7rem] font-black text-primary uppercase tracking-tight flex items-center gap-4">
                    <PieChart className="w-7 h-7 text-tertiary" />
                    Performance de Busca Ativa
                  </h3>
                  <p className="text-sm font-bold text-on-surface-variant/45 uppercase tracking-widest mt-2">Resultados dos contatos</p>
                </div>
                <div className="bg-primary/5 px-5 py-3 rounded-[1.4rem] border border-primary/10 shadow-sm shrink-0">
                  <span className="text-2xl font-black text-primary">{acompStats.total}</span>
                  <span className="text-[11px] font-bold text-primary/40 uppercase ml-2">Total</span>
                </div>
              </div>

              <div className="space-y-8 relative z-10">
                <SimpleProgressBar 
                  label="Sucesso no Agendamento" 
                  value={acompStats.sucesso} 
                  total={acompStats.total} 
                  color="bg-emerald-600" 
                />
                <SimpleProgressBar 
                  label="Contatos Efetivos" 
                  value={acompStats.contatos} 
                  total={acompStats.total} 
                  color="bg-blue-600" 
                />
                <SimpleProgressBar 
                  label="Buscas Infrutíferas" 
                  value={acompStats.total - acompStats.contatos} 
                  total={acompStats.total} 
                  color="bg-rose-600" 
                />
              </div>

              <div className="mt-12 pt-8 border-t border-outline-variant/10 grid grid-cols-3 gap-4 md:gap-5 text-center relative z-10">
                <div className="bg-primary/5 rounded-[1.4rem] px-4 py-5 border border-primary/10">
                  <p className="text-[11px] font-black text-on-surface-variant/40 uppercase mb-2 tracking-widest">Conversão</p>
                  <p className="text-3xl font-black text-primary">
                    {acompStats.total > 0 ? Math.round((acompStats.sucesso / acompStats.total) * 100) : 0}%
                  </p>
                </div>
                <div className="bg-blue-50 rounded-[1.4rem] px-4 py-5 border border-blue-100">
                  <p className="text-[11px] font-black text-on-surface-variant/40 uppercase mb-2 tracking-widest">Eficiência</p>
                  <p className="text-3xl font-black text-blue-500">
                    {acompStats.total > 0 ? Math.round((acompStats.contatos / acompStats.total) * 100) : 0}%
                  </p>
                </div>
                <div className="bg-rose-50 rounded-[1.4rem] px-4 py-5 border border-rose-100">
                  <p className="text-[11px] font-black text-on-surface-variant/40 uppercase mb-2 tracking-widest">Taxa Falha</p>
                  <p className="text-3xl font-black text-rose-500">
                    {acompStats.total > 0 ? Math.round(((acompStats.total - acompStats.contatos) / acompStats.total) * 100) : 0}%
                  </p>
                </div>
              </div>
            </div>

            {/* Gráfico de Entraves e Métodos */}
            <div className="bg-white p-9 md:p-11 rounded-[3rem] shadow-2xl border border-primary/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-40 h-40 bg-secondary/5 rounded-full blur-3xl" />
              <div className="flex items-center justify-between mb-10 relative z-10">
                <div>
                  <h3 className="text-2xl md:text-[1.7rem] font-black text-primary uppercase tracking-tight flex items-center gap-4">
                    <BarChart3 className="w-7 h-7 text-secondary" />
                    Métodos & Entraves
                  </h3>
                  <p className="text-sm font-bold text-on-surface-variant/45 uppercase tracking-widest mt-2">Análise qualitativa das ações</p>
                </div>
              </div>

              <div className="space-y-10 relative z-10">
                <div>
                  <p className="text-xs font-black text-primary uppercase tracking-[0.25em] mb-5 flex items-center gap-3">
                    <Phone className="w-4 h-4" /> Métodos de Busca (Top 2)
                  </p>
                  <div className="grid grid-cols-1 gap-4">
                    {Object.entries(acompStats.tipoBusca)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 2)
                      .map(([label, val], idx) => (
                        <div key={label} className="bg-surface-container-low p-5 rounded-[1.5rem] border border-outline-variant/10 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-sm ${idx === 0 ? 'bg-primary' : 'bg-primary/40'}`}>
                              {idx + 1}
                            </div>
                            <span className="text-xs md:text-sm font-bold text-on-surface-variant uppercase truncate max-w-[240px]">
                              {formatEnumLabel(label)}
                            </span>
                          </div>
                          <span className="text-lg font-black text-primary">{val}</span>
                        </div>
                      ))}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-black text-rose-500 uppercase tracking-[0.25em] mb-5 flex items-center gap-3">
                    <AlertTriangle className="w-4 h-4" /> Entraves Críticos (Top 2)
                  </p>
                  <div className="grid grid-cols-1 gap-4">
                    {Object.entries(acompStats.entraves)
                      .sort(([, a], [, b]) => b - a)
                      .slice(0, 2)
                      .map(([label, val], idx) => (
                        <div key={label} className="bg-rose-50 p-5 rounded-[1.5rem] border border-rose-100 flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center text-white font-black text-sm shadow-sm">
                              !
                            </div>
                            <span className="text-xs md:text-sm font-bold text-rose-700 uppercase truncate max-w-[240px]">
                              {formatEnumLabel(label)}
                            </span>
                          </div>
                          <span className="text-lg font-black text-rose-600">{val}</span>
                        </div>
                      ))}
                    {Object.keys(acompStats.entraves).length === 0 && (
                      <div className="bg-emerald-50 p-5 rounded-[1.5rem] border border-emerald-100 text-center">
                        <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest">Nenhum entrave identificado</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>

          <div className="space-y-8">
            <div className="flex justify-between items-center px-2 md:px-4">
              <h3 className="text-xl md:text-2xl font-black text-primary flex items-center gap-4 uppercase tracking-tight">
                <TrendingUp className="w-7 h-7 text-tertiary" />
                Tendências e Volumetria
              </h3>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-10">
              {/* Gráfico de Linha - Tendência de Acompanhamentos */}
              <div className="bg-white p-9 md:p-11 rounded-[3rem] shadow-2xl border border-primary/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full blur-3xl" />
                <div className="flex items-center justify-between mb-10 relative z-10">
                  <div>
                    <h3 className="text-2xl md:text-[1.7rem] font-black text-primary uppercase tracking-tight flex items-center gap-4">
                      <Activity className="w-7 h-7 text-primary" />
                      Fluxo de Acompanhamentos
                    </h3>
                    <p className="text-sm font-bold text-on-surface-variant/45 uppercase tracking-widest mt-2">Tendência Mensal</p>
                  </div>
                </div>
                <LineChart 
                  data={stats.acompTrend.map(t => ({ label: t.month, value: t.total }))} 
                />
              </div>

              {/* Gráfico de Colunas - Volume por Tipo de Exame */}
              <div className="bg-white p-9 md:p-11 rounded-[3rem] shadow-2xl border border-primary/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-40 h-40 bg-secondary/5 rounded-full blur-3xl" />
                <div className="flex items-center justify-between mb-10 relative z-10">
                  <div>
                    <h3 className="text-2xl md:text-[1.7rem] font-black text-primary uppercase tracking-tight flex items-center gap-4">
                      <BarChart3 className="w-7 h-7 text-secondary" />
                      Volume por Tipo de Exame
                    </h3>
                    <p className="text-sm font-bold text-on-surface-variant/45 uppercase tracking-widest mt-2">Comparativo Cito vs Molecular</p>
                  </div>
                </div>
                <ColumnChart 
                data={[
                  { label: 'Citopatológico', value: stats.examVolume.cito, color: 'bg-emerald-600' },
                  { label: 'Molecular DNA', value: stats.examVolume.hpv, color: 'bg-blue-600' },
                  { label: 'Pendente', value: stats.examVolume.pendente, color: 'bg-rose-600' },
                ]} 
              />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
