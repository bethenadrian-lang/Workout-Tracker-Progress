import React, { useState, useEffect, useRef, useMemo } from 'react';
import Chart from 'chart.js/auto';
import type { ChartData, ChartOptions } from 'chart.js';
import { WorkoutLog, ExerciseItem, AuthSession } from './types';
import { getActiveSession, logoutUser } from './services/auth';
import {
  loadUserLogs,
  saveUserLogs,
  validateImportPayload,
} from './services/storage';
import { AuthModal } from './components/AuthModal';
import { ToastContainer, ToastMessage } from './components/Toast';
import { ErrorBoundary } from './components/ErrorBoundary';

const G = [
  'Cuádriceps',
  'Isquios/Glúteos',
  'Pecho',
  'Espalda',
  'Hombro',
  'Brazos',
  'Core',
  'Full Body / Olímpico',
];

const RAW_EX = `Sentadilla trasera|0|Pecho arriba, profundidad completa y rodillas siguiendo la línea de los pies.
Sentadilla frontal|0|Codos altos y tronco vertical; buena base para las cargadas.
Prensa de piernas|0|Lumbar pegada al respaldo y sin bloquear las rodillas arriba.
Zancada caminando|0|Paso largo, tronco erguido y rodilla trasera cerca del suelo.
Sentadilla búlgara|0|Pie trasero elevado; el peso recae sobre la pierna delantera.
Peso muerto|1|Espalda neutra, barra pegada a las piernas y empuja el suelo.
Peso muerto rumano|1|Cadera atrás con rodillas semiflexionadas; nota el estiramiento de isquios.
Hip thrust|1|Mentón al pecho y bloqueo de cadera con el glúteo, sin hiperextender.
Curl femoral|1|Controla la fase excéntrica y no despegues la cadera.
Buenos días|1|Carga ligera, espalda neutra y bisagra de cadera limpia.
Press banca|2|Escápulas retraídas, pies firmes y barra al esternón.
Press inclinado con mancuernas|2|Banco a 30°; recorrido completo sin chocar las mancuernas.
Fondos en paralelas|2|Inclina el torso para más pecho y baja hasta 90° de codo.
Aperturas con mancuernas|2|Codos semiflexionados y estiramiento controlado.
Dominadas|3|Inicia con la escápula, pecho a la barra y sin balanceo.
Remo con barra|3|Torso a 45°, tira hacia el ombligo y aprieta la espalda.
Jalón al pecho|3|Codos hacia las costillas, sin echar el tronco atrás.
Remo con mancuerna|3|Espalda paralela al suelo y tira con el codo.
Press militar|4|Glúteos y abdomen apretados; la barra sube en línea recta.
Push press|4|Pequeño impulso de piernas y bloqueo firme sobre la cabeza.
Elevaciones laterales|4|Codos ligeramente flexionados; sube hasta la altura del hombro.
Face pull|4|Cuerda a la cara, codos altos y rotación externa.
Curl con barra|5|Codos pegados al cuerpo y sin balanceo.
Curl martillo|5|Agarre neutro; trabaja braquial y antebrazo.
Press francés|5|Codos fijos apuntando al techo y bajada controlada.
Extensión de tríceps|5|Polea o cuerda, codos fijos y extensión completa.
Plancha|6|Cuerpo en línea, glúteos y abdomen apretados.
Elevación de piernas|6|Sin balancear y sin arquear la lumbar.
Rueda abdominal|6|Pelvis en retroversión y recorrido que puedas controlar.
Pallof press|6|Resiste la rotación con el tronco estable.
Clean (Cargada)|7|Barra pegada, triple extensión y recepción rápida con codos altos.
Snatch (Arrancada)|7|Agarre ancho, barra cerca del cuerpo y recepción estable sobre la cabeza.
Thruster|7|Sentadilla frontal encadenada con press; aprovecha el impulso de las piernas.
Kettlebell swing|7|Bisagra de cadera, no sentadilla; la cadera lanza la pesa.
Wall ball|7|Sentadilla profunda y lanzamiento fluido a la marca.
Burpee|7|Pecho al suelo, salto con extensión completa y ritmo constante.`;

const EXERCISES: ExerciseItem[] = RAW_EX.split('\n').map((l) => {
  const [n, g, t] = l.split('|');
  return { n, g: G[parseInt(g, 10)], t };
});

const PALETTE = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
  '#f97316',
  '#64748b',
];

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const pd = (s: string): Date => {
  if (!s || typeof s !== 'string') return new Date();
  const parts = s.split('-');
  if (parts.length < 3) return new Date();
  const [a, b, c] = parts;
  const d = new Date(+a, +b - 1, +c);
  return isNaN(d.getTime()) ? new Date() : d;
};

const lab = (s: string) => {
  try {
    return pd(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  } catch {
    return s;
  }
};

const labY = (s: string) => {
  try {
    return pd(s).toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return s;
  }
};

const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const rpeColorClass = (r: number) => {
  if (r >= 10) return 'bg-red-500 text-white';
  if (r >= 9) return 'bg-orange-500 text-white';
  if (r >= 8) return 'bg-amber-400 text-slate-900';
  if (r >= 5) return 'bg-emerald-500 text-white';
  return 'bg-slate-300 text-slate-800 dark:bg-zinc-600 dark:text-zinc-100';
};

const SCRIPT_URL =
  'https://script.google.com/macros/s/AKfycbynHcxa3YHt4r6y7TQ_xijeTNKBZS7PU9xX_panQ60VIMkriL9-sPxsVF1pPPzpDj4R/exec';

interface ProgressStatItem {
  name: string;
  color: string;
  current: number;
  maxVal: number;
  delta: number;
}

export default function App() {
  // Theme state
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const t = localStorage.getItem('wt_theme');
      if (t) return t === 'dark';
      return (
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches
      );
    } catch {
      return false;
    }
  });

  // Active tab state
  const [activeTab, setActiveTab] = useState<number>(0);
  const tabs = [
    'Diario de Entreno',
    'Progreso y Gráficos',
    'Buscador de Ejercicios',
    'Calculadora 1RM',
  ];

  // Auth state
  const [session, setSession] = useState<AuthSession | null>(() => getActiveSession());
  const [authModalOpen, setAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');

  // Toasts state
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const addToast = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = uid();
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };
  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Workout logs state - per user or guest
  const [logs, setLogs] = useState<WorkoutLog[]>(() => {
    const initialSession = getActiveSession();
    const stored = loadUserLogs(initialSession?.userId);
    if (stored.length > 0) return stored;

    // Default starter logs
    const today = new Date();
    const dMinus = (days: number) => {
      const d = new Date(today);
      d.setDate(d.getDate() - days);
      return fmt(d);
    };

    return [
      {
        id: uid(),
        userId: initialSession?.userId,
        date: dMinus(4),
        ex: 'Sentadilla trasera',
        kg: 90,
        sets: 3,
        reps: 8,
        rpe: 7,
        note: 'Buen calentamiento y técnica',
      },
      {
        id: uid(),
        userId: initialSession?.userId,
        date: dMinus(4),
        ex: 'Press banca',
        kg: 70,
        sets: 4,
        reps: 8,
        rpe: 8,
        note: 'Pausa de 1s en el pecho',
      },
      {
        id: uid(),
        userId: initialSession?.userId,
        date: dMinus(2),
        ex: 'Sentadilla trasera',
        kg: 95,
        sets: 3,
        reps: 6,
        rpe: 8,
        note: 'Subiendo kilos con buena barra',
      },
      {
        id: uid(),
        userId: initialSession?.userId,
        date: dMinus(2),
        ex: 'Dominadas',
        kg: 0,
        sets: 4,
        reps: 8,
        rpe: 7,
        note: 'Estrictas al pecho',
      },
      {
        id: uid(),
        date: fmt(today),
        userId: initialSession?.userId,
        ex: 'Sentadilla trasera',
        kg: 100,
        sets: 3,
        reps: 5,
        rpe: 8,
        note: '¡Sensaciones excelentes!',
      },
      {
        id: uid(),
        date: fmt(today),
        userId: initialSession?.userId,
        ex: 'Press banca',
        kg: 75,
        sets: 3,
        reps: 6,
        rpe: 8,
        note: 'Progresando sólido',
      },
    ];
  });

  // When user signs in or switches account
  const handleAuthSuccess = (newSession: AuthSession) => {
    setSession(newSession);
    const userLogs = loadUserLogs(newSession.userId);
    if (userLogs.length > 0) {
      setLogs(userLogs);
    } else {
      const updated = logs.map((l) => ({ ...l, userId: newSession.userId }));
      setLogs(updated);
      saveUserLogs(updated, newSession.userId);
    }
    addToast(`¡Sesión iniciada como ${newSession.name}!`, 'success');
  };

  const handleLogout = () => {
    logoutUser();
    setSession(null);
    const guestLogs = loadUserLogs(undefined);
    setLogs(guestLogs);
    addToast('Sesión cerrada correctamente.', 'info');
  };

  // Save logs with feedback
  const persistLogs = async (newLogs: WorkoutLog[]) => {
    setLogs(newLogs);
    const saveResult = saveUserLogs(newLogs, session?.userId);
    if (!saveResult.success) {
      addToast(saveResult.error || 'Error al guardar en el dispositivo', 'error');
    }

    try {
      fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newLogs),
      })
        .then((r) => r.json())
        .catch(() => {});
    } catch {}
  };

  // Sync theme
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      try {
        localStorage.setItem('wt_theme', 'dark');
      } catch {}
    } else {
      document.documentElement.classList.remove('dark');
      try {
        localStorage.setItem('wt_theme', 'light');
      } catch {}
    }
  }, [isDark]);

  // Tab 0: Diario form state & validation errors
  const [fDate, setFDate] = useState<string>(() => fmt(new Date()));
  const [fEx, setFEx] = useState<string>('');
  const [fKg, setFKg] = useState<string>('60');
  const [fSets, setFSets] = useState<string>('3');
  const [fReps, setFReps] = useState<string>('8');
  const [fRpe, setFRpe] = useState<number>(7);
  const [fNote, setFNote] = useState<string>('');

  const [errors, setErrors] = useState<{
    date?: string;
    ex?: string;
    kg?: string;
    sets?: string;
    reps?: string;
  }>({});

  const [formBanner, setFormBanner] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);
  const formBannerTimeout = useRef<NodeJS.Timeout | null>(null);

  const showFormBanner = (text: string, type: 'success' | 'error') => {
    if (formBannerTimeout.current) clearTimeout(formBannerTimeout.current);
    setFormBanner({ text, type });
    formBannerTimeout.current = setTimeout(() => {
      setFormBanner(null);
    }, 3000);
  };

  const validateForm = () => {
    const errs: typeof errors = {};

    if (!fDate) {
      errs.date = 'La fecha es obligatoria.';
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(fDate)) {
      errs.date = 'Formato de fecha inválido.';
    }

    const trimmedEx = fEx.trim();
    if (!trimmedEx) {
      errs.ex = 'Introduce el nombre del ejercicio.';
    } else if (trimmedEx.length < 2) {
      errs.ex = 'El nombre debe tener al menos 2 caracteres.';
    } else if (trimmedEx.length > 70) {
      errs.ex = 'El nombre no puede superar los 70 caracteres.';
    }

    const kgNum = parseFloat(fKg);
    if (isNaN(kgNum)) {
      errs.kg = 'Introduce un peso numérico.';
    } else if (kgNum < 0) {
      errs.kg = 'El peso no puede ser negativo.';
    } else if (kgNum > 600) {
      errs.kg = 'El peso máximo admitido es 600 kg.';
    }

    const setsNum = parseInt(fSets, 10);
    if (isNaN(setsNum) || setsNum < 1) {
      errs.sets = 'Mínimo 1 serie.';
    } else if (setsNum > 50) {
      errs.sets = 'Máximo 50 series.';
    }

    const repsNum = parseInt(fReps, 10);
    if (isNaN(repsNum) || repsNum < 1) {
      errs.reps = 'Mínimo 1 repetición.';
    } else if (repsNum > 150) {
      errs.reps = 'Máximo 150 repeticiones.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddLog = async () => {
    if (!validateForm()) {
      showFormBanner('Por favor corrige los campos señalados.', 'error');
      return;
    }

    const newLog: WorkoutLog = {
      id: uid(),
      userId: session?.userId,
      date: fDate,
      ex: fEx.trim(),
      kg: parseFloat(fKg),
      sets: parseInt(fSets, 10),
      reps: parseInt(fReps, 10),
      rpe: fRpe,
      note: fNote.trim(),
    };

    const updated = [...logs, newLog];
    await persistLogs(updated);
    setFNote('');
    setErrors({});
    showFormBanner('¡Serie guardada correctamente! ✓', 'success');
  };

  // Delete log with safety
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const handleDeleteLog = async (id: string) => {
    if (deleteConfirmId !== id) {
      setDeleteConfirmId(id);
      setTimeout(() => {
        setDeleteConfirmId((curr) => (curr === id ? null : curr));
      }, 3000);
      return;
    }
    setDeleteConfirmId(null);
    const updated = logs.filter((l) => l.id !== id);
    await persistLogs(updated);
    addToast('Serie eliminada.', 'info');
  };

  // Day's session logs
  const dayLogs = useMemo(() => {
    return logs.filter((l) => l.date === fDate);
  }, [logs, fDate]);

  const dayExerciseCount = useMemo(() => {
    return new Set(dayLogs.map((l) => l.ex)).size;
  }, [dayLogs]);

  const dayTotalSets = useMemo(() => {
    return dayLogs.reduce((acc, l) => acc + (l.sets || 0), 0);
  }, [dayLogs]);

  const dayTotalVolume = useMemo(() => {
    return dayLogs.reduce(
      (acc, l) => acc + (l.kg || 0) * (l.sets || 0) * (l.reps || 0),
      0
    );
  }, [dayLogs]);

  const formattedSessionDate = useMemo(() => {
    try {
      return (
        'Sesión del ' +
        pd(fDate).toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        })
      );
    } catch {
      return `Sesión de ${fDate}`;
    }
  }, [fDate]);

  // Exercise lists
  const distinctExercises = useMemo(() => {
    const set = new Set<string>();
    EXERCISES.forEach((e) => set.add(e.n));
    logs.forEach((l) => {
      if (l.ex) set.add(l.ex);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [logs]);

  const loggedExercises = useMemo(() => {
    const set = new Set<string>();
    logs.forEach((l) => {
      if (l.ex) set.add(l.ex);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'));
  }, [logs]);

  // Tab 1: Progress & Charts
  const [selectedEx, setSelectedEx] = useState<Set<string>>(
    new Set(['Sentadilla trasera'])
  );
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const exMenuRef = useRef<HTMLDivElement>(null);
  const exBtnRef = useRef<HTMLButtonElement>(null);
  const chartCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const chartInstanceRef = useRef<Chart | null>(null);

  useEffect(() => {
    if (loggedExercises.length > 0) {
      const valid = new Set([...selectedEx].filter((e) => loggedExercises.includes(e)));
      if (valid.size === 0 && selectedEx.size > 0) {
        setSelectedEx(new Set([loggedExercises[0]]));
      }
    }
  }, [loggedExercises]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        exMenuRef.current &&
        !exMenuRef.current.contains(e.target as Node) &&
        exBtnRef.current &&
        !exBtnRef.current.contains(e.target as Node)
      ) {
        setIsMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsMenuOpen(false);
    };
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const getExerciseColor = (exName: string) => {
    const idx = loggedExercises.indexOf(exName);
    return PALETTE[(idx >= 0 ? idx : 0) % PALETTE.length];
  };

  const progressStats = useMemo<ProgressStatItem[]>(() => {
    const selArray = loggedExercises.filter((e) => selectedEx.has(e));
    const items: ProgressStatItem[] = [];

    for (const e of selArray) {
      const entries = logs
        .filter((l) => l.ex === e)
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      if (!entries.length) continue;

      const dateMap: Record<string, number> = {};
      entries.forEach((l) => {
        if (l.date) {
          dateMap[l.date] = Math.max(dateMap[l.date] || 0, l.kg || 0);
        }
      });
      const sortedDates = Object.keys(dateMap).sort();
      if (!sortedDates.length) continue;

      const values = sortedDates.map((d) => dateMap[d]);
      const current = values[values.length - 1] ?? 0;
      const maxVal = Math.max(...values, 0);
      const delta = current - (values[0] ?? current);

      items.push({
        name: e,
        color: getExerciseColor(e),
        current,
        maxVal,
        delta,
      });
    }

    return items;
  }, [loggedExercises, selectedEx, logs]);

  // Robust Chart rendering with auto registration and canvas safety
  useEffect(() => {
    if (activeTab !== 1 || !chartCanvasRef.current) return;

    // Destroy existing instance attached to canvas or ref
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
      chartInstanceRef.current = null;
    }
    const existing = Chart.getChart(chartCanvasRef.current);
    if (existing) {
      existing.destroy();
    }

    const selArray = loggedExercises.filter((e) => selectedEx.has(e));
    if (selArray.length === 0) {
      return;
    }

    const dataMaps = selArray.map((e) => {
      const m: Record<string, number> = {};
      logs
        .filter((l) => l.ex === e)
        .forEach((l) => {
          if (l.date) {
            m[l.date] = Math.max(m[l.date] || 0, l.kg || 0);
          }
        });
      return m;
    });

    const allDates = Array.from(
      new Set(dataMaps.flatMap((m) => Object.keys(m)))
    ).sort();

    if (allDates.length === 0) return;

    const tc = isDark ? '#a1a1aa' : '#64748b';
    const gc = isDark ? '#27272a' : '#e2e8f0';

    try {
      const datasets = selArray.map((e, i) => {
        const color = getExerciseColor(e);
        return {
          label: e,
          data: allDates.map((d) => dataMaps[i][d] ?? null),
          borderColor: color,
          backgroundColor: color + '1f',
          fill: selArray.length === 1,
          tension: 0.3,
          pointRadius: selArray.length > 4 ? 3 : 5,
          pointHoverRadius: 7,
          pointBackgroundColor: color,
          spanGaps: true,
        };
      });

      const chartData: ChartData<'line'> = {
        labels: allDates.map(lab),
        datasets,
      };

      const options: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'nearest',
          intersect: false,
        },
        plugins: {
          legend: {
            display: selArray.length > 1,
            labels: {
              color: tc,
              usePointStyle: true,
              boxWidth: 8,
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: ${ctx.raw} kg`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: tc },
            grid: { display: false },
          },
          y: {
            ticks: {
              color: tc,
              callback: (val) => `${val} kg`,
            },
            grid: { color: gc },
          },
        },
      };

      chartInstanceRef.current = new Chart(chartCanvasRef.current, {
        type: 'line',
        data: chartData,
        options,
      });
    } catch (err) {
      console.error('Error creating Chart instance:', err);
    }

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
        chartInstanceRef.current = null;
      }
    };
  }, [activeTab, loggedExercises, selectedEx, logs, isDark]);

  // Hall of Fame PRs
  const personalRecords = useMemo(() => {
    const bests: Record<string, WorkoutLog> = {};
    const sorted = [...logs].sort((a, b) =>
      (a.date || '').localeCompare(b.date || '')
    );
    sorted.forEach((l) => {
      if (!l || !l.ex) return;
      if (!bests[l.ex] || (l.kg || 0) > (bests[l.ex].kg || 0)) {
        bests[l.ex] = l;
      }
    });
    return Object.values(bests)
      .filter((l) => (l.kg || 0) > 0)
      .sort((a, b) => (b.kg || 0) - (a.kg || 0));
  }, [logs]);

  // Calendar
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const calendarStats = useMemo(() => {
    const cnt: Record<string, number> = {};
    logs.forEach((l) => {
      if (l.date) {
        cnt[l.date] = (cnt[l.date] || 0) + 1;
      }
    });
    const daysWithLogs = new Set(Object.keys(cnt));
    const year = currentMonthDate.getFullYear();
    const month = currentMonthDate.getMonth();
    const prefix = `${year}-${pad(month + 1)}`;
    const monthSessions = Array.from(daysWithLogs).filter((s) =>
      s.startsWith(prefix)
    ).length;

    const getMonday = (d: Date) => {
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(d.getFullYear(), d.getMonth(), diff);
      return fmt(mon);
    };

    const workoutWeeks = new Set(
      Array.from(daysWithLogs).map((s) => getMonday(pd(s)))
    );
    let checkDate = new Date();
    let weekStreak = 0;
    if (!workoutWeeks.has(getMonday(checkDate))) {
      checkDate.setDate(checkDate.getDate() - 7);
    }
    while (workoutWeeks.has(getMonday(checkDate)) && weekStreak < 200) {
      weekStreak++;
      checkDate.setDate(checkDate.getDate() - 7);
    }

    let checkDay = new Date();
    let dayStreak = 0;
    if (!daysWithLogs.has(fmt(checkDay))) {
      checkDay.setDate(checkDay.getDate() - 1);
    }
    while (daysWithLogs.has(fmt(checkDay)) && dayStreak < 2000) {
      dayStreak++;
      checkDay.setDate(checkDay.getDate() - 1);
    }

    return {
      monthSessions,
      weekStreak,
      dayStreak,
      daysWithLogs,
      cnt,
    };
  }, [logs, currentMonthDate]);

  const calendarGrid = useMemo(() => {
    const y = currentMonthDate.getFullYear();
    const mo = currentMonthDate.getMonth();
    const totalDays = new Date(y, mo + 1, 0).getDate();
    const startOffset = (new Date(y, mo, 1).getDay() + 6) % 7;
    const todayStr = fmt(new Date());

    const items: Array<{
      dayNum?: number;
      dateStr?: string;
      hasWorkout?: boolean;
      count?: number;
      isToday?: boolean;
    }> = [];

    for (let i = 0; i < startOffset; i++) {
      items.push({});
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${y}-${pad(mo + 1)}-${pad(d)}`;
      const hasWorkout = calendarStats.daysWithLogs.has(dateStr);
      const count = calendarStats.cnt[dateStr] || 0;
      const isToday = dateStr === todayStr;
      items.push({
        dayNum: d,
        dateStr,
        hasWorkout,
        count,
        isToday,
      });
    }

    return items;
  }, [currentMonthDate, calendarStats]);

  // Tab 2: Buscador
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [groupFilter, setGroupFilter] = useState<number>(-1);

  const filteredExercises = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return EXERCISES.filter((e) => {
      const matchesGroup = groupFilter < 0 || e.g === G[groupFilter];
      const matchesSearch =
        !q || `${e.n} ${e.g} ${e.t}`.toLowerCase().includes(q);
      return matchesGroup && matchesSearch;
    });
  }, [searchQuery, groupFilter]);

  const handleUseExercise = (name: string) => {
    setFEx(name);
    setActiveTab(0);
    setErrors((prev) => ({ ...prev, ex: undefined }));
  };

  // Tab 3: Calculadora 1RM
  const [calcW, setCalcW] = useState<string>('100');
  const [calcR, setCalcR] = useState<string>('5');
  const [calcFormula, setCalcFormula] = useState<string>('m');
  const [calcError, setCalcError] = useState<string | null>(null);

  const oneRmResult = useMemo(() => {
    const w = parseFloat(calcW);
    const r = parseInt(calcR, 10);

    if (isNaN(w) || w <= 0) {
      setCalcError('Introduce un peso mayor que 0 kg.');
      return null;
    }
    if (w > 600) {
      setCalcError('El peso no puede superar los 600 kg.');
      return null;
    }
    if (isNaN(r) || r < 1) {
      setCalcError('Introduce al menos 1 repetición.');
      return null;
    }
    if (r > 30) {
      setCalcError('El cálculo de 1RM es fiable hasta un máximo de 30 repeticiones.');
      return null;
    }

    setCalcError(null);
    const ep = r === 1 ? w : w * (1 + r / 30);
    const br = (w * 36) / (37 - r);
    const val =
      calcFormula === 'e' ? ep : calcFormula === 'b' ? br : (ep + br) / 2;

    const percentages = [
      { p: 90, r: 4 },
      { p: 85, r: 6 },
      { p: 80, r: 8 },
      { p: 75, r: 10 },
      { p: 70, r: 12 },
    ].map((item) => ({
      p: item.p,
      kg: (val * item.p) / 100,
      reps: item.r,
    }));

    return {
      value: val,
      epley: ep,
      brzycki: br,
      isHighReps: r > 12,
      percentages,
    };
  }, [calcW, calcR, calcFormula]);

  // Footer: Import / Export / Clear
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [clearConfirmStep, setClearConfirmStep] = useState<boolean>(false);
  const clearTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleExportJSON = () => {
    if (logs.length === 0) {
      addToast('No hay datos para exportar.', 'info');
      return;
    }
    try {
      const dateStr = fmt(new Date());
      const dataStr =
        'data:application/json;charset=utf-8,' +
        encodeURIComponent(JSON.stringify(logs, null, 2));
      const dlAnchor = document.createElement('a');
      dlAnchor.setAttribute('href', dataStr);
      dlAnchor.setAttribute('download', `workout-data-${dateStr}.json`);
      dlAnchor.click();
      addToast('Archivo JSON exportado exitosamente.', 'success');
    } catch (e: any) {
      addToast(`Error al exportar: ${e.message}`, 'error');
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json')) {
      addToast('El archivo seleccionado debe ser un archivo .json', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const content = ev.target?.result as string;
        const validation = validateImportPayload(content);
        if (!validation.valid || !validation.logs) {
          addToast(validation.error || 'Error al validar el archivo JSON', 'error');
          return;
        }

        const mergedMap = new Map<string, WorkoutLog>();
        logs.forEach((l) => mergedMap.set(l.id, l));
        validation.logs.forEach((l) => {
          mergedMap.set(l.id, { ...l, userId: session?.userId });
        });

        const merged = Array.from(mergedMap.values()).sort((a, b) =>
          (a.date || '').localeCompare(b.date || '')
        );

        await persistLogs(merged);
        addToast(
          `✓ ${validation.stats?.valid} registros importados (${validation.stats?.skipped || 0} omitidos por formato).`,
          'success'
        );
      } catch (err: any) {
        addToast(`Error al procesar el archivo: ${err.message}`, 'error');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      addToast('Error al leer el archivo desde el dispositivo.', 'error');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    if (!clearConfirmStep) {
      setClearConfirmStep(true);
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
      clearTimeoutRef.current = setTimeout(() => {
        setClearConfirmStep(false);
      }, 3000);
    } else {
      setClearConfirmStep(false);
      if (clearTimeoutRef.current) clearTimeout(clearTimeoutRef.current);
      persistLogs([]);
      addToast('Todos los entrenamientos han sido vaciados.', 'info');
    }
  };

  const dropdownLabel = useMemo(() => {
    if (!loggedExercises.length) return 'Sin ejercicios registrados';
    const n = selectedEx.size;
    if (n === 0) return 'Ningún ejercicio seleccionado';
    if (n === 1) return Array.from(selectedEx)[0];
    if (n === loggedExercises.length) return `Todos los ejercicios (${n})`;
    return `${n} ejercicios seleccionados`;
  }, [loggedExercises, selectedEx]);

  return (
    <div className="bg-slate-50 text-slate-800 dark:bg-zinc-950 dark:text-zinc-100 min-h-screen flex flex-col selection:bg-emerald-500 selection:text-white">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
        initialMode={authModalMode}
      />

      {/* Header */}
      <header
        className="sticky z-20 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 shadow-2xs"
        style={{ top: 'env(safe-area-inset-top, 0px)' }}
      >
        <div className="max-w-5xl mx-auto px-3 sm:px-4">
          <div className="flex flex-wrap items-center justify-between py-2.5 sm:py-3 gap-2">
            {/* Title & Brand */}
            <div className="flex items-center gap-2">
              <span className="text-xl">🏋️</span>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-slate-900 dark:text-zinc-50">
                Workout Tracker &amp; Progress
              </h1>
            </div>

            {/* User Auth & Theme buttons */}
            <div className="flex items-center gap-2">
              {session ? (
                <div className="flex items-center gap-2 bg-slate-100 dark:bg-zinc-800 py-1 px-2 sm:px-2.5 rounded-full border border-slate-200 dark:border-zinc-700">
                  <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center text-xs font-bold uppercase shrink-0">
                    {session.name ? session.name.charAt(0) : session.email.charAt(0)}
                  </div>
                  <span className="text-xs font-medium max-w-[100px] sm:max-w-[140px] truncate hidden xs:inline">
                    {session.name || session.email}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="text-[11px] text-slate-500 hover:text-red-500 dark:text-zinc-400 dark:hover:text-red-400 font-semibold cursor-pointer pl-1"
                    title="Cerrar sesión"
                  >
                    Salir
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('login');
                      setAuthModalOpen(true);
                    }}
                    className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-2.5 sm:px-3 py-1 text-xs transition cursor-pointer"
                  >
                    Iniciar sesión
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthModalMode('register');
                      setAuthModalOpen(true);
                    }}
                    className="rounded-full border border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-xs px-2.5 py-1 transition cursor-pointer hidden sm:inline-block"
                  >
                    Registrarse
                  </button>
                </div>
              )}

              {/* Theme toggle */}
              <button
                id="theme"
                type="button"
                onClick={() => setIsDark((prev) => !prev)}
                className="rounded-full border border-slate-300 dark:border-zinc-700 px-2.5 py-1 text-xs hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer shrink-0"
                aria-label={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                {isDark ? '☀️ Claro' : '🌙 Oscuro'}
              </button>
            </div>
          </div>

          {/* Tabs navigation */}
          <nav
            id="tabs"
            className="flex gap-1 overflow-x-auto -mb-px scrollbar-none py-0.5"
            aria-label="Pestañas de la aplicación"
          >
            {tabs.map((tabName, i) => {
              const active = activeTab === i;
              return (
                <button
                  key={tabName}
                  type="button"
                  onClick={() => setActiveTab(i)}
                  className={`tb whitespace-nowrap px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition cursor-pointer shrink-0 min-h-[40px] flex items-center ${
                    active
                      ? 'border-emerald-600 text-emerald-700 dark:border-emerald-400 dark:text-emerald-400 font-semibold'
                      : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100'
                  }`}
                >
                  {i + 1}. {tabName}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Main Content wrapped in ErrorBoundary */}
      <main className="max-w-5xl mx-auto px-3 sm:px-4 py-4 sm:py-6 flex-1 w-full">
        <ErrorBoundary>
          {/* Tab 0: Diario de Entreno */}
          {activeTab === 0 && (
            <section className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Form Column */}
              <div className="lg:col-span-2 card p-4 sm:p-5 space-y-3.5 self-start">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-slate-900 dark:text-zinc-100 text-base">
                    Registrar ejercicio
                  </h2>
                  {!session && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-medium">
                      Modo local
                    </span>
                  )}
                </div>

                {/* Date Input */}
                <div>
                  <label className="lbl" htmlFor="fDate">
                    Fecha <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="fDate"
                    type="date"
                    className={`inp ${errors.date ? 'border-red-500 focus:ring-red-500' : ''}`}
                    value={fDate}
                    onChange={(e) => {
                      setFDate(e.target.value);
                      if (errors.date) setErrors((prev) => ({ ...prev, date: undefined }));
                    }}
                  />
                  {errors.date && (
                    <p className="text-xs text-red-500 mt-1 font-medium">{errors.date}</p>
                  )}
                </div>

                {/* Exercise Input */}
                <div>
                  <label className="lbl" htmlFor="fEx">
                    Ejercicio <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="fEx"
                      list="exl"
                      className={`inp ${errors.ex ? 'border-red-500 focus:ring-red-500' : ''}`}
                      placeholder="Busca o escribe un ejercicio"
                      value={fEx}
                      onChange={(e) => {
                        setFEx(e.target.value);
                        if (errors.ex) setErrors((prev) => ({ ...prev, ex: undefined }));
                      }}
                    />
                    {fEx && (
                      <button
                        type="button"
                        onClick={() => setFEx('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer"
                        title="Limpiar ejercicio"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <datalist id="exl">
                    {distinctExercises.map((n) => (
                      <option key={n} value={n} />
                    ))}
                  </datalist>
                  {errors.ex && (
                    <p className="text-xs text-red-500 mt-1 font-medium">{errors.ex}</p>
                  )}
                </div>

                {/* Numbers Grid: Peso, Series, Reps */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="lbl" htmlFor="fKg">
                      Peso (kg) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="fKg"
                      type="number"
                      min="0"
                      max="600"
                      step="0.5"
                      inputMode="decimal"
                      className={`inp num ${errors.kg ? 'border-red-500 focus:ring-red-500' : ''}`}
                      placeholder="0"
                      value={fKg}
                      onChange={(e) => {
                        setFKg(e.target.value);
                        if (errors.kg) setErrors((prev) => ({ ...prev, kg: undefined }));
                      }}
                    />
                    {errors.kg && (
                      <p className="text-[11px] text-red-500 mt-0.5">{errors.kg}</p>
                    )}
                  </div>
                  <div>
                    <label className="lbl" htmlFor="fSets">
                      Series <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="fSets"
                      type="number"
                      min="1"
                      max="50"
                      className={`inp num ${errors.sets ? 'border-red-500 focus:ring-red-500' : ''}`}
                      value={fSets}
                      onChange={(e) => {
                        setFSets(e.target.value);
                        if (errors.sets) setErrors((prev) => ({ ...prev, sets: undefined }));
                      }}
                    />
                    {errors.sets && (
                      <p className="text-[11px] text-red-500 mt-0.5">{errors.sets}</p>
                    )}
                  </div>
                  <div>
                    <label className="lbl" htmlFor="fReps">
                      Reps <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="fReps"
                      type="number"
                      min="1"
                      max="150"
                      className={`inp num ${errors.reps ? 'border-red-500 focus:ring-red-500' : ''}`}
                      value={fReps}
                      onChange={(e) => {
                        setFReps(e.target.value);
                        if (errors.reps) setErrors((prev) => ({ ...prev, reps: undefined }));
                      }}
                    />
                    {errors.reps && (
                      <p className="text-[11px] text-red-500 mt-0.5">{errors.reps}</p>
                    )}
                  </div>
                </div>

                {/* RPE Selector */}
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="lbl mb-0">RPE (esfuerzo percibido: {fRpe})</span>
                  </div>
                  <div id="rpe" className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((r) => {
                      const isSelected = r === fRpe;
                      return (
                        <button
                          key={r}
                          type="button"
                          onClick={() => setFRpe(r)}
                          className={`h-9 rounded-md text-xs sm:text-sm font-bold transition cursor-pointer flex items-center justify-center ${rpeColorClass(
                            r
                          )} ${
                            isSelected
                              ? 'ring-2 ring-offset-2 ring-slate-900 dark:ring-white dark:ring-offset-zinc-900 scale-105 opacity-100 z-1'
                              : 'opacity-40 hover:opacity-75'
                          }`}
                          aria-label={`RPE ${r}`}
                        >
                          {r}
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] sm:text-xs mut mt-1.5">
                    5-7 moderado · 8 duro · 9-10 al límite
                  </p>
                </div>

                {/* Notes */}
                <div>
                  <label className="lbl" htmlFor="fNote">
                    Notas
                  </label>
                  <input
                    id="fNote"
                    className="inp"
                    placeholder="Sensaciones, técnica, ajustes…"
                    value={fNote}
                    maxLength={300}
                    onChange={(e) => setFNote(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddLog();
                    }}
                  />
                </div>

                {/* Submit Button */}
                <button
                  id="add"
                  type="button"
                  onClick={handleAddLog}
                  className="btn w-full flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  <span>➕</span>
                  <span>Añadir / Guardar serie</span>
                </button>

                {/* Inline Banner */}
                {formBanner && (
                  <div
                    id="msg"
                    className={`p-2.5 rounded-lg text-xs font-semibold flex items-center gap-2 ${
                      formBanner.type === 'error'
                        ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60'
                        : 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60'
                    }`}
                  >
                    <span>{formBanner.type === 'error' ? '⚠️' : '✓'}</span>
                    <span>{formBanner.text}</span>
                  </div>
                )}
              </div>

              {/* Session Column */}
              <div className="lg:col-span-3 card p-4 sm:p-5 flex flex-col">
                <h2 id="sTitle" className="font-bold capitalize text-base sm:text-lg">
                  {formattedSessionDate}
                </h2>

                {/* Stats */}
                <div id="sStats" className="grid grid-cols-3 gap-2 my-3">
                  <div className="sub text-center">
                    <div className="num text-xl sm:text-2xl font-bold leading-none truncate">
                      {dayExerciseCount}
                    </div>
                    <div className="text-[11px] sm:text-xs mut mt-1">Ejercicios</div>
                  </div>
                  <div className="sub text-center">
                    <div className="num text-xl sm:text-2xl font-bold leading-none truncate">
                      {dayTotalSets}
                    </div>
                    <div className="text-[11px] sm:text-xs mut mt-1">Series</div>
                  </div>
                  <div className="sub text-center">
                    <div className="num text-xl sm:text-2xl font-bold leading-none truncate">
                      {dayTotalVolume.toLocaleString('es-ES')} kg
                    </div>
                    <div className="text-[11px] sm:text-xs mut mt-1">Volumen</div>
                  </div>
                </div>

                {/* Logs List */}
                <ul
                  id="sList"
                  className="divide-y divide-slate-200 dark:divide-zinc-800 flex-1 overflow-y-auto max-h-[520px]"
                >
                  {dayLogs.length > 0 ? (
                    dayLogs.map((l) => {
                      const isConfirming = deleteConfirmId === l.id;
                      return (
                        <li
                          key={l.id}
                          className="flex items-start gap-2.5 sm:gap-3 py-3 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 px-2 rounded-xl transition"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-slate-900 dark:text-zinc-100 truncate text-sm sm:text-base">
                              {l.ex}
                            </div>
                            <div className="num flex items-baseline gap-1 mt-0.5">
                              <span className="text-xl sm:text-2xl font-bold">{l.kg}</span>
                              <span className="text-xs mut font-medium">kg</span>
                              <span className="mx-1 mut">|</span>
                              <span className="text-base sm:text-lg font-semibold">
                                {l.sets}×{l.reps}
                              </span>
                            </div>
                            {l.note && (
                              <p className="text-xs mut mt-1 break-words italic">
                                "{l.note}"
                              </p>
                            )}
                          </div>

                          <span
                            className={`num shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold ${rpeColorClass(
                              l.rpe
                            )}`}
                          >
                            RPE {l.rpe}
                          </span>

                          <button
                            type="button"
                            onClick={() => handleDeleteLog(l.id)}
                            className={`shrink-0 p-1.5 rounded-lg text-sm transition cursor-pointer ${
                              isConfirming
                                ? 'bg-red-600 text-white font-bold text-xs px-2'
                                : 'mut hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40'
                            }`}
                            title={isConfirming ? 'Haz clic otra vez para confirmar' : 'Eliminar serie'}
                            aria-label={isConfirming ? 'Confirmar eliminación' : 'Eliminar serie'}
                          >
                            {isConfirming ? '¿Borrar?' : '✕'}
                          </button>
                        </li>
                      );
                    })
                  ) : (
                    <div className="py-12 text-center text-slate-400 dark:text-zinc-500">
                      <p className="text-3xl mb-2">📋</p>
                      <p className="text-sm">
                        Aún no hay ejercicios este día. Registra el primero con el formulario.
                      </p>
                    </div>
                  )}
                </ul>
              </div>
            </section>
          )}

          {/* Tab 1: Progreso y Gráficos */}
          {activeTab === 1 && (
            <section className="space-y-5">
              {/* Card: Evolución de carga */}
              <div className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <h2 className="font-bold text-base sm:text-lg">Evolución de carga</h2>
                  <div className="flex gap-3 text-xs sm:text-sm">
                    <button
                      id="selAll"
                      type="button"
                      onClick={() => setSelectedEx(new Set(loggedExercises))}
                      className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline cursor-pointer"
                    >
                      Ver todos
                    </button>
                    <button
                      id="selNone"
                      type="button"
                      onClick={() => setSelectedEx(new Set())}
                      className="mut hover:underline cursor-pointer"
                    >
                      Quitar todos
                    </button>
                  </div>
                </div>

                {/* Exercise multiselect dropdown */}
                <div className="relative mb-3">
                  <button
                    ref={exBtnRef}
                    id="exBtn"
                    type="button"
                    aria-haspopup="true"
                    aria-expanded={isMenuOpen}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsMenuOpen((prev) => !prev);
                    }}
                    className="inp flex items-center justify-between text-left cursor-pointer"
                  >
                    <span id="exLbl" className="truncate font-medium">
                      {dropdownLabel}
                    </span>
                    <span className="mut ml-2">▾</span>
                  </button>

                  {isMenuOpen && (
                    <div
                      ref={exMenuRef}
                      id="exMenu"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 shadow-xl p-1.5"
                    >
                      {loggedExercises.length > 0 ? (
                        loggedExercises.map((e) => {
                          const checked = selectedEx.has(e);
                          const c = getExerciseColor(e);
                          return (
                            <label
                              key={e}
                              className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-700/80 transition"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(ev) => {
                                  const next = new Set(selectedEx);
                                  if (ev.target.checked) {
                                    next.add(e);
                                  } else {
                                    next.delete(e);
                                  }
                                  setSelectedEx(next);
                                }}
                                style={{ accentColor: c }}
                                className="w-4 h-4 cursor-pointer"
                              />
                              <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ background: c }}
                              />
                              <span className="truncate">{e}</span>
                            </label>
                          );
                        })
                      ) : (
                        <p className="p-3 text-xs mut text-center">
                          No hay ejercicios con registros aún.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Progress Summary Cards */}
                <div id="cStat" className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                  {progressStats.length > 0 ? (
                    progressStats.map((st) => (
                      <div key={st.name} className="sub">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: st.color }}
                          />
                          <span className="truncate text-sm font-semibold">
                            {st.name}
                          </span>
                        </div>
                        <div className="num mt-1 flex items-baseline gap-1.5 flex-wrap">
                          <span className="text-2xl font-bold">{st.current}</span>
                          <span className="text-xs mut font-medium">kg</span>
                          <span className="text-xs mut ml-2">
                            máx {st.maxVal} kg · {st.delta > 0 ? '+' : ''}
                            {st.delta} kg en total
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm mut py-4 col-span-full text-center">
                      Elige al menos un ejercicio arriba para ver su evolución.
                    </p>
                  )}
                </div>

                {/* Chart Canvas */}
                <div className="relative h-64 sm:h-80 md:h-96 w-full">
                  {selectedEx.size > 0 && loggedExercises.length > 0 ? (
                    <canvas ref={chartCanvasRef} id="cv" className="w-full h-full" />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-zinc-500 text-sm">
                      <span className="text-3xl mb-1">📈</span>
                      <span>Selecciona al menos un ejercicio arriba para generar el gráfico</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Card: Hall of Fame */}
              <div className="card p-4 sm:p-5">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-lg">🏆</span>
                  <h2 className="font-bold text-base sm:text-lg">
                    Hall of Fame · marcas personales
                  </h2>
                </div>
                <div
                  id="prs"
                  className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
                >
                  {personalRecords.length > 0 ? (
                    personalRecords.map((l, i) => (
                      <div key={l.ex} className="sub relative overflow-hidden">
                        <div className="flex justify-between items-center gap-2 text-sm">
                          <span className="truncate font-semibold">{l.ex}</span>
                          {i < 3 && (
                            <span
                              className="text-base shrink-0"
                              title={`Top ${i + 1}`}
                            >
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                            </span>
                          )}
                        </div>
                        <div className="num text-3xl font-bold text-emerald-600 dark:text-emerald-400 my-1">
                          {l.kg}
                          <span className="text-sm mut font-medium"> kg</span>
                        </div>
                        <div className="text-xs mut">
                          {l.sets}×{l.reps} · {labY(l.date)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm mut py-4 col-span-full text-center">
                      Registra ejercicios con peso para ver tus marcas.
                    </p>
                  )}
                </div>
              </div>

              {/* Card: Calendario */}
              <div className="card p-4 sm:p-5">
                <div className="flex items-center justify-between mb-3">
                  <button
                    id="pm"
                    type="button"
                    onClick={() => {
                      setCurrentMonthDate(
                        new Date(
                          currentMonthDate.getFullYear(),
                          currentMonthDate.getMonth() - 1,
                          1
                        )
                      );
                    }}
                    className="rounded-lg border border-slate-300 dark:border-zinc-700 w-9 h-9 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center cursor-pointer transition text-lg"
                    aria-label="Mes anterior"
                  >
                    ‹
                  </button>
                  <h2 id="mTitle" className="font-bold capitalize text-base sm:text-lg">
                    {currentMonthDate.toLocaleDateString('es-ES', {
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h2>
                  <button
                    id="nm"
                    type="button"
                    onClick={() => {
                      setCurrentMonthDate(
                        new Date(
                          currentMonthDate.getFullYear(),
                          currentMonthDate.getMonth() + 1,
                          1
                        )
                      );
                    }}
                    className="rounded-lg border border-slate-300 dark:border-zinc-700 w-9 h-9 hover:bg-slate-100 dark:hover:bg-zinc-800 flex items-center justify-center cursor-pointer transition text-lg"
                    aria-label="Mes siguiente"
                  >
                    ›
                  </button>
                </div>

                {/* Calendar Stats */}
                <div id="calStat" className="grid grid-cols-3 gap-2 mb-3">
                  <div className="sub text-center">
                    <div className="num text-xl sm:text-2xl font-bold leading-none">
                      {calendarStats.monthSessions}
                    </div>
                    <div className="text-[11px] sm:text-xs mut mt-1">
                      Sesiones del mes
                    </div>
                  </div>
                  <div className="sub text-center">
                    <div className="num text-xl sm:text-2xl font-bold leading-none">
                      {calendarStats.weekStreak}
                    </div>
                    <div className="text-[11px] sm:text-xs mut mt-1">
                      Semanas seguidas
                    </div>
                  </div>
                  <div className="sub text-center">
                    <div className="num text-xl sm:text-2xl font-bold leading-none">
                      {calendarStats.dayStreak}
                    </div>
                    <div className="text-[11px] sm:text-xs mut mt-1">
                      Días seguidos
                    </div>
                  </div>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-semibold mut mb-1.5">
                  <span>L</span>
                  <span>M</span>
                  <span>X</span>
                  <span>J</span>
                  <span>V</span>
                  <span>S</span>
                  <span>D</span>
                </div>

                {/* Day cells */}
                <div id="cal" className="grid grid-cols-7 gap-1.5">
                  {calendarGrid.map((item, idx) => {
                    if (!item.dateStr) {
                      return <div key={`empty-${idx}`} />;
                    }
                    return (
                      <button
                        key={item.dateStr}
                        type="button"
                        onClick={() => {
                          setFDate(item.dateStr!);
                          setActiveTab(0);
                        }}
                        title={
                          item.hasWorkout
                            ? `${item.count} registros`
                            : 'Sin entreno'
                        }
                        className={`aspect-square rounded-lg text-xs sm:text-sm num flex items-center justify-center transition cursor-pointer ${
                          item.hasWorkout
                            ? 'bg-emerald-500 text-white font-bold shadow-xs hover:bg-emerald-600'
                            : 'bg-slate-100 dark:bg-zinc-800 mut hover:bg-slate-200 dark:hover:bg-zinc-700'
                        } ${
                          item.isToday
                            ? 'ring-2 ring-slate-900 dark:ring-white ring-offset-1 font-extrabold'
                            : ''
                        }`}
                      >
                        {item.dayNum}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs mut mt-3 text-center sm:text-left">
                  Toca cualquier día para ver o registrar su sesión en el diario.
                </p>
              </div>
            </section>
          )}

          {/* Tab 2: Buscador de Ejercicios */}
          {activeTab === 2 && (
            <section className="space-y-4">
              <div className="card p-4 sm:p-5 space-y-3">
                <div className="relative">
                  <input
                    id="q"
                    className="inp pr-8"
                    placeholder="Buscar ejercicio por nombre, grupo o técnica…"
                    aria-label="Buscar ejercicio"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 text-sm font-bold p-1 cursor-pointer"
                      title="Limpiar búsqueda"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Group chips */}
                <div id="chips" className="flex flex-wrap gap-2">
                  {['Todos', ...G].map((g, i) => {
                    const isActive = i - 1 === groupFilter;
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => setGroupFilter(i - 1)}
                        className={`px-3 py-1.5 rounded-full text-xs sm:text-sm border transition cursor-pointer ${
                          isActive
                            ? 'bg-emerald-600 border-emerald-600 text-white font-semibold shadow-xs'
                            : 'border-slate-300 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-700 dark:text-zinc-300'
                        }`}
                      >
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Exercise Cards */}
              <div
                id="cards"
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              >
                {filteredExercises.length > 0 ? (
                  filteredExercises.map((e) => (
                    <div
                      key={e.n}
                      className="card p-4 flex flex-col gap-2 hover:shadow-md transition hover:border-emerald-500/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-sm sm:text-base">
                          {e.n}
                        </h3>
                        <span className="shrink-0 text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 font-medium">
                          {e.g}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm mut flex-1 leading-relaxed">
                        {e.t}
                      </p>
                      <button
                        type="button"
                        onClick={() => handleUseExercise(e.n)}
                        className="text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 font-semibold text-left hover:underline cursor-pointer pt-1 flex items-center gap-1"
                      >
                        <span>Registrar en el diario</span>
                        <span>→</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="py-12 text-center text-slate-400 dark:text-zinc-500 col-span-full card p-6">
                    <p className="text-3xl mb-2">🔍</p>
                    <p className="text-sm font-medium">
                      Ningún ejercicio coincide con tu búsqueda.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery('');
                        setGroupFilter(-1);
                      }}
                      className="mt-3 text-xs text-emerald-600 dark:text-emerald-400 font-semibold underline cursor-pointer"
                    >
                      Restablecer filtros
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Tab 3: Calculadora 1RM */}
          {activeTab === 3 && (
            <section className="max-w-xl mx-auto space-y-4">
              <div className="card p-4 sm:p-5 space-y-3.5">
                <h2 className="font-bold text-base sm:text-lg">1RM estimado</h2>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="lbl" htmlFor="cW">
                      Peso (kg) <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="cW"
                      type="number"
                      min="1"
                      max="600"
                      step="0.5"
                      className="inp num"
                      value={calcW}
                      onChange={(e) => setCalcW(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="lbl" htmlFor="cR">
                      Repeticiones <span className="text-red-500">*</span>
                    </label>
                    <input
                      id="cR"
                      type="number"
                      min="1"
                      max="30"
                      className="inp num"
                      value={calcR}
                      onChange={(e) => setCalcR(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="lbl" htmlFor="cF">
                      Fórmula
                    </label>
                    <select
                      id="cF"
                      className="inp cursor-pointer"
                      value={calcFormula}
                      onChange={(e) => setCalcFormula(e.target.value)}
                    >
                      <option value="m">Media (Epley + Brzycki)</option>
                      <option value="e">Epley</option>
                      <option value="b">Brzycki</option>
                    </select>
                  </div>
                </div>

                {calcError ? (
                  <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-medium">
                    ⚠️ {calcError}
                  </div>
                ) : oneRmResult ? (
                  <div id="cOut">
                    <div className="sub text-center py-4">
                      <div className="num text-4xl sm:text-5xl font-extrabold text-emerald-600 dark:text-emerald-400">
                        {oneRmResult.value.toFixed(1)}
                        <span className="text-lg mut font-medium"> kg</span>
                      </div>
                      <div className="text-xs mut mt-1 font-semibold uppercase tracking-wider">
                        1RM estimado
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div className="sub text-center">
                        <div className="num text-xl sm:text-2xl font-bold leading-none">
                          {oneRmResult.epley.toFixed(1)} kg
                        </div>
                        <div className="text-xs mut mt-1">Epley</div>
                      </div>
                      <div className="sub text-center">
                        <div className="num text-xl sm:text-2xl font-bold leading-none">
                          {oneRmResult.brzycki.toFixed(1)} kg
                        </div>
                        <div className="text-xs mut mt-1">Brzycki</div>
                      </div>
                    </div>
                    {oneRmResult.isHighReps && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 text-center">
                        ℹ️ Con más de 12 repeticiones la estimación de 1RM pierde precisión teórica.
                      </p>
                    )}
                  </div>
                ) : null}
              </div>

              <details open className="card p-4 sm:p-5">
                <summary className="font-bold text-base cursor-pointer select-none">
                  Porcentajes de trabajo
                </summary>
                <div className="overflow-x-auto">
                  <table className="w-full mt-3 text-sm">
                    <thead className="mut text-left border-b border-slate-200 dark:border-zinc-800">
                      <tr>
                        <th className="py-1.5 font-semibold">% 1RM</th>
                        <th className="font-semibold">Peso</th>
                        <th className="font-semibold">Reps aprox.</th>
                      </tr>
                    </thead>
                    <tbody
                      id="cTb"
                      className="divide-y divide-slate-200 dark:divide-zinc-800"
                    >
                      {oneRmResult ? (
                        oneRmResult.percentages.map((row) => (
                          <tr key={row.p}>
                            <td className="py-2 num font-medium">{row.p}%</td>
                            <td className="num font-bold text-emerald-600 dark:text-emerald-400">
                              {row.kg.toFixed(1)} kg
                            </td>
                            <td className="mut">~{row.reps} reps</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={3} className="py-3 text-xs mut text-center">
                            Introduce valores válidos arriba para calcular los porcentajes.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </details>
            </section>
          )}
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="max-w-5xl mx-auto px-3 sm:px-4 py-6 border-t border-slate-200 dark:border-zinc-800/80 w-full mt-auto">
        <div className="flex flex-wrap items-center justify-between gap-y-2 text-xs mut">
          <div className="flex items-center gap-1.5">
            <span>🔒</span>
            <span>
              {session
                ? `Conectado como ${session.email} (datos cifrados)`
                : 'Datos guardados de forma segura en este navegador.'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              id="exp"
              type="button"
              onClick={handleExportJSON}
              className="underline hover:text-slate-800 dark:hover:text-zinc-200 cursor-pointer"
            >
              Exportar como JSON
            </button>

            <button
              id="imp"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="underline hover:text-slate-800 dark:hover:text-zinc-200 cursor-pointer"
            >
              Importar desde JSON
            </button>
            <input
              ref={fileInputRef}
              id="impFile"
              type="file"
              accept=".json,application/json"
              onChange={handleImportFile}
              className="hidden"
              aria-label="Importar archivo JSON"
            />

            <button
              id="clr"
              type="button"
              onClick={handleClearAll}
              className={`underline cursor-pointer transition font-medium ${
                clearConfirmStep
                  ? 'text-red-500 font-bold scale-105'
                  : 'hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              {clearConfirmStep ? '¿Seguro? Pulsa otra vez para borrar' : 'Vaciar todo'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
