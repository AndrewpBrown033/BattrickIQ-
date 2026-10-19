import { auth, db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';

/**
 * Login is real Firebase Authentication (email + password). Firestore rules identify the caller
 * from the Firebase token.
 *
 * Existing data is keyed by a legacy app uid (e.g. `bt_andrew_admin`). Each account keeps that uid
 * in `users_auth/{email}` (a mapping document with NO password), and the rules grant access to
 * `users/{uid}` / `users_data/{uid}` only to the account whose mapping points at that uid. So
 * nothing needs moving.
 *
 * Accounts created before this change stored a plaintext password in `users_auth`. On a
 * user's first login with the old password we create their Firebase account and strip the
 * password from the document (see migrateLegacyAccount).
 */

export interface CustomUser {
  uid: string;
  email: string;
  role?: 'admin' | 'manager';
}

type AuthCallback = (user: CustomUser | null) => void;

export const ADMIN_EMAIL = 'andrewpbrown33@gmail.com';
const LEGACY_ADMIN_UID = 'bt_andrew_admin';

const LISTENERS: Set<AuthCallback> = new Set();
let currentUser: CustomUser | null = null;
let ready = false;

function persist(user: CustomUser | null) {
  try {
    if (user) localStorage.setItem('bt_custom_user', JSON.stringify(user));
    else localStorage.removeItem('bt_custom_user');
  } catch {
    // storage unavailable - fine
  }
}

function setUser(user: CustomUser | null) {
  currentUser = user;
  persist(user);
  LISTENERS.forEach((cb) => cb(currentUser));
}

const cleanEmailOf = (email: string) => email.trim().toLowerCase();
const mappingRef = (email: string) => doc(db, 'users_auth', cleanEmailOf(email));

// Sign-in and the auth listener both resolve the same user; share one lookup so a brand-new
// account never gets two different random uids written.
const resolving = new Map<string, Promise<CustomUser>>();
function resolveUser(fb: User): Promise<CustomUser> {
  let p = resolving.get(fb.uid);
  if (!p) {
    p = loadOrCreateMapping(fb).finally(() => setTimeout(() => resolving.delete(fb.uid), 0));
    resolving.set(fb.uid, p);
  }
  return p;
}

/** Load (or create) the account mapping for a signed-in Firebase user. */
async function loadOrCreateMapping(fb: User): Promise<CustomUser> {
  const email = cleanEmailOf(fb.email || '');
  const snap = await getDoc(mappingRef(email));
  if (snap.exists()) {
    const d = snap.data() as any;
    return { uid: d.uid, email, role: d.role === 'admin' && email === ADMIN_EMAIL ? 'admin' : 'manager' };
  }
  // First sign-in of a brand-new account (or one whose mapping was never written).
  const uid = email === ADMIN_EMAIL ? LEGACY_ADMIN_UID : 'bt_' + Math.random().toString(36).substring(2, 11);
  const role: 'admin' | 'manager' = email === ADMIN_EMAIL ? 'admin' : 'manager';
  await setDoc(mappingRef(email), { email, uid, role, createdAt: new Date().toISOString() });
  return { uid, email, role };
}

// Reconcile with Firebase's own persisted session. Listeners hear nothing until this resolves,
// so no Firestore listener ever starts without a token.
onAuthStateChanged(auth, async (fb) => {
  try {
    if (!fb || !fb.email) {
      ready = true;
      setUser(null);
      return;
    }
    const user = await resolveUser(fb);
    ready = true;
    setUser(user);
  } catch (e) {
    console.error('Could not resolve signed-in user', e);
    ready = true;
    setUser(null);
  }
});

export function isAuthReady() {
  return ready;
}

export function onCustomAuthStateChanged(callback: AuthCallback) {
  LISTENERS.add(callback);
  if (ready) callback(currentUser);
  return () => {
    LISTENERS.delete(callback);
  };
}

export function getCustomUser(): CustomUser | null {
  return currentUser;
}

function authError(code: string, message: string) {
  return { code, message };
}

function mapFirebaseError(e: any): never {
  const code: string = e?.code || '';
  if (code === 'auth/operation-not-allowed') {
    throw authError(code, 'Email/password sign-in is not enabled yet. In Firebase Console go to Authentication → Sign-in method and enable Email/Password.');
  }
  if (code === 'auth/too-many-requests') throw authError(code, 'Too many attempts. Wait a few minutes and try again.');
  throw e?.code ? e : authError('auth/unknown', e?.message || 'Sign-in failed.');
}

export async function customSignUp(email: string, password: string): Promise<CustomUser> {
  if (!email || !password) throw new Error('Email and password are required.');
  if (password.length < 6) throw new Error('Password must be at least 6 characters.');
  const clean = cleanEmailOf(email);

  try {
    await createUserWithEmailAndPassword(auth, clean, password);
  } catch (e: any) {
    if (e?.code === 'auth/email-already-in-use') {
      throw authError('auth/email-already-in-use', 'This email address is already registered.');
    }
    mapFirebaseError(e);
  }
  // onAuthStateChanged writes the mapping and updates listeners; return the resolved user.
  const fb = auth.currentUser;
  if (!fb) throw authError('auth/unknown', 'Sign-up did not complete.');
  const user = await resolveUser(fb);
  setUser(user);
  return user;
}

/** Old accounts: password was stored in users_auth. Verify it, create the Firebase account, then strip it. */
async function migrateLegacyAccount(clean: string, password: string): Promise<boolean> {
  let snap;
  try {
    snap = await getDoc(mappingRef(clean));
  } catch {
    return false;
  }
  if (!snap.exists()) return false;
  const d = snap.data() as any;
  if (typeof d.password !== 'string' || d.password !== password) return false;

  try {
    await createUserWithEmailAndPassword(auth, clean, password);
  } catch (e: any) {
    // A Firebase account already exists with a different password: do not touch it.
    if (e?.code === 'auth/email-already-in-use') return false;
    mapFirebaseError(e);
  }
  // Rewrite the mapping WITHOUT the password (setDoc without merge drops the field).
  await setDoc(mappingRef(clean), {
    email: clean,
    uid: d.uid,
    role: d.role === 'admin' && clean === ADMIN_EMAIL ? 'admin' : 'manager',
    createdAt: d.createdAt || new Date().toISOString(),
    migratedAt: new Date().toISOString(),
  });
  return true;
}

export async function customSignIn(email: string, password: string): Promise<CustomUser> {
  if (!email || !password) throw new Error('Email and password are required.');
  const clean = cleanEmailOf(email);

  try {
    await signInWithEmailAndPassword(auth, clean, password);
  } catch (e: any) {
    const code = e?.code || '';
    const maybeLegacy = ['auth/user-not-found', 'auth/invalid-credential', 'auth/wrong-password', 'auth/invalid-login-credentials'].includes(code);
    if (!maybeLegacy) mapFirebaseError(e);
    const migrated = await migrateLegacyAccount(clean, password);
    if (!migrated) {
      throw authError(
        code === 'auth/user-not-found' ? 'auth/user-not-found' : 'auth/wrong-password',
        code === 'auth/user-not-found' ? 'No account associated with this email address.' : 'Invalid password. Please try again.'
      );
    }
  }

  const fb = auth.currentUser;
  if (!fb) throw authError('auth/unknown', 'Sign-in did not complete.');
  const user = await resolveUser(fb);
  setUser(user);
  return user;
}

export function customSignOut() {
  signOut(auth).catch(() => {});
  setUser(null);
}

/** Demo-only UI switch between admin/manager views. It cannot grant any data access (rules decide that). */
export function toggleDemoRole(): CustomUser | null {
  if (!currentUser) return null;
  const newRole = currentUser.role === 'admin' ? 'manager' : 'admin';
  setUser({ ...currentUser, role: newRole });
  return currentUser;
}
