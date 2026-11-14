import { Component, type ErrorInfo, type ReactNode } from 'react';
import { repairStoredSquad } from '../utils/sanitizeSquad';

type Props = { children: ReactNode; label?: string };
type State = { error: Error | null; repaired: boolean | null };

/**
 * Catches a crash in one part of the app so the page shows what went wrong (and a repair button) instead of going
 * blank. Re-mount it with a changing `key` (e.g. the active tab) to reset it.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, repaired: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', (this as any).props.label || '', error, info.componentStack);
  }

  repair = () => {
    const changed = repairStoredSquad();
    (this as any).setState({ repaired: changed });
    // Re-render the children against the cleaned data.
    (this as any).setState({ error: null });
  };

  render() {
    if (!this.state.error) return (this as any).props.children;
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900 space-y-2">
        <div className="font-bold">{(this as any).props.label ? `${(this as any).props.label} hit a problem` : 'Something went wrong'}</div>
        <p className="text-xs">
          The rest of the app is fine. This usually means a saved record is in an unexpected shape. Try the repair below; if it
          keeps happening, a fresh sync from Battrick will replace the saved data.
        </p>
        <pre className="text-[10px] bg-white/70 border border-red-100 rounded p-2 overflow-x-auto whitespace-pre-wrap">
          {String(this.state.error?.message || this.state.error)}
        </pre>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={this.repair} className="px-3 py-1.5 rounded-lg bg-red-700 text-white text-xs font-bold">
            Repair saved squad data and retry
          </button>
          <button type="button" onClick={() => (this as any).setState({ error: null })} className="px-3 py-1.5 rounded-lg border border-red-300 text-xs font-bold">
            Try again
          </button>
        </div>
      </div>
    );
  }
}
