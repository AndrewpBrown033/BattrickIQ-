import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Credentials retrieved from firebase-applet-config.json
const firebaseConfig = {
  apiKey: "AIzaSyCrZVc979wK4JhL2tqCns0THOKmnXUGo0M",
  authDomain: "decent-radius-k98sv.firebaseapp.com",
  projectId: "decent-radius-k98sv",
  storageBucket: "decent-radius-k98sv.firebasestorage.app",
  messagingSenderId: "329690078515",
  appId: "1:329690078515:web:ee4e1bcb47291875627246"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Use getFirestore with databaseId as the second parameter for type-safe named DB initialization
export const db = getFirestore(app, "ai-studio-battrickiq-dd7e77b4-4c9e-44eb-b3f1-e7ef8edd6f4a");

// --- Firestore Secure Error Handling as per Skill Mandate ---
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || null,
      isAnonymous: auth.currentUser?.isAnonymous || null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

