import React from 'react';
import { Bell, Settings, Menu, X, Building, Users, MapPin, LayoutDashboard, LogOut, ClipboardList, Star, BadgeCheck } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  title: string;
  pageTitle?: string;
  subtitle?: string;
  showAvatarDetails?: boolean;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ 
  title, 
  pageTitle, 
  subtitle, 
  showAvatarDetails = true,
  activeTab,
  setActiveTab
}) => {
  const { toggleSidebar, isOpen } = useSidebar();
  const { user, isAdmin, logout } = useAuth();

  const navItems = [
    { id: 'resumo', label: 'Resumo', icon: LayoutDashboard },
    { id: 'pacientes', label: 'Pacientes', icon: Users },
    { id: 'favoritos', label: 'Favoritos', icon: Star },
    { id: 'acompanhamento', label: 'Acompanhamentos', icon: ClipboardList },
  ];

  return (
    <header className="bg-gradient-to-r from-[#001b3d] to-[#002b5c] backdrop-blur-md shadow-[0px_8px_32px_rgba(0,0,0,0.3)] flex items-center w-full px-4 md:px-6 h-[80px] sticky top-0 z-40 border-b border-white/10">
      {/* Botão de Menu (Mobile/Tablet) */}
      <div className="flex lg:hidden items-center">
        <button 
          onClick={toggleSidebar}
          className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-300 relative group border border-white/10"
          aria-label="Toggle Menu"
        >
          {isOpen ? (
            <X className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          ) : (
            <Menu className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          )}
        </button>
      </div>

      {/* Logo - Visível em telas médias e grandes */}
      <div className="hidden sm:flex flex-col mx-4 lg:mr-8 lg:ml-0">
        <h1 className="font-black text-white tracking-tighter text-xl lg:text-2xl leading-none">
          AMAR
        </h1>
        <p className="hidden lg:block text-[8px] font-bold text-white/60 uppercase tracking-[0.1em] mt-1 border-l border-white/30 pl-2 max-w-[150px] leading-tight">
          Acompanhamento da Mulher nas Ações de Rastreio
        </p>
      </div>

      {/* Informações Centrais (Mobile) - Ajustado para evitar sobreposição */}
      {user && (
        <div className="flex lg:hidden flex-1 flex-col items-center justify-center px-2 overflow-hidden min-w-0">
          {/* Unidade - Sempre visível para todos exceto talvez CAP se vazio */}
          {user.unidade_saude && (
            <div className="flex items-center gap-1.5 w-full justify-center">
              <Building className="w-3.5 h-3.5 text-blue-300 shrink-0" />
              <span className="text-[10px] md:text-[12px] font-black text-white uppercase tracking-tight text-center">
                {user.unidade_saude}
              </span>
            </div>
          )}
          
          {(user.role === 'equipe' || user.role === 'microarea') && user.equipe && (
            <div className="flex items-center gap-2 md:gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <Users className="w-3 h-3 text-white/50 shrink-0" />
                <span className="text-[9px] md:text-[11px] font-bold text-white/80 uppercase">
                  {user.equipe}
                </span>
              </div>
              
              {user.role === 'microarea' && user.microarea && (
                <>
                  <div className="w-1 h-1 rounded-full bg-white/20"></div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3 h-3 text-white/50 shrink-0" />
                    <span className="text-[9px] md:text-[11px] font-bold text-white/80 uppercase">
                      MA: {user.microarea}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* CAP Badge - Mobile/Tablet */}
          {user.role === 'cap' && (
            <div className="flex items-center gap-2 mt-2">
              <Building className="w-5 h-5 text-white/70" />
              <span className="text-[13px] font-black text-white/80 uppercase tracking-[0.15em]">Coordenação CAP5.3</span>
            </div>
          )}
        </div>
      )}

      {/* Estrutura Desktop */}
      <div className="hidden lg:flex items-center gap-4 h-full flex-1 min-w-0">
        {/* Navegação - Ajustada para telas menores de desktop */}
        <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab?.(item.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 whitespace-nowrap group ${
                  isActive 
                    ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] border border-white/20' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="text-[10px] xl:text-xs font-bold tracking-wide uppercase">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Informações do Usuário - Adaptável conforme Perfil */}
        <div className="hidden xl:flex items-center gap-6 border-l border-white/10 pl-6 ml-1 min-w-0">
          {user && (
            <div className="flex items-center gap-6">
              {/* Unidade - Visível para Unidade, Equipe e Microárea */}
              {user.unidade_saude && (
                <div className="flex items-center gap-2.5 group/info min-w-0">
                  <Building className="w-4 h-4 text-blue-300 shrink-0 group-hover/info:scale-110 transition-transform" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] uppercase tracking-[0.2em] text-white/40 font-black leading-none mb-1 group-hover/info:text-blue-300 transition-colors">Unidade</span>
                    <span className="text-[12px] font-black text-white uppercase tracking-wide whitespace-normal leading-tight max-w-[200px]">{user.unidade_saude}</span>
                  </div>
                </div>
              )}

              {/* Equipe - Visível para Equipe e Microárea */}
              {(user.role === 'equipe' || user.role === 'microarea') && user.equipe && (
                <div className="flex items-center gap-2.5 group/info min-w-0">
                  <Users className="w-4 h-4 text-purple-300 shrink-0 group-hover/info:scale-110 transition-transform" />
                  <div className="flex flex-col min-w-0">
                    <span className="text-[8px] uppercase tracking-[0.2em] text-white/40 font-black leading-none mb-1 group-hover/info:text-purple-300 transition-colors">Equipe</span>
                    <span className="text-[12px] font-black text-white uppercase tracking-wide whitespace-normal leading-tight max-w-[150px]">{user.equipe}</span>
                  </div>
                </div>
              )}

              {/* Microárea - Visível apenas para Microárea */}
              {user.role === 'microarea' && user.microarea && (
                <div className="flex items-center gap-2.5 group/info shrink-0">
                  <MapPin className="w-4 h-4 text-emerald-300 group-hover/info:scale-110 transition-transform" />
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase tracking-[0.2em] text-white/40 font-black leading-none mb-1 group-hover/info:text-emerald-300 transition-colors">MA</span>
                    <span className="text-[12px] font-black text-white uppercase tracking-wide">{user.microarea}</span>
                  </div>
                </div>
              )}

              {/* CAP - Exibir apenas identificação se for coordenação */}
              {user.role === 'cap' && (
                <div className="flex items-center gap-2.5 group/info shrink-0">
                  <Building className="w-4 h-4 text-amber-300 shrink-0 group-hover/info:scale-110 transition-transform" />
                  <div className="flex flex-col">
                    <span className="text-[8px] uppercase tracking-[0.2em] text-white/40 font-black leading-none mb-1 group-hover/info:text-amber-300 transition-colors">Perfil</span>
                    <span className="text-[12px] font-black text-white uppercase tracking-wide">COORDENAÇÃO CAP</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Lado Direito - Perfil e Logout */}
      <div className="hidden lg:flex items-center gap-2 md:gap-4 h-full ml-auto lg:ml-0">
        <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-white/10 h-full">
          <div className="hidden sm:flex flex-col justify-center min-w-0">
            <p className="text-xs md:text-sm font-bold text-white leading-tight truncate max-w-[100px] md:max-w-[150px]">
              {user?.name || user?.email?.split('@')[0]}
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <BadgeCheck className="w-3 h-3 text-blue-300" />
              <span className="text-[8px] font-black text-blue-200/70 uppercase tracking-wider">{(user?.role === 'admin' || user?.role === 'cap') ? 'ADMIN' : user?.role?.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setActiveTab?.('configuracoes')}
          className="p-2 md:p-2.5 hover:bg-white/10 rounded-xl transition-all duration-300 text-white/60 hover:text-white group border border-transparent hover:border-white/20 shrink-0"
          title="Configurações"
        >
          <Settings className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
        </button>

        <button
          onClick={logout}
          className="p-2 md:p-2.5 hover:bg-red-500/20 rounded-xl transition-all duration-300 text-white/60 hover:text-red-400 group border border-transparent hover:border-red-500/30 shrink-0"
          title="Sair"
        >
          <LogOut className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </header>
  );
};
