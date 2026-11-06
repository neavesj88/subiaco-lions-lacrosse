// =============================================================================
// ErrorBoundary — client/src/components/error-boundary.tsx
// =============================================================================
// A safety net for the whole site. If any page crashes with an unexpected
// JavaScript error, React normally unmounts EVERYTHING and the visitor sees a
// blank white screen with no explanation — the worst possible experience for
// a club member (and impossible for a non-technical maintainer to diagnose).
//
// This component catches such crashes and instead shows a friendly
// "something went wrong" card with a Reload button, plus the technical error
// message in small print so whoever maintains the site can report it.
//
// This must be a CLASS component — error boundaries are the one React feature
// that still requires classes (hooks can't catch render errors).
// =============================================================================

import { Component, type ReactNode } from "react";

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  // React calls this when any child component throws during render
  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Log to the browser console so it shows up if a maintainer opens DevTools
    console.error("[error-boundary] Page crashed:", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center bg-stone-50 px-4 py-12">
          <div className="max-w-md w-full bg-white rounded-xl border shadow-sm p-8 text-center">
            <div className="w-14 h-14 rounded-full bg-maroon-100 text-maroon-700 flex items-center justify-center mx-auto mb-4 text-2xl">
              ⚠️
            </div>
            <h1 className="text-xl font-bold text-stone-900 mb-2">Something went wrong</h1>
            <p className="text-sm text-stone-500 mb-6">
              Sorry — this page hit an unexpected error. Reloading usually fixes it.
              If it keeps happening, let the site administrator know.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-maroon-700 hover:bg-maroon-800 text-white font-medium text-sm px-6 py-2.5 rounded-md transition-colors"
            >
              Reload Page
            </button>
            {/* Technical detail for whoever maintains the site — safe to screenshot */}
            <p className="mt-6 text-xs text-stone-500 font-mono break-all">
              {this.state.error.message}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
