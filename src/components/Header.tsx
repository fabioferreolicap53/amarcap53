import React from 'react';
import { Bell, Settings, Menu, X, Building, Users, MapPin } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  title: string;
  pageTitle?: string;
  subtitle?: string;
  showAvatarDetails?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, pageTitle, subtitle, showAvatarDetails = true }) => {
  const { toggleSidebar, isOpen } = useSidebar();
  const { user } = useAuth();

  return (
    <header className="bg-[#1c2e4a] backdrop-blur-md shadow-[0px_12px_32px_rgba(25,28,30,0.06)] flex justify-between items-center w-full px-4 md:px-8 h-16 sticky top-0 z-40">
      <div className="flex items-center gap-2 md:gap-4">
        <button 
          onClick={toggleSidebar}
          className="lg:hidden p-2 hover:bg-white/10 rounded-md transition-colors mr-1 relative"
          aria-label="Toggle Menu"
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <Menu className="w-6 h-6 text-white" />
          )}
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center">
          {/* Título da página em mobile/tablet */}
          {pageTitle && (
            <span className="lg:hidden font-bold font-headline text-white tracking-tight text-sm">
              {pageTitle}
            </span>
          )}
          
          {/* Destaque das informações do usuário logado na versão Desktop */}
          {user && (
            <div className="hidden lg:flex items-center gap-12 ml-10 border-l border-white/20 pl-10">
              <div className="flex items-center gap-4 group transition-all duration-300">
                <div className="flex items-center justify-center">
                  <Building className="w-5 h-5 text-white/70 group-hover:text-white transition-colors duration-300" strokeWidth={2} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-white/40 font-black leading-none mb-1.5 group-hover:text-white/50 transition-colors">Unidade</span>
                  <span className="text-[15px] font-bold text-white leading-none tracking-tight">{user.unidade_saude}</span>
                </div>
              </div>

              <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>

              <div className="flex items-center gap-4 group transition-all duration-300">
                <div className="flex items-center justify-center">
                  <Users className="w-5 h-5 text-white/70 group-hover:text-white transition-colors duration-300" strokeWidth={2} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-white/40 font-black leading-none mb-1.5 group-hover:text-white/50 transition-colors">Equipe</span>
                  <span className="text-[15px] font-bold text-white leading-none tracking-tight">{user.equipe}</span>
                </div>
              </div>

              <div className="w-px h-10 bg-gradient-to-b from-transparent via-white/20 to-transparent"></div>

              <div className="flex items-center gap-4 group transition-all duration-300">
                <div className="flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-white/70 group-hover:text-white transition-colors duration-300" strokeWidth={2} />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-white/40 font-black leading-none mb-1.5 group-hover:text-white/50 transition-colors">Microárea</span>
                  <span className="text-[15px] font-bold text-white leading-none tracking-tight">{user.microarea}</span>
                </div>
              </div>
            </div>
          )}
        </div>


      </div>
      
      <div className="flex items-center gap-2 md:gap-4">
        
        <div className={`flex items-center gap-3 pl-2 md:pl-4 border-l border-white/20 ml-1 md:ml-2`}>
          {showAvatarDetails && user && (
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-white leading-tight truncate max-w-[120px] mb-1">{user.email}</p>
              <div className="flex flex-col lg:hidden items-end gap-0.5">
                <span className="text-[9px] font-bold text-white/50 uppercase leading-none">{user.unidade_saude}</span>
                <span className="text-[9px] font-bold text-white/50 uppercase leading-none">{user.equipe} • MA: {user.microarea}</span>
              </div>
            </div>
          )}
          <div className="w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-sm ring-2 ring-white/20">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
};
