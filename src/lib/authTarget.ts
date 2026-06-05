/// <reference types="vite/client" />

export type AppKey = 'amarcap53' | 'agenda';

interface KnownAppMeta {
  name: string;
  description: string;
  collection: string;
  collectionIds: string[];
}

const uniqueValues = (values: Array<string | undefined>) => {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value && value.trim()))));
};

export const DEFAULT_APP_KEY: AppKey = 'amarcap53';
export const SELECTED_APP_STORAGE_KEY = 'selectedApp';
export const SELECTED_COLLECTION_STORAGE_KEY = 'selectedAuthCollection';

export const KNOWN_APPS: Record<AppKey, KnownAppMeta> = {
  amarcap53: {
    name: 'AMAR',
    description: 'ACOMPANHAMENTO DA MULHER NAS ACOES DE RASTREIO',
    collection: 'amarcap53_users',
    collectionIds: uniqueValues([
      // Collection id seen in live auth tokens for amarcap53_users.
      'twexrmhjkbtopmh',
      import.meta.env.VITE_AMARCAP53_COLLECTION_ID,
    ]),
  },
  agenda: {
    name: 'AGENDA',
    description: 'SISTEMA DE AGENDAMENTO DE CONSULTAS',
    collection: 'agenda_cap53_usuarios',
    collectionIds: uniqueValues([
      import.meta.env.VITE_AGENDA_CAP53_COLLECTION_ID,
    ]),
  },
};

const decodeBase64Url = (value: string) => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (normalized.length % 4)) % 4);
  return window.atob(normalized + padding);
};

export const decodeTokenPayload = (token: string) => {
  try {
    const [, payload] = token.split('.');
    if (!payload) return null;
    return JSON.parse(decodeBase64Url(payload)) as Record<string, unknown>;
  } catch (error) {
    console.error('Falha ao decodificar token de autenticacao:', error);
    return null;
  }
};

export const extractAuthCollectionId = (token: string) => {
  const payload = decodeTokenPayload(token);
  const collectionId = payload?.collectionId;
  return typeof collectionId === 'string' ? collectionId : null;
};

export const extractTokenFromLocation = (location: Location = window.location) => {
  const searchParams = new URLSearchParams(location.search);
  let token = searchParams.get('token');

  if (!token && location.hash.includes('token=')) {
    const hashQuery = location.hash.split('?')[1] || '';
    const hashParams = new URLSearchParams(hashQuery);
    token = hashParams.get('token');
  }

  return token;
};

export const getKnownAppKeyFromCollection = (collectionRef: string | null | undefined): AppKey | null => {
  if (!collectionRef) return null;

  const normalizedCollectionRef = collectionRef.trim();

  for (const [appKey, config] of Object.entries(KNOWN_APPS) as Array<[AppKey, KnownAppMeta]>) {
    if (config.collection === normalizedCollectionRef) {
      return appKey;
    }

    if (config.collectionIds.includes(normalizedCollectionRef)) {
      return appKey;
    }
  }

  return null;
};

export const persistAuthTarget = (collectionRef: string | null | undefined, appKey: AppKey | null | undefined) => {
  if (collectionRef) {
    localStorage.setItem(SELECTED_COLLECTION_STORAGE_KEY, collectionRef);
  } else {
    localStorage.removeItem(SELECTED_COLLECTION_STORAGE_KEY);
  }

  if (appKey) {
    localStorage.setItem(SELECTED_APP_STORAGE_KEY, appKey);
  } else {
    localStorage.removeItem(SELECTED_APP_STORAGE_KEY);
  }
};

export const getStoredAuthTarget = () => {
  const rawAppKey = localStorage.getItem(SELECTED_APP_STORAGE_KEY);
  const appKey = rawAppKey && rawAppKey in KNOWN_APPS ? (rawAppKey as AppKey) : null;
  const collectionRef = localStorage.getItem(SELECTED_COLLECTION_STORAGE_KEY);

  return {
    appKey,
    collectionRef: collectionRef || null,
  };
};

export const getAuthTargetFromToken = (token: string) => {
  const collectionRef = extractAuthCollectionId(token);
  const appKey = getKnownAppKeyFromCollection(collectionRef);

  return {
    collectionRef,
    appKey,
  };
};

export const getLoginUrlForApp = (appKey: AppKey | null | undefined) => {
  return appKey ? `/?app=${appKey}` : '/';
};
