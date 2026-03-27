import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { X, Search, AlertTriangle, Calendar, Phone, ClipboardList, MapPin, MessageSquare, Info, CheckCircle2, Building } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { pb } from '../lib/pocketbase';

interface Paciente {
  id: string;
  nome: string;
  cns: string;
  data_nascimento: string;
  idade?: number;
  siscan?: string;
  cadastro_lab?: string;
  coleta_v2?: string;
  dna_hpv_pront?: string;
  dna_hpv_gal?: string;
  dna_hpv_pep?: string;
  alertas?: string;
}

export const PatientsScreen = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPaciente, setSelectedPaciente] = useState<Paciente | null>(null);
  const { user } = useAuth();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const handleOpenModal = (paciente: Paciente) => {
    setSelectedPaciente(paciente);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPaciente(null);
  };

  const [isSaving, setIsSaving] = useState(false);

  const handleSaveFollowUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!selectedPaciente || !user) return;
    
    setIsSaving(true);
    const formData = new FormData(e.currentTarget);
    
    const data = {
      paciente: selectedPaciente.id,
      profissional: user.id,
      data_busca: formData.get('data_busca') || '',
      tipo_contato: formData.get('tipo_contato') || '',
      situacao_pos_busca: formData.get('situacao_pos_busca') || '',
      identificacao_rede: formData.get('identificacao_rede') || '',
      principais_entraves: formData.get('principais_entraves') || '',
      observacoes: formData.get('observacoes') || '',
    };

    try {
      await pb.collection('amarcap53_acompanhamentos').create(data);
      alert('Acompanhamento registrado com sucesso!');
      handleCloseModal();
    } catch (error) {
      console.error('Erro ao salvar acompanhamento:', error);
      alert('Erro ao salvar o acompanhamento. Verifique se a coleção foi criada no PocketBase.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    const fetchPacientes = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        // Busca os pacientes filtrando pela unidade, equipe e microárea do usuário logado
        const records = await pb.collection('amarcap53_pacientes').getFullList({
          filter: `unidade = "${user.unidade_saude}" && equipe = "${user.equipe}" && microarea = "${user.microarea}"`,
          sort: 'nome',
        });
        
        // Mapeia os dados do banco para a interface
        const pacientesFormatados = records.map(record => ({
          id: record.id,
          nome: record.nome || '--',
          cns: record.cns || '--',
          data_nascimento: record.data_nascimento || '--',
          idade: calcularIdade(record.data_nascimento),
          siscan: record.siscan || '--',
          cadastro_lab: record.cadastro_lab || '--',
          coleta_v2: record.coleta_v2 || '--',
          dna_hpv_pront: record.dna_hpv_pront || '--',
          dna_hpv_gal: record.dna_hpv_gal || '--',
          dna_hpv_pep: record.dna_hpv_pep || '--',
          alertas: record.alertas || 'NORMAL',
        }));

        setPacientes(pacientesFormatados);
      } catch (error) {
        console.error("Erro ao buscar pacientes:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPacientes();
  }, [user]);

  const calcularIdade = (dataNascimento: string) => {
    if (!dataNascimento) return 0;
    // Tenta interpretar DD/MM/YYYY ou YYYY-MM-DD
    let dataFormatada = dataNascimento;
    if (dataNascimento.includes('/')) {
      const [dia, mes, ano] = dataNascimento.split('/');
      dataFormatada = `${ano}-${mes}-${dia}`;
    }
    
    const hoje = new Date();
    const nascimento = new Date(dataFormatada);
    let idade = hoje.getFullYear() - nascimento.getFullYear();
    const m = hoje.getMonth() - nascimento.getMonth();
    if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
      idade--;
    }
    return isNaN(idade) ? 0 : idade;
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <Header title="Meus Pacientes" pageTitle="Meus Pacientes" />
      
      <div className="flex-1 overflow-y-auto p-4 md:p-8 no-scrollbar">
        <div className="max-w-7xl mx-auto">
          
          <div className="mb-6 md:mb-10">
            <h2 className="text-xl md:text-[1.5rem] font-bold text-primary mb-2">Meus Pacientes</h2>
            <p className="text-on-surface-variant text-sm max-w-2xl">
              Gerencie o fluxo de acompanhamento e rastreio citopatológico. Utilize as ações para registrar novas interações e buscas ativas.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:gap-6 mb-6 md:mb-8">
            <div className="bg-surface-container-lowest p-5 md:p-6 rounded-xl shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between border-l-4 border-primary gap-4">
              <div>
                <p className="text-[10px] md:text-xs font-bold text-primary/60 uppercase tracking-widest mb-1">Total sob sua responsabilidade</p>
                <p className="text-3xl md:text-[2.5rem] font-black text-primary leading-none">
                  {pacientes.length} <span className="text-sm font-medium text-on-surface-variant ml-1 md:ml-2 tracking-normal">Pacientes Ativos</span>
                </p>
              </div>
              <div className="flex gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-right">
                  <p className="text-[10px] md:text-xs text-on-surface-variant font-medium">Urgentes</p>
                  <p className="text-lg md:text-xl font-bold text-error">
                    {pacientes.filter(p => p.alertas && p.alertas.toUpperCase().includes('URGENTE')).length}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] md:text-xs text-on-surface-variant font-medium">Aguardando Coleta</p>
                  <p className="text-lg md:text-xl font-bold text-tertiary-container">
                    {pacientes.filter(p => p.alertas && p.alertas.toUpperCase().includes('AGUARDANDO COLETA')).length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0px_12px_32px_rgba(25,28,30,0.06)] border border-outline-variant/10">
            <div className="overflow-x-auto custom-scrollbar-horizontal">
              <table className="w-full text-left border-collapse table-auto min-w-[1200px] lg:min-w-full">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="px-3 py-4 text-[0.65rem] font-bold uppercase tracking-wider whitespace-nowrap text-center">AÇÃO</th>
                    <th className="px-3 py-4 text-[0.65rem] font-bold uppercase tracking-wider whitespace-nowrap text-center">ALERTAS</th>
                    <th className="px-3 py-4 text-[0.65rem] font-bold uppercase tracking-wider whitespace-nowrap">NOME</th>
                    <th className="px-3 py-4 text-[0.65rem] font-bold uppercase tracking-wider whitespace-nowrap">CNS</th>
                    <th className="px-3 py-4 text-[0.65rem] font-bold uppercase tracking-wider whitespace-nowrap">NASCIMENTO</th>
                    <th className="px-3 py-4 text-[0.65rem] font-bold uppercase tracking-wider whitespace-nowrap text-center">IDADE</th>
                    <th className="px-3 py-4 text-[0.65rem] font-bold uppercase tracking-wider whitespace-nowrap">SISCAN</th>
                    <th className="px-3 py-4 text-[0.65rem] font-bold uppercase tracking-wider whitespace-nowrap text-center">CADASTRO LAB</th>
                    <th className="px-3 py-4 text-[0.65rem] font-bold uppercase tracking-wider whitespace-nowrap text-center">COLETA V2</th>
                    <th className="px-3 py-4 text-[0.65rem] font-bold uppercase tracking-wider whitespace-nowrap">DNA HPV (PRONT)</th>
                    <th className="px-3 py-4 text-[0.65rem] font-bold uppercase tracking-wider whitespace-nowrap text-center">DNA HPV (GAL)</th>
                    <th className="px-3 py-4 text-[0.65rem] font-bold uppercase tracking-wider whitespace-nowrap text-center">DNA HPV (PEP)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  {isLoading ? (
                    <tr>
                      <td colSpan={12} className="px-6 py-8 text-center text-on-surface-variant text-xs">
                        Carregando pacientes...
                      </td>
                    </tr>
                  ) : pacientes.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-6 py-8 text-center text-on-surface-variant text-xs">
                        Nenhum paciente encontrado para sua Unidade/Equipe/Microárea.
                      </td>
                    </tr>
                  ) : (
                    pacientes.map((paciente) => (
                      <tr key={paciente.id} className="hover:bg-surface-container-low transition-colors group">
                        <td className="px-3 py-3 text-center">
                          <button 
                            onClick={() => handleOpenModal(paciente)}
                            className="relative overflow-hidden group bg-surface-container-lowest border border-primary/20 hover:border-primary/50 text-primary px-2 py-1 rounded-md text-[10px] font-bold shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                          >
                            <span className="relative z-10">Acompanhar</span>
                            <div className="absolute inset-0 h-full w-full bg-gradient-to-r from-primary/0 via-primary/5 to-primary/0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"></div>
                          </button>
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          {paciente.alertas && paciente.alertas !== 'NORMAL' ? (
                            <div className="relative group/alert cursor-help">
                              <div className="flex items-center justify-center px-2.5 py-1 rounded-md bg-error text-white shadow-[0_2px_8px_rgba(185,28,28,0.4)] transition-transform group-hover/alert:scale-105">
                                <AlertTriangle className="w-3 h-3 mr-1.5 animate-bounce" />
                                <span className="text-[10px] font-black uppercase tracking-tight">{paciente.alertas}</span>
                              </div>
                              {/* Tooltip premium para detalhes */}
                              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-neutral-900 text-white text-[10px] rounded-lg opacity-0 group-hover/alert:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-xl border border-white/10">
                                <p className="font-bold text-error mb-0.5">ALERTA CRÍTICO</p>
                                <p className="opacity-80 text-[9px]">Ação imediata recomendada para este caso.</p>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-neutral-900"></div>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center px-2.5 py-1 rounded-md bg-surface-container-high border border-outline-variant/30 opacity-60 hover:opacity-100 transition-opacity">
                              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest italic">Sem Alertas</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 font-bold text-primary text-[11px] whitespace-nowrap truncate max-w-[120px]" title={paciente.nome}>{paciente.nome}</td>
                        <td className="px-3 py-3 text-[10px] font-medium whitespace-nowrap">{paciente.cns}</td>
                        <td className="px-3 py-3 text-[10px] whitespace-nowrap">{paciente.data_nascimento}</td>
                        <td className="px-3 py-3 text-[10px] text-center">{paciente.idade}</td>
                        <td className="px-3 py-3 text-[10px] whitespace-nowrap">
                          {paciente.siscan !== '--' ? paciente.siscan : <span className="text-outline italic opacity-50">--</span>}
                        </td>
                        <td className="px-3 py-3 text-[10px] text-center">
                          {paciente.cadastro_lab !== '--' ? paciente.cadastro_lab : <span className="text-outline italic opacity-50">--</span>}
                        </td>
                        <td className="px-3 py-3 text-[10px] text-center">
                          {paciente.coleta_v2 !== '--' ? paciente.coleta_v2 : <span className="text-outline italic opacity-50">--</span>}
                        </td>
                        <td className="px-3 py-3 text-[10px] whitespace-nowrap">
                          {paciente.dna_hpv_pront !== '--' ? paciente.dna_hpv_pront : <span className="text-outline italic opacity-50">--</span>}
                        </td>
                        <td className="px-3 py-3 text-[10px] text-center">
                          {paciente.dna_hpv_gal !== '--' ? paciente.dna_hpv_gal : <span className="text-outline italic opacity-50">--</span>}
                        </td>
                        <td className="px-3 py-3 text-[10px] text-center whitespace-nowrap">
                          {paciente.dna_hpv_pep !== '--' ? paciente.dna_hpv_pep : <span className="text-outline italic opacity-50">--</span>}
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

      {/* Modal Premium */}
      {isModalOpen && selectedPaciente && (
        <div className="fixed inset-0 bg-primary/20 backdrop-blur-md z-[100] flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-300">
          <div className="bg-surface-container-lowest w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl shadow-[0px_24px_48px_rgba(0,0,0,0.15)] overflow-hidden border border-white/20 animate-in zoom-in-95 duration-300">
            {/* Header do Modal */}
            <div className="bg-gradient-to-r from-[#1c2e4a] to-[#253c61] px-5 sm:px-8 md:px-10 py-5 sm:py-6 flex justify-between items-center relative shrink-0">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <ClipboardList className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-white text-base sm:text-lg md:text-xl font-black tracking-tight leading-tight">Registro de Acompanhamento</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse"></div>
                    <p className="text-white/60 text-[10px] sm:text-xs font-medium uppercase tracking-widest truncate max-w-[200px] sm:max-w-[300px]">
                      Paciente: {selectedPaciente.nome}
                    </p>
                  </div>
                </div>
              </div>
              <button 
                onClick={handleCloseModal} 
                className="p-2 -mr-2 rounded-full hover:bg-white/10 text-white/60 hover:text-white transition-all duration-300 hover:rotate-90"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            
            {/* Corpo do Modal com Rolagem Independente */}
            <div className="overflow-y-auto custom-scrollbar-modal flex-1 p-5 sm:p-8 md:p-10">
              <form id="registro-acompanhamento-form" onSubmit={handleSaveFollowUp}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5 sm:gap-y-6">
                {/* Data da Busca */}
                <div className="space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <Calendar className="w-3.5 h-3.5" />
                    </div>
                    Data da Busca
                  </label>
                  <div className="relative">
                    <input 
                      name="data_busca"
                      required
                      className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none shadow-sm hover:border-primary/40" 
                      type="date" 
                    />
                  </div>
                </div>

                {/* Tipo de Contato */}
                <div className="space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <Phone className="w-3.5 h-3.5" />
                    </div>
                    Tipo de Contato
                  </label>
                  <div className="relative">
                    <select name="tipo_contato" required className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none appearance-none cursor-pointer shadow-sm hover:border-primary/40">
                      <option value="" disabled selected>Selecione uma modalidade</option>
                      <option value="Contato direto">Contato direto</option>
                      <option value="Contato indireto (mensagem)">Contato indireto (mensagem)</option>
                      <option value="Não houve contato (não localizada, ligação não atendida...)">Não houve contato (não localizada, ligação não atendida...)</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-on-surface-variant">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                {/* Situação Pós Busca */}
                <div className="col-span-1 md:col-span-2 space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <Info className="w-3.5 h-3.5" />
                    </div>
                    Situação Pós Busca Ativa
                  </label>
                  <div className="relative">
                    <select name="situacao_pos_busca" required className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none appearance-none cursor-pointer shadow-sm hover:border-primary/40">
                      <option value="" disabled selected>Selecione o desfecho da busca</option>
                      <option value="Sucesso no agendamento">Sucesso no agendamento</option>
                      <option value="Recusa do procedimento">Recusa do procedimento</option>
                      <option value="Não localizada">Não localizada</option>
                      <option value="Óbito">Óbito</option>
                      <option value="Mudança de endereço">Mudança de endereço</option>
                      <option value="Em tratamento particular">Em tratamento particular</option>
                      <option value="Aguardando retorno da rede">Aguardando retorno da rede</option>
                      <option value="Falha de comunicação">Falha de comunicação</option>
                      <option value="Reagendado">Reagendado</option>
                      <option value="Outros">Outros</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-on-surface-variant">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>

                {/* Identificação da Rede */}
                <div className="space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <Building className="w-3.5 h-3.5" />
                    </div>
                    Identificação da Rede
                  </label>
                  <input 
                    name="identificacao_rede"
                    className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none placeholder:text-outline-variant/60 shadow-sm hover:border-primary/40" 
                    placeholder="Ex: Hospital Souza Aguiar" 
                    type="text" 
                  />
                </div>

                {/* Principais Entraves */}
                <div className="space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </div>
                    Principais Entraves
                  </label>
                  <input 
                    name="principais_entraves"
                    className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-3.5 transition-all outline-none placeholder:text-outline-variant/60 shadow-sm hover:border-primary/40" 
                    placeholder="Ex: Falta de transporte, mudança de telefone" 
                    type="text" 
                  />
                </div>

                {/* Observações */}
                <div className="col-span-1 md:col-span-2 space-y-2 group/field">
                  <label className="flex items-center gap-2 text-[0.65rem] font-bold text-primary/70 uppercase tracking-[0.15em] transition-colors group-focus-within/field:text-primary">
                    <div className="p-1 rounded bg-primary/5 group-focus-within/field:bg-primary/10 transition-colors">
                      <MessageSquare className="w-3.5 h-3.5" />
                    </div>
                    Observações Detalhadas
                  </label>
                  <textarea 
                    name="observacoes"
                    className="w-full bg-white border border-outline-variant/30 rounded-xl text-sm font-medium text-on-surface focus:ring-2 focus:ring-primary/20 focus:border-primary p-4 resize-none transition-all outline-none placeholder:text-outline-variant/60 shadow-sm hover:border-primary/40 min-h-[120px]" 
                    placeholder="Descreva aqui detalhes relevantes do atendimento, informações adicionais repassadas pelo paciente ou qualquer outro ponto importante..." 
                    rows={4}
                  ></textarea>
                </div>
              </div>
              </form>
            </div>
              
            <div className="flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 p-5 sm:p-6 md:px-10 md:py-6 border-t border-outline-variant/10 bg-surface-container-lowest shrink-0 z-10">
              <button 
                type="button" 
                onClick={handleCloseModal}
                disabled={isSaving}
                className="px-6 sm:px-8 py-3 rounded-xl text-sm font-bold text-primary hover:bg-primary/5 transition-all border border-transparent hover:border-primary/10 w-full sm:w-auto order-2 sm:order-1 disabled:opacity-50"
              >
                Descartar
              </button>
              <button 
                form="registro-acompanhamento-form"
                type="submit" 
                disabled={isSaving}
                className="px-6 sm:px-10 py-3 rounded-xl text-sm font-black text-white bg-gradient-to-r from-[#1c2e4a] to-[#253c61] shadow-[0_10px_20px_rgba(28,46,74,0.3)] hover:shadow-[0_15px_30px_rgba(28,46,74,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-2 group w-full sm:w-auto order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <CheckCircle2 className="w-4 h-4 group-hover:scale-110 transition-transform" />
                )}
                {isSaving ? 'Salvando...' : 'Salvar Registro'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
