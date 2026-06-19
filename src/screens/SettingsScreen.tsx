import React, { useState, useRef, useEffect } from 'react';
import { Header } from '../components/Header';
import { Edit2, User, Check, ShieldCheck, MapPin, Moon, AlignJustify, Mail, AlertOctagon, Shield, Terminal, UploadCloud, CheckCircle, AlertTriangle, FileText, History, BarChart3, ChevronRight, Info, Trash2, Database, Activity, Loader2, Search, Users, BadgeCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { pb } from '../lib/pocketbase';
import { motion, AnimatePresence } from 'motion/react';
import Papa from 'papaparse';

type UploadStage = 'idle' | 'reading' | 'cleaning' | 'importing' | 'completed' | 'error';

interface UploadStatus {
  stage: UploadStage;
  message: string;
  current: number;
  total: number;
  fileName?: string;
}

interface ImportLog {
  id: string;
  filename: string;
  total_records: number;
  success_count: number;
  error_count: number;
  created: string;
  user_id: string;
  details?: string;
}

interface SettingsScreenProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ activeTab, setActiveTab }) => {
  const { user, isAdmin } = useAuth();

  const getRoleLabel = (role?: string) => {
    const labels: Record<string, string> = {
      admin: 'Administrador',
      cap: 'Coordenação CAP',
      unidade: 'Unidade',
      equipe: 'Equipe',
      microarea: 'Microárea',
    };
    return role ? labels[role] || role : '—';
  };

  const isCap = user?.role === 'cap';

  const [isUploading, setIsUploading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [userName, setUserName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  
  // Email change states
  const [newEmail, setNewEmail] = useState('');
  const [isRequestingEmail, setIsRequestingEmail] = useState(false);
  const [emailSuccess, setEmailSuccess] = useState(false);

  // Password reset states
  const [isRequestingPassword, setIsRequestingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  const [importHistory, setImportHistory] = useState<ImportLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({ 
    stage: 'idle', 
    message: '', 
    current: 0, 
    total: 0 
  });
  const [replaceExisting, setReplaceExisting] = useState(false);

  // Sincroniza o estado do input com o usuário do contexto sempre que ele mudar
  useEffect(() => {
    setUserName(user?.name || '');
  }, [user]);

  // Carrega histórico de importações
  useEffect(() => {
    if (isCap) {
      fetchImportHistory();
    }
  }, [isCap]);

  const fetchImportHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const records = await pb.collection('amarcap53_importacoes').getList(1, 5, {
        sort: '-created',
      });
      setImportHistory(records.items as unknown as ImportLog[]);
    } catch (err: any) {
      if (err?.status !== 404) {
        console.error('Erro ao buscar histórico:', err);
      }
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleDeleteImport = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (!window.confirm('Tem certeza que deseja excluir este registro de importação? Esta ação não afetará os dados dos pacientes, apenas o registro histórico.')) {
      return;
    }

    try {
      await pb.collection('amarcap53_importacoes').delete(id);
      setImportHistory(prev => prev.filter(log => log.id !== id));
    } catch (err) {
      console.error('Erro ao excluir histórico:', err);
      alert('Falha ao excluir o registro de importação.');
    }
  };

  const [totalPatients, setTotalPatients] = useState(0);
  const [lastSync, setLastSync] = useState<string>('--');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const resultList = await pb.collection('amarcap53_pacientes').getList(1, 1);
      setTotalPatients(resultList.totalItems);
      
      try {
        const lastImport = await pb.collection('amarcap53_importacoes').getFirstListItem('', { sort: '-created' });
        if (lastImport) {
          setLastSync(new Date(lastImport.created).toLocaleString('pt-BR'));
        }
      } catch (e: any) {
        if (e?.status !== 404) throw e;
      }
    } catch (err) {
      console.error('Erro ao buscar estatísticas:', err);
    }
  };
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateName = async () => {
    if (!user) return;
    setIsSavingName(true);
    try {
      const updatedRecord = await pb.collection('amarcap53_users').update(user.id, {
        name: userName
      });
      
      // Atualiza o estado global do AuthContext forçando um refresh da sessão
      await pb.collection('amarcap53_users').authRefresh();
      
      // O useEffect do SettingsScreen sincronizará o userName automaticamente
      setIsEditingName(false);
      alert('Nome atualizado com sucesso!');
    } catch (err) {
      console.error('Erro ao atualizar nome:', err);
      alert('Erro ao atualizar nome. Tente novamente.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !user) return;
    
    setIsRequestingEmail(true);
    try {
      await pb.collection('amarcap53_users').requestEmailChange(newEmail);
      setEmailSuccess(true);
      setNewEmail('');
      setTimeout(() => setEmailSuccess(false), 8000);
    } catch (err: any) {
      console.error('Erro ao solicitar troca de e-mail:', err);
      alert('Erro ao solicitar troca de e-mail. Verifique se o novo e-mail já está em uso.');
    } finally {
      setIsRequestingEmail(false);
    }
  };

  const handleRequestPasswordReset = async () => {
    if (!user?.email) return;
    
    setIsRequestingPassword(true);
    try {
      await pb.collection('amarcap53_users').requestPasswordReset(user.email);
      setPasswordSuccess(true);
      setTimeout(() => setPasswordSuccess(false), 8000);
    } catch (err) {
      console.error('Erro ao solicitar reset de senha:', err);
      alert('Erro ao solicitar troca de senha. Tente novamente mais tarde.');
    } finally {
      setIsRequestingPassword(false);
    }
  };


  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setUploadStatus({ stage: 'error', message: 'Por favor, envie apenas arquivos .csv', current: 0, total: 0 });
      return;
    }

    // Limite de 50MB
    const MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setUploadStatus({ stage: 'error', message: 'Arquivo muito grande (max. 50MB). Divida em partes menores.', current: 0, total: 0 });
      return;
    }

    setIsUploading(true);
    setUploadStatus({ stage: 'reading', message: 'Lendo arquivo...', current: 0, total: 0, fileName: file.name });

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const csvText = e.target?.result as string;

        const parsed = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          transformHeader: (h: string) => h.replace(/,+$/, '').trim(),
        });
        const allRecords = parsed.data.filter((r: any) => r.nome && r.nome.trim());
        if (allRecords.length === 0) throw new Error('CSV vazio ou sem dados validos');

        const convertDate = (val: string) => {
          if (!val || val === '--' || val.trim() === '') return '';
          if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val;
          const parts = val.split('/');
          if (parts.length === 3) {
            let [d, m, y] = parts;
            if (y.length === 2) y = '20' + y;
            return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
          }
          return val;
        };

        const DATE_FIELDS = ['data_nascimento', 'cito_lab', 'cito_pep', 'dna_hpv_gal', 'dna_hpv_pep'];

        const cleanedRecords = allRecords.map((r: any) => {
          const record: Record<string, any> = {};
          for (const key in r) {
            if (r.hasOwnProperty(key) && key) record[key] = r[key];
          }
          DATE_FIELDS.forEach(f => { if (record[f]) record[f] = convertDate(record[f]); });
          if (record.cns) record.cns = String(record.cns).replace(/\D/g, '').padStart(15, '0').slice(-15);
          if (record.idade) record.idade = parseInt(record.idade, 10) || 0;
          if (record.microarea !== undefined && record.microarea !== '') record.microarea = parseInt(record.microarea, 10) || 0;
          return record;
        });

        // Se "Substituir existentes" marcado, deleta TODOS os registros antigos ANTES de importar
        if (replaceExisting) {
          setUploadStatus({ stage: 'cleaning', message: 'Removendo registros antigos...', current: 0, total: 1, fileName: file.name });

          // Fase 1: Coleta TODOS os IDs antes de deletar (evita paginação deslizante)
          const allIds: string[] = [];
          let fetchPage = 1;
          while (true) {
            const page = await pb.collection('amarcap53_pacientes').getList(fetchPage, 200, { requestKey: null });
            allIds.push(...page.items.map(r => r.id));
            if (allIds.length >= page.totalItems || page.items.length < 200) break;
            fetchPage++;
          }

          // Fase 2: Deleta sequencialmente 1 por 1 (estável, sem silenciar erros)
          let totalDeleted = 0;
          for (const id of allIds) {
            await pb.collection('amarcap53_pacientes').delete(id);
            totalDeleted++;
            if (totalDeleted % 100 === 0) {
              setUploadStatus({ stage: 'cleaning', message: `Removendo registros antigos... ${totalDeleted}/${allIds.length}`, current: totalDeleted, total: allIds.length, fileName: file.name });
            }
          }

          console.log(`[CSV] ${totalDeleted} registros antigos deletados`);
          if (totalDeleted > 0) await new Promise(r => setTimeout(r, 300));
        }

        // Chunk de 500 — Promise.allSettled via SDK
        const BATCH_SIZE = 500;
        const totalChunks = Math.ceil(cleanedRecords.length / BATCH_SIZE);

        let importedTotal = 0;
        let errorsTotal = 0;

        for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
          const start = chunkIdx * BATCH_SIZE;
          const end = Math.min(start + BATCH_SIZE, cleanedRecords.length);
          const chunkRecords = cleanedRecords.slice(start, end);

          setUploadStatus({
            stage: 'importing',
            message: `Enviando lote ${chunkIdx + 1} de ${totalChunks}...`,
            current: chunkIdx + 1,
            total: totalChunks,
            fileName: file.name,
          });

          const batchPromises = chunkRecords.map((rec) =>
            pb.collection('amarcap53_pacientes').create(rec, { requestKey: null })
          );
          const results = await Promise.allSettled(batchPromises);
          results.forEach((r) => {
            if (r.status === 'fulfilled') importedTotal++;
            else {
              errorsTotal++;
              if (errorsTotal <= 3) console.warn(`Lote ${chunkIdx + 1}:`, r.reason?.message || r.reason);
            }
          });
        }

        fetchImportHistory();
        fetchStats();
        setUploadStatus({
          stage: 'completed',
          message: `Sucesso! ${importedTotal} registros importados${errorsTotal > 0 ? `, ${errorsTotal} falhas` : ''}.`,
          current: importedTotal,
          total: importedTotal,
          fileName: file.name,
        });
      } catch (err: any) {
        console.error('Erro na importacao:', err);
        const rollbackMsg = err.message?.includes('revertida') ? ' Dados antigos preservados.' : '';
        setUploadStatus({ stage: 'error', message: `Erro: ${err.message || 'Falha na comunicacao'}.${rollbackMsg}`, current: 0, total: 0 });
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = () => {
      setIsUploading(false);
      setUploadStatus({ stage: 'error', message: 'Erro ao ler arquivo', current: 0, total: 0 });
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#f1f5f9]">
      <Header 
        title="Configurações" 
        pageTitle="Configurações" 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-12 no-scrollbar">
        <div className="max-w-7xl mx-auto">
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Lado Esquerdo: Dashboard de Gestão — 2/3 largura */}
            <div className="lg:col-span-2 space-y-8">

              {/* Perfil do Usuário */}
              <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-200/60 relative overflow-hidden">
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Meu Perfil</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Gerencie seus dados pessoais</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    {/* Nome */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">NOME</label>
                      <div className="flex gap-3">
                        <div className="flex-1 relative">
                          <input 
                            type="text" 
                            value={isEditingName ? userName : user?.name || 'Não informado'}
                            onChange={(e) => setUserName(e.target.value)}
                            disabled={!isEditingName}
                            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500/20 transition-all disabled:opacity-70"
                          />
                        </div>
                        {!isEditingName ? (
                          <button 
                            onClick={() => { setUserName(user?.name || ''); setIsEditingName(true); }}
                            className="p-4 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-2xl transition-all shadow-sm"
                          >
                            <Edit2 className="w-5 h-5" />
                          </button>
                        ) : (
                          <button 
                            onClick={handleUpdateName}
                            disabled={isSavingName}
                            className="p-4 bg-emerald-500 text-white hover:bg-emerald-600 rounded-2xl transition-all shadow-lg shadow-emerald-200"
                          >
                            <Check className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                      {/* Role Badge */}
                      <div className="flex items-center gap-2 ml-1 mt-2">
                        <BadgeCheck className="w-4 h-4 text-blue-500" />
                        <span className="text-[11px] font-black text-blue-600 uppercase tracking-wider bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                          {getRoleLabel(user?.role)}
                        </span>
                      </div>
                    </div>

                    {/* Email Display */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">E-mail de Acesso</label>
                      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-400">
                        {user?.email}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100 flex flex-col justify-between">
                    <form onSubmit={handleRequestEmailChange} className="space-y-4">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-4">Solicitar troca de e-mail</p>
                      <div className="flex flex-col gap-3">
                        <input 
                          type="email" 
                          placeholder="Novo e-mail"
                          value={newEmail}
                          onChange={(e) => setNewEmail(e.target.value)}
                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500/20 transition-all"
                        />
                        <button 
                          type="submit"
                          disabled={isRequestingEmail || !newEmail}
                          className="w-full py-4 bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl hover:opacity-90 transition-all shadow-lg shadow-blue-200 text-xs disabled:opacity-30"
                        >
                          {isRequestingEmail ? 'Processando...' : 'Solicitar Alteração'}
                        </button>
                      </div>
                      {emailSuccess && (
                        <p className="text-[10px] font-bold text-emerald-600 uppercase text-center animate-pulse mt-2">
                          Verifique sua caixa de entrada e SPAM para confirmar!
                        </p>
                      )}
                    </form>

                    <div className="pt-6 mt-6 border-t border-slate-200">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-4">Segurança da Conta</p>
                      <button 
                        onClick={handleRequestPasswordReset}
                        disabled={isRequestingPassword}
                        className="w-full py-4 bg-slate-800 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-slate-900 transition-all shadow-lg shadow-slate-200 text-xs disabled:opacity-30 flex items-center justify-center gap-2"
                      >
                        {isRequestingPassword ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Shield className="w-4 h-4" />
                        )}
                        {isRequestingPassword ? 'Solicitando...' : 'Redefinir Senha por E-mail'}
                      </button>
                      {passwordSuccess && (
                        <p className="text-[10px] font-bold text-emerald-600 uppercase text-center animate-pulse mt-3">
                          Link de redefinição enviado para seu e-mail!
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

            {/* Card Premium: Gestão de Dados (Dashboard Style) - Apenas CAP */}
            {isCap && (
              <div className="bg-[#001b3d] rounded-[2.5rem] p-1 shadow-[0_20px_50px_rgba(0,27,61,0.3)] relative overflow-hidden group">
                {/* Efeitos de Fundo Glassmorphism */}
                <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-[100px] -mr-48 -mt-48"></div>
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] -ml-32 -mb-32"></div>
                
                <div className="relative z-10 bg-[#001b3d]/40 backdrop-blur-xl rounded-[2.4rem] p-8 md:p-10 border border-white/5">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
                    <div className="flex items-center gap-5">
                      <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20">
                        <Database className="w-7 h-7 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-black text-white tracking-tight uppercase">Gestão de Dados</h2>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                          <p className="text-[10px] font-black text-emerald-500/80 uppercase tracking-widest">Sistema Operacional</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-7 border border-white/10 hover:bg-white/10 transition-colors group/card flex flex-col">
                      <div className="flex items-center gap-3 mb-6">
                        <Users className="w-4 h-4 text-blue-400 shrink-0" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 truncate">Base Ativa</p>
                      </div>
                      <div className="flex flex-col items-start mt-auto">
                        <span className="text-3xl lg:text-4xl font-black text-white tracking-tight leading-none">{totalPatients.toLocaleString('pt-BR')}</span>
                        <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider mt-1.5">Registros</span>
                      </div>
                    </div>
                    
                    <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-7 border border-white/10 hover:bg-white/10 transition-colors flex flex-col">
                      <div className="flex items-center gap-3 mb-6">
                        <Activity className="w-4 h-4 text-emerald-400 shrink-0" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 truncate">Status Sincro</p>
                      </div>
                      <div className="flex flex-col items-start mt-auto">
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg lg:text-xl font-black text-white tracking-tight">{lastSync !== '--' ? 'ATUALIZADO' : 'PENDENTE'}</span>
                          <CheckCircle className={`w-4 h-4 ${lastSync !== '--' ? 'text-emerald-500' : 'text-white/20'}`} />
                        </div>
                        {lastSync !== '--' && (
                          <span className="text-[9px] font-bold text-white/30 uppercase tracking-wider mt-1.5">Base sincronizada</span>
                        )}
                      </div>
                    </div>

                    <div className="bg-white/5 backdrop-blur-md rounded-[2rem] p-7 border border-white/10 hover:bg-white/10 transition-colors flex flex-col">
                      <div className="flex items-center gap-3 mb-6">
                        <History className="w-4 h-4 text-indigo-400 shrink-0" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40 truncate">Última Carga</p>
                      </div>
                      <div className="flex flex-col items-start mt-auto">
                        <span className="text-lg lg:text-xl font-black text-white tracking-tight leading-none">{lastSync.split(',')[0]}</span>
                        <span className="text-[9px] font-medium text-white/30 uppercase tracking-wider mt-1.5">{lastSync.split(',')[1] || '—'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Instruções Processuais - Apenas CAP */}
            {isCap && (
              <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-200/60 relative overflow-hidden">
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
                    <ShieldCheck className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Protocolo de Importação</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Siga as diretrizes para garantir a integridade</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    <div className="flex gap-5">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center font-black flex-shrink-0 border border-slate-100">01</div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-slate-800 uppercase">Formato do Arquivo</h4>
                        <p className="text-xs font-medium text-slate-500 leading-relaxed">
                          Utilize apenas arquivos <span className="text-blue-600 font-bold">.CSV</span> com delimitador de vírgula.
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-5">
                      <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 flex items-center justify-center font-black flex-shrink-0 border border-slate-100">02</div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-slate-800 uppercase">Política de Dados</h4>
                        <p className="text-xs font-medium text-slate-500 leading-relaxed">
                          A importação utiliza <span className="text-rose-500 font-bold underline decoration-rose-200 underline-offset-4">Substituição Total</span>. A base anterior será removida.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50/50 rounded-3xl p-6 border border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Ordem das Colunas (Mandatório)</h4>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { n: 'Unidade', t: 'Texto' },
                        { n: 'Equipe', t: 'Texto' },
                        { n: 'Microárea', t: 'Número' },
                        { n: 'CNS', t: 'Número' },
                        { n: 'Nome', t: 'Texto' },
                        { n: 'Nasc.', t: 'Data' },
                        { n: 'Idade', t: 'Número' },
                        { n: 'Grupo', t: 'Texto' },
                        { n: 'Cito Lab', t: 'Data' },
                        { n: 'Cito PEP', t: 'Data' },
                        { n: 'DNA-HPV', t: 'Data' }
                      ].map((col, idx) => (
                        <div key={idx} className="flex flex-col items-center">
                          <span className="px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-[9px] font-black text-slate-600 uppercase tracking-tighter shadow-sm">
                            {col.n}
                          </span>
                          <span className="text-[7px] font-bold text-slate-400 uppercase mt-1">{col.t}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Lado Direito: Upload e Histórico — 1/3 largura */}
          <div className="lg:col-span-1 flex flex-col gap-8">
            {isCap ? (
              <>
                  {/* Card de Ação: Upload */}
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200/60 flex-1 flex flex-col">
                    <div className="mb-8 shrink-0">
                      <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Novo Upload</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Atualize a base de pacientes</p>
                    </div>

                    <div className="relative flex-1 flex flex-col justify-center">
                      <AnimatePresence mode="wait">
                        {isUploading ? (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="w-full aspect-square bg-slate-50 rounded-[2rem] border-2 border-blue-100 p-6 flex flex-col items-center justify-center text-center space-y-6"
                          >
                            <div className="relative">
                              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200 animate-bounce">
                                <FileText className="w-8 h-8 text-white" />
                              </div>
                              <div className="absolute -top-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-4 border-slate-50 flex items-center justify-center">
                                <Loader2 className="w-3 h-3 text-white animate-spin" />
                              </div>
                            </div>
                            
                            <div className="space-y-2 w-full">
                              <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">{uploadStatus.message}</p>
                              <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase">
                                <span>{uploadStatus.stage}</span>
                                <span>{Math.round((uploadStatus.current / (uploadStatus.total || 1)) * 100)}%</span>
                              </div>
                              <div className="w-full h-2 bg-blue-100 rounded-full overflow-hidden">
                                <motion.div 
                                  className="h-full bg-blue-600"
                                  initial={{ width: 0 }}
                                  animate={{ width: `${(uploadStatus.current / (uploadStatus.total || 1)) * 100}%` }}
                                />
                              </div>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{uploadStatus.current} / {uploadStatus.total} Registros</p>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.label 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center w-full aspect-square border-2 border-slate-200 border-dashed rounded-[2rem] cursor-pointer bg-slate-50/50 hover:bg-white hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/5 transition-all relative group overflow-hidden"
                          >
                            <div className="flex flex-col items-center justify-center text-center px-6 relative z-10">
                              <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-slate-100 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-blue-600 transition-all duration-500">
                                <UploadCloud className="w-8 h-8 text-blue-600 group-hover:text-white transition-colors" />
                              </div>
                              <p className="text-xs font-black text-slate-800 uppercase tracking-widest">Solte o CSV aqui</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">ou clique para navegar</p>
                            </div>
                            <input 
                              type="file" 
                              className="hidden" 
                              accept=".csv" 
                              onChange={handleFileUpload}
                              disabled={isUploading}
                              ref={fileInputRef}
                            />
                          </motion.label>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Toggle Substituir */}
                    <label className="flex items-center gap-3 mt-5 cursor-pointer select-none group/toggle">
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={replaceExisting}
                          onChange={(e) => setReplaceExisting(e.target.checked)}
                          disabled={isUploading}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-6 bg-slate-200 rounded-full peer-checked:bg-red-500 transition-colors shadow-inner"></div>
                        <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform peer-checked:translate-x-4"></div>
                      </div>
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider group-hover/toggle:text-red-600 transition-colors">
                        Substituir existentes
                      </span>
                      {replaceExisting && (
                        <span className="px-2 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded text-[8px] font-black uppercase">
                          Dados atuais serao deletados
                        </span>
                      )}
                    </label>

                    {uploadStatus.stage === 'completed' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3"
                      >
                        <div className="w-8 h-8 bg-emerald-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-200">
                          <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-[10px] font-black text-emerald-800 uppercase leading-tight">{uploadStatus.message}</p>
                      </motion.div>
                    )}
                    
                    {uploadStatus.stage === 'error' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3"
                      >
                        <div className="w-8 h-8 bg-rose-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-rose-200">
                          <AlertTriangle className="w-4 h-4 text-white" />
                        </div>
                        <p className="text-[10px] font-black text-rose-800 uppercase leading-tight">{uploadStatus.message}</p>
                      </motion.div>
                    )}
                  </div>

                  {/* Histórico de Operações */}
                  <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200/60 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-8 shrink-0">
                      <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Histórico</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Últimos sincronismos</p>
                      </div>
                      <button onClick={fetchImportHistory} className="p-2.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors border border-slate-100">
                        <History className={`w-4 h-4 text-slate-500 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    <div className="flex-1 flex flex-col justify-center">
                      <div className="space-y-4">
                        {importHistory.length > 0 ? importHistory.map((log) => (
                        <div key={log.id} className="p-5 bg-slate-50/50 border border-slate-100 rounded-3xl relative group hover:border-blue-200 transition-colors">
                          <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-sm">
                                <FileText className="w-4 h-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-xs font-black text-slate-800 truncate max-w-[140px]">{log.filename}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{new Date(log.created).toLocaleDateString('pt-BR')}</p>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => handleDeleteImport(e, log.id)} 
                              className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex justify-between items-center bg-white/50 rounded-2xl p-3 border border-white">
                            <div className="flex flex-col">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Registros</span>
                              <span className="text-xs font-black text-slate-700">{log.total_records}</span>
                            </div>
                            <div className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-[8px] font-black uppercase">
                              Sucesso
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="py-12 flex flex-col items-center justify-center text-center opacity-40">
                          <Search className="w-8 h-8 text-slate-300 mb-3" />
                          <p className="text-[10px] font-black text-slate-400 uppercase">Nenhum registro encontrado</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </>
              ) : (
                <div className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200/60 flex flex-col items-center justify-center text-center opacity-60 flex-1">
                  <Shield className="w-12 h-12 text-slate-200 mb-4" />
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-2">Área Administrativa</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-[200px]">
                    Recursos de importação disponíveis apenas para administradores.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
