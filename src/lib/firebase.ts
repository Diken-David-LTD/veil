import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

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
  }
}

export const getEliteErrorMessage = (error: any) => {
  const message = error?.message || String(error);
  
  if (message.includes('permission-denied')) {
    return "Clearance Check: It seems you haven't been granted the key to this particular room yet. Discretion is our shield.";
  }
  if (message.includes('unavailable')) {
    return "Pulse Interrupted: The network is momentarily hushed. Let's try to regain our connection to the circle.";
  }
  if (message.includes('quota-exceeded')) {
    return "Refined Limit: Everyone is gathering at once! We've hit our daily threshold for this action. Please return when the crowd thins.";
  }
  if (message.includes('not-found')) {
    return "Slipped Away: Whatever you're looking for has vanished into the shadows of the network.";
  }
  if (message.includes('already-exists')) {
    return "Double Presence: This entry already resides within our database. No need for a duplicate.";
  }
  
  return "Momentary Static: Something slightly off-script happened. Our refinement team is already looking into it.";
};

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const eliteMessage = getEliteErrorMessage(error);
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(eliteMessage);
}
