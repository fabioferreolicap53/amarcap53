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

const AUTH_ACTION_SEGMENTS = [
  'reset-password',
  'confirm-password-reset',
  'verify-email',
  'confirm-verification',
  'confirm-email-change',
];

const isAuthActionRoute = (value: string) => {
  const normalized = value.toLowerCase();
  return AUTH_ACTION_SEGMENTS.some((segment) => normalized.includes(segment));
};

const isLoginHash = (hash: string) => {
  const normalized = hash.toLowerCase();

  if (!normalized || normalized.includes('token=')) {
    return false;
  }

  return (
    normalized === '#/login' ||
    normalized === '#login' ||
    normalized.startsWith('#/login?') ||
    normalized.startsWith('#/signin') ||
    normalized.startsWith('#/auth')
  );
};

function AppContent() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'resumo';
  });
  const { isOpen, closeSidebar, isMobile, setIsMobile } = useSidebar();
  const { user, isLoading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState(() => {
    return `${window.location.pathname}${window.location.search}`;
  });

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    // Check if the current URL is an auth action route
    const checkRoute = () => {
      const path = window.location.pathname;
      const search = window.location.search;
      const hash = window.location.hash;
      const routeWithSearch = `${path}${search}`;

      // Alguns ambientes empurram hash de login (#/login) mesmo em links de ação.
      // Removemos isso cedo para não competir com verificação/reset/troca de e-mail.
      if (isAuthActionRoute(routeWithSearch) && isLoginHash(hash)) {
        window.history.replaceState(null, '', routeWithSearch);
      }

      setCurrentRoute(routeWithSearch);
    };
    
    // Check immediately on mount
    checkRoute();
    
    window.addEventListener('popstate', checkRoute);
    window.addEventListener('hashchange', checkRoute);
    
    return () => {
      window.removeEventListener('popstate', checkRoute);
      window.removeEventListener('hashchange', checkRoute);
    };
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
  const normalizedPath = currentRoute.toLowerCase();
  const isResetPassword = normalizedPath.includes('reset-password') || normalizedPath.includes('confirm-password-reset');
  const isVerifyEmail = normalizedPath.includes('verify-email') || normalizedPath.includes('confirm-verification');
  const isConfirmEmailChange = normalizedPath.includes('confirm-email-change');

  if (isResetPassword) {
    return <ResetPasswordScreen />;
  }

  if (isVerifyEmail) {
    return <VerifyEmailScreen />;
  }

  if (isConfirmEmailChange) {
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

