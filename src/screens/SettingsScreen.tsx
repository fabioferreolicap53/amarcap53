import React, { useState, useRef } from 'react';
import { Header } from '../components/Header';
import { Edit2, ShieldCheck, MapPin, Moon, AlignJustify, Mail, AlertOctagon, Shield, Terminal, UploadCloud, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Papa from 'papaparse';
import { pb } from '../lib/pocketbase';

export const SettingsScreen = () => {
  const { user, isAdmin } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        let successCount = 0;
        let errorCount = 0;

        for (const row of data) {
          try {
            // Verifica se os cabeçalhos obrigatórios existem
            if (!row['NOME'] || !row['CNS'] || !row['UNIDADE'] || !row['EQUIPE'] || !row['MICROAREA']) {
              console.warn('Linha ignorada por falta de dados obrigatórios:', row);
              errorCount++;
              continue;
            }

            // Mapeamento dos dados do CSV para a coleção do PocketBase baseando-se nos novos cabeçalhos
            const pacienteData = {
              nome: row['NOME'],
              cns: row['CNS'],
              data_nascimento: row['NASCIMENTO'] || '',
              unidade: row['UNIDADE'],
              equipe: row['EQUIPE'],
              microarea: row['MICROAREA'],
              siscan: row['SISCAN'] || '',
              cadastro_lab: row['CADASTRO LAB'] || '',
              coleta_v2: row['COLETA V2'] || '',
              dna_hpv_pront: row['DNA HPV (PRONT)'] || '',
              dna_hpv_gal: row['DNA HPV (GAL)'] || '',
              dna_hpv_pep: row['DNA HPV (PEP)'] || '',
              alertas: row['ALERTAS'] || '',
            };

            await pb.collection('amarcap53_pacientes').create(pacienteData);
            successCount++;
          } catch (err) {
            console.error('Erro ao importar paciente:', err);
            errorCount++;
          }
        }

        setIsUploading(false);
        if (successCount > 0) {
          setUploadStatus({ 
            type: 'success', 
            message: `Upload concluído: ${successCount} pacientes importados com sucesso. ${errorCount > 0 ? `(${errorCount} erros)` : ''}` 
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
                  <p className="text-on-surface-variant text-sm">Gerencie suas informações profissionais e credenciais do SUS.</p>
                </div>
                <button className="w-full sm:w-auto bg-primary text-on-primary px-4 py-2 rounded-md text-sm font-medium hover:opacity-90 transition-all flex items-center justify-center gap-2">
                  <Edit2 className="w-4 h-4" />
                  Editar Perfil
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 md:gap-y-6 gap-x-12">
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Nome Completo</p>
                  <p className="text-sm font-semibold text-primary">Helena Maria de Souza Santos</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Registro Profissional (CRM)</p>
                  <p className="text-sm font-semibold text-primary">123456-RJ</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">Cartão Nacional de Saúde (CNS)</p>
                  <p className="text-sm font-semibold text-primary">980 0000 0000 0000</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">E-mail Institucional</p>
                  <p className="text-sm font-semibold text-primary">{user?.email}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-primary-container text-on-primary-fixed p-6 md:p-8 rounded-xl flex flex-col justify-center items-center text-center">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-white/10 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Acesso Seguro</h3>
              <p className="text-xs text-on-primary-container leading-relaxed px-4">
                Nível de acesso: <span className="font-bold uppercase">{isAdmin ? 'Administrador' : 'Usuário Padrão'}</span>
              </p>
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
                    </div>

                    <div className="bg-surface-container-lowest p-4 rounded-lg border border-outline-variant/20 text-xs text-on-surface-variant space-y-2">
                      <p className="font-bold text-primary mb-2">Modelo de Cabeçalho Obrigatório (Exatamente como escrito abaixo):</p>
                      <code className="block bg-surface p-2 rounded text-error/80 break-all">
                        NOME,CNS,NASCIMENTO,UNIDADE,EQUIPE,MICROAREA,SISCAN,CADASTRO LAB,COLETA V2,DNA HPV (PRONT),DNA HPV (GAL),DNA HPV (PEP),ALERTAS
                      </code>
                      <ul className="list-disc pl-4 space-y-1 mt-2">
                        <li>As colunas <span className="font-semibold">NOME, CNS, UNIDADE, EQUIPE, MICROAREA</span> são obrigatórias para o upload.</li>
                        <li>Os dados de unidade, equipe e microárea devem ser idênticos aos cadastrados no sistema.</li>
                      </ul>
                    </div>
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
