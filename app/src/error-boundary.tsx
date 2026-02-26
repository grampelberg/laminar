import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error?: unknown
  errorInfo?: ErrorInfo
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: unknown): State {
    return { error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    globalThis.console.error('ErrorBoundary caught error', error, info)
    this.setState({ errorInfo: info })
  }

  render() {
    const { error } = this.state
    if (error) {
      const errorObject = error instanceof Error ? error : undefined
      const errorMessage =
        errorObject?.message ?? (typeof error === 'string' ? error : '')
      const errorName = errorObject?.name ?? 'Error'
      const errorStack = errorObject?.stack
      const fallbackMessage =
        errorMessage || 'An unexpected error occurred. See console for details.'
      return (
        <main className="w-full p-6">
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <h1 className="text-lg font-semibold text-red-900">
              Something went wrong
            </h1>
            <div className="mt-2 text-red-800">
              {errorMessage ? `${errorName}: ${errorMessage}` : fallbackMessage}
            </div>
            {errorStack && (
              <pre className="mt-3 max-h-[50vh] overflow-auto rounded bg-white/70 p-3 text-xs whitespace-pre-wrap text-red-900">
                {errorStack}
              </pre>
            )}
            {this.state.errorInfo?.componentStack && (
              <pre className="mt-3 max-h-[40vh] overflow-auto rounded bg-white/70 p-3 text-xs whitespace-pre-wrap text-red-900">
                {this.state.errorInfo.componentStack}
              </pre>
            )}
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
