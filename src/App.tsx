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
import { InstallBanner } from './components/InstallBanner';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthScreen } from './screens/AuthScreen';

function AppContent() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'resumo';
  });
  const { isOpen, closeSidebar, isMobile, setIsMobile } = useSidebar();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

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

  if (!user) {
    return (
      <>
        <AuthScreen />
        <InstallBanner />
      </>
    );
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
        {activeTab === 'resumo' && <DashboardScreen key="resumo" activeTab={activeTab} setActiveTab={setActiveTab} />}
        {activeTab === 'pacientes' && <PatientsScreen key="pacientes" activeTab={activeTab} setActiveTab={setActiveTab} />}
        {activeTab === 'favoritos' && <FavoritesScreen key="favoritos" activeTab={activeTab} setActiveTab={setActiveTab} />}
        {activeTab === 'acompanhamento' && <FollowUpsScreen key="acompanhamento" activeTab={activeTab} setActiveTab={setActiveTab} />}
        {activeTab === 'configuracoes' && <SettingsScreen key="configuracoes" activeTab={activeTab} setActiveTab={setActiveTab} />}
      </main>
      <InstallBanner />
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

