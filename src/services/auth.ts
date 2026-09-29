import { AuthUser, AuthSession } from '../types';

const USERS_STORAGE_KEY = 'wt_auth_users';
const SESSION_STORAGE_KEY = 'wt_auth_session';

// Helper utilities for hex conversion
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

// Generate cryptographically secure random salt
function generateSalt(): string {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    return bytesToHex(bytes);
  }
  // Fallback random
  let s = '';
  for (let i = 0; i < 32; i++) {
    s += Math.floor(Math.random() * 16).toString(16);
  }
  return s;
}

// Derive cryptographic hash using PBKDF2 (100,000 iterations, SHA-256)
async function hashPassword(password: string, saltHex: string): Promise<string> {
  const enc = new TextEncoder();
  if (
    typeof window !== 'undefined' &&
    window.crypto &&
    window.crypto.subtle
  ) {
    try {
      const salt = hexToBytes(saltHex);
      const keyMaterial = await window.crypto.subtle.importKey(
        'raw',
        enc.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveBits']
      );
      const derivedBits = await window.crypto.subtle.deriveBits(
        {
          name: 'PBKDF2',
          salt: salt as any,
          iterations: 100000,
          hash: 'SHA-256',
        },
        keyMaterial,
        256
      );
      return bytesToHex(new Uint8Array(derivedBits));
    } catch (e) {
      console.warn('SubtleCrypto error, falling back to basic hash', e);
    }
  }

  // Fallback SHA-256 hash using digest if PBKDF2 not fully supported
  if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
    const data = enc.encode(password + saltHex);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    return bytesToHex(new Uint8Array(hash));
  }

  // Ultra-simple fallback for environments without crypto
  let h = 0;
  const str = password + saltHex;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16).padStart(16, '0');
}

// Get all registered users from storage
export function getStoredUsers(): AuthUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Error reading users from localStorage', e);
    return [];
  }
}

// Save users to storage
function saveUsers(users: AuthUser[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (e) {
    console.error('Error saving users to localStorage', e);
  }
}

// Get current active session
export function getActiveSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const session: AuthSession = JSON.parse(raw);
    if (session.expiresAt && Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return session;
  } catch (e) {
    return null;
  }
}

// Save active session
export function saveActiveSession(session: AuthSession | null): void {
  try {
    if (session) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (e) {
    console.error('Error managing session', e);
  }
}

// Input validation helpers
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim();
  if (!trimmed) {
    return { valid: false, error: 'El correo electrónico es obligatorio.' };
  }
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return { valid: false, error: 'Introduce un correo electrónico válido (ejemplo: usuario@dominio.com).' };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: 'El correo electrónico no puede superar los 100 caracteres.' };
  }
  return { valid: true };
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'La contraseña es obligatoria.' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'La contraseña debe tener al menos 6 caracteres.' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'La contraseña no puede superar los 128 caracteres.' };
  }
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasDigit = /[0-9]/.test(password);
  if (!hasLetter || !hasDigit) {
    return { valid: false, error: 'La contraseña debe contener al menos una letra y un número.' };
  }
  return { valid: true };
}

// Register user
export async function registerUser(
  email: string,
  password: string,
  name?: string
): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return { success: false, error: emailValidation.error };
  }

  const passValidation = validatePassword(password);
  if (!passValidation.valid) {
    return { success: false, error: passValidation.error };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const users = getStoredUsers();

  const existing = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    return {
      success: false,
      error: 'Ya existe una cuenta registrada con este correo electrónico.',
    };
  }

  const salt = generateSalt();
  const hash = await hashPassword(password, salt);
  const displayName = (name && name.trim()) || normalizedEmail.split('@')[0];

  const newUser: AuthUser = {
    id: 'user_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 7),
    email: normalizedEmail,
    name: displayName,
    salt,
    hash,
    createdAt: new Date().toISOString(),
  };

  users.push(newUser);
  saveUsers(users);

  // Create session (valid for 30 days)
  const session: AuthSession = {
    userId: newUser.id,
    email: newUser.email,
    name: newUser.name,
    token: 'tok_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };

  saveActiveSession(session);
  return { success: true, session };
}

// Login user
export async function loginUser(
  email: string,
  password: string
): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
  const emailValidation = validateEmail(email);
  if (!emailValidation.valid) {
    return { success: false, error: emailValidation.error };
  }

  if (!password) {
    return { success: false, error: 'Introduce tu contraseña.' };
  }

  const normalizedEmail = email.trim().toLowerCase();
  const users = getStoredUsers();

  const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!user) {
    return {
      success: false,
      error: 'No se encontró ninguna cuenta con este correo electrónico.',
    };
  }

  const computedHash = await hashPassword(password, user.salt);
  if (computedHash !== user.hash) {
    return {
      success: false,
      error: 'Contraseña incorrecta. Por favor verifícala e intenta de nuevo.',
    };
  }

  const session: AuthSession = {
    userId: user.id,
    email: user.email,
    name: user.name,
    token: 'tok_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 10),
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
  };

  saveActiveSession(session);
  return { success: true, session };
}

// Logout user
export function logoutUser(): void {
  saveActiveSession(null);
}
