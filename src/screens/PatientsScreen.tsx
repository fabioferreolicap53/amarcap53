import React, { useState } from 'react';
import { Header } from '../components/Header';
import { X } from 'lucide-react';

export const PatientsScreen = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <Header 
        title="AMAR - ACOMPANHAMENTO DA MULHER NAS AÇÕES DE RASTREIO" 
        pageTitle="Meus Pacientes"
        subtitle="Unidade de Saúde: SMS RJ" 
      />
      
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
              <table className="w-full text-left border-collapse min-w-[1000px]">
                <thead>
                  <tr className="bg-primary text-white">
                    <th className="px-6 py-4 text-[0.6875rem] font-bold uppercase tracking-wider whitespace-nowrap">NOME</th>
                    <th className="px-6 py-4 text-[0.6875rem] font-bold uppercase tracking-wider whitespace-nowrap">CNS</th>
                    <th className="px-6 py-4 text-[0.6875rem] font-bold uppercase tracking-wider whitespace-nowrap">NASCIMENTO</th>
                    <th className="px-6 py-4 text-[0.6875rem] font-bold uppercase tracking-wider whitespace-nowrap">IDADE</th>
                    <th className="px-6 py-4 text-[0.6875rem] font-bold uppercase tracking-wider whitespace-nowrap">SISCAN</th>
                    <th className="px-6 py-4 text-[0.6875rem] font-bold uppercase tracking-wider whitespace-nowrap">CADASTRO LAB</th>
                    <th className="px-6 py-4 text-[0.6875rem] font-bold uppercase tracking-wider whitespace-nowrap">COLETA V2</th>
                    <th className="px-6 py-4 text-[0.6875rem] font-bold uppercase tracking-wider whitespace-nowrap">DNA HPV (PRONT)</th>
                    <th className="px-6 py-4 text-[0.6875rem] font-bold uppercase tracking-wider whitespace-nowrap">DNA HPV (GAL)</th>
                    <th className="px-6 py-4 text-[0.6875rem] font-bold uppercase tracking-wider whitespace-nowrap">DNA HPV (PEP)</th>
                    <th className="px-6 py-4 text-[0.6875rem] font-bold uppercase tracking-wider whitespace-nowrap">ALERTAS</th>
                    <th className="px-6 py-4 text-[0.6875rem] font-bold uppercase tracking-wider whitespace-nowrap text-center">AÇÃO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/10">
                  <tr className="hover:bg-surface-container-low transition-colors group">
                    <td className="px-6 py-4 font-bold text-primary whitespace-nowrap">ANA CAROLINA SILVA</td>
                    <td className="px-6 py-4 text-xs font-medium whitespace-nowrap">702 4056 8922 0001</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">12/05/1985</td>
                    <td className="px-6 py-4 text-xs">38</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">10/01/24</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">11/01/24</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">08/01/24</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">05/01/24</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">07/01/24</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-primary-fixed text-on-primary-fixed text-[10px] font-bold">NEGATIVO</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[10px] font-bold">ASC-US</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-gradient-to-r from-primary to-primary-container text-white px-4 py-1.5 rounded-md text-xs font-bold shadow-md hover:scale-95 transition-transform"
                      >
                        Acompanhar
                      </button>
                    </td>
                  </tr>
                  <tr className="bg-surface-container-low hover:bg-surface-container-high transition-colors group">
                    <td className="px-6 py-4 font-bold text-primary whitespace-nowrap">BEATRIZ OLIVEIRA SANTOS</td>
                    <td className="px-6 py-4 text-xs font-medium whitespace-nowrap">898 3321 0098 4452</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">22/11/1972</td>
                    <td className="px-6 py-4 text-xs">51</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">15/02/24</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">16/02/24</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">14/02/24</td>
                    <td className="px-6 py-4 text-xs">--</td>
                    <td className="px-6 py-4 text-xs">--</td>
                    <td className="px-6 py-4 text-xs text-outline italic whitespace-nowrap">Pendente</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-surface-container-high text-on-surface-variant text-[10px] font-bold">NORMAL</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-gradient-to-r from-primary to-primary-container text-white px-4 py-1.5 rounded-md text-xs font-bold shadow-md hover:scale-95 transition-transform"
                      >
                        Acompanhar
                      </button>
                    </td>
                  </tr>
                  <tr className="hover:bg-surface-container-low transition-colors group">
                    <td className="px-6 py-4 font-bold text-primary whitespace-nowrap">CARLA MENDES PEREIRA</td>
                    <td className="px-6 py-4 text-xs font-medium whitespace-nowrap">921 5567 1234 8876</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">05/03/1992</td>
                    <td className="px-6 py-4 text-xs">31</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">02/03/24</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">03/03/24</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">01/03/24</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">28/02/24</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">02/03/24</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[10px] font-bold">POSITIVO</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[10px] font-bold">LSIL</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-gradient-to-r from-primary to-primary-container text-white px-4 py-1.5 rounded-md text-xs font-bold shadow-md hover:scale-95 transition-transform"
                      >
                        Acompanhar
                      </button>
                    </td>
                  </tr>
                  <tr className="bg-surface-container-low hover:bg-surface-container-high transition-colors group">
                    <td className="px-6 py-4 font-bold text-primary whitespace-nowrap">DANIELA COSTA</td>
                    <td className="px-6 py-4 text-xs font-medium whitespace-nowrap">700 8890 1233 4412</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">18/07/1968</td>
                    <td className="px-6 py-4 text-xs">55</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">20/02/24</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">21/02/24</td>
                    <td className="px-6 py-4 text-xs whitespace-nowrap">19/02/24</td>
                    <td className="px-6 py-4 text-xs">--</td>
                    <td className="px-6 py-4 text-xs">--</td>
                    <td className="px-6 py-4 text-xs text-outline italic whitespace-nowrap">Pendente</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded-full bg-error-container text-on-error-container text-[10px] font-bold">NIC III</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button 
                        onClick={() => setIsModalOpen(true)}
                        className="bg-gradient-to-r from-primary to-primary-container text-white px-4 py-1.5 rounded-md text-xs font-bold shadow-md hover:scale-95 transition-transform"
                      >
                        Acompanhar
                      </button>
                    </td>
                  </tr>
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
                  <option>Opção 1 - Telefônico</option>
                  <option>Opção 2 - Visita Domiciliar</option>
                  <option>Opção 3 - Digital (WhatsApp)</option>
                  <option>Opção 4 - Correspondência</option>
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
