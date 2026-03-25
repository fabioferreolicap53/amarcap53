import React from 'react';
import { Header } from '../components/Header';
import { Edit2, ShieldCheck, MapPin, Moon, AlignJustify, Mail, AlertOctagon, Shield, Terminal } from 'lucide-react';

export const SettingsScreen = () => {
  return (
    <div className="flex-1 flex flex-col min-h-screen bg-surface">
      <Header 
        title="AMAR - ACOMPANHAMENTO DA MULHER NAS AÇÕES DE RASTREIO" 
        pageTitle="Configurações"
        subtitle="Unidade de Saúde: SMS RJ" 
        showAvatarDetails={true}
        unit="Unidade: Clínica da Família Zilda Arns"
        team="Equipe: Laranja"
        microArea="Microárea: 001"
      />
      
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
                  <p className="text-sm font-semibold text-primary">helena.souza@saude.rj.gov.br</p>
                </div>
              </div>
            </div>
            
            <div className="bg-primary-container text-on-primary-fixed p-6 md:p-8 rounded-xl flex flex-col justify-center items-center text-center">
              <div className="w-16 h-16 md:w-20 md:h-20 bg-white/10 rounded-full flex items-center justify-center mb-4">
                <ShieldCheck className="w-8 h-8 md:w-10 md:h-10 text-white" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">Acesso Seguro</h3>
              <p className="text-xs text-on-primary-container leading-relaxed px-4">
                Sua conta está vinculada ao sistema AMAR através da rede oficial da Secretaria Municipal de Saúde do Rio de Janeiro.
              </p>
            </div>
          </section>

          <section className="space-y-4 md:space-y-6">
            <div className="border-b border-outline-variant/30 pb-4">
              <h2 className="text-lg md:text-xl font-bold text-primary">Unidade de Atuação</h2>
              <p className="text-on-surface-variant text-sm">Vínculo territorial e divisão de microáreas.</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 md:gap-6">
              <div className="md:col-span-1 bg-surface-container-low p-5 md:p-6 rounded-lg flex flex-col gap-2">
                <p className="text-[10px] uppercase tracking-widest text-on-surface-variant">Microárea Atual</p>
                <p className="text-2xl md:text-3xl font-black text-primary">04</p>
                <p className="text-xs text-on-surface-variant">Bairro: Botafogo</p>
              </div>
              
              <div className="md:col-span-3 bg-white p-5 md:p-6 rounded-lg shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4 md:gap-6">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-secondary-container rounded-full flex items-center justify-center text-primary flex-shrink-0">
                    <MapPin className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-primary">CMS Manoel José Ferreira</p>
                    <p className="text-[10px] md:text-xs text-on-surface-variant">Rua Silveira Martins, 161 - Catete, Rio de Janeiro - RJ</p>
                  </div>
                </div>
                <button className="text-primary text-xs font-bold hover:underline self-end sm:self-auto">Ver no Mapa</button>
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
