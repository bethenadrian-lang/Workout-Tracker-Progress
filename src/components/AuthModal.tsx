import React, { useState, useEffect } from 'react';
import {
  loginUser,
  registerUser,
  validateEmail,
  validatePassword,
  demoLogin,
} from '../services/auth';
import { AuthSession } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (session: AuthSession) => void;
  initialMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setMode(initialMode);
    setError(null);
  }, [initialMode, isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const emailVal = validateEmail(email);
    if (!emailVal.valid) {
      setError(emailVal.error || 'Correo electrónico inválido.');
      return;
    }

    const passVal = validatePassword(password);
    if (!passVal.valid) {
      setError(passVal.error || 'Contraseña inválida.');
      return;
    }

    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('Las contraseñas no coinciden. Por favor verifícalas.');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        const res = await registerUser(email, password, name);
        if (res.success && res.session) {
          onSuccess(res.session);
          onClose();
        } else {
          setError(res.error || 'Error al crear la cuenta.');
        }
      } else {
        const res = await loginUser(email, password);
        if (res.success && res.session) {
          onSuccess(res.session);
          onClose();
        } else {
          setError(res.error || 'Error al iniciar sesión.');
        }
      }
    } catch (err: any) {
      setError(`Ocurrió un error: ${err.message || 'Error de autenticación'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await demoLogin();
      if (res.success && res.session) {
        onSuccess(res.session);
        onClose();
      } else {
        setError(res.error || 'Error al iniciar cuenta demo.');
      }
    } catch {
      setError('Error al iniciar cuenta demo.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 dark:bg-black/80 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-md p-5 sm:p-6 bg-white dark:bg-zinc-900 shadow-2xl relative my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 text-xl font-bold p-1 leading-none cursor-pointer"
          aria-label="Cerrar"
        >
          ✕
        </button>

        {/* Mode Switcher Tabs */}
        <div className="mb-5 text-center">
          <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-zinc-800 mb-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 sm:flex-initial px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition cursor-pointer ${
                mode === 'register'
                  ? 'bg-white dark:bg-zinc-900 text-slate-900 dark:text-zinc-100 shadow-xs'
                  : 'text-slate-500 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
            >
              Crear cuenta nueva
            </button>
          </div>

          <h2 id="auth-modal-title" className="text-lg sm:text-xl font-bold tracking-tight">
            {mode === 'login' ? 'Acceder a tu cuenta' : 'Crear tu cuenta de entreno'}
          </h2>
          <p className="text-xs mut mt-1">
            {mode === 'login'
              ? 'Tus entrenamientos y récords guardados de forma segura.'
              : 'Empieza a registrar tus entrenamientos con tu perfil personalizado.'}
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 text-xs font-medium flex items-start gap-2"
          >
            <span className="font-bold text-sm">⚠️</span>
            <div className="flex-1">
              <span>{error}</span>
              {mode === 'login' && error.includes('No se encontró') && (
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className="block mt-1 font-bold underline cursor-pointer text-emerald-600 dark:text-emerald-400"
                >
                  ¿Quieres crear esta cuenta ahora? Pulsa aquí
                </button>
              )}
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <div>
              <label className="lbl" htmlFor="auth-name">
                Nombre o apodo (opcional)
              </label>
              <input
                id="auth-name"
                type="text"
                className="inp"
                placeholder="Ej. Adrián"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
              />
            </div>
          )}

          <div>
            <label className="lbl" htmlFor="auth-email">
              Correo electrónico <span className="text-red-500">*</span>
            </label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              className="inp"
              placeholder="tu@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="lbl mb-0" htmlFor="auth-password">
                Contraseña <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                {showPassword ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <input
              id="auth-password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              className="inp"
              placeholder={mode === 'register' ? 'Mínimo 4 caracteres' : 'Tu contraseña'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === 'register' && (
            <div>
              <label className="lbl" htmlFor="auth-confirm-password">
                Confirmar contraseña <span className="text-red-500">*</span>
              </label>
              <input
                id="auth-confirm-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="new-password"
                className="inp"
                placeholder="Repite tu contraseña"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn w-full flex items-center justify-center gap-2 cursor-pointer mt-2 disabled:opacity-50 font-semibold"
          >
            {loading ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Guardando…</span>
              </>
            ) : mode === 'login' ? (
              'Iniciar sesión'
            ) : (
              'Crear mi cuenta ahora'
            )}
          </button>
        </form>

        {/* Switch mode links */}
        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-zinc-800 text-center space-y-2">
          {mode === 'login' ? (
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              ¿No tienes una cuenta aún?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setError(null);
                }}
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Crear cuenta gratis
              </button>
            </p>
          ) : (
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              ¿Ya estás registrado?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
              >
                Inicia sesión aquí
              </button>
            </p>
          )}

          {/* Quick Demo Button */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleQuickDemo}
              disabled={loading}
              className="text-xs py-1.5 px-3 rounded-lg border border-dashed border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-medium transition cursor-pointer w-full"
            >
              ⚡ Probar al instante con cuenta de demostración
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
