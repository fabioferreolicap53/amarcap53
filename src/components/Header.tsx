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
          {/* Título da página em Desktop (já existia no projeto mas estava comentado ou removido, vamos manter apenas se passado) */}
          <span className="hidden lg:block font-bold font-headline text-white tracking-tight text-lg mr-4">
            {pageTitle || title}
          </span>
          
          {/* Destaque das informações do usuário logado na versão Desktop */}
          {user && (
            <div className="hidden lg:flex items-center gap-4 bg-white/10 px-3 py-1.5 rounded-full border border-white/10">
              <div className="flex items-center gap-1.5" title="Unidade de Saúde">
                <Building className="w-3.5 h-3.5 text-primary-container" />
                <span className="text-xs font-medium text-white truncate max-w-[150px]">{user.unidade_saude}</span>
              </div>
              <div className="w-px h-3 bg-white/20"></div>
              <div className="flex items-center gap-1.5" title="Equipe">
                <Users className="w-3.5 h-3.5 text-primary-container" />
                <span className="text-xs font-medium text-white truncate max-w-[100px]">{user.equipe}</span>
              </div>
              <div className="w-px h-3 bg-white/20"></div>
              <div className="flex items-center gap-1.5" title="Microárea">
                <MapPin className="w-3.5 h-3.5 text-primary-container" />
                <span className="text-xs font-medium text-white">MA: {user.microarea}</span>
              </div>
            </div>
          )}
        </div>


      </div>
      
      <div className="flex items-center gap-2 md:gap-4">
        <button className="p-2 hover:bg-white/10 rounded-full transition-colors">
          <Bell className="w-5 h-5 text-white" />
        </button>

        
        <div className={`flex items-center gap-3 pl-2 md:pl-4 border-l border-white/20 ml-1 md:ml-2`}>
          {showAvatarDetails && user && (
            <div className="text-right hidden md:block">
              <p className="text-xs font-bold text-white leading-tight truncate max-w-[120px]">{user.email}</p>
              <p className="text-[10px] text-white/60 uppercase tracking-tighter truncate max-w-[120px] lg:hidden">{user.unidade_saude}</p>
              <div className="flex gap-1 justify-end lg:hidden">
                <p className="text-[10px] text-white/60 uppercase tracking-tighter truncate max-w-[60px]">{user.equipe}</p>
                <p className="text-[10px] text-white/60 uppercase tracking-tighter">• MA:{user.microarea}</p>
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
