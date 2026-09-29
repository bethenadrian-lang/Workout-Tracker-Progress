import { WorkoutLog } from '../types';
import { getActiveSession } from './auth';

const GLOBAL_DEFAULT_KEY = 'wt_v1';

export function getUserStorageKey(userId?: string): string {
  if (userId) {
    return `wt_user_${userId}_logs`;
  }
  return GLOBAL_DEFAULT_KEY;
}

// Safely read logs for specific user or guest
export function loadUserLogs(userId?: string): WorkoutLog[] {
  const key = getUserStorageKey(userId);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(sanitizeLogItem).filter(Boolean) as WorkoutLog[];
  } catch (e) {
    console.error(`Error loading logs for key ${key}:`, e);
    return [];
  }
}

// Fetch workouts from server for authenticated user
export async function syncWorkoutsFromServer(userId?: string): Promise<WorkoutLog[] | null> {
  const session = getActiveSession();
  if (!session?.token || !userId) return null;

  try {
    const res = await fetch('/api/workouts', {
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (Array.isArray(data.workouts)) {
      const sanitized = data.workouts.map(sanitizeLogItem).filter(Boolean) as WorkoutLog[];
      const key = getUserStorageKey(userId);
      localStorage.setItem(key, JSON.stringify(sanitized));
      return sanitized;
    }
  } catch (e) {
    console.warn('Could not sync workouts from server, using local cache:', e);
  }
  return null;
}

// Safely save logs to localStorage and synchronize with Server
export function saveUserLogs(logs: WorkoutLog[], userId?: string): { success: boolean; error?: string } {
  const key = getUserStorageKey(userId);
  try {
    const serialized = JSON.stringify(logs);
    localStorage.setItem(key, serialized);
    if (!userId) {
      localStorage.setItem(GLOBAL_DEFAULT_KEY, serialized);
    }
  } catch (e: any) {
    if (e.name === 'QuotaExceededError' || e.code === 22) {
      return {
        success: false,
        error: 'El almacenamiento local está lleno. Exporta tus datos para liberar espacio.',
      };
    }
  }

  // Sync to server if authenticated
  const session = getActiveSession();
  if (session?.token && userId) {
    try {
      fetch('/api/workouts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ workouts: logs }),
      }).catch((err) => {
        console.warn('Background sync to server failed:', err);
      });
    } catch {}
  }

  return { success: true };
}

// Sanitize log items defensively
export function sanitizeLogItem(item: any): WorkoutLog | null {
  if (!item || typeof item !== 'object') return null;
  const ex = typeof item.ex === 'string' ? item.ex.trim() : '';
  if (!ex) return null;

  const kg = typeof item.kg === 'number' ? Math.max(0, item.kg) : parseFloat(item.kg) || 0;
  const sets = typeof item.sets === 'number' ? Math.max(1, Math.floor(item.sets)) : parseInt(item.sets, 10) || 1;
  const reps = typeof item.reps === 'number' ? Math.max(1, Math.floor(item.reps)) : parseInt(item.reps, 10) || 1;
  const rpe = typeof item.rpe === 'number' ? Math.min(10, Math.max(1, Math.round(item.rpe))) : parseInt(item.rpe, 10) || 7;

  let date = typeof item.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : '';
  if (!date) {
    const now = new Date();
    date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }

  const id = typeof item.id === 'string' && item.id.length > 0 ? item.id : Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const note = typeof item.note === 'string' ? item.note.slice(0, 500) : '';

  return {
    id,
    userId: typeof item.userId === 'string' ? item.userId : undefined,
    date,
    ex: ex.slice(0, 80),
    kg: Math.min(kg, 999),
    sets: Math.min(sets, 100),
    reps: Math.min(reps, 500),
    rpe,
    note,
  };
}

// Deep validation of imported file
export function validateImportPayload(content: string): {
  valid: boolean;
  logs?: WorkoutLog[];
  error?: string;
  stats?: { total: number; valid: number; skipped: number };
} {
  if (!content || !content.trim()) {
    return { valid: false, error: 'El archivo está vacío.' };
  }

  if (content.length > 10 * 1024 * 1024) {
    return { valid: false, error: 'El archivo supera el tamaño máximo permitido (10MB).' };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (err: any) {
    return { valid: false, error: `El archivo no tiene un formato JSON válido: ${err.message}` };
  }

  if (!Array.isArray(parsed)) {
    return { valid: false, error: 'El archivo JSON debe contener una lista (array) de ejercicios.' };
  }

  const sanitizedList: WorkoutLog[] = [];
  let skipped = 0;

  for (const item of parsed) {
    const sanitized = sanitizeLogItem(item);
    if (sanitized) {
      sanitizedList.push(sanitized);
    } else {
      skipped++;
    }
  }

  if (sanitizedList.length === 0) {
    return { valid: false, error: 'No se encontraron registros válidos de entrenamiento en el archivo.' };
  }

  return {
    valid: true,
    logs: sanitizedList,
    stats: {
      total: parsed.length,
      valid: sanitizedList.length,
      skipped,
    },
  };
}
