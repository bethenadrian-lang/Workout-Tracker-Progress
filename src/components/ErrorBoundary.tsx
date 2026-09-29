import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[300px] flex flex-col items-center justify-center p-6 text-center bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100">
          <div className="card max-w-md p-6 border-red-200 dark:border-red-900/60 shadow-lg">
            <span className="text-4xl mb-3 block">⚠️</span>
            <h2 className="text-lg font-bold text-red-600 dark:text-red-400 mb-2">
              Se ha producido un error al cargar la vista
            </h2>
            <p className="text-xs text-slate-600 dark:text-zinc-400 mb-4">
              {this.state.error?.message || 'Error inesperado al renderizar el componente.'}
            </p>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="btn text-xs font-semibold px-4 py-2 cursor-pointer"
            >
              Recargar la aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
