import React, { useState, useEffect } from 'react';
import { Header } from '../components/Header';
import { X, Search } from 'lucide-react';
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
  const { user } = useAuth();
  const [pacientes, setPacientes] = useState<Paciente[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
                  124 <span className="text-sm font-medium text-on-surface-variant ml-1 md:ml-2 tracking-normal">Pacientes Ativos</span>
                </p>
              </div>
              <div className="flex gap-4 w-full sm:w-auto justify-between sm:justify-end">
                <div className="text-right">
                  <p className="text-[10px] md:text-xs text-on-surface-variant font-medium">Urgentes</p>
                  <p className="text-lg md:text-xl font-bold text-error">12</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] md:text-xs text-on-surface-variant font-medium">Aguardando Coleta</p>
                  <p className="text-lg md:text-xl font-bold text-tertiary-container">45</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0px_12px_32px_rgba(25,28,30,0.06)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-auto">
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
                            onClick={() => setIsModalOpen(true)}
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

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-primary/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
          <div className="bg-surface-container-lowest w-full max-w-2xl rounded-xl shadow-[0px_12px_32px_rgba(25,28,30,0.1)] overflow-hidden">
            <div className="bg-primary px-8 py-6 flex justify-between items-center">
              <div>
                <h3 className="text-white text-lg font-bold">Registro de Acompanhamento</h3>
                <p className="text-primary-fixed-dim text-xs">Paciente: ANA CAROLINA SILVA</p>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="text-white/60 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <form className="p-8 grid grid-cols-2 gap-6" onSubmit={(e) => { e.preventDefault(); setIsModalOpen(false); }}>
              <div className="col-span-1">
                <label className="block text-[0.6875rem] font-bold text-primary uppercase tracking-wider mb-2">DATA DA BUSCA</label>
                <input className="w-full bg-surface-container-high border-none rounded-md text-sm focus:ring-2 focus:ring-primary/20 p-3" type="date" />
              </div>
              <div className="col-span-1">
                <label className="block text-[0.6875rem] font-bold text-primary uppercase tracking-wider mb-2">TIPO DE CONTATO</label>
                <select className="w-full bg-surface-container-high border-none rounded-md text-sm focus:ring-2 focus:ring-primary/20 p-3">
                  <option value="" disabled selected>Selecione uma opção</option>
                  <option>Contato direto</option>
                  <option>Contato indireto (mensagem)</option>
                  <option>Não houve contato (não localizada, ligação não atendida...)</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[0.6875rem] font-bold text-primary uppercase tracking-wider mb-2">SITUAÇÃO PÓS BUSCA ATIVA</label>
                <select className="w-full bg-surface-container-high border-none rounded-md text-sm focus:ring-2 focus:ring-primary/20 p-3">
                  <option>Opção 1 - Sucesso no agendamento</option>
                  <option>Opção 2 - Recusa do procedimento</option>
                  <option>Opção 3 - Não localizada</option>
                  <option>Opção 4 - Óbito</option>
                  <option>Opção 5 - Mudança de endereço</option>
                  <option>Opção 6 - Em tratamento particular</option>
                  <option>Opção 7 - Aguardando retorno da rede</option>
                  <option>Opção 8 - Falha de comunicação</option>
                  <option>Opção 9 - Reagendado</option>
                  <option>Opção 10 - Outros</option>
                </select>
              </div>
              <div className="col-span-1">
                <label className="block text-[0.6875rem] font-bold text-primary uppercase tracking-wider mb-2">IDENTIFICAÇÃO DA REDE</label>
                <input className="w-full bg-surface-container-high border-none rounded-md text-sm focus:ring-2 focus:ring-primary/20 p-3 placeholder:text-outline-variant" placeholder="Ex: Hospital Municipal Souza Aguiar" type="text" />
              </div>
              <div className="col-span-1">
                <label className="block text-[0.6875rem] font-bold text-primary uppercase tracking-wider mb-2">PRINCIPAIS ENTRAVES</label>
                <input className="w-full bg-surface-container-high border-none rounded-md text-sm focus:ring-2 focus:ring-primary/20 p-3 placeholder:text-outline-variant" placeholder="Ex: Falta de transporte" type="text" />
              </div>
              <div className="col-span-2">
                <label className="block text-[0.6875rem] font-bold text-primary uppercase tracking-wider mb-2">OBSERVAÇÕES</label>
                <textarea className="w-full bg-surface-container-high border-none rounded-md text-sm focus:ring-2 focus:ring-primary/20 p-3 resize-none placeholder:text-outline-variant" placeholder="Detalhes adicionais sobre o atendimento..." rows={3}></textarea>
              </div>
              
              <div className="col-span-2 flex justify-end gap-3 mt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-6 py-2.5 rounded-md text-sm font-bold text-primary border border-primary/20 hover:bg-surface-container-low transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="px-8 py-2.5 rounded-md text-sm font-bold text-white bg-gradient-to-r from-primary to-primary-container shadow-lg hover:opacity-90 transition-opacity"
                >
                  Salvar Alterações
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
