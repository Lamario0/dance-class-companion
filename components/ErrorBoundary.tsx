import * as React from 'react';

interface Props {
  children?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      let errorMessage = this.state.error?.message || 'An unknown error occurred';
      let isFirestoreError = false;

      try {
        const parsed = JSON.parse(errorMessage);
        if (parsed.operationType && parsed.error) {
          isFirestoreError = true;
          errorMessage = `Firestore Permission Error: Could not perform '${parsed.operationType}' on '${parsed.path}'. ${parsed.error}`;
        }
      } catch (e) {
        // Not a JSON string, ignore
      }

      return (
        <div className="min-h-screen bg-surface-0 flex items-center justify-center p-4">
          <div className="card p-8 max-w-md w-full text-center">
            <svg viewBox="0 0 32 32" className="mx-auto mb-5 h-14 w-14 text-violet-300" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M8.6 17.8c-2.6.3-4.3-2.6-4.4-6.1C4 7.9 5.4 4.6 7.9 4.4c2.6-.2 3.8 3 3.7 6.6-.1 3.4-.6 6.5-3 6.8Z" />
              <path d="M23.4 25.8c2.6.3 4.3-2.6 4.4-6.1.2-3.8-1.2-7.1-3.7-7.3-2.6-.2-3.8 3-3.7 6.6.1 3.4.6 6.5 3 6.8Z" />
            </svg>
            <h2 className="text-xl font-bold text-text-hi mb-2">Oops — we tripped over our own feet.</h2>
            <p className="text-text-mid mb-5">Reloading usually gets things moving again.</p>
            <details className="mb-6 text-left">
              <summary className="cursor-pointer text-[14px] text-text-lo">Technical details</summary>
              <div className="mt-2 rounded-sm bg-surface-0 p-3 overflow-auto max-h-48">
                <p className="text-[13px] text-rose-300 font-mono">{errorMessage}</p>
              </div>
            </details>
            <button
              className="btn-primary press w-full"
              onClick={() => window.location.reload()}
            >
              Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
