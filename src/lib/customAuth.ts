import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface CustomUser {
  uid: string;
  email: string;
  role?: 'admin' | 'manager';
}

type AuthCallback = (user: CustomUser | null) => void;

const LISTENERS: Set<AuthCallback> = new Set();
let currentUser: CustomUser | null = null;

// Initialize from localStorage
const storedUser = localStorage.getItem('bt_custom_user');
if (storedUser) {
  try {
    currentUser = JSON.parse(storedUser);
  } catch (e) {
    console.error("Error parsing stored user:", e);
  }
}

function notifyListeners() {
  LISTENERS.forEach(cb => cb(currentUser));
}

export function onCustomAuthStateChanged(callback: AuthCallback) {
  LISTENERS.add(callback);
  // Immediate trigger with current value
  callback(currentUser);
  return () => {
    LISTENERS.delete(callback);
  };
}

export function getCustomUser(): CustomUser | null {
  return currentUser;
}

export async function customSignUp(email: string, password: string): Promise<CustomUser> {
  if (!email || !password) {
    throw new Error("Email and password are required.");
  }
  
  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters.");
  }

  const cleanEmail = email.trim().toLowerCase();
  const credentialRef = doc(db, 'users_auth', cleanEmail);
  
  // Check if user already exists
  const docSnap = await getDoc(credentialRef);
  if (docSnap.exists()) {
    throw { code: 'auth/email-already-in-use', message: 'This email address is already registered.' };
  }

  // Generate a clean deterministic/random UID
  const uid = 'bt_' + Math.random().toString(36).substring(2, 11);
  const role = cleanEmail === 'andrewpbrown33@gmail.com' ? 'admin' : 'manager';
  
  // Save credentials
  await setDoc(credentialRef, {
    email: cleanEmail,
    password: password, // For private app development workspace
    uid: uid,
    role: role,
    createdAt: new Date().toISOString()
  });

  const newUser: CustomUser = { uid, email: cleanEmail, role };
  currentUser = newUser;
  localStorage.setItem('bt_custom_user', JSON.stringify(newUser));
  notifyListeners();
  
  return newUser;
}

export async function customSignIn(email: string, password: string): Promise<CustomUser> {
  if (!email || !password) {
    throw new Error("Email and password are required.");
  }

  const cleanEmail = email.trim().toLowerCase();
  const credentialRef = doc(db, 'users_auth', cleanEmail);
  
  const docSnap = await getDoc(credentialRef);
  if (!docSnap.exists()) {
    throw { code: 'auth/user-not-found', message: 'No account associated with this email address.' };
  }

  const data = docSnap.data();
  if (data.password !== password) {
    throw { code: 'auth/wrong-password', message: 'Invalid password. Please try again.' };
  }

  const role = data.role || (cleanEmail === 'andrewpbrown33@gmail.com' ? 'admin' : 'manager');

  const user: CustomUser = {
    uid: data.uid,
    email: data.email,
    role: role
  };

  currentUser = user;
  localStorage.setItem('bt_custom_user', JSON.stringify(user));
  notifyListeners();
  
  return user;
}

export function customSignOut() {
  currentUser = null;
  localStorage.removeItem('bt_custom_user');
  notifyListeners();
}

export function toggleDemoRole(): CustomUser | null {
  if (!currentUser) return null;
  const newRole = currentUser.role === 'admin' ? 'manager' : 'admin';
  currentUser = {
    ...currentUser,
    role: newRole
  };
  localStorage.setItem('bt_custom_user', JSON.stringify(currentUser));
  notifyListeners();
  return currentUser;
}
