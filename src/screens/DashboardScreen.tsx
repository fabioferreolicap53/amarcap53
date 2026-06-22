import React, { useState, useEffect, useRef } from 'react';
import { Users, Clock, CheckCircle2, AlertTriangle, ArrowRight, Download, BellRing, Plus, HeartPulse, Calendar, BadgeCheck, TrendingUp, ClipboardList, PieChart, BarChart3, MapPin, LayoutDashboard, Filter, CheckCircle, AlertCircle, Building, X, UserCheck, TestTube2, CircleOff, Search, Activity } from 'lucide-react';
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
import { LoadingOverlay } from '../components/LoadingOverlay';
import { useAuth } from '../contexts/AuthContext';
import { pb } from '../lib/pocketbase';
import { UNIDADES_EQUIPES, MICROAREAS } from '../constants/regionalData';
import { getCanonicalValue } from '../constants/followUpOptions';

// Remove acentos via Unicode NFD decomposition (ex: "ESPERANÇA" → "ESPERANCA")
const normalizeText = (str: string) =>
  str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim().replace(/\s+/g, ' ');

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
const SimpleProgressBar: React.FC<{ label: string; value: number; total: number; color: string; rank?: number; isHighlighted?: boolean }> = ({ label, value, total, color, rank, isHighlighted }) => (
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
        <span className={`text-[11px] md:text-xs font-black uppercase tracking-widest truncate group-hover/item:text-primary transition-colors ${
          isHighlighted ? 'text-blue-600' : 'text-primary/70'
        }`}>{label}</span>
        {isHighlighted && (
          <span className="text-[7px] font-black text-blue-500 uppercase tracking-widest bg-blue-100 px-1.5 py-0.5 rounded border border-blue-200">Você</span>
        )}
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
    <div className="relative h-64 w-full px-2">
      {/* Eixo Y linhas de grade */}
      {[0, 25, 50, 75, 100].map(pct => (
        <div key={pct} className="absolute left-0 right-0 border-t border-dashed border-slate-100" style={{ bottom: `${pct}%` }} />
      ))}
      
      <div className="flex items-end justify-around h-full gap-2 md:gap-4 pt-6 pb-4">
        {data.map((d, i) => {
          const percentage = total > 0 ? Math.round((d.value / total) * 100) : 0;
          const heightPercent = (d.value / max) * 100;
          
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-2 group h-full justify-end">
              {/* Valor acima da barra */}
              <div className="flex flex-col items-center transition-all duration-300 group-hover:-translate-y-1">
                <span className={`text-[11px] md:text-sm font-black leading-none ${d.value > 0 ? 'text-primary' : 'text-slate-300'}`}>
                  {d.value}
                </span>
                {d.value > 0 && (
                  <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">
                    {percentage}%
                  </span>
                )}
              </div>

              {/* Barra */}
              <div className="relative w-full flex-1 flex items-end justify-center max-w-[56px] min-h-[8px]">
                {/* Track */}
                <div className="absolute inset-x-1 bottom-0 top-0 bg-slate-50 rounded-xl border border-slate-100" />
                {/* Fill */}
                <div 
                  className={`absolute inset-x-1 bottom-0 ${d.color} rounded-xl transition-all duration-1000 ease-out shadow-md group-hover:shadow-xl group-hover:brightness-110 z-10`}
                  style={{ height: `${d.value > 0 ? Math.max(heightPercent, 6) : 3}%` }}
                >
                  <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-white/40 to-transparent rounded-t-xl" />
                </div>
                {/* Glow sutil na ativa */}
                {d.value > 0 && (
                  <div className={`absolute -inset-x-2 bottom-0 ${d.color.replace('bg-', 'bg-')}/20 blur-xl rounded-full`}
                    style={{ height: `${Math.max(heightPercent, 6)}%` }} />
                )}
              </div>

              {/* Label */}
              <span className={`text-[9px] md:text-[11px] font-black uppercase tracking-widest transition-colors ${d.value > 0 ? 'text-primary/70' : 'text-slate-300'}`}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};



const InfoPopover: React.FC<{ content: string }> = ({ content }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isHover, setIsHover] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = isOpen || isHover;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMouseEnter = () => {
    if (leaveTimer.current) clearTimeout(leaveTimer.current);
    setIsHover(true);
  };
  const handleMouseLeave = () => {
    leaveTimer.current = setTimeout(() => {
      setIsHover(false);
    }, 200);
  };

  return (
    <div
      className="relative inline-flex flex-col items-center"
      ref={ref}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Tooltip acima */}
      <div
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 transition-opacity duration-200 pointer-events-auto"
        style={{ opacity: show ? 1 : 0, visibility: show ? 'visible' : 'hidden' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-white text-slate-700 text-[11px] leading-relaxed font-medium rounded-xl px-4 py-3 shadow-[0_10px_40px_rgba(0,0,0,0.15)] border border-slate-200/80 max-w-[240px] text-center whitespace-normal">
          {content}
        </div>
        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.08)]"></div>
      </div>

      {/* Botão */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="w-4 h-4 rounded-full bg-slate-200/60 hover:bg-primary/15 text-slate-400 hover:text-primary flex items-center justify-center transition-all duration-200 flex-shrink-0"
        aria-label="Info"
      >
        <span className="text-[8px] font-black leading-none" style={{ fontFamily: 'serif', fontStyle: 'italic' }}>i</span>
      </button>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: number | string; icon: React.ReactNode; color: string; description?: string }> = ({ title, value, icon, color, description }) => (
  <div className="bg-white p-6 md:p-7 rounded-[2.5rem] shadow-lg border border-primary/5 hover:border-primary/10 transition-all duration-500 group relative overflow-visible">
    <div className={`absolute top-0 right-0 w-24 h-24 ${color.replace('bg-', 'bg-')}/5 rounded-full blur-2xl`} />
    <div className="flex justify-between items-start mb-5 relative z-10">
      <div className={`w-14 h-14 rounded-[1.25rem] ${color.replace('bg-', 'bg-')}/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500 shadow-inner`}>
        {React.cloneElement(icon as React.ReactElement, { className: 'w-7 h-7 ' + color.replace('bg-', 'text-'), strokeWidth: 2.5 })}
      </div>
      <div className="flex items-center gap-2">
        {description && <InfoPopover content={description} />}
      </div>
    </div>
    <div className={`text-4xl md:text-5xl font-black ${color.replace('bg-', 'text-')} tracking-tighter mb-2 relative z-10`}>{value}</div>
    <p className="text-[11px] font-black text-on-surface-variant/50 uppercase tracking-widest relative z-10">{title}</p>
  </div>
);

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ activeTab, setActiveTab }) => {
  const { user, isAdmin } = useAuth();

  // Cache localStorage (evita full table scan repetido)
  const STATS_CACHE_TTL = 5 * 60 * 1000; // 5 minutos
  const getCache = (key: string) => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const cached = JSON.parse(raw);
      if (Date.now() - cached.ts > STATS_CACHE_TTL) return null;
      return cached.data;
    } catch { return null; }
  };
  const setCache = (key: string, data: any) => {
    try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
  };
  const STATS_CACHE_KEY = `dash_stats_cache_${user?.id}`;
  const ACOMP_CACHE_KEY = `dash_acomp_cache_${user?.id}`;

  const _sInit = getCache(STATS_CACHE_KEY);
  const [stats, setStats] = useState(_sInit ?? {
    totalPacientes: 0,
    coletasAtrasadas: 0,
    examesEmDia: 0,
    resultadosAlterados: 0,
    coberturaPercent: 0,
    pepMol: 0,
    coltMol: 0,
    pepCito: 0,
    coltCito: 0,
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
  const [isLoading, setIsLoading] = useState(true);

  const _aInit = getCache(ACOMP_CACHE_KEY);
  const [acompStats, setAcompStats] = useState(_aInit?.acompStats ?? {
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
    let cancelled = false;
    const fetchStats = async () => {
      if (!user) return;
      try {
        const patientFilterParts: string[] = [];

        // Base filters from user role (normalize accents: DB stores unaccented)
        if (!isAdmin) {
          if (user.role === 'unidade') {
            patientFilterParts.push(pb.filter('unidade ~ {:u}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%') }));
          } else if (user.role === 'equipe') {
            patientFilterParts.push(pb.filter('unidade ~ {:u} && equipe ~ {:e}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%'), e: normalizeText(user.equipe).replace(/\s+/g, '%') }));
          } else if (user.role === 'microarea') {
            patientFilterParts.push(pb.filter('unidade ~ {:u} && equipe ~ {:e}', { u: normalizeText(user.unidade_saude).replace(/\s+/g, '%'), e: normalizeText(user.equipe).replace(/\s+/g, '%') }));
            patientFilterParts.push(`microarea = ${Number(user.microarea)}`);
          }
        }

        // Applied UI filters (normalize accents)
        if (filterUnidade.length > 0) {
          const uParams: Record<string, string> = {};
          const uClauses = filterUnidade.map((u, i) => {
            uParams[`u${i}`] = normalizeText(u).replace(/\s+/g, '%');
            return `unidade ~ {:u${i}}`;
          });
          patientFilterParts.push(pb.filter(uClauses.join(' || '), uParams));
        }
        if (filterEquipe.length > 0) {
          const eParams: Record<string, string> = {};
          const eClauses = filterEquipe.map((e, i) => {
            eParams[`e${i}`] = normalizeText(e).replace(/\s+/g, '%');
            return `equipe ~ {:e${i}}`;
          });
          patientFilterParts.push(pb.filter(eClauses.join(' || '), eParams));
        }
        if (filterMicroarea.length > 0) {
          patientFilterParts.push(`(${filterMicroarea.map(m => `microarea = ${Number(m)}`).join(' || ')})`);
        }

        // Build filter strings
        const patientFilter = patientFilterParts.join(' && ');

        // Build acomp filters (only acomp-specific fields, not role/regional — handled via patient IDs below)
        const acompFilterParts: string[] = [];
        if (filterDataInicio) {
          acompFilterParts.push(`data_busca >= "${filterDataInicio} 00:00:00"`);
        }
        if (filterDataFim) {
          acompFilterParts.push(`data_busca <= "${filterDataFim} 23:59:59"`);
        }

        // Parallel queries
        const hasUIFilters = filterUnidade.length > 0 || filterEquipe.length > 0 || filterMicroarea.length > 0 || filterDataInicio || filterDataFim;
        const isScopeQuery = !isAdmin || hasUIFilters;
        const lastSixMonths = getLastSixMonths();
        const emptyAcompTrend = lastSixMonths.map(month => ({ month: month.label, total: 0 }));
        const emptyExamTrend = lastSixMonths.map(month => ({ month: month.label, cito: 0, hpv: 0 }));
        let regionalUnidade: Record<string, number> = {};
        let regionalEquipe: Record<string, number> = {};
        let regionalMicroarea: Record<string, number> = {};
        let scopedPatientIds: string[] = [];
        let loadedRecords: any[] = [];

        if (isScopeQuery) {
          // Non-CAP or CAP with UI filters: query limited scope
          loadedRecords = await pb.collection('amarcap53_pacientes').getFullList({
            filter: patientFilter || undefined,
            batch: 500,
            requestKey: null,
            fields: 'id,dna_hpv_pep,dna_hpv_gal,cito_pep,cito_lab,grupo,unidade,equipe,microarea'
          });
          if (cancelled) return;
          scopedPatientIds = loadedRecords.map(p => p.id).filter(Boolean);

          const totalPacientes = loadedRecords.length;
          const alerts: Record<string, number> = {};
          const groups: Record<string, number> = {};

          loadedRecords.forEach(p => {
            let status: string;
            if (hasValue(p.dna_hpv_pep)) {
              status = 'PEP_MOLECULAR';
            } else if (hasValue(p.dna_hpv_gal)) {
              status = 'COLETA_MOLECULAR';
            } else if (hasValue(p.cito_pep)) {
              status = 'PEP_CITO';
            } else if (hasValue(p.cito_lab)) {
              status = 'COLETA_CITO';
            } else {
              status = 'NAO_IDENTIFICADO';
            }
            alerts[status] = (alerts[status] || 0) + 1;
            groups[p.grupo || 'NÃO INFORMADO'] = (groups[p.grupo || 'NÃO INFORMADO'] || 0) + 1;
          });

          const pepMolCount = alerts['PEP_MOLECULAR'] || 0;
          const coltMolCount = alerts['COLETA_MOLECULAR'] || 0;
          const pepCitoCount = alerts['PEP_CITO'] || 0;
          const coltCitoCount = alerts['COLETA_CITO'] || 0;
          const atrasadas = alerts['NAO_IDENTIFICADO'] || 0;
          const alterados = pepMolCount + coltMolCount + pepCitoCount + coltCitoCount;
          const emDia = Math.max(totalPacientes - atrasadas, 0);

          setStats({
            totalPacientes,
            coletasAtrasadas: atrasadas,
            examesEmDia: emDia,
            resultadosAlterados: alterados,
            coberturaPercent: totalPacientes > 0 ? Math.round((emDia / totalPacientes) * 100) : 0,
            pepMol: pepMolCount,
            coltMol: coltMolCount,
            pepCito: pepCitoCount,
            coltCito: coltCitoCount,
            alertBreakdown: alerts,
            grupoBreakdown: groups,
            examVolume: { cito: pepCitoCount + coltCitoCount, hpv: pepMolCount + coltMolCount, pendente: atrasadas },
            examTrend: emptyExamTrend,
            acompTrend: emptyAcompTrend
          });
          setCache(STATS_CACHE_KEY, {
            totalPacientes, coletasAtrasadas: atrasadas, examesEmDia: emDia, resultadosAlterados: alterados,
            coberturaPercent: totalPacientes > 0 ? Math.round((emDia / totalPacientes) * 100) : 0,
            pepMol: pepMolCount, coltMol: coltMolCount, pepCito: pepCitoCount, coltCito: coltCitoCount,
            alertBreakdown: alerts, grupoBreakdown: groups,
            examVolume: { cito: pepCitoCount + coltCitoCount, hpv: pepMolCount + coltMolCount, pendente: atrasadas }
          });
        } else {
          // CAP without UI filters: pure count-based queries (instant)
          const baseFilter = patientFilter || '';
          // Mostra cache imediatamente (instantaneo)
          const cached = getCache(STATS_CACHE_KEY);
          if (cached) {
            setStats({ ...cached, examTrend: emptyExamTrend, grupoBreakdown: {}, acompTrend: emptyAcompTrend });
          }

          const safeCount = async (field?: string, label?: string): Promise<number> => {
            try {
              const f = field
                ? (baseFilter ? `${baseFilter} && ${field}` : field)
                : baseFilter || '';
              const res = await pb.collection('amarcap53_pacientes').getList(1, 1, {
                filter: f,
                fields: 'id',
                requestKey: null,
              });
              return res.totalItems;
            } catch (err: any) {
              console.warn(`[count] ${label || field || 'total'} failed:`, err?.message || err);
              return 0;
            }
          };

          const [totalPacientes, pepMol, coltMol, pepCito, coltCito] = await Promise.all([
            safeCount(undefined, 'total'),
            safeCount('dna_hpv_pep != ""', 'dna_hpv_pep'),
            safeCount('dna_hpv_gal != "" && dna_hpv_pep = ""', 'dna_hpv_gal'),
            safeCount('cito_pep != "" && dna_hpv_gal = "" && dna_hpv_pep = ""', 'cito_pep'),
            safeCount('cito_lab != "" && cito_pep = "" && dna_hpv_gal = "" && dna_hpv_pep = ""', 'cito_lab'),
          ]);
          if (cancelled) return;

          const withExam = pepMol + coltMol + pepCito + coltCito;
          const atrasadas = Math.max(totalPacientes - withExam, 0);

            setStats({
              totalPacientes,
              coletasAtrasadas: atrasadas,
              examesEmDia: withExam,
              resultadosAlterados: withExam,
              coberturaPercent: totalPacientes > 0 ? Math.round((withExam / totalPacientes) * 100) : 0,
              pepMol,
              coltMol,
              pepCito,
              coltCito,
              alertBreakdown: {
                NAO_IDENTIFICADO: atrasadas,
                PEP_MOLECULAR: pepMol,
                COLETA_MOLECULAR: coltMol,
                PEP_CITO: pepCito,
                COLETA_CITO: coltCito
              },
              grupoBreakdown: {},
              examVolume: { cito: pepCito + coltCito, hpv: pepMol + coltMol, pendente: atrasadas },
              examTrend: emptyExamTrend,
              acompTrend: emptyAcompTrend
            });
            setCache(STATS_CACHE_KEY, {
              totalPacientes,
              coletasAtrasadas: atrasadas,
              examesEmDia: withExam,
              resultadosAlterados: withExam,
              coberturaPercent: totalPacientes > 0 ? Math.round((withExam / totalPacientes) * 100) : 0,
              pepMol,
              coltMol,
              pepCito,
              coltCito,
              alertBreakdown: { NAO_IDENTIFICADO: atrasadas, PEP_MOLECULAR: pepMol, COLETA_MOLECULAR: coltMol, PEP_CITO: pepCito, COLETA_CITO: coltCito },
              examVolume: { cito: pepCito + coltCito, hpv: pepMol + coltMol, pendente: atrasadas }
            });
          }
        // Cache de acompanhamentos: renderiza instantâneo, busca em background
        const aCached = getCache(ACOMP_CACHE_KEY);
        if (aCached && !cancelled) {
          setAcompStats(aCached.acompStats);

        }

        // Acompanhamentos (separate, non-blocking for initial render)
        // Use scoped patient IDs from the pacientes query (role + UI filters) to avoid unreliable paciente.unidade filter syntax
        if (scopedPatientIds.length > 0) {
          const chunkSize = 200;
          const idChunks: string[][] = [];
          for (let i = 0; i < scopedPatientIds.length; i += chunkSize) {
            idChunks.push(scopedPatientIds.slice(i, i + chunkSize));
          }
          const idFilter = idChunks.map(chunk => `(${chunk.map(id => `paciente = "${id}"`).join(' || ')})`).join(' || ');
          acompFilterParts.unshift(`(${idFilter})`);
        }
        const acompFilterStr = acompFilterParts.join(' && ').trim();
        const acompRecords = await pb.collection('amarcap53_acompanhamentos').getFullList({
          filter: acompFilterStr || undefined,
          sort: 'created',
          batch: 500,
          requestKey: null,
          fields: 'situacao_pos_busca,tipo_contato,entraves_identificados,data_busca,created,paciente'
        });
        if (cancelled) return;

        // Regional breakdown — use already-loaded records (skip extra 130K query)
        const regionalSource = loadedRecords.length > 0 ? loadedRecords : [];
        regionalSource.forEach((p: any) => {
          if (p.unidade) regionalUnidade[p.unidade] = (regionalUnidade[p.unidade] || 0) + 1;
          if (p.equipe) regionalEquipe[p.equipe] = (regionalEquipe[p.equipe] || 0) + 1;
          if (p.microarea !== undefined && p.microarea !== null && p.microarea !== '') {
            const maKey = p.equipe ? `${p.equipe}/${p.microarea}` : String(p.microarea);
            regionalMicroarea[maKey] = (regionalMicroarea[maKey] || 0) + 1;
          }
        });

        // Process Acompanhamentos
        const aStats = {
          total: acompRecords.length,
          sucesso: acompRecords.filter(r => {
            const val = String(r.situacao_pos_busca || '').toLowerCase();
            return val && val.includes('agendamento');
          }).length,
          contatos: acompRecords.filter(r => {
            const val = String(r.tipo_contato || '').toLowerCase();
            return val && !val.includes('não houve contato');
          }).length,
          tipoBusca: {} as Record<string, number>,
          situacao: {} as Record<string, number>,
          entraves: {} as Record<string, number>,
          unidadeBreakdown: regionalUnidade,
          equipeBreakdown: regionalEquipe,
          microareaBreakdown: regionalMicroarea
        };

        const acompTrendMap2 = Object.fromEntries(lastSixMonths.map(month => [month.key, 0])) as Record<string, number>;
        const trendComContato = Object.fromEntries(lastSixMonths.map(month => [month.key, 0])) as Record<string, number>;
        const trendSemContato = Object.fromEntries(lastSixMonths.map(month => [month.key, 0])) as Record<string, number>;
        acompRecords.forEach(r => {
          const metodo = getAcompanhamentoMetodo(r);
          if (metodo) aStats.tipoBusca[metodo] = (aStats.tipoBusca[metodo] || 0) + 1;

          const canonicalSituacao = getCanonicalValue('situacao_pos_busca', r.situacao_pos_busca || '');
          if (canonicalSituacao) {
            aStats.situacao[canonicalSituacao] = (aStats.situacao[canonicalSituacao] || 0) + 1;
          }

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
          if (key in acompTrendMap2) acompTrendMap2[key] = (acompTrendMap2[key] || 0) + 1;

          // Exam trend from acompanhamentos: com contato / sem contato
          const valContato = String(r.tipo_contato || '').toLowerCase();
          const temContato = valContato && !valContato.includes('não houve contato');
          if (key in trendComContato) {
            if (temContato) trendComContato[key]++;
            else trendSemContato[key]++;
          }
        });

        // Update stats with trend data
        const acompTrendFinal = lastSixMonths.map(month => ({ month: month.label, total: acompTrendMap2[month.key] || 0 }));
        const examTrendFinal = lastSixMonths.map(month => ({ month: month.label, cito: trendComContato[month.key] || 0, hpv: trendSemContato[month.key] || 0 }));

        if (!cancelled) {
          setStats(prev => ({
            ...prev,
            examTrend: examTrendFinal,
            acompTrend: acompTrendFinal
          }));
          setAcompStats(aStats);
          // Salva cache de acompanhamentos
          setCache(ACOMP_CACHE_KEY, {
            acompStats: aStats,
          });
        }
      } catch (error: any) {
        if (error?.isAbort) return;
        console.error('Erro ao buscar estatísticas:', error);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchStats();
    return () => { cancelled = true; };
  }, [user?.id, user?.role, user?.unidade_saude, user?.equipe, user?.microarea, isAdmin, filterDataInicio, filterDataFim, filterUnidade, filterEquipe, filterMicroarea]);

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
            <div className="w-full bg-gradient-to-br from-[#001b3d] to-[#002b5c] p-4 md:p-10 rounded-2xl md:rounded-[2.5rem] text-white relative overflow-hidden group shadow-xl flex flex-col md:flex-row items-center justify-between gap-4 md:gap-10 text-center md:text-left">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl group-hover:bg-white/10 transition-all duration-700"></div>

              <div className="relative z-10 flex-1 max-w-[80%]">
                <div className="flex items-center justify-center md:justify-start gap-3 mb-4">
                  <div className="w-16 h-16 md:w-20 md:h-20 bg-white/10 backdrop-blur-md rounded-2xl md:rounded-3xl flex items-center justify-center ring-1 ring-white/20 shadow-inner">
                    <LayoutDashboard className="w-8 h-8 md:w-10 md:h-10 text-blue-300" />
                  </div>
                  <h1 className="text-2xl md:text-[2.5rem] font-black tracking-tight uppercase leading-none">Resumo <span className="text-blue-300 opacity-50">Geral</span></h1>
                </div>
                <p className="text-base md:text-lg text-white/70 font-medium leading-relaxed md:whitespace-nowrap mx-auto md:mx-0">
                  Olá, <span className="text-white font-black">{user?.name || 'Profissional'}</span>! Acompanhe o panorama atualizado do seu território.
                </p>
              </div>

              {/* Total de Pacientes */}
              <div className="relative z-10 md:-ml-[10%] flex flex-col items-center">
                <span className="text-[10px] md:text-xs font-black text-white/40 uppercase tracking-[0.3em] mb-1">Total de Pacientes</span>
                <span className="text-4xl md:text-5xl font-black text-white leading-none tracking-tighter tabular-nums">
                  {stats.totalPacientes.toLocaleString('pt-BR')}
                </span>
              </div>

              {/* Botão de Filtro */}
              <div className="relative z-10">
                <button
                  onClick={() => setIsFilterVisible(!isFilterVisible)}
                  className={`flex items-center gap-2 md:gap-3 px-4 md:px-8 h-12 md:h-14 rounded-2xl text-[10px] md:text-sm font-black uppercase tracking-widest transition-all duration-500 border ${
                    isFilterVisible || filterUnidade.length > 0 || filterEquipe.length > 0 || filterMicroarea.length > 0 || filterDataInicio || filterDataFim
                      ? 'bg-primary text-white border-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.3)]'
                      : 'bg-white/10 text-white border-white/20 hover:bg-white/20'
                  }`}
                >
                  <Filter className="w-4 h-4 md:w-5 md:h-5" />
                  <span className="hidden sm:inline">Filtros</span>
                  {(filterUnidade.length > 0 || filterEquipe.length > 0 || filterMicroarea.length > 0 || filterDataInicio || filterDataFim) && (
                    <div className="w-5 h-5 md:w-6 md:h-6 flex items-center justify-center bg-white text-primary text-[9px] md:text-[10px] rounded-full font-black animate-pulse">
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
                        disabled={filterUnidade.length === 0 && user?.role === 'cap'}
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
                        disabled={filterEquipe.length === 0 && user?.role === 'cap'}
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

        {/* Grid de Estatísticas Principais - Rastreamento */}
          <div className="mb-16">

            {/* Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5">
              {[
                { key: 'NAO_IDENTIFICADO', label: 'NÃO IDENTIFICADO COLETA OU RESULTADO DE EXAME DE RASTREAMENTO', value: stats.alertBreakdown['NAO_IDENTIFICADO'] || 0, objetivo: 'DIMINUIR', objetivoColor: 'text-rose-700 bg-rose-50 border-rose-200', barColor: 'bg-gradient-to-r from-rose-400 to-rose-600', dotColor: 'bg-rose-500', icon: CircleOff, glowColor: 'shadow-rose-500/20', ringColor: 'ring-rose-400/30', hoverBorder: 'hover:border-rose-300', iconBg: 'bg-rose-100', iconColor: 'text-rose-600' },
                { key: 'COLETA_CITO', label: 'IDENTIFICADO COLETA DE CITO/PENDENTE DE REGISTRO DE RESULTADO NO PEP', value: stats.alertBreakdown['COLETA_CITO'] || 0, objetivo: 'ZERAR', objetivoColor: 'text-amber-700 bg-amber-50 border-amber-200', barColor: 'bg-gradient-to-r from-amber-400 to-amber-600', dotColor: 'bg-amber-500', icon: Clock, glowColor: 'shadow-amber-500/20', ringColor: 'ring-amber-400/30', hoverBorder: 'hover:border-amber-300', iconBg: 'bg-amber-100', iconColor: 'text-amber-600' },
                { key: 'PEP_CITO', label: 'IDENTIFICADO REGISTRO DE RESULTADO DE CITO NO PEP', value: stats.alertBreakdown['PEP_CITO'] || 0, objetivo: 'MONITORAR', objetivoColor: 'text-emerald-700 bg-emerald-50 border-emerald-200', barColor: 'bg-gradient-to-r from-emerald-400 to-emerald-600', dotColor: 'bg-emerald-500', icon: CheckCircle, glowColor: 'shadow-emerald-500/20', ringColor: 'ring-emerald-400/30', hoverBorder: 'hover:border-emerald-300', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600' },
                { key: 'COLETA_MOLECULAR', label: 'IDENTIFICADO TESTE MOLECULAR DNA-HPV - (GAL/MEDIREC)', value: stats.alertBreakdown['COLETA_MOLECULAR'] || 0, objetivo: 'AUMENTAR', objetivoColor: 'text-emerald-700 bg-emerald-50 border-emerald-200', barColor: 'bg-gradient-to-r from-orange-400 to-orange-600', dotColor: 'bg-orange-500', icon: TestTube2, glowColor: 'shadow-orange-500/20', ringColor: 'ring-orange-400/30', hoverBorder: 'hover:border-orange-300', iconBg: 'bg-orange-100', iconColor: 'text-orange-600' },
                { key: 'PEP_MOLECULAR', label: 'CONFIRMADO O REGISTRO DE RESULTADOS DO TESTE MOLECULAR DNA-HPV NO PEP', value: stats.alertBreakdown['PEP_MOLECULAR'] || 0, objetivo: 'AUMENTAR', objetivoColor: 'text-indigo-700 bg-indigo-50 border-indigo-200', barColor: 'bg-gradient-to-r from-indigo-400 to-indigo-600', dotColor: 'bg-indigo-500', icon: BadgeCheck, glowColor: 'shadow-indigo-500/20', ringColor: 'ring-indigo-400/30', hoverBorder: 'hover:border-indigo-300', iconBg: 'bg-indigo-100', iconColor: 'text-indigo-600' },
              ].map((card) => {
                const pct = stats.totalPacientes > 0 ? Math.round((card.value / stats.totalPacientes) * 100) : 0;
                const isActiveSearch = card.key === 'NAO_IDENTIFICADO';
                const buscaAtivaValor = isActiveSearch ? acompStats.total : 0;
                const buscaAtivaPct = isActiveSearch && stats.totalPacientes > 0 ? Math.round((buscaAtivaValor / stats.totalPacientes) * 100) : 0;
                const Icon = card.icon;

                return (
                  <div
                    key={card.key}
                    onClick={() => {
                      localStorage.setItem('dashboard:pendingFilter', JSON.stringify({ filterStatus: [card.key] }));
                      setActiveTab('pacientes');
                    }}
                    className={`group bg-white rounded-3xl shadow-lg ${card.glowColor} hover:shadow-2xl hover:${card.glowColor} border border-slate-200/80 ${card.hoverBorder} transition-all duration-500 flex flex-col overflow-hidden cursor-pointer hover:scale-[1.03] hover:-translate-y-1`}
                  >
                    {/* Glow accent top bar */}
                    <div className={`h-1.5 w-full ${card.barColor} opacity-80 group-hover:opacity-100 transition-opacity`} />

                    {/* Icon header */}
                    <div className="px-5 pt-5 pb-2 flex items-center gap-3">
                      <div className={`w-11 h-11 rounded-xl ${card.iconBg} flex items-center justify-center ring-4 ${card.ringColor} shadow-md group-hover:scale-110 transition-transform duration-300`}>
                        <Icon className={`w-5 h-5 ${card.iconColor}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] md:text-[11px] font-black text-slate-500 uppercase tracking-wide leading-tight group-hover:text-slate-700 transition-colors line-clamp-3">
                          {card.label}
                        </p>
                      </div>
                    </div>

                    <div className="px-5 pt-1 pb-5 flex-1 flex flex-col">
                      {/* Objetivo badge */}
                      <div className="mb-4">
                        {card.objetivo ? (
                          <span className={`inline-flex items-center gap-1 text-[9px] md:text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${card.objetivoColor}`}>
                            <Activity className="w-3 h-3" />
                            Objetivo: {card.objetivo}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[9px] md:text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-lg border text-slate-400 bg-slate-50 border-slate-200">
                            Objetivo: -
                          </span>
                        )}
                      </div>

                      {/* Valor Absoluto */}
                      <div className="flex items-end justify-between gap-2 mb-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Absoluto</span>
                        <span className="text-2xl md:text-3xl font-black text-slate-800 tabular-nums leading-none group-hover:scale-105 transition-transform origin-right">
                          {card.value.toLocaleString('pt-BR')}
                        </span>
                      </div>

                      {/* Percentual */}
                      <div className="flex items-end justify-between gap-2 mb-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Percentual</span>
                        <div className="flex items-baseline gap-1">
                          <span className="text-lg font-black text-slate-700 tabular-nums">
                            {pct}%
                          </span>
                        </div>
                      </div>

                      {/* Mini bar */}
                      <div className="mt-auto h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                        <div
                          className={`h-full ${card.barColor} rounded-full transition-all duration-700 ease-out shadow-md`}
                          style={{ width: `${Math.max(pct, 3)}%` }}
                        />
                      </div>
                    </div>

                    {/* Busca Ativa section (only NAO_IDENTIFICADO) */}
                    {isActiveSearch && (
                      <>
                        <div className="mx-5 border-t border-dashed border-rose-200" />
                        <div className="px-5 py-4 bg-gradient-to-b from-rose-50/80 to-white">
                          <div className="flex items-center gap-2 mb-3">
                            <Search className="w-3.5 h-3.5 text-rose-500" />
                            <p className="text-[10px] font-black text-rose-700 uppercase tracking-widest">Com Busca Ativa</p>
                          </div>
                          <div className="flex items-end justify-between gap-2 mb-1">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Absoluto</span>
                            <span className="text-xl font-black text-slate-800 tabular-nums leading-none">
                              {buscaAtivaValor.toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <div className="flex items-end justify-between gap-2">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Percentual</span>
                            <span className="text-sm font-black text-slate-600 tabular-nums">
                              {buscaAtivaPct}%
                            </span>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Gráficos e Tabelas */}


          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
            {/* Performance de Busca Ativa */}
            <div className="bg-white p-6 md:p-9 rounded-[2.5rem] shadow-xl border border-primary/5 relative overflow-hidden lg:col-span-2">
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


          <Footer />
        </div>
      </div>

      <LoadingOverlay visible={isLoading} message="Carregando resumo..." />
    </div>
  );
};
