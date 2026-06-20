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

const stageLabels: Record<UploadStage, string> = {
  idle: 'Pronto',
  reading: 'Lendo arquivo',
  cleaning: 'Limpando registros antigos',
  importing: 'Importando',
  completed: 'Concluído',
  error: 'Erro',
};

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

  // Estados para importação com pause/cancel (inspirados na exclusão)
  const [importControl, setImportControl] = useState<'idle' | 'running' | 'paused'>('idle');
  const [importProgress, setImportProgress] = useState({ imported: 0, total: 0, errors: 0 });
  const [importSummary, setImportSummary] = useState<{ elapsedSec: number; errors: number; total: number; cancelled: boolean } | null>(null);
  const [importEta, setImportEta] = useState<string>('');
  const importFlagsRef = useRef({ paused: false, cancelled: false });
  const importStartTimeRef = useRef(0);
  const importEtaTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Estados para exclusão total
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteStatus, setDeleteStatus] = useState<{ message: string; type: 'idle' | 'deleting' | 'completed' | 'error' }>({ message: '', type: 'idle' });

  // Password confirmation + pause/cancel controls
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [deleteControl, setDeleteControl] = useState<'idle' | 'running' | 'paused'>('idle');
  const [deleteProgress, setDeleteProgress] = useState({ deleted: 0, total: 0, errors: 0 });
  const [deleteSummary, setDeleteSummary] = useState<{ elapsedSec: number; errors: number; total: number; cancelled: boolean } | null>(null);
  const [deleteEta, setDeleteEta] = useState<string>('');
  const deleteFlagsRef = useRef({ paused: false, cancelled: false });
  const deleteStartTimeRef = useRef(0);
  const deleteEtaTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    console.log('[SETTINGS] handleFileUpload - V5 com pause/cancel');
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setUploadStatus({ stage: 'error', message: 'Por favor, envie apenas arquivos .csv', current: 0, total: 0 });
      return;
    }

    var MAX_FILE_SIZE = 50 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      setUploadStatus({ stage: 'error', message: 'Arquivo muito grande (max. 50MB). Divida em partes menores.', current: 0, total: 0 });
      return;
    }

    setImportSummary(null);
    setImportEta('');
    setIsUploading(true);
    setImportControl('running');
    setUploadStatus({ stage: 'reading', message: 'Lendo arquivo...', current: 0, total: 0, fileName: file.name });
    setImportProgress({ imported: 0, total: 0, errors: 0 });
    importFlagsRef.current = { paused: false, cancelled: false };
    importStartTimeRef.current = Date.now();

    // Interval pra atualizar ETA a cada 2s
    importEtaTimerRef.current = setInterval(() => {
      var p = importProgress;
      if (p.total > 0 && p.imported > 0 && importControl === 'running') {
        var elapsed = (Date.now() - importStartTimeRef.current) / 1000;
        var rate = p.imported / elapsed;
        var remaining = (p.total - p.imported) / rate;
        if (rate > 0 && remaining > 0 && remaining < 3600) {
          var mins = Math.floor(remaining / 60);
          var secs = Math.floor(remaining % 60);
          setImportEta(`${mins}m ${secs}s`);
        } else if (rate > 0 && remaining >= 3600) {
          setImportEta('> 1h');
        } else {
          setImportEta('...');
        }
      }
    }, 2000);

    var FIELD_ALIASES: Record<string, string[]> = {
      unidade: ['UNIDADE', 'UNIDADE DE SAUDE', 'ESTABELECIMENTO', 'UBS'],
      equipe: ['EQUIPE', 'EQUIPE DE SAUDE', 'EQ'],
      microarea: ['MICROAREA', 'MICRO AREA', 'MICRO', 'MICROAREA'],
      cns: ['CNS', 'CARTAO SUS', 'NUMERO CNS'],
      nome: ['NOME', 'NOME PACIENTE', 'NOME DO PACIENTE', 'PACIENTE', 'NOME COMPLETO'],
      data_nascimento: ['NASC', 'DATA DE NASCIMENTO', 'DATA NASCIMENTO', 'NASCIMENTO', 'DATA_NASCIMENTO'],
      idade: ['IDADE', 'ANOS'],
      grupo: ['GRUPO', 'FAIXA ETARIA', 'CATEGORIA'],
      cito_lab: ['CITO LAB', 'CITO LABORATORIO', 'CITO_LAB', 'CITOLAB'],
      cito_pep: ['CITO PEP', 'CITO_PEP', 'CITOPEP'],
      dna_hpv_gal: ['DNA-HPV', 'DNA_HPV_GAL', 'DNA HPV', 'DNA HPV GAL'],
      alertas_rastreamento: ['ALERTAS RASTREAMENTO', 'ALERTAS', 'OBSERVACOES'],
    };

    function normalize(h: string): string {
      return h.trim().toUpperCase().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
    }

    function findField(csvHeader: string): string | null {
      var n = normalize(csvHeader);
      for (var fld in FIELD_ALIASES) {
        for (var a of FIELD_ALIASES[fld]) { if (normalize(a) === n) return fld; }
      }
      for (var fld2 in FIELD_ALIASES) {
        for (var a2 of FIELD_ALIASES[fld2]) {
          var na = normalize(a2);
          if (n.includes(na) || na.includes(n)) return fld2;
        }
      }
      return null;
    }

    function convertDate(val: string): string {
      if (!val || val === '--' || val.trim() === '') return '';
      if (/^\d{4}-\d{2}-\d{2}/.test(val)) return val;
      var parts = val.split('/');
      if (parts.length === 3) {
        var d = parts[0], m = parts[1], y = parts[2];
        if (y.length === 2) y = '20' + y;
        return y + '-' + m.padStart(2, '0') + '-' + d.padStart(2, '0');
      }
      return val;
    }

    var reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        var csvText = ev.target?.result as string;
        if (!csvText || csvText.trim().length === 0) throw new Error('CSV vazio');

        var parsed = Papa.parse<Record<string, string>>(csvText, { header: true, skipEmptyLines: true });
        if (parsed.data.length === 0) throw new Error('CSV vazio ou sem dados');

        var rawHeaders = parsed.meta.fields || [];
        var headerMap: Record<string, string | null> = {};
        for (var h of rawHeaders) headerMap[h] = findField(h);

        var DATE_FIELDS = new Set(['data_nascimento', 'cito_lab', 'cito_pep', 'dna_hpv_gal', 'dna_hpv_pep']);

        var records = parsed.data
          .filter(function(r) {
            var nomeField = rawHeaders.find(function(h) { return findField(h) === 'nome'; });
            return nomeField && r[nomeField] && r[nomeField].trim();
          })
          .map(function(r) {
            var rec: Record<string, any> = {};
            for (var rawH of rawHeaders) {
              var mapped = headerMap[rawH];
              if (!mapped) continue;
              var val: any = r[rawH];
              if (val === undefined || val === null || val === '' || val === '--') continue;
              if (DATE_FIELDS.has(mapped)) { val = convertDate(val); if (!val) continue; }
              else if (mapped === 'cns') { val = String(val).replace(/\D/g, '').padStart(15, '0').slice(-15); }
              else if (mapped === 'idade' || mapped === 'microarea') { val = parseInt(val, 10) || 0; }
              rec[mapped] = val;
            }
            return rec;
          })
          .filter(function(r) { return r.nome && r.cns; });

        if (records.length === 0) throw new Error('Nenhum registro com nome e CNS encontrado');

        setImportProgress({ imported: 0, total: records.length, errors: 0 });
        setUploadStatus({ stage: 'importing', message: 'Importando...', current: 0, total: records.length, fileName: file.name });

        var BATCH = 500;
        var imported = 0;
        var errors = 0;
        var wasCancelled = false;

        for (var i = 0; i < records.length; i += BATCH) {
          if (importFlagsRef.current.cancelled) { wasCancelled = true; break; }
          while (importFlagsRef.current.paused && !importFlagsRef.current.cancelled) {
            await new Promise(function(r2) { setTimeout(r2, 200); });
          }
          if (importFlagsRef.current.cancelled) { wasCancelled = true; break; }

          var batch = records.slice(i, i + BATCH);
          var results = await Promise.allSettled(
            batch.map(function(rec) { return pb.collection('amarcap53_pacientes').create(rec, { requestKey: null }); })
          );
          results.forEach(function(r) { r.status === 'fulfilled' ? imported++ : errors++; });
          setImportProgress({ imported: imported, total: records.length, errors: errors });
          setUploadStatus({
            stage: 'importing', message: imported + ' registros importados...',
            current: imported, total: records.length, fileName: file.name,
          });
        }

        if (importEtaTimerRef.current) clearInterval(importEtaTimerRef.current);
        var elapsed = Math.round((Date.now() - importStartTimeRef.current) / 1000);

        // Cria registro de log no histórico
        try {
          await pb.collection('amarcap53_importacoes').create({
            filename: file.name,
            total_records: records.length,
            success_count: imported,
            error_count: errors,
            user_id: user?.id || '',
            details: wasCancelled ? 'Interrompido pelo usuario' : 'Concluido',
          });
        } catch (logErr: any) {
          if (logErr?.status !== 404) console.error('Erro ao salvar log de importacao:', logErr);
        }

        fetchImportHistory();
        fetchStats();

        if (wasCancelled) {
          setImportSummary({ elapsedSec: elapsed, errors: errors, total: imported, cancelled: true });
          setUploadStatus({ stage: 'completed', message: imported + ' registros importados. Operação interrompida.', current: imported, total: records.length, fileName: file.name });
        } else {
          setImportSummary({ elapsedSec: elapsed, errors: errors, total: imported, cancelled: false });
          setUploadStatus({ stage: 'completed', message: 'Sucesso! ' + imported + ' registros importados' + (errors > 0 ? ', ' + errors + ' falhas' : '') + '.', current: imported, total: records.length, fileName: file.name });
        }
        setImportControl('idle');
      } catch (err: any) {
        if (importEtaTimerRef.current) clearInterval(importEtaTimerRef.current);
        var elapsedErr = Math.round((Date.now() - importStartTimeRef.current) / 1000);
        setImportSummary({ elapsedSec: elapsedErr, errors: 0, total: 0, cancelled: false });
        console.error('Erro na importacao:', err);
        setUploadStatus({ stage: 'error', message: 'Erro: ' + (err.message || 'Falha na comunicacao'), current: 0, total: 0 });
        setImportControl('idle');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };

    reader.onerror = function() {
      if (importEtaTimerRef.current) clearInterval(importEtaTimerRef.current);
      setIsUploading(false);
      setImportControl('idle');
      setUploadStatus({ stage: 'error', message: 'Erro ao ler arquivo', current: 0, total: 0 });
    };
    reader.readAsText(file);
  };

  const handlePauseResumeImport = () => {
    if (importFlagsRef.current.paused) {
      importFlagsRef.current.paused = false;
      setImportControl('running');
    } else {
      importFlagsRef.current.paused = true;
      setImportControl('paused');
    }
  };

  const handleCancelImport = () => {
    importFlagsRef.current.cancelled = true;
    importFlagsRef.current.paused = false;
    setImportControl('idle');
  };

  const handleDeleteAll = () => {
    setShowPasswordModal(true);
    setPasswordInput('');
    setPasswordError('');
  };

  const handlePasswordSubmit = async () => {
    if (!passwordInput) {
      setPasswordError('Digite sua senha');
      return;
    }

    try {
      // Valida senha via REST direto — SEMPRE usa identity fixa do usuário logado
      // IMPORTANTE: não usa SDK authWithPassword para não disparar onChange da authStore
      var identity = user?.email || user?.username || '';
      if (!identity) {
        // Fallback: extrai do token JWT
        try {
          var payload = JSON.parse(atob(pb.authStore.token.split('.')[1]));
          identity = payload.email || payload.username || payload.id || '';
        } catch {}
      }

      var resp = await fetch(pb.baseURL + '/api/collections/amarcap53_users/auth-with-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity, password: passwordInput }),
      });
      var data = await resp.json();
      if (!resp.ok || !data.token) {
        setPasswordError('Senha incorreta');
        return;
      }
      // Valida role
      if (data.record?.role !== 'cap' && data.record?.role !== 'admin') {
        setPasswordError('Apenas usuarios CAP ou admin podem excluir dados');
        return;
      }
    } catch {
      setPasswordError('Erro ao validar senha');
      return;
    }

    setShowPasswordModal(false);
    setDeleteSummary(null);
    setDeleteEta('');
    setIsDeleting(true);
    setDeleteControl('running');
    setDeleteStatus({ message: 'Buscando registros para exclusão...', type: 'deleting' });
    setDeleteProgress({ deleted: 0, total: 0, errors: 0 });
    deleteFlagsRef.current = { paused: false, cancelled: false };
    deleteStartTimeRef.current = Date.now();

    // Interval pra atualizar ETA a cada 2s
    deleteEtaTimerRef.current = setInterval(() => {
      var p = deleteProgress;
      if (p.total > 0 && p.deleted > 0 && deleteControl === 'running') {
        var elapsed = (Date.now() - deleteStartTimeRef.current) / 1000;
        var rate = p.deleted / elapsed;
        var remaining = (p.total - p.deleted) / rate;
        if (rate > 0 && remaining > 0 && remaining < 3600) {
          var mins = Math.floor(remaining / 60);
          var secs = Math.floor(remaining % 60);
          setDeleteEta(`${mins}m ${secs}s`);
        } else if (rate > 0 && remaining >= 3600) {
          setDeleteEta('> 1h');
        } else {
          setDeleteEta('...');
        }
      }
    }, 2000);

    try {
      const records = await pb.collection('amarcap53_pacientes').getFullList({ fields: 'id' });
      const total = records.length;

      if (total === 0) {
        if (deleteEtaTimerRef.current) clearInterval(deleteEtaTimerRef.current);
        setDeleteSummary({ elapsedSec: 0, errors: 0, total: 0, cancelled: false });
        setDeleteStatus({ message: 'Nenhum registro para excluir. Base já vazia.', type: 'completed' });
        setDeleteControl('idle');
        fetchStats();
        return;
      }

      setDeleteProgress({ deleted: 0, total, errors: 0 });
      setDeleteStatus({ message: `Excluindo ${total} registros...`, type: 'deleting' });

      var BATCH = 100;
      var deleted = 0;
      var errorsCount = 0;
      var wasCancelled = false;
      for (var i = 0; i < total; i += BATCH) {
        if (deleteFlagsRef.current.cancelled) { wasCancelled = true; break; }
        while (deleteFlagsRef.current.paused && !deleteFlagsRef.current.cancelled) {
          await new Promise(r => setTimeout(r, 200));
        }
        if (deleteFlagsRef.current.cancelled) { wasCancelled = true; break; }

        var batch = records.slice(i, i + BATCH);
        var results = await Promise.allSettled(
          batch.map(r => pb.collection('amarcap53_pacientes').delete(r.id))
        );
        results.forEach(r => r.status === 'fulfilled' ? deleted++ : errorsCount++);
        setDeleteProgress({ deleted, total, errors: errorsCount });
      }

      if (deleteEtaTimerRef.current) clearInterval(deleteEtaTimerRef.current);
      var elapsed = Math.round((Date.now() - deleteStartTimeRef.current) / 1000);

      if (wasCancelled) {
        setDeleteSummary({ elapsedSec: elapsed, errors: errorsCount, total: deleted, cancelled: true });
        setDeleteStatus({ message: `${deleted} registros excluídos. Operação interrompida.`, type: 'completed' });
      } else {
        setDeleteSummary({ elapsedSec: elapsed, errors: errorsCount, total: deleted, cancelled: false });
        setDeleteStatus({ message: `${deleted} registros excluídos com sucesso!`, type: 'completed' });
      }
      setDeleteControl('idle');
      fetchStats();
    } catch (err: any) {
      if (deleteEtaTimerRef.current) clearInterval(deleteEtaTimerRef.current);
      var elapsedErr = Math.round((Date.now() - deleteStartTimeRef.current) / 1000);
      setDeleteSummary({ elapsedSec: elapsedErr, errors: 0, total: 0, cancelled: false });
      console.error('Erro ao excluir registros:', err);
      setDeleteStatus({ message: `Erro: ${err.message || 'Falha na comunicação'}`, type: 'error' });
      setDeleteControl('idle');
    } finally {
      setIsDeleting(false);
    }
  };

  const handlePauseResume = () => {
    if (deleteFlagsRef.current.paused) {
      deleteFlagsRef.current.paused = false;
      setDeleteControl('running');
    } else {
      deleteFlagsRef.current.paused = true;
      setDeleteControl('paused');
    }
  };

  const handleCancelDelete = () => {
    deleteFlagsRef.current.cancelled = true;
    deleteFlagsRef.current.paused = false;
    setDeleteControl('idle');
  };

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordInput('');
    setPasswordError('');
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
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Meu Perfil</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Gerencie seus dados pessoais</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-6">
                    {/* Nome */}
                    <div className="space-y-3">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">NOME</label>
                      <div className="flex gap-3">
                        <div className="flex-1 relative">
                          <input 
                            type="text" 
                            value={isEditingName ? userName : user?.name || 'Não informado'}
                            onChange={(e) => setUserName(e.target.value)}
                            disabled={!isEditingName}
                            className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-70 disabled:bg-slate-50"
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
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">E-mail de Acesso</label>
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
                          className="w-full p-4 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 transition-all"
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

            {/* Card: Gestão de Dados - Apenas CAP */}
            {isCap && (
              <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-200/60 relative overflow-hidden">
                {/* Linha decorativa superior */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-800" />
                
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <Database className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Gestão de Dados</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                      <p className="text-[10px] font-black text-emerald-600/80 uppercase tracking-widest">Sistema Operacional</p>
                    </div>
                  </div>
                </div>
                  
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="bg-slate-50/80 rounded-[2rem] p-7 border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                      <Users className="w-4 h-4 text-blue-500 shrink-0" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">Base Ativa</p>
                    </div>
                    <div className="flex flex-col items-start mt-auto">
                      <span className="text-3xl lg:text-4xl font-black text-slate-800 tracking-tight leading-none">{totalPatients.toLocaleString('pt-BR')}</span>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">Registros</span>
                    </div>
                  </div>
                    
                  <div className="bg-slate-50/80 rounded-[2rem] p-7 border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                      <Activity className="w-4 h-4 text-emerald-500 shrink-0" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">Status Sincro</p>
                    </div>
                    <div className="flex flex-col items-start mt-auto">
                      <div className="flex items-center gap-2.5">
                        <span className="text-lg lg:text-xl font-black text-slate-800 tracking-tight">{lastSync !== '--' ? 'ATUALIZADO' : 'PENDENTE'}</span>
                        <CheckCircle className={`w-4 h-4 ${lastSync !== '--' ? 'text-emerald-500' : 'text-slate-300'}`} />
                      </div>
                      {lastSync !== '--' && (
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1.5">Base sincronizada</span>
                      )}
                    </div>
                  </div>

                  <div className="bg-slate-50/80 rounded-[2rem] p-7 border border-slate-100 hover:bg-slate-50 hover:border-slate-200 transition-all flex flex-col">
                    <div className="flex items-center gap-3 mb-6">
                      <History className="w-4 h-4 text-indigo-500 shrink-0" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 truncate">Última Carga</p>
                    </div>
                    <div className="flex flex-col items-start mt-auto">
                      <span className="text-lg lg:text-xl font-black text-slate-800 tracking-tight leading-none">{lastSync.split(',')[0]}</span>
                      <span className="text-[9px] font-medium text-slate-400 uppercase tracking-wider mt-1.5">{lastSync.split(',')[1] || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Protocolo de Importação - Apenas CAP */}
            {isCap && (
              <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-200/60 relative overflow-hidden">
                {/* Linha decorativa superior */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500" />

                <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                    <BadgeCheck className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Protocolo de Importação</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">Processamento inteligente em lotes com controle total</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  <div className="space-y-8">
                    {/* Passo 01 */}
                    <div className="flex gap-5 group">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black flex-shrink-0 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-all duration-300">01</div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-slate-800 uppercase">Arquivo CSV</h4>
                        <p className="text-xs font-medium text-slate-500 leading-relaxed">
                          Formatos aceitos: <span className="text-blue-600 font-bold">.CSV</span> com delimitador de vírgula. Cabeçalho na primeira linha.
                        </p>
                      </div>
                    </div>

                    {/* Passo 02 */}
                    <div className="flex gap-5 group">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black flex-shrink-0 border border-emerald-100 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300">02</div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-slate-800 uppercase">Mapeamento Automático</h4>
                        <p className="text-xs font-medium text-slate-500 leading-relaxed">
                          Headers reconhecidos automaticamente. CNS <span className="font-bold text-slate-600">(15 dígitos)</span>, datas <span className="font-bold text-slate-600">(ISO)</span> e campos numéricos são sanitizados em tempo real.
                        </p>
                      </div>
                    </div>

                    {/* Passo 03 */}
                    <div className="flex gap-5 group">
                      <div className="w-10 h-10 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-black flex-shrink-0 border border-violet-100 group-hover:bg-violet-600 group-hover:text-white transition-all duration-300">03</div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-black text-slate-800 uppercase">Processamento Controlado</h4>
                        <p className="text-xs font-medium text-slate-500 leading-relaxed">
                          Importação em lotes com pause/<span className="font-bold text-amber-600">continuar</span>, cancelamento, barra de progresso, <span className="font-bold text-slate-600">ETA</span> dinâmico e contagem de falhas.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Colunas */}
                  <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 rounded-3xl p-6 border border-slate-200/80">
                    <div className="flex items-center gap-2 mb-5">
                      <FileText className="w-4 h-4 text-slate-400" />
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Colunas Esperadas</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { n: 'Unidade', t: 'texto', c: 'text-blue-600 bg-blue-50 border-blue-100' },
                        { n: 'Equipe', t: 'texto', c: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
                        { n: 'Microárea', t: 'número', c: 'text-violet-600 bg-violet-50 border-violet-100' },
                        { n: 'CNS', t: 'número', c: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
                        { n: 'Nome', t: 'texto', c: 'text-sky-600 bg-sky-50 border-sky-100' },
                        { n: 'Nasc.', t: 'data', c: 'text-amber-600 bg-amber-50 border-amber-100' },
                        { n: 'Idade', t: 'número', c: 'text-rose-600 bg-rose-50 border-rose-100' },
                        { n: 'Grupo', t: 'texto', c: 'text-teal-600 bg-teal-50 border-teal-100' },
                        { n: 'Cito Lab', t: 'data', c: 'text-orange-600 bg-orange-50 border-orange-100' },
                        { n: 'Cito PEP', t: 'data', c: 'text-cyan-600 bg-cyan-50 border-cyan-100' },
                        { n: 'DNA-HPV', t: 'data', c: 'text-purple-600 bg-purple-50 border-purple-100' }
                      ].map((col, idx) => (
                        <div key={idx} className="flex flex-col items-center">
                          <span className={`px-3 py-1.5 border rounded-xl text-[9px] font-black uppercase tracking-tighter shadow-sm ${col.c} transition-transform hover:scale-105`}>
                            {col.n}
                          </span>
                          <span className="text-[7px] font-bold text-slate-400 uppercase mt-1">{col.t}</span>
                        </div>
                      ))}
                    </div>
                    <p className="text-[8px] font-medium text-slate-400 mt-4 leading-relaxed border-t border-slate-200/60 pt-3">
                      A ordem das colunas no CSV deve seguir esta sequência. O sistema reconhece variações nos nomes dos headers automaticamente.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Lado Direito: Upload e Histórico — 1/3 largura */}
          <div className="lg:col-span-1 flex flex-col gap-8">
            {isCap ? (
              <>
                  {/* Card: Importar CSV */}
                  <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-200/60 flex-1 flex flex-col">
                    <div className="flex items-center gap-4 mb-8 shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-200">
                        <UploadCloud className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Importar CSV</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Adicione registros à base de pacientes</p>
                      </div>
                    </div>

                    <div className="relative flex-1 flex flex-col justify-center">
                      <AnimatePresence mode="wait">
                        {isUploading ? (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="w-full bg-slate-50 rounded-[2rem] border-2 border-blue-100 p-6 flex flex-col text-center space-y-5"
                          >
                            {/* Barra de progresso */}
                            <div className="space-y-2">
                              <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase">
                                <span>{importProgress.imported} / {importProgress.total} registros</span>
                                <span>{importProgress.total > 0 ? Math.round((importProgress.imported / importProgress.total) * 100) : 0}%</span>
                              </div>
                              <div className="w-full h-3 bg-blue-100 rounded-full overflow-hidden">
                                <motion.div 
                                  className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full"
                                  initial={{ width: 0 }}
                                  animate={{ width: (importProgress.total > 0 ? (importProgress.imported / importProgress.total) * 100 : 0) + '%' }}
                                  transition={{ duration: 0.3 }}
                                />
                              </div>
                            </div>

                            {/* Grid métricas: TEMPO, ERROS, ESTIMADO */}
                            <div className="grid grid-cols-3 gap-2">
                              <div className="bg-white rounded-xl p-2.5 text-center">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">TEMPO</p>
                                <p className="text-[11px] font-black text-slate-700 mt-0.5">
                                  {importStartTimeRef.current > 0
                                    ? (function() { var s = Math.round((Date.now() - importStartTimeRef.current) / 1000); var m = Math.floor(s / 60); var seg = s % 60; return m + 'm ' + seg.toString().padStart(2, '0') + 's'; })()
                                    : '0m 00s'}
                                </p>
                              </div>
                              <div className="bg-white rounded-xl p-2.5 text-center">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">ERROS</p>
                                <p className={'text-[11px] font-black mt-0.5 ' + (importProgress.errors > 0 ? 'text-rose-600' : 'text-emerald-600')}>
                                  {importProgress.errors}
                                </p>
                              </div>
                              <div className="bg-white rounded-xl p-2.5 text-center">
                                <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">
                                  {importControl === 'paused' ? 'RESTANTE' : 'ESTIMADO'}
                                </p>
                                <p className="text-[11px] font-black text-slate-700 mt-0.5">
                                  {importEta || '...'}
                                </p>
                              </div>
                            </div>

                            {/* Status + Controles */}
                            <div className="flex items-center justify-center gap-3">
                              {importControl === 'paused' ? (
                                <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse" />
                              ) : (
                                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                              )}
                              <p className="text-[10px] font-black text-slate-600 uppercase">
                                {importControl === 'paused' ? 'PAUSADO' : 'IMPORTANDO'}
                              </p>
                            </div>

                            <div className="flex gap-3">
                              <button
                                onClick={handlePauseResumeImport}
                                className="flex-1 py-4 bg-amber-500 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 text-xs flex items-center justify-center gap-2"
                              >
                                {importControl === 'paused' ? '▶ Continuar' : '⏸ Pausar'}
                              </button>
                              <button
                                onClick={handleCancelImport}
                                className="flex-1 py-4 bg-slate-200 text-slate-600 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-300 transition-all text-xs flex items-center justify-center gap-2"
                              >
                                ⏹ Interromper
                              </button>
                            </div>
                          </motion.div>
                        ) : (
                          <motion.label 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center justify-center w-full border-2 border-slate-200 border-dashed min-h-[220px] rounded-[2rem] cursor-pointer bg-slate-50/50 hover:bg-white hover:border-blue-400 hover:shadow-xl hover:shadow-blue-500/5 transition-all relative group overflow-hidden"
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

                    {uploadStatus.stage === 'completed' && importSummary && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-6 w-full space-y-5"
                      >
                        <div className={'p-6 rounded-2xl flex items-center gap-4 ' + (importSummary.cancelled ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-100')}>
                          <div className={'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ' + (importSummary.cancelled ? 'bg-amber-500 shadow-amber-200' : 'bg-emerald-500 shadow-emerald-200')}>
                            {importSummary.cancelled ? (
                              <AlertTriangle className="w-5 h-5 text-white" />
                            ) : (
                              <CheckCircle className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <p className={'text-[10px] font-black uppercase leading-tight ' + (importSummary.cancelled ? 'text-amber-800' : 'text-emerald-800')}>
                            {uploadStatus.message}
                          </p>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-white rounded-xl p-3 text-center">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">REGISTROS</p>
                            <p className="text-sm font-black text-slate-800 mt-0.5">{importSummary.total}</p>
                          </div>
                          <div className="bg-white rounded-xl p-3 text-center">
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">DURAÇÃO</p>
                            <p className="text-sm font-black text-slate-800 mt-0.5">
                              {function() { var m = Math.floor(importSummary.elapsedSec / 60); var s = importSummary.elapsedSec % 60; return m + 'm ' + s.toString().padStart(2, '0') + 's'; }()}
                            </p>
                          </div>
                          <div className={'rounded-xl p-3 text-center ' + (importSummary.errors > 0 ? 'bg-rose-50' : 'bg-white')}>
                            <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">FALHAS</p>
                            <p className={'text-sm font-black mt-0.5 ' + (importSummary.errors > 0 ? 'text-rose-600' : 'text-slate-400')}>
                              {importSummary.errors}
                            </p>
                          </div>
                        </div>

                        <button
                          onClick={function() { setUploadStatus({ stage: 'idle', message: '', current: 0, total: 0 }); setImportControl('idle'); setImportSummary(null); }}
                          className="w-full py-4 bg-slate-100 text-slate-600 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all text-xs"
                        >
                          Voltar
                        </button>
                      </motion.div>
                    )}

                    {uploadStatus.stage === 'completed' && !importSummary && (
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

                  {/* Card: Excluir Base */}
                  <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-200/60 flex-1 flex flex-col">
                    <div className="flex items-center gap-4 mb-8 shrink-0">
                      <div className="w-12 h-12 bg-gradient-to-br from-rose-500 to-rose-700 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
                        <Trash2 className="w-6 h-6 text-white" />
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Excluir Base</h3>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Remova todos os registros de pacientes</p>
                      </div>
                    </div>

                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 min-h-[220px]">
                      <p className="text-sm font-bold text-slate-600">Excluir todos os registros</p>
                      <p className="text-[10px] font-medium text-slate-400 leading-relaxed max-w-[200px]">
                        Esta ação remove permanentemente todos os dados da coleção de pacientes.
                      </p>

                      {deleteStatus.type === 'idle' && (
                        <button
                          onClick={handleDeleteAll}
                          className="w-full py-4 bg-rose-600 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 text-xs"
                        >
                          Excluir Tudo
                        </button>
                      )}

                      {deleteStatus.type === 'deleting' && (
                        <div className="w-full space-y-5">
                          {/* Progresso */}
                          <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase">
                              <span>{deleteProgress.deleted} / {deleteProgress.total} registros</span>
                              <span>{deleteProgress.total > 0 ? Math.round((deleteProgress.deleted / deleteProgress.total) * 100) : 0}%</span>
                            </div>
                            <div className="w-full h-3 bg-rose-100 rounded-full overflow-hidden">
                              <motion.div 
                                className="h-full bg-gradient-to-r from-rose-500 to-rose-600 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ width: `${deleteProgress.total > 0 ? (deleteProgress.deleted / deleteProgress.total) * 100 : 0}%` }}
                                transition={{ duration: 0.3 }}
                              />
                            </div>
                          </div>

                          {/* Métricas: tempo + erros + ETA */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white rounded-xl p-2.5 text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">TEMPO</p>
                              <p className="text-[11px] font-black text-slate-700 mt-0.5">
                                {deleteStartTimeRef.current > 0
                                  ? (() => { var s = Math.round((Date.now() - deleteStartTimeRef.current) / 1000); var m = Math.floor(s / 60); var seg = s % 60; return `${m}m ${seg.toString().padStart(2, '0')}s`; })()
                                  : '0m 00s'}
                              </p>
                            </div>
                            <div className="bg-white rounded-xl p-2.5 text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">ERROS</p>
                              <p className={`text-[11px] font-black mt-0.5 ${deleteProgress.errors > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                {deleteProgress.errors}
                              </p>
                            </div>
                            <div className="bg-white rounded-xl p-2.5 text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">
                                {deleteControl === 'paused' ? 'RESTANTE' : 'ESTIMADO'}
                              </p>
                              {deleteControl === 'paused' ? (
                                <p className="text-[11px] font-black text-amber-600 mt-0.5">
                                  {deleteEta || '...'}
                                </p>
                              ) : (
                                <p className="text-[11px] font-black text-slate-700 mt-0.5">
                                  {deleteEta || '...'}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Status */}
                          <div className="flex items-center justify-center gap-3">
                            {deleteControl === 'paused' ? (
                              <div className="w-3 h-3 bg-amber-400 rounded-full animate-pulse" />
                            ) : (
                              <Loader2 className="w-4 h-4 text-rose-500 animate-spin" />
                            )}
                            <p className="text-[10px] font-black text-slate-600 uppercase">
                              {deleteControl === 'paused' ? 'PAUSADO' : 'EXCLUINDO'}
                            </p>
                          </div>

                          {/* Controles: Pause/Resume + Cancelar */}
                          <div className="flex gap-3">
                            <button
                              onClick={handlePauseResume}
                              className="flex-1 py-4 bg-amber-500 text-white font-black uppercase tracking-widest rounded-2xl hover:bg-amber-600 transition-all shadow-lg shadow-amber-200 text-xs flex items-center justify-center gap-2"
                            >
                              {deleteControl === 'paused' ? '▶ Continuar' : '⏸ Pausar'}
                            </button>
                            <button
                              onClick={handleCancelDelete}
                              className="flex-1 py-4 bg-slate-200 text-slate-600 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-300 transition-all text-xs flex items-center justify-center gap-2"
                            >
                              ⏹ Interromper
                            </button>
                          </div>
                        </div>
                      )}

                      {deleteStatus.type === 'completed' && deleteSummary && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="w-full space-y-5"
                        >
                          {/* Header: ícone diferente se cancelado */}
                          <div className={`p-6 rounded-2xl flex items-center gap-4 ${deleteSummary.cancelled ? 'bg-amber-50 border border-amber-200' : 'bg-emerald-50 border border-emerald-100'}`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${deleteSummary.cancelled ? 'bg-amber-500 shadow-amber-200' : 'bg-emerald-500 shadow-emerald-200'}`}>
                              {deleteSummary.cancelled ? (
                                <AlertTriangle className="w-5 h-5 text-white" />
                              ) : (
                                <CheckCircle className="w-5 h-5 text-white" />
                              )}
                            </div>
                            <p className={`text-[10px] font-black uppercase leading-tight ${deleteSummary.cancelled ? 'text-amber-800' : 'text-emerald-800'}`}>
                              {deleteStatus.message}
                            </p>
                          </div>

                          {/* Métricas finais */}
                          <div className="grid grid-cols-3 gap-2">
                            <div className="bg-white rounded-xl p-3 text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">REGISTROS</p>
                              <p className="text-sm font-black text-slate-800 mt-0.5">{deleteSummary.total}</p>
                            </div>
                            <div className="bg-white rounded-xl p-3 text-center">
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">DURAÇÃO</p>
                              <p className="text-sm font-black text-slate-800 mt-0.5">
                                {(() => { var m = Math.floor(deleteSummary.elapsedSec / 60); var s = deleteSummary.elapsedSec % 60; return `${m}m ${s.toString().padStart(2, '0')}s`; })()}
                              </p>
                            </div>
                            <div className={`rounded-xl p-3 text-center ${deleteSummary.errors > 0 ? 'bg-rose-50' : 'bg-white'}`}>
                              <p className="text-[8px] font-black text-slate-400 uppercase tracking-tight">FALHAS</p>
                              <p className={`text-sm font-black mt-0.5 ${deleteSummary.errors > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                                {deleteSummary.errors}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => { setDeleteStatus({ message: '', type: 'idle' }); setDeleteControl('idle'); setDeleteSummary(null); }}
                            className="w-full py-4 bg-slate-100 text-slate-600 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all text-xs"
                          >
                            Voltar
                          </button>
                        </motion.div>
                      )}

                      {deleteStatus.type === 'error' && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="w-full space-y-4"
                        >
                          <div className="p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-center gap-3">
                            <div className="w-8 h-8 bg-rose-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-rose-200">
                              <AlertTriangle className="w-4 h-4 text-white" />
                            </div>
                            <p className="text-[10px] font-black text-rose-800 uppercase leading-tight">{deleteStatus.message}</p>
                          </div>
                          <button
                            onClick={() => { setDeleteStatus({ message: '', type: 'idle' }); setDeleteControl('idle'); setDeleteSummary(null); }}
                            className="w-full py-4 bg-slate-100 text-slate-600 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all text-xs"
                          >
                            Voltar
                          </button>
                        </motion.div>
                      )}
                    </div>
                  </div>

                  {/* Histórico de Operações */}
                  <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-200/60 flex-1 flex flex-col">
                    <div className="flex items-center justify-between mb-8 shrink-0">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-slate-600 to-slate-800 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-200">
                          <History className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-xl font-black text-slate-800 uppercase tracking-tight">Histórico</h3>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Últimos sincronismos</p>
                        </div>
                      </div>
                      <button onClick={fetchImportHistory} className="p-2.5 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors border border-slate-100">
                        <History className={`w-4 h-4 text-slate-500 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                      </button>
                    </div>

                    <div className="flex-1 flex flex-col justify-center min-h-[220px]">
                      <div className="space-y-3">
                        {importHistory.length > 0 ? importHistory.map((log) => (
                        <div key={log.id} className="p-4 bg-slate-50/80 border border-slate-100 rounded-2xl relative group hover:border-blue-200 hover:bg-white hover:shadow-sm transition-all">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center border border-slate-100 shadow-sm shrink-0">
                                <FileText className="w-4 h-4 text-blue-600" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-800 truncate max-w-[130px]">{log.filename}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{new Date(log.created).toLocaleDateString('pt-BR')}</p>
                              </div>
                            </div>
                            <button 
                              onClick={(e) => handleDeleteImport(e, log.id)} 
                              className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors rounded-lg hover:bg-rose-50 shrink-0"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between bg-white rounded-xl px-3.5 py-2.5 border border-slate-100">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">Registros</span>
                              <span className="text-sm font-black text-slate-700">{log.total_records}</span>
                            </div>
                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[8px] font-black uppercase border border-emerald-200">
                              <CheckCircle className="w-3 h-3" />
                              Sucesso
                            </div>
                          </div>
                        </div>
                      )) : (
                        <div className="py-12 flex flex-col items-center justify-center text-center">
                          <Search className="w-8 h-8 text-slate-300 mb-3" />
                          <p className="text-[10px] font-black text-slate-400 uppercase">Nenhum registro encontrado</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                </>
              ) : (
                <div className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-sm border border-slate-200/60 flex flex-col items-center justify-center text-center flex-1">
                  <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-5 border border-slate-100">
                    <Shield className="w-7 h-7 text-slate-300" />
                  </div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tighter mb-2">Área Administrativa</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest max-w-[220px] leading-relaxed">
                    Recursos de importação e exclusão disponíveis apenas para administradores.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
    </div>

      {/* Modal de Confirmação de Senha */}
      <AnimatePresence>
      {showPasswordModal && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={closePasswordModal}
        >
          <motion.div 
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="w-full max-w-md bg-white rounded-[2.5rem] p-8 shadow-2xl border border-rose-100 relative overflow-hidden"
            onClick={e => e.stopPropagation()}
          >
            {/* Bg decorativo */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-rose-500/5 rounded-full blur-3xl -ml-12 -mb-12" />

            <div className="relative z-10">
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-14 h-14 bg-gradient-to-br from-rose-500 to-rose-700 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-200">
                  <Shield className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight">Confirmação de Segurança</h3>
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mt-0.5">Ação irreversível</p>
                </div>
              </div>

              {/* Aviso */}
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl mb-6">
                <p className="text-[10px] font-black text-rose-700 uppercase text-center leading-relaxed">
                  Esta ação irá remover permanentemente TODOS os registros da coleção de pacientes. Esta operação não pode ser desfeita.
                </p>
              </div>

              {/* Input Senha */}
              <div className="space-y-2 mb-6">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                  Digite sua senha para confirmar
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={passwordInput}
                    onChange={e => setPasswordInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handlePasswordSubmit()}
                    placeholder="••••••••"
                    className="w-full py-4 pl-11 pr-5 bg-slate-50 border-2 border-slate-200 rounded-2xl text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-rose-400 focus:bg-white transition-all"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-rose-500 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                  {passwordError && (
                    <motion.p 
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-[10px] font-black text-rose-500 mt-2 ml-1"
                    >
                      {passwordError}
                    </motion.p>
                  )}
                </div>
              </div>

              {/* Ações */}
              <div className="flex gap-3">
                <button
                  onClick={closePasswordModal}
                  className="flex-1 py-4 bg-slate-100 text-slate-600 font-black uppercase tracking-widest rounded-2xl hover:bg-slate-200 transition-all text-xs"
                >
                  Cancelar
                </button>
                <button
                  onClick={handlePasswordSubmit}
                  className="flex-1 py-4 bg-gradient-to-r from-rose-600 to-rose-700 text-white font-black uppercase tracking-widest rounded-2xl hover:from-rose-700 hover:to-rose-800 transition-all shadow-lg shadow-rose-200 text-xs"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
      </AnimatePresence>

  </div>
  );
};
