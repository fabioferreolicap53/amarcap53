import React from 'react';
import { Bell, Settings, Menu, X, Building, Users, MapPin, LayoutDashboard, ClipboardCheck, LogOut } from 'lucide-react';
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
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'resumo', label: 'Resumo', icon: LayoutDashboard },
    { id: 'pacientes', label: 'Meus Pacientes', icon: Users },
    { id: 'acompanhamentos', label: 'Acompanhamentos', icon: ClipboardCheck },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  return (
    <header className="bg-gradient-to-r from-[#001b3d] to-[#002b5c] backdrop-blur-md shadow-[0px_8px_32px_rgba(0,0,0,0.3)] flex items-center w-full px-4 md:px-8 h-[80px] sticky top-0 z-40 border-b border-white/10">
      {/* Logo Desktop */}
      <div className="hidden lg:flex flex-col mr-8">
        <h1 className="font-black text-white tracking-tighter text-2xl leading-none">
          AMAR
        </h1>
        <p className="text-[8px] font-bold text-white/60 uppercase tracking-[0.1em] mt-1 border-l border-white/30 pl-2 max-w-[150px] leading-tight">
          Acompanhamento da Mulher nas Ações de Rastreio
        </p>
      </div>

      {/* Botão de Menu (Mobile) */}
      <div className="flex lg:hidden items-center">
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-white/10 rounded-lg transition-all duration-300 relative group"
          aria-label="Toggle Menu"
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          ) : (
            <Menu className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          )}
        </button>
      </div>

      {/* Informações Centrais (Mobile) */}
      {user && (
        <div className="flex lg:hidden flex-1 flex-col items-center justify-center px-2 overflow-hidden">
          <div className="flex items-center gap-1.5 w-full justify-center">
            <Building className="w-3.5 h-3.5 text-white/50" />
            <span className="text-[12px] font-bold text-white leading-none truncate max-w-[160px] text-center">
              {user.unidade_saude}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <span className="text-[11px] font-medium text-white/70 leading-none truncate max-w-[120px]">
              {user.equipe}
            </span>
            <div className="w-1 h-1 rounded-full bg-white/30"></div>
            <span className="text-[11px] font-medium text-white/70 leading-none">
              MA: {user.microarea}
            </span>
          </div>
        </div>
      )}

      {/* Estrutura Desktop */}
      <div className="hidden lg:flex items-center gap-6 h-full flex-1">
        {/* Navegação */}
        <nav className="flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab?.(item.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl transition-all duration-300 whitespace-nowrap group ${
                  isActive 
                    ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] border border-white/20' 
                    : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon className={`w-4 h-4 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className="text-xs font-bold tracking-wide uppercase">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="w-px h-8 bg-white/10 mx-2"></div>

        {/* Informações do Usuário */}
        <div className="hidden xl:flex items-center gap-8 border-l border-white/10 pl-8 ml-2">
          {user && (
            <>
              <div className="flex flex-col group/info">
                <span className="text-[8px] uppercase tracking-[0.2em] text-white/30 font-black leading-none mb-1.5 group-hover/info:text-white/50 transition-colors">Unidade</span>
                <span className="text-[12px] font-bold text-white/90 leading-none truncate max-w-[180px]" title={user.unidade_saude}>{user.unidade_saude}</span>
              </div>
              <div className="flex flex-col group/info">
                <span className="text-[8px] uppercase tracking-[0.2em] text-white/30 font-black leading-none mb-1.5 group-hover/info:text-white/50 transition-colors">Equipe</span>
                <span className="text-[12px] font-bold text-white/90 leading-none truncate max-w-[120px]" title={user.equipe}>{user.equipe}</span>
              </div>
              <div className="flex flex-col group/info">
                <span className="text-[8px] uppercase tracking-[0.2em] text-white/30 font-black leading-none mb-1.5 group-hover/info:text-white/50 transition-colors">Microárea</span>
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400/50"></div>
                  <span className="text-[12px] font-bold text-white/90 leading-none">{user.microarea}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Lado Direito */}
      <div className="flex items-center gap-4 h-full">
        <div className="flex items-center gap-3 pl-4 border-l border-white/10 h-full">
          <div className="text-right hidden xl:flex flex-col justify-center">
            <p className="text-sm font-bold text-white leading-tight">
              {user?.name || user?.email}
            </p>
            <p className="text-[10px] text-white/50 font-medium">Profissional de Saúde</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/20 to-white/5 flex items-center justify-center text-white font-black text-sm ring-1 ring-white/20 shadow-lg">
            {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>

        <button 
          onClick={logout}
          className="p-2.5 hover:bg-red-500/20 rounded-xl transition-all duration-300 text-white/60 hover:text-red-400 group border border-transparent hover:border-red-500/30"
          title="Sair"
        >
          <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </header>
  );
};
