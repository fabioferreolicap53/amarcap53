import React, { useState, useEffect } from 'react';
import { Users, Clock, CheckCircle2, AlertTriangle, ArrowRight, Download, BellRing, Plus, Activity, HeartPulse, Calendar, BadgeCheck, TrendingUp, Phone, MessageSquare, ClipboardList, PieChart, BarChart3, MapPin, LayoutDashboard, Filter, CheckCircle, AlertCircle, Target, Building2, Building, X } from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement
} from 'chart.js';
import { Header } from '../components/Header';
import { DatePickerPTBR } from '../components/DatePickerPTBR';
import { MultiSelect } from '../components/MultiSelect';
import { Footer } from '../components/Footer';
import { useAuth } from '../contexts/AuthContext';
import { pb } from '../lib/pocketbase';
import { UNIDADES_EQUIPES, MICROAREAS } from '../constants/regionalData';
import { getCanonicalValue } from '../constants/followUpOptions';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  ArcElement
);

interface DashboardScreenProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// Helper Components
const SimpleProgressBar: React.FC<{ label: string; value: number; total: number; color: string; rank?: number }> = ({ label, value, total, color, rank }) => (
  <div className="group/item relative">
    <div className="flex items-center justify-between gap-4 mb-2">
      <div className="flex items-center gap-3 min-w-0">
        {rank !== undefined && (
          <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
            rank === 0 ? 'bg-amber-100 text-amber-600 ring-1 ring-amber-200' : 
            rank === 1 ? 'bg-slate-100 text-slate-500 ring-1 ring-slate-200' :
            rank === 2 ? 'bg-orange-50 text-orange-600 ring-1 ring-orange-100' :
            'bg-primary/5 text-primary/40'
          }`}>
            {rank + 1}
          </div>
        )}
        <span className="text-[11px] md:text-xs font-black uppercase tracking-widest text-primary/70 truncate group-hover/item:text-primary transition-colors">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm md:text-base font-black text-primary">{value}</span>
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-black text-primary/40 uppercase tracking-tighter leading-none">Pacientes</span>
          <span className="text-[10px] font-black text-primary/60 mt-0.5">
            {total > 0 ? Math.round((value / total) * 100) : 0}%
          </span>
        </div>
      </div>
    </div>
    <div className="h-3 w-full bg-slate-100/50 rounded-full overflow-hidden border border-outline-variant/10 shadow-inner relative">
      <div 
        className={`h-full ${color} transition-all duration-1000 ease-out shadow-lg rounded-full relative overflow-hidden`} 
        style={{ width: `${total > 0 && value > 0 ? (value / total) * 100 : 2}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
      </div>
    </div>
  </div>
);

const ColumnChart: React.FC<{ data: { label: string; value: number; color: string }[] }> = ({ data }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((acc, curr) => acc + curr.value, 0);

  return (
    <div className="relative h-64 pt-12 w-full">
      {/* Linhas de Grade de Fundo */}
      <div className="absolute inset-x-0 bottom-8 h-px bg-slate-200/50" />
      <div className="absolute inset-x-0 top-12 h-px bg-slate-100/30" />
      
      <div className="flex items-end justify-between h-full gap-2 md:gap-4 px-2">
      {data.map((d, i) => {
        const percentage = total > 0 ? Math.round((d.value / total) * 100) : 0;
        const heightPercent = (d.value / max) * 100;
        
        return (
          <div key={i} className="flex-1 flex flex-col items-center gap-4 group h-full">
            <div className="relative w-full flex flex-col items-center justify-end h-full pb-8">
              {/* Valor fixo no topo */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex flex-col items-center">
                <span className={`text-[11px] md:text-sm font-black transition-colors duration-300 ${d.value > 0 ? 'text-primary' : 'text-slate-300'}`}>
                  {d.value}
                </span>
                {d.value > 0 && (
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">
                    {percentage}%
                  </span>
                )}
              </div>

              {/* Barra de trilha (Track) */}
              <div className="absolute inset-x-0 bottom-8 top-0 bg-slate-50/50 rounded-2xl border border-slate-100/50" />
              
              {/* Barra de dados */}
              <div 
                className={`w-full max-w-[48px] ${d.color} rounded-t-xl transition-all duration-1000 ease-out shadow-lg relative group-hover:brightness-110 group-hover:scale-[1.05] group-hover:shadow-2xl`}
                style={{ height: `${d.value > 0 ? Math.max(heightPercent, 8) : 4}%` }}
              >
                {/* Efeito de brilho no topo da barra */}
                <div className="absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/30 to-transparent rounded-t-xl" />
                
                {/* Tooltip no hover (opcional, mantido para detalhes) */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-1 font-black z-20 shadow-2xl pointer-events-none whitespace-nowrap">
                  {d.label}: {d.value} ({percentage}%)
                </div>
              </div>
            </div>
            
            {/* Label do Eixo X */}
            <div className="flex flex-col items-center">
              <span className={`text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-colors duration-300 ${d.value > 0 ? 'text-primary/70' : 'text-slate-300'}`}>
                {d.label}
              </span>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
};

const LineChart: React.FC<{ data: { label: string; value: number }[] }> = ({ data }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  
  return (
    <div className="relative h-64 pt-12 w-full px-2">
      {/* Linhas de Grade */}
      <div className="absolute inset-x-0 bottom-8 h-px bg-slate-100" />
      <div className="absolute inset-x-0 top-12 h-px bg-slate-50/50" />
      
      <div className="absolute inset-0 flex items-end justify-between px-4">
        {data.map((d, i) => {
          const heightPercent = (d.value / max) * 100;
          const nextHeightPercent = i < data.length - 1 ? (data[i+1].value / max) * 100 : 0;
          
          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full relative group pb-8">
              {/* Valor fixo no topo se for relevante */}
              <div className={`absolute left-1/2 -translate-x-1/2 transition-all duration-500 mb-2 ${d.value > 0 ? 'opacity-100' : 'opacity-30'}`}
                style={{ bottom: `calc(${heightPercent}% + 45px)` }}
              >
                <span className="text-[11px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-full border border-primary/10">
                  {d.value}
                </span>
              </div>

              {/* Área de Gradiente (Simulada com Divs) */}
              <div 
                className="absolute bottom-8 w-px bg-gradient-to-t from-primary/20 to-transparent transition-all duration-1000"
                style={{ height: `${heightPercent}%`, left: '50%' }}
              />

              {/* Ponto (Dot) */}
              <div 
                className={`w-4 h-4 rounded-full border-[3px] border-white shadow-xl z-10 transition-all duration-500 group-hover:scale-150 ${
                  d.value > 0 ? 'bg-primary shadow-primary/30' : 'bg-slate-300'
                }`}
                style={{ marginBottom: `${heightPercent}%` }}
              />

              {/* Linha de Conexão */}
              {i < data.length - 1 && (
                <div 
                  className="absolute h-[2px] bg-gradient-to-r from-primary/40 to-primary/40 origin-left z-0"
                  style={{ 
                    left: '50%', 
                    bottom: `calc(${heightPercent}% + 8px)`, // Ajuste para centralizar no dot
                    width: '100%',
                    transform: `rotate(${Math.atan2((data[i+1].value - d.value) * 160 / max, 100) * 180 / Math.PI}deg)`
                  }}
                />
              )}

              {/* Label Eixo X */}
              <span className={`mt-5 text-[10px] md:text-[11px] font-black uppercase tracking-tight transition-colors ${
                d.value > 0 ? 'text-primary' : 'text-slate-300'
              }`}>
                {d.label}
              </span>

              {/* Tooltip Hover */}
              <div className="absolute -top-12 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-3 py-1.5 rounded-xl opacity-0 group-hover:opacity-100 transition-all transform group-hover:-translate-y-1 font-black z-30 shadow-2xl pointer-events-none whitespace-nowrap">
                {d.label}: {d.value} buscas
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: number | string; icon: React.ReactNode; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 md:p-7 rounded-[2.5rem] shadow-lg border border-primary/5 hover:border-primary/10 transition-all duration-500 group relative overflow-hidden">
    <div className={`absolute top-0 right-0 w-24 h-24 ${color.replace('bg-', 'bg-')}/5 rounded-full blur-2xl`} />
    <div className="flex justify-between items-start mb-5 relative z-10">
      <div className={`w-14 h-14 rounded-[1.25rem] ${color.replace('bg-', 'bg-')}/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-7 h-7 ' + color.replace('bg-', 'text-'), strokeWidth: 2.5 })}
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-on-surface-variant/30">Geral</span>
    </div>
    <div className={`text-4xl md:text-5xl font-black ${color.replace('bg-', 'text-')} tracking-tighter mb-2 relative z-10`}>{value}</div>
    <p className="text-[11px] font-black text-on-surface-variant/50 uppercase tracking-widest relative z-10">{title}</p>
  </div>
);

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
  const [filterUnidade, setFilterUnidade] = useState<string[]>([]);
  const [filterEquipe, setFilterEquipe] = useState<string[]>([]);
  const [filterMicroarea, setFilterMicroarea] = useState<string[]>([]);
  const [isFilterVisible, setIsFilterVisible] = useState(false);

  const [acompStats, setAcompStats] = useState({
    total: 0,
    sucesso: 0,
    contatos: 0,
    tipoBusca: {} as Record<string, number>,
    situacao: {} as Record<string, number>,
    entraves: {} as Record<string, number>,
    unidadeBreakdown: {} as Record<string, number>,
    equipeBreakdown: {} as Record<string, number>,
    microareaBreakdown: {} as Record<string, number>
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
        
        // Base filters from user role
        if (!isAdmin) {
          if (user.role === 'unidade') {
            patientFilterParts.push(`unidade = "${user.unidade_saude}"`);
          } else if (user.role === 'equipe') {
            patientFilterParts.push(`unidade = "${user.unidade_saude}"`);
            patientFilterParts.push(`equipe = "${user.equipe}"`);
          } else if (user.role === 'microarea') {
            patientFilterParts.push(`unidade = "${user.unidade_saude}"`);
            patientFilterParts.push(`equipe = "${user.equipe}"`);
            patientFilterParts.push(`microarea ~ "${user.microarea}"`);
          }
        }

        // Applied UI filters
        if (filterUnidade.length > 0) {
          patientFilterParts.push(`(${filterUnidade.map(u => `unidade = "${u}"`).join(' || ')})`);
        }
        if (filterEquipe.length > 0) {
          patientFilterParts.push(`(${filterEquipe.map(e => `equipe = "${e}"`).join(' || ')})`);
        }
        if (filterMicroarea.length > 0) {
          patientFilterParts.push(`(${filterMicroarea.map(m => `microarea ~ "${m}"`).join(' || ')})`);
        }

        // Fetch Pacientes
        const records = await pb.collection('amarcap53_pacientes').getFullList({
          filter: patientFilterParts.join(' && '),
          sort: '-created',
          requestKey: null
        });

        // Breakdown de Alertas e Grupos
        const alerts: Record<string, number> = {};
        const groups: Record<string, number> = {};
        const unidadeBreakdown: Record<string, number> = {};
        const equipeBreakdown: Record<string, number> = {};
        const microareaBreakdown: Record<string, number> = {};
        
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
          
          // Regional breakdowns
          if (p.unidade) unidadeBreakdown[p.unidade] = (unidadeBreakdown[p.unidade] || 0) + 1;
          if (p.equipe) equipeBreakdown[p.equipe] = (equipeBreakdown[p.equipe] || 0) + 1;
          if (p.microarea) microareaBreakdown[p.microarea] = (microareaBreakdown[p.microarea] || 0) + 1;

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
        
        // Base filters from user role (mirroring patient filters)
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

        // Applied UI filters
        if (filterUnidade.length > 0) {
          acompFilters.push(`(${filterUnidade.map(u => `paciente.unidade = "${u}"`).join(' || ')})`);
        }
        if (filterEquipe.length > 0) {
          acompFilters.push(`(${filterEquipe.map(e => `paciente.equipe = "${e}"`).join(' || ')})`);
        }
        if (filterMicroarea.length > 0) {
          acompFilters.push(`(${filterMicroarea.map(m => `paciente.microarea ~ "${m}"`).join(' || ')})`);
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
          sucesso: acompRecords.filter(r => {
            const canonical = getCanonicalValue('situacao_pos_busca', r.situacao_pos_busca || '');
            return canonical && canonical.includes('1 -');
          }).length,
          contatos: acompRecords.filter(r => {
            const canonical = getCanonicalValue('tipo_contato', r.tipo_contato || '');
            return canonical && !canonical.includes('3 -');
          }).length,
          tipoBusca: {} as Record<string, number>,
          situacao: {} as Record<string, number>,
          entraves: {} as Record<string, number>,
          unidadeBreakdown,
          equipeBreakdown,
          microareaBreakdown
        };

        const acompTrendMap = Object.fromEntries(lastSixMonths.map(month => [month.key, 0])) as Record<string, number>;
        acompRecords.forEach(r => {
          const metodo = getAcompanhamentoMetodo(r);
          if (metodo) aStats.tipoBusca[metodo] = (aStats.tipoBusca[metodo] || 0) + 1;
          
          const canonicalSituacao = getCanonicalValue('situacao_pos_busca', r.situacao_pos_busca || '');
          if (canonicalSituacao) {
            aStats.situacao[canonicalSituacao] = (aStats.situacao[canonicalSituacao] || 0) + 1;
          }
          
          // Filtrar entraves reais (ignorar "0- Nenhum" ou similares)
          const entravesList = Array.isArray(r.entraves_identificados)
            ? r.entraves_identificados
            : r.entraves_identificados ? [r.entraves_identificados] : [];
          entravesList.forEach(val => {
            const cleanVal = val.replace(/^\d+\s*-\s*/, '');
            if (cleanVal) {
              aStats.entraves[cleanVal] = (aStats.entraves[cleanVal] || 0) + 1;
            }
          });

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
  }, [user, isAdmin, filterDataInicio, filterDataFim, filterUnidade, filterEquipe, filterMicroarea]);

  const chartData = {
    labels: stats.examTrend.map(t => t.month),
    datasets: [
      {
        label: 'Citopatológico',
        data: stats.examTrend.map(t => t.cito),
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, 'rgba(16, 185, 129, 0.9)');
          gradient.addColorStop(1, 'rgba(16, 185, 129, 0.2)');
          return gradient;
        },
        borderColor: 'rgb(16, 185, 129)',
        borderWidth: 1,
        borderRadius: { topLeft: 12, topRight: 12, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: false,
        barThickness: 32,
        hoverBackgroundColor: 'rgba(16, 185, 129, 1)',
      },
      {
        label: 'Molecular DNA',
        data: stats.examTrend.map(t => t.hpv),
        backgroundColor: (context: any) => {
          const ctx = context.chart.ctx;
          const gradient = ctx.createLinearGradient(0, 0, 0, 400);
          gradient.addColorStop(0, 'rgba(59, 130, 246, 0.9)');
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0.2)');
          return gradient;
        },
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 1,
        borderRadius: { topLeft: 12, topRight: 12, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: false,
        barThickness: 32,
        hoverBackgroundColor: 'rgba(59, 130, 246, 1)',
      }
    ]
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <Header 
        title="Resumo" 
        pageTitle="Resumo" 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 no-scrollbar relative">
        <div className="max-w-[1600px] mx-auto space-y-8 md:space-y-10">
          
          <div className="flex flex-col gap-6 mb-8 items-center lg:items-stretch justify-center">
            {/* Card Principal de Boas-vindas */}
            <div className="w-full bg-gradient-to-br from-[#051934] via-[#0a2347] to-[#112d5a] p-6 md:p-10 rounded-[2.5rem] text-white relative overflow-hidden group shadow-xl flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>
              
              <div className="relative z-10 flex-1">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                  <div className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center ring-1 ring-white/20 shadow-inner">
                    <LayoutDashboard className="w-6 h-6 text-blue-300" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight uppercase">Resumo <span className="text-blue-300 opacity-50">Geral</span></h1>
                </div>
                <p className="text-base md:text-lg text-white/70 font-medium leading-relaxed max-w-xl mx-auto md:mx-0">
                  Olá, <span className="text-white font-black">{user?.name || 'Profissional'}</span>! Acompanhe o panorama atualizado do seu território.
                </p>
              </div>

              {/* Botão de Filtro */}
              <div className="relative z-10">
                <button 
                  onClick={() => setIsFilterVisible(!isFilterVisible)}
                  className={`flex items-center gap-3 px-6 h-14 rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest transition-all duration-500 border ${
                    isFilterVisible || filterUnidade.length > 0 || filterEquipe.length > 0 || filterMicroarea.length > 0 || filterDataInicio || filterDataFim
                      ? 'bg-primary text-white border-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]' 
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>Filtros</span>
                  {(filterUnidade.length > 0 || filterEquipe.length > 0 || filterMicroarea.length > 0 || filterDataInicio || filterDataFim) && (
                    <div className="w-5 h-5 flex items-center justify-center bg-white text-primary text-[9px] rounded-full font-black animate-pulse">
                      {[filterUnidade, filterEquipe, filterMicroarea].filter(f => f.length > 0).length + (filterDataInicio || filterDataFim ? 1 : 0)}
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Painel de Filtros Avançados - Colapsável */}
            {isFilterVisible && (
              <div className="w-full bg-white p-6 md:p-8 rounded-[2.5rem] shadow-xl border border-primary/5 relative animate-in slide-in-from-top-6 fade-in duration-500">
                <div className="flex items-center justify-between gap-4 mb-6 w-full">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/5 rounded-xl text-primary">
                      <Filter className="w-5 h-5" />
                    </div>
                    <h2 className="text-lg font-black text-primary uppercase tracking-tighter">Filtros Avançados</h2>
                  </div>
                  <button 
                    onClick={() => setIsFilterVisible(false)}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-400 transition-all"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <div className="md:col-span-2 space-y-3">
                    <label className="flex items-center gap-2 text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                      <Calendar className="w-3.5 h-3.5" />
                      Período de Referência
                    </label>
                    <div className="flex gap-4">
                      <DatePickerPTBR 
                        placeholder="Início"
                        value={filterDataInicio}
                        onChange={setFilterDataInicio}
                      />
                      <DatePickerPTBR 
                        placeholder="Fim"
                        value={filterDataFim}
                        onChange={setFilterDataFim}
                      />
                    </div>
                  </div>

                  {(isAdmin || user?.role === 'cap') && (
                    <div className="space-y-3">
                      <MultiSelect 
                        label="Unidades"
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
                        label="Equipes"
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
                        label="Microáreas"
                        placeholder="Todas as Microáreas"
                        options={MICROAREAS.map(ma => ma.toString())}
                        value={filterMicroarea}
                        onChange={setFilterMicroarea}
                        disabled={filterEquipe.length === 0 && (isAdmin || user?.role === 'cap' || user?.role === 'unidade')}
                      />
                    </div>
                  )}

                  <div className={`flex items-end gap-4 ${
                    // Se apenas o período estiver visível (2 colunas), botões ocupam as outras 2 colunas
                    !(isAdmin || user?.role === 'cap' || user?.role === 'unidade' || user?.role === 'equipe') 
                    ? 'md:col-span-2' 
                    : 'md:col-span-2 lg:col-span-4'
                  }`}>
                    <button 
                      onClick={() => { 
                        setFilterDataInicio(''); 
                        setFilterDataFim('');
                        setFilterUnidade([]);
                        setFilterEquipe([]);
                        setFilterMicroarea([]);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 py-4 bg-rose-50 text-rose-600 text-[11px] font-black uppercase tracking-widest rounded-2xl hover:bg-rose-100 transition-all border border-rose-100"
                    >
                      <AlertTriangle className="w-4 h-4" />
                      Limpar
                    </button>
                    <button 
                      onClick={() => setIsFilterVisible(false)}
                      className="flex-1 py-4 bg-primary text-white text-[11px] font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-primary/20"
                    >
                      Aplicar Filtros
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

        {/* Grid de Estatísticas Principais */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 mb-16">
            <StatCard 
              title="Total Pacientes" 
              value={stats.totalPacientes} 
              icon={<Users className="w-6 h-6" />}
              color="bg-blue-500"
            />
            <StatCard 
              title="Busca Ativa" 
              value={stats.coletasAtrasadas} 
              icon={<Clock className="w-6 h-6" />}
              color="bg-amber-500"
            />
            <StatCard 
              title="Exames em Dia" 
              value={`${stats.coberturaPercent}%`} 
              icon={<CheckCircle2 className="w-6 h-6" />}
              color="bg-emerald-500"
            />
            <StatCard 
              title="Casos Alterados" 
              value={stats.resultadosAlterados} 
              icon={<AlertTriangle className="w-6 h-6" />}
              color="bg-rose-500"
            />
          </div>

          {/* Gráficos e Tabelas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8 items-stretch">
            {/* Gráfico de Meta Territorial */}
            <div className="bg-white p-6 md:p-9 rounded-[2.5rem] shadow-xl border border-primary/5 relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
              <div className="flex flex-col sm:flex-row items-center sm:justify-between mb-8 relative z-10 text-center sm:text-left">
                <div className="flex flex-col items-center sm:items-start">
                  <h3 className="text-xl md:text-2xl font-black text-primary uppercase tracking-tight flex items-center gap-3">
                    <Target className="w-6 h-6 text-emerald-500" />
                    Meta Territorial
                  </h3>
                  <p className="text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest mt-1">Status de Rastreamento (%)</p>
                </div>
              </div>
              
              <div 
                key={`meta-territorial-chart-wrapper-${stats.totalPacientes}`}
                className="flex-1 w-full min-h-[250px] flex items-center justify-center relative z-10"
              >
                <div className="w-full h-full max-w-[600px] mx-auto">
                  <Bar 
                    data={chartData} 
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: { 
                          display: true,
                          position: 'top',
                          align: 'end',
                          labels: {
                            boxWidth: 8,
                            usePointStyle: true,
                            pointStyle: 'circle',
                            font: { size: 10, weight: 'bold' },
                            padding: 20,
                            color: '#64748b'
                          }
                        },
                        tooltip: {
                          backgroundColor: '#051934',
                          titleFont: { size: 12, weight: 'bold' },
                          bodyFont: { size: 11 },
                          padding: 12,
                          cornerRadius: 12,
                          displayColors: true,
                          usePointStyle: true,
                          callbacks: {
                            label: (context: any) => ` ${context.dataset.label}: ${context.parsed.y}%`
                          }
                        }
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 100,
                          ticks: {
                            callback: (value) => `${value}%`,
                            font: { weight: 'bold', size: 10 },
                            color: '#94a3b8',
                            stepSize: 20
                          },
                          grid: { 
                            color: 'rgba(241, 245, 249, 1)',
                            drawTicks: false
                          },
                          border: { display: false }
                        },
                        x: {
                          grid: { display: false },
                          border: { display: false },
                          ticks: {
                            font: { weight: 'bold', size: 10 },
                            color: '#64748b',
                            padding: 10
                          }
                        }
                      },
                      interaction: {
                        mode: 'index',
                        intersect: false,
                      }
                    }} 
                  />
                </div>
              </div>
            </div>

            {/* Distribuição por Unidade / Equipe */}
            <div className="bg-white p-6 md:p-9 rounded-[2.5rem] shadow-xl border border-primary/5 relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
              <div className="flex flex-col sm:flex-row items-center sm:justify-between mb-8 relative z-10 text-center sm:text-left">
                <div className="flex flex-col items-center sm:items-start">
                  <h3 className="text-xl md:text-2xl font-black text-primary uppercase tracking-tight flex items-center gap-3">
                    <Building2 className="w-6 h-6 text-blue-500" />
                    Ranking Regional
                  </h3>
                  <p className="text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest mt-1">Desempenho por Unidade</p>
                </div>
              </div>

              <div className="flex-1 w-full overflow-y-auto no-scrollbar max-h-[300px] relative z-10">
                <div className="space-y-6">
                {(isAdmin || user?.role === 'cap') && (
                  <div className="space-y-4">
                    <p className="text-[9px] font-black text-primary/30 uppercase tracking-[0.2em] border-b border-primary/5 pb-1.5">Unidades</p>
                    {Object.entries(acompStats.unidadeBreakdown)
                      .sort((a, b) => (b[1] as number) - (a[1] as number))
                      .slice(0, 5)
                      .map(([label, val], idx) => (
                        <SimpleProgressBar 
                          key={label}
                          label={label} 
                          value={val} 
                          total={stats.totalPacientes} 
                          color="bg-primary" 
                          rank={idx}
                        />
                      ))}
                  </div>
                )}

                {(isAdmin || user?.role === 'cap' || user?.role === 'unidade') && (
                  <div className="space-y-4">
                    <p className="text-[9px] font-black text-blue-500/30 uppercase tracking-[0.2em] border-b border-blue-500/5 pb-1.5">Equipes</p>
                    {Object.entries(acompStats.equipeBreakdown)
                      .sort((a, b) => (b[1] as number) - (a[1] as number))
                      .slice(0, 5)
                      .map(([label, val], idx) => (
                        <SimpleProgressBar 
                          key={label}
                          label={label} 
                          value={val} 
                          total={stats.totalPacientes} 
                          color="bg-blue-500" 
                          rank={idx}
                        />
                      ))}
                  </div>
                )}
                {(isAdmin || user?.role === 'cap' || user?.role === 'unidade' || user?.role === 'equipe' || user?.role === 'microarea') && Object.keys(acompStats.microareaBreakdown).length > 0 && (
                  <div className="space-y-4">
                    <p className="text-[9px] font-black text-emerald-500/30 uppercase tracking-[0.2em] border-b border-emerald-500/5 pb-1.5">Microáreas</p>
                    {Object.entries(acompStats.microareaBreakdown)
                      .sort((a, b) => (b[1] as number) - (a[1] as number))
                      .slice(0, 5)
                      .map(([label, val], idx) => (
                        <SimpleProgressBar 
                          key={label}
                          label={`MA ${label}`} 
                          value={val} 
                          total={stats.totalPacientes} 
                          color="bg-emerald-500" 
                          rank={idx}
                        />
                      ))}
                  </div>
                )}
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {/* Gráfico de Status de Rastreamento Real */}
            <div className="bg-white p-6 md:p-9 rounded-[2.5rem] shadow-xl border border-primary/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl" />
              <div className="flex flex-col sm:flex-row items-center sm:justify-between mb-8 relative z-10 text-center sm:text-left">
                <div className="flex flex-col items-center sm:items-start">
                  <h3 className="text-xl md:text-2xl font-black text-primary uppercase tracking-tight flex items-center gap-3">
                    <BadgeCheck className="w-6 h-6 text-emerald-500" />
                    Status Clínico
                  </h3>
                  <p className="text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest mt-1">Nível de Rastreamento</p>
                </div>
              </div>

              <div className="space-y-6 relative z-10">
                <SimpleProgressBar 
                  label="PEP Molecular" 
                  value={stats.alertBreakdown['PEP_MOLECULAR'] || 0} 
                  total={stats.totalPacientes} 
                  color="bg-blue-600" 
                />
                <SimpleProgressBar 
                  label="Coleta Molecular" 
                  value={stats.alertBreakdown['COLETA_MOLECULAR'] || 0} 
                  total={stats.totalPacientes} 
                  color="bg-orange-500" 
                />
                <SimpleProgressBar 
                  label="PEP Cito" 
                  value={stats.alertBreakdown['PEP_CITO'] || 0} 
                  total={stats.totalPacientes} 
                  color="bg-emerald-600" 
                />
                <SimpleProgressBar 
                  label="Coleta Cito" 
                  value={stats.alertBreakdown['COLETA_CITO'] || 0} 
                  total={stats.totalPacientes} 
                  color="bg-yellow-500" 
                />
                <SimpleProgressBar 
                  label="Pendente" 
                  value={stats.alertBreakdown['NAO_IDENTIFICADO'] || 0} 
                  total={stats.totalPacientes} 
                  color="bg-red-500" 
                />
              </div>
            </div>

            {/* Performance de Busca Ativa */}
            <div className="bg-white p-6 md:p-9 rounded-[2.5rem] shadow-xl border border-primary/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-3xl" />
              <div className="flex flex-col sm:flex-row items-center sm:justify-between mb-8 relative z-10 gap-4 text-center sm:text-left">
                <div className="flex flex-col items-center sm:items-start">
                  <h3 className="text-xl md:text-2xl font-black text-primary uppercase tracking-tight flex items-center gap-3">
                    <PieChart className="w-6 h-6 text-tertiary" />
                    Performance
                  </h3>
                  <p className="text-[11px] font-bold text-on-surface-variant/40 uppercase tracking-widest mt-1">Resultados das Buscas</p>
                </div>
                <div className="bg-primary/5 px-4 py-2 rounded-xl border border-primary/10 shadow-sm shrink-0">
                  <span className="text-xl font-black text-primary">{acompStats.total}</span>
                  <span className="text-[10px] font-bold text-primary/40 uppercase ml-2">Total</span>
                </div>
              </div>

              <div className="space-y-6 relative z-10">
                <SimpleProgressBar 
                  label="Sucesso" 
                  value={acompStats.sucesso} 
                  total={acompStats.total} 
                  color="bg-emerald-500" 
                />
                <SimpleProgressBar 
                  label="Efetivos" 
                  value={acompStats.contatos} 
                  total={acompStats.total} 
                  color="bg-blue-500" 
                />
                <SimpleProgressBar 
                  label="Infrutíferas" 
                  value={acompStats.total - acompStats.contatos} 
                  total={acompStats.total} 
                  color="bg-rose-500" 
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <h3 className="text-lg md:text-xl font-black text-primary flex items-center gap-3 uppercase tracking-tight px-2">
              <TrendingUp className="w-6 h-6 text-tertiary" />
              Tendências
            </h3>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
              <div className="bg-white p-6 md:p-9 rounded-[2.5rem] shadow-xl border border-primary/5 relative overflow-hidden flex flex-col items-center lg:items-stretch text-center lg:text-left">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
                <div className="flex items-center justify-center lg:justify-start gap-3 mb-6 relative z-10 w-full">
                  <div className="p-3 bg-primary/5 text-primary rounded-xl shadow-inner shrink-0">
                    <Activity className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-black text-primary uppercase tracking-tight">Fluxo Mensal</h3>
                    <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mt-1">Buscas Ativas</p>
                  </div>
                </div>
                <div className="flex-1 w-full min-h-[250px] flex items-center justify-center">
                  <LineChart data={stats.acompTrend.map(t => ({ label: t.month, value: t.total }))} />
                </div>
              </div>

              <div className="bg-white p-6 md:p-9 rounded-[2.5rem] shadow-xl border border-primary/5 relative overflow-hidden flex flex-col items-center lg:items-stretch text-center lg:text-left">
                <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full blur-3xl" />
                <div className="flex items-center justify-center lg:justify-start gap-3 mb-6 relative z-10 w-full">
                  <div className="p-3 bg-secondary/5 text-secondary rounded-xl shadow-inner shrink-0">
                    <BarChart3 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-black text-primary uppercase tracking-tight">Volumetria</h3>
                    <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mt-1">Cito vs Molecular</p>
                  </div>
                </div>
                <div className="flex-1 w-full min-h-[250px] flex items-center justify-center">
                  <ColumnChart data={[
                    { label: 'Cito', value: stats.examVolume.cito, color: 'bg-emerald-500' },
                    { label: 'DNA', value: stats.examVolume.hpv, color: 'bg-blue-500' },
                    { label: 'Pendente', value: stats.examVolume.pendente, color: 'bg-rose-500' },
                  ]} />
                </div>
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </div>
    </div>
  );
};
