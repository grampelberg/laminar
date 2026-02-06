import { Component, type ErrorInfo, type ReactNode } from 'react'

type Props = {
  children: ReactNode
}

type State = {
  error?: unknown
  errorInfo?: ErrorInfo
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = {}

  static getDerivedStateFromError(error: unknown): State {
    return { error }
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('ErrorBoundary caught error', error, info)
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
            <h1 className="text-red-900 text-lg font-semibold">
              Something went wrong
            </h1>
            <div className="mt-2 text-red-800">
              {errorMessage ? `${errorName}: ${errorMessage}` : fallbackMessage}
            </div>
            {errorStack ? (
              <pre className="mt-3 max-h-[50vh] overflow-auto whitespace-pre-wrap rounded bg-white/70 p-3 text-xs text-red-900">
                {errorStack}
              </pre>
            ) : null}
            {this.state.errorInfo?.componentStack ? (
              <pre className="mt-3 max-h-[40vh] overflow-auto whitespace-pre-wrap rounded bg-white/70 p-3 text-xs text-red-900">
                {this.state.errorInfo.componentStack}
              </pre>
            ) : null}
          </div>
        </main>
      )
    }

    return this.props.children
  }
}
