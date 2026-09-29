import { AuthSession } from '../types';

const SESSION_STORAGE_KEY = 'wt_auth_session';

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
  } catch {
    return null;
  }
}

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

export function validateEmail(email: string): { valid: boolean; error?: string } {
  const trimmed = email.trim();
  if (!trimmed) {
    return { valid: false, error: 'Introduce tu correo electrónico.' };
  }
  if (!trimmed.includes('@') || !trimmed.includes('.')) {
    return { valid: false, error: 'Introduce un correo válido (ejemplo: usuario@correo.com).' };
  }
  return { valid: true };
}

export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (!password) {
    return { valid: false, error: 'Introduce una contraseña.' };
  }
  if (password.length < 4) {
    return { valid: false, error: 'La contraseña debe tener al menos 4 caracteres.' };
  }
  return { valid: true };
}

// Register user via Server API
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

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
        name: name?.trim(),
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Error al crear la cuenta.' };
    }

    const session: AuthSession = {
      userId: data.user.id,
      email: data.user.email,
      name: data.user.name,
      token: data.token,
      expiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000,
    };

    saveActiveSession(session);
    return { success: true, session };
  } catch (err: any) {
    return {
      success: false,
      error: 'No se pudo conectar con el servidor. Revisa tu conexión a internet.',
    };
  }
}

// Login user via Server API
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

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        password,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Error al iniciar sesión.' };
    }

    const session: AuthSession = {
      userId: data.user.id,
      email: data.user.email,
      name: data.user.name,
      token: data.token,
      expiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000,
    };

    saveActiveSession(session);
    return { success: true, session };
  } catch (err: any) {
    return {
      success: false,
      error: 'No se pudo conectar con el servidor. Revisa tu conexión a internet.',
    };
  }
}

// Quick demo login via Server API
export async function demoLogin(): Promise<{ success: boolean; session?: AuthSession; error?: string }> {
  try {
    const res = await fetch('/api/auth/demo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      return { success: false, error: data.error || 'Error al entrar en cuenta demo.' };
    }
    const session: AuthSession = {
      userId: data.user.id,
      email: data.user.email,
      name: data.user.name,
      token: data.token,
      expiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000,
    };
    saveActiveSession(session);
    return { success: true, session };
  } catch (err: any) {
    return { success: false, error: 'Error de conexión con el servidor.' };
  }
}

// Logout user
export async function logoutUser(): Promise<void> {
  const session = getActiveSession();
  if (session?.token) {
    try {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
      }).catch(() => {});
    } catch {}
  }
  saveActiveSession(null);
}
