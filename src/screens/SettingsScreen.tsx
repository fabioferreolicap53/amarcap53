import React, { useState, useRef, useEffect } from 'react';
import { Header } from '../components/Header';
import { Edit2, ShieldCheck, MapPin, Moon, AlignJustify, Mail, AlertOctagon, Shield, Terminal, UploadCloud, CheckCircle, AlertTriangle, FileText, History, BarChart3, ChevronRight, Info } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Papa from 'papaparse';
import { pb } from '../lib/pocketbase';

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

export const SettingsScreen = () => {
  const { user, isAdmin } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [userName, setUserName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);
  const [importHistory, setImportHistory] = useState<ImportLog[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Sincroniza o estado do input com o usuário do contexto sempre que ele mudar
  useEffect(() => {
    setUserName(user?.name || '');
  }, [user]);

  // Carrega histórico de importações
  useEffect(() => {
    if (isAdmin) {
      fetchImportHistory();
    }
  }, [isAdmin]);

  const fetchImportHistory = async () => {
    try {
      setIsLoadingHistory(true);
      const records = await pb.collection('amarcap53_importacoes').getList(1, 5, {
        sort: '-created',
      });
      setImportHistory(records.items as unknown as ImportLog[]);
    } catch (err) {
      console.error('Erro ao buscar histórico:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpdateName = async () => {
    if (!user) return;
    setIsSavingName(true);
    try {
      // Atualiza o nome na coleção
      const updatedRecord = await pb.collection('amarcap53_users').update(user.id, {
        name: userName
      });

      // Verifica se o campo 'name' existe no retorno da API
      if (updatedRecord && !('name' in updatedRecord)) {
        alert('AVISO: O campo "name" não existe no seu PocketBase. O nome NÃO foi salvo. Por favor, adicione o campo "name" na coleção "amarcap53_users" no painel do PocketBase.');
        setIsEditingName(false);
        return;
      }
      
      // Recarrega os dados da sessão
      await pb.collection('amarcap53_users').authRefresh();
      
      // Garante que o estado local reflita o que foi salvo
      setUserName(pb.authStore.model?.name || '');
      
      setIsEditingName(false);
    } catch (err) {
      console.error('Erro ao atualizar nome:', err);
      alert('Erro ao atualizar nome. Tente novamente.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      setUploadStatus({ type: 'error', message: 'Por favor, envie apenas arquivos .csv' });
      return;
    }

    setIsUploading(true);
    setUploadStatus({ type: null, message: '' });

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const data = results.data as any[];
        const totalRecords = data.length;
        let successCount = 0;
        let errorCount = 0;
        const errorDetails: string[] = [];

        try {
          // Etapa 1: Apagar todos os registros antigos antes de importar os novos (Substituição Total)
          // Buscamos os IDs de todos os pacientes na coleção
          const recordsToDelete = await pb.collection('amarcap53_pacientes').getFullList({ fields: 'id' });
          
          if (recordsToDelete.length > 0) {
            // PocketBase não tem delete em lote nativo via JS SDK, então deletamos um por um
            // Executamos em paralelo usando Promise.all limitando a concorrência para não estourar limite da API
            const batchSize = 50;
            for (let i = 0; i < recordsToDelete.length; i += batchSize) {
              const batch = recordsToDelete.slice(i, i + batchSize);
              await Promise.all(batch.map(record => pb.collection('amarcap53_pacientes').delete(record.id)));
            }
          }
        } catch (deleteErr: any) {
          console.error('Erro ao limpar banco de dados antes da importação:', deleteErr);
          const errorMessage = deleteErr.status === 403 || deleteErr.status === 401 
            ? 'Erro de permissão: Verifique se a regra de "Delete" na coleção amarcap53_pacientes está liberada no PocketBase.' 
            : `Erro ao limpar dados antigos: ${deleteErr.message || 'Erro desconhecido'}`;
            
          setUploadStatus({ type: 'error', message: errorMessage });
          setIsUploading(false);
          if (fileInputRef.current) fileInputRef.current.value = '';
          return;
        }

        // Etapa 2: Inserir os novos registros
        for (const row of data) {
          try {
            // Verifica se os cabeçalhos obrigatórios existem
            if (!row['UNIDADE']?.trim() || !row['EQUIPE']?.trim() || !row['MICROAREA']?.trim() || !row['NOME']?.trim() || !row['CNS']?.trim() || !row['NASCIMENTO']?.trim() || !row['IDADE']?.trim()) {
              const missingFields = [];
              if (!row['UNIDADE']?.trim()) missingFields.push('UNIDADE');
              if (!row['EQUIPE']?.trim()) missingFields.push('EQUIPE');
              if (!row['MICROAREA']?.trim()) missingFields.push('MICROAREA');
              if (!row['NOME']?.trim()) missingFields.push('NOME');
              if (!row['CNS']?.trim()) missingFields.push('CNS');
              if (!row['NASCIMENTO']?.trim()) missingFields.push('NASCIMENTO');
              if (!row['IDADE']?.trim()) missingFields.push('IDADE');
              
              errorDetails.push(`Linha ${(successCount + errorCount + 1)}: Campos obrigatórios ausentes ou vazios (${missingFields.join(', ')})`);
              errorCount++;
              continue;
            }

            // Mapeamento dos dados do CSV para a coleção do PocketBase baseando-se nos novos cabeçalhos
            // Aplicamos .trim() em todos os campos de texto para evitar erros de validação por espaços extras
            const pacienteData = {
              nome: row['NOME'].trim(),
              cns: row['CNS'].trim(),
              data_nascimento: row['NASCIMENTO'].trim(),
              idade: parseInt(row['IDADE'].trim()) || null,
              unidade: row['UNIDADE'].trim(),
              equipe: row['EQUIPE'].trim(),
              microarea: row['MICROAREA'].trim(),
              siscan: row['SISCAN']?.trim() || '',
              cadastro_lab: row['CADASTRO LAB']?.trim() || '',
              coleta_v2: row['COLETA V2']?.trim() || '',
              dna_hpv_pront: row['DNA HPV (PRONT)']?.trim() || '',
              dna_hpv_gal: row['DNA HPV (GAL)']?.trim() || '',
              dna_hpv_pep: row['DNA HPV (PEP)']?.trim() || '',
            };

            await pb.collection('amarcap53_pacientes').create(pacienteData);
            successCount++;
          } catch (err: any) {
            console.error('Erro ao importar paciente:', err);
            errorDetails.push(`Linha ${(successCount + errorCount + 1)}: ${err.message || 'Erro desconhecido'}`);
            errorCount++;
          }
        }

        // Salva o log da importação no banco
        try {
          await pb.collection('amarcap53_importacoes').create({
            filename: file.name,
            total_records: totalRecords,
            success_count: successCount,
            error_count: errorCount,
            user_id: user?.id,
            details: errorDetails.slice(0, 50).join('\n') // Limita os detalhes para não sobrecarregar
          });
          fetchImportHistory(); // Atualiza a lista na UI
        } catch (logErr) {
          console.error('Erro ao salvar log de importação:', logErr);
        }

        setIsUploading(false);
        if (successCount > 0) {
          setUploadStatus({ 
            type: 'success', 
            message: `Upload concluído: ${successCount} pacientes importados com sucesso. ${errorCount > 0 ? `(${errorCount} erros registrados no relatório)` : ''}` 
          });
        } else {
          setUploadStatus({ type: 'error', message: 'Nenhum paciente importado. Verifique os cabeçalhos do arquivo.' });
        }
        
        // Reset file input
        if (fileInputRef.current) fileInputRef.current.value = '';
      },
      error: (error) => {
        setIsUploading(false);
        setUploadStatus({ type: 'error', message: `Erro ao ler o arquivo: ${error.message}` });
      }
    });
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <Header title="Configurações" pageTitle="Configurações" />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8 lg:p-10 no-scrollbar">
        <div className="max-w-6xl mx-auto space-y-8 md:space-y-12">
          
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-surface-container-lowest p-6 md:p-8 rounded-xl shadow-sm border-l-4 border-primary">
              <div className="flex flex-col sm:flex-row items-start justify-between mb-6 md:mb-8 gap-4">
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-primary mb-1">Informações do Perfil</h2>
                  <p className="text-on-surface-variant text-sm">Gerencie seu nome de exibição e credenciais de acesso.</p>
                </div>
                {!isEditingName ? (
                  <button 
                    onClick={() => { setIsEditingName(true); setUserName(user?.name || ''); }}
                    className="w-full sm:w-auto bg-primary text-on-primary px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2"
                  >
                    <Edit2 className="w-4 h-4" />
                    Editar Nome
                  </button>
                ) : (
                  <div className="flex gap-2 w-full sm:w-auto">
                    <button 
                      onClick={handleUpdateName}
                      disabled={isSavingName}
                      className="flex-1 sm:flex-none bg-primary text-on-primary px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSavingName ? 'Salvando...' : 'Salvar'}
                    </button>
                    <button 
                      onClick={() => setIsEditingName(false)}
                      className="flex-1 sm:flex-none bg-surface-container-high text-on-surface px-4 py-2 rounded-md text-sm font-medium hover:bg-surface-container-highest transition-all"
                    >
                      Cancelar
                    </button>
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 md:gap-y-6 gap-x-12">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">NOME</p>
                  {isEditingName ? (
                    <input 
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="w-full bg-surface border border-outline/30 rounded-lg px-3 py-2 text-sm font-semibold text-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                      placeholder="Seu nome completo"
                      autoFocus
                    />
                  ) : (
                    <p className="text-sm font-semibold text-primary">{user?.name || 'Não informado'}</p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">E-MAIL DE ACESSO</p>
                  <p className="text-sm font-semibold text-primary">{user?.email}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-primary-container text-on-primary-fixed p-6 md:p-8 rounded-xl flex flex-col justify-center items-center text-center relative overflow-hidden group">
              {/* Micro efeito premium de brilho ao fundo */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              
              <div className="w-16 h-16 md:w-20 md:h-20 bg-white/10 rounded-full flex items-center justify-center mb-4 relative z-10 shadow-lg">
                <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2 relative z-10">Acesso Seguro</h3>
              <div className="bg-white/10 px-4 py-1.5 rounded-full border border-white/20 relative z-10">
                <p className="text-[10px] md:text-xs text-white uppercase tracking-widest font-black">
                  Nível: <span className="text-secondary-container">{isAdmin ? 'ADMINISTRADOR' : 'USUÁRIO PADRÃO'}</span>
                </p>
              </div>
            </div>
          </section>

          {isAdmin && (
            <section className="space-y-4 md:space-y-6">
              <div className="border-b border-outline-variant/30 pb-4">
                <h2 className="text-lg md:text-xl font-bold text-primary flex items-center gap-2">
                  <Terminal className="w-5 h-5" />
                  Administração do Sistema
                </h2>
                <p className="text-on-surface-variant text-sm">Ferramentas exclusivas para administradores.</p>
              </div>

              <div className="bg-surface-container-low p-6 md:p-8 rounded-xl border border-outline-variant/30">
                <div className="flex flex-col md:flex-row gap-8 items-start">
                  <div className="flex-1 space-y-4">
                    <div>
                      <h3 className="text-base font-bold text-primary flex items-center gap-2">
                        <UploadCloud className="w-5 h-5 text-secondary" />
                        Importar Pacientes via CSV
                      </h3>
                      <p className="text-sm text-on-surface-variant mt-1">
                        Faça o upload de uma lista de pacientes para alimentar o banco de dados. O arquivo deve estar no formato .csv.
                      </p>
                      <div className="mt-3 inline-flex items-center gap-2 bg-error/10 border border-error/20 text-error px-3 py-2 rounded-md text-xs font-bold">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                        <p>Aviso: Cada nova importação irá <span className="underline">substituir totalmente</span> os pacientes atuais do sistema.</p>
                      </div>
                    </div>

                      <p className="font-bold text-primary mb-2">Modelo de Cabeçalho Obrigatório (Exatamente como escrito abaixo):</p>
                      <code className="block bg-surface p-2 rounded text-primary/80 break-all">
                        UNIDADE, EQUIPE, MICROAREA, NOME, CNS, NASCIMENTO, IDADE, SISCAN, CADASTRO LAB, COLETA V2, DNA HPV (PRONT), DNA HPV (GAL), DNA HPV (PEP)
                      </code>
                      <ul className="list-disc pl-4 space-y-1 mt-2">
                        <li>As colunas <span className="font-semibold">UNIDADE, EQUIPE, MICROAREA, NOME, CNS, NASCIMENTO, IDADE</span> são obrigatórias para o upload.</li>
                        <li>Os dados de unidade, equipe e microárea devem ser idênticos aos cadastrados no sistema.</li>
                      </ul>
                  </div>

                  <div className="w-full md:w-1/3 flex flex-col gap-4">
                    <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-primary/20 border-dashed rounded-xl cursor-pointer bg-surface-container-lowest hover:bg-primary/5 transition-colors relative overflow-hidden">
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        <UploadCloud className={`w-8 h-8 mb-2 ${isUploading ? 'text-primary animate-bounce' : 'text-primary/60'}`} />
                        <p className="text-sm font-semibold text-primary text-center px-2">
                          {isUploading ? 'Processando arquivo...' : 'Clique para selecionar o CSV'}
                        </p>
                      </div>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept=".csv" 
                        onChange={handleFileUpload}
                        disabled={isUploading}
                        ref={fileInputRef}
                      />
                    </label>

                    {uploadStatus.type === 'success' && (
                      <div className="flex items-start gap-2 text-sm text-secondary-container bg-secondary/10 p-3 rounded-lg">
                        <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p>{uploadStatus.message}</p>
                      </div>
                    )}

                    {uploadStatus.type === 'error' && (
                      <div className="flex items-start gap-2 text-sm text-error bg-error/10 p-3 rounded-lg">
                        <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <p>{uploadStatus.message}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Seção de Relatórios de Importação */}
              <div className="mt-8 border-t border-outline-variant/20 pt-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-base font-bold text-primary flex items-center gap-2">
                      <History className="w-5 h-5 text-secondary" />
                      Relatório de Importações Recentes
                    </h3>
                    <p className="text-xs text-on-surface-variant mt-1">Acompanhe o status e detalhes dos últimos arquivos processados.</p>
                  </div>
                  <button 
                    onClick={fetchImportHistory}
                    className="text-primary hover:text-primary/70 transition-colors p-2 rounded-full hover:bg-primary/5"
                    title="Atualizar Relatórios"
                  >
                    <History className={`w-4 h-4 ${isLoadingHistory ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <div className="space-y-4">
                  {isLoadingHistory && importHistory.length === 0 ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : importHistory.length === 0 ? (
                    <div className="bg-surface-container-lowest p-8 rounded-xl border border-dashed border-outline-variant/30 text-center">
                      <Info className="w-8 h-8 text-on-surface-variant/40 mx-auto mb-3" />
                      <p className="text-sm text-on-surface-variant italic">Nenhuma importação registrada no sistema.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {importHistory.map((log) => (
                        <div key={log.id} className="bg-surface-container-lowest border border-outline-variant/20 rounded-xl overflow-hidden hover:border-primary/30 transition-all group">
                          <div className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${log.error_count > 0 ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'}`}>
                                <FileText className="w-5 h-5" />
                              </div>
                              <div>
                                <h4 className="text-sm font-bold text-primary truncate max-w-[200px] sm:max-w-xs" title={log.filename}>
                                  {log.filename}
                                </h4>
                                <p className="text-[10px] text-on-surface-variant uppercase tracking-wider font-medium">
                                  {new Date(log.created).toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-6 sm:gap-8">
                              <div className="text-center">
                                <p className="text-[9px] text-on-surface-variant uppercase font-black mb-1">Total</p>
                                <p className="text-sm font-bold text-primary">{log.total_records}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[9px] text-secondary uppercase font-black mb-1">Sucesso</p>
                                <p className="text-sm font-bold text-secondary">{log.success_count}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[9px] text-error uppercase font-black mb-1">Erros</p>
                                <p className="text-sm font-bold text-error">{log.error_count}</p>
                              </div>
                              <div className="flex items-center justify-center bg-surface-container-high p-1.5 rounded-full group-hover:bg-primary/10 transition-colors">
                                <ChevronRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary" />
                              </div>
                            </div>
                          </div>
                          
                          {log.error_count > 0 && log.details && (
                            <div className="bg-error/[0.02] border-t border-error/5 p-4">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertTriangle className="w-3.5 h-3.5 text-error" />
                                <span className="text-[10px] font-bold text-error uppercase tracking-widest">Detalhes dos Erros (Top 50)</span>
                              </div>
                              <pre className="text-[10px] text-error/80 font-mono bg-error/5 p-3 rounded-lg overflow-x-auto max-h-32 whitespace-pre-wrap">
                                {log.details}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {importHistory.length > 0 && (
                    <div className="flex justify-center mt-6">
                      <div className="bg-surface-container-high/50 px-4 py-2 rounded-full border border-outline-variant/10 flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-secondary"></div>
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Sucesso</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-error"></div>
                          <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Erros</span>
                        </div>
                        <div className="w-px h-3 bg-outline-variant/30 mx-1"></div>
                        <p className="text-[10px] text-on-surface-variant italic">Relatório sincronizado em tempo real</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          <section className="space-y-4 md:space-y-6">
            <div className="border-b border-outline-variant/30 pb-4">
              <h2 className="text-lg md:text-xl font-bold text-primary">Unidade de Atuação</h2>
              <p className="text-on-surface-variant text-sm">Vínculo territorial e divisão de microáreas.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
              <div className="md:col-span-1 bg-surface-container-low p-5 md:p-6 rounded-lg flex flex-col gap-2">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Microárea Atual</p>
                <p className="text-2xl md:text-3xl font-black text-primary">{user?.microarea}</p>
                <p className="text-xs text-on-surface-variant">Equipe: {user?.equipe}</p>
              </div>
              
              <div className="md:col-span-3 bg-white p-5 md:p-6 rounded-lg shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-secondary-container rounded-full flex items-center justify-center text-primary flex-shrink-0">
                    <MapPin className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">{user?.unidade_saude}</p>
                    <p className="text-[10px] md:text-xs text-on-surface-variant">Unidade de Saúde Vinculada</p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-primary">Preferências de Visualização</h3>
              
              <div className="bg-surface-container-low rounded-xl overflow-hidden">
                <div className="p-4 md:p-5 flex items-center justify-between hover:bg-white/40 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <Moon className="w-5 h-5 md:w-6 md:h-6 text-on-surface-variant" />
                    <div>
                      <p className="text-sm font-semibold">Modo Escuro</p>
                      <p className="text-[10px] text-on-surface-variant">Reduz a fadiga ocular em turnos noturnos</p>
                    </div>
                  </div>
                  <div className="w-10 h-5 bg-outline-variant rounded-full relative">
                    <div className="absolute left-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                  </div>
                </div>
                
                <div className="p-5 flex items-center justify-between border-t border-outline-variant/10 hover:bg-white/40 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <AlignJustify className="w-6 h-6 text-on-surface-variant" />
                    <div>
                      <p className="text-sm font-semibold">Alta Densidade de Dados</p>
                      <p className="text-[10px] text-on-surface-variant">Exibe mais informações em tabelas de prontuário</p>
                    </div>
                  </div>
                  <div className="w-10 h-5 bg-primary rounded-full relative">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-primary">Notificações e Alertas</h3>
              
              <div className="bg-surface-container-low rounded-xl overflow-hidden">
                <div className="p-5 flex items-center justify-between hover:bg-white/40 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <Mail className="w-6 h-6 text-on-surface-variant" />
                    <div>
                      <p className="text-sm font-semibold">Alertas de Microárea</p>
                      <p className="text-[10px] text-on-surface-variant">Novas pendências de rastreio na sua área</p>
                    </div>
                  </div>
                  <div className="w-10 h-5 bg-primary rounded-full relative">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                  </div>
                </div>
                
                <div className="p-5 flex items-center justify-between border-t border-outline-variant/10 hover:bg-white/40 transition-colors cursor-pointer">
                  <div className="flex items-center gap-4">
                    <AlertOctagon className="w-6 h-6 text-error" />
                    <div>
                      <p className="text-sm font-semibold">Casos Críticos</p>
                      <p className="text-[10px] text-on-surface-variant">Notificar imediatamente sobre indicadores vermelhos</p>
                    </div>
                  </div>
                  <div className="w-10 h-5 bg-primary rounded-full relative">
                    <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="pt-10 border-t border-outline-variant/30 flex flex-col md:flex-row justify-between items-center gap-6 pb-8">
            <div className="flex gap-8">
              <a className="text-xs font-medium text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2" href="#">
                <Shield className="w-4 h-4" />
                Termos de Uso e Privacidade
              </a>
              <a className="text-xs font-medium text-on-surface-variant hover:text-primary transition-colors flex items-center gap-2" href="#">
                <Terminal className="w-4 h-4" />
                Versão do Sistema (v2.4.0)
              </a>
            </div>
            <button className="border border-outline-variant/40 px-6 py-2 rounded-md text-xs font-bold text-primary hover:bg-surface-container-low transition-all">
              Relatar um Problema Técnico
            </button>
          </section>
          
        </div>
      </div>
    </div>
  );
};
