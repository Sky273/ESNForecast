import { Component, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-red-200 bg-red-50 p-5">
          <div className="text-base font-semibold text-red-900">L'ecran n'a pas pu etre affiche.</div>
          <div className="mt-2 text-sm text-red-800">{this.state.error.message}</div>
          <button className="mt-4 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-medium text-red-900" onClick={() => this.setState({ error: undefined })}>
            Reessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

