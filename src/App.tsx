/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardScreen } from './screens/DashboardScreen';
import { PatientsScreen } from './screens/PatientsScreen';
import { FollowUpsScreen } from './screens/FollowUpsScreen';
import { FavoritesScreen } from './screens/FavoritesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthScreen } from './screens/AuthScreen';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';
import { VerifyEmailScreen } from './screens/VerifyEmailScreen';
import { ConfirmEmailChangeScreen } from './screens/ConfirmEmailChangeScreen';

function AppContent() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'resumo';
  });
  const { isOpen, closeSidebar, isMobile, setIsMobile } = useSidebar();
  const { user, isLoading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState('');

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    // Check if the current URL is an auth action route
    const checkRoute = () => {
      const path = window.location.pathname;
      setCurrentRoute(path);
    };
    
    checkRoute();
    window.addEventListener('popstate', checkRoute);
    return () => window.removeEventListener('popstate', checkRoute);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [setIsMobile]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Intercepta as rotas de ações de autenticação (Central de Acesso)
  if (currentRoute === '/reset-password' || currentRoute === '/confirm-password-reset') {
    return <ResetPasswordScreen />;
  }

  if (currentRoute === '/verify-email' || currentRoute === '/confirm-verification') {
    return <VerifyEmailScreen />;
  }

  if (currentRoute === '/confirm-email-change') {
    return <ConfirmEmailChangeScreen />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return (
    <div className="flex min-h-screen bg-surface text-on-surface overflow-hidden relative">
      {/* Overlay for mobile when sidebar is open */}
      {isMobile && isOpen && (
        <div 
          className="sidebar-overlay"
          onClick={closeSidebar}
        />
      )}

      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300`}>
        {activeTab === 'resumo' && <DashboardScreen activeTab={activeTab} setActiveTab={setActiveTab} />}
        {activeTab === 'pacientes' && <PatientsScreen activeTab={activeTab} setActiveTab={setActiveTab} />}
        {activeTab === 'favoritos' && <FavoritesScreen activeTab={activeTab} setActiveTab={setActiveTab} />}
        {activeTab === 'acompanhamento' && <FollowUpsScreen activeTab={activeTab} setActiveTab={setActiveTab} />}
        {activeTab === 'configuracoes' && <SettingsScreen activeTab={activeTab} setActiveTab={setActiveTab} />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SidebarProvider>
        <AppContent />
      </SidebarProvider>
    </AuthProvider>
  );
}

