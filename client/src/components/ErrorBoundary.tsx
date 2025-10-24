import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useGameStore } from '../lib/stores/useGameStore';

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // Report to game store for potential recovery
    useGameStore.getState().setGameState('paused');
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return React.createElement('div', {
        className: 'flex flex-col items-center justify-center min-h-screen bg-black text-red-400 font-mono p-8'
      },
        React.createElement('div', { className: 'text-center' },
          React.createElement('div', { className: 'text-6xl mb-4' }, '⚠️'),
          React.createElement('h1', { className: 'text-2xl mb-4' }, 'System Error'),
          React.createElement('p', { className: 'mb-6 text-gray-300' }, 'A critical error occurred in the Cultural Arcade system.'),
          React.createElement('div', { className: 'space-y-2' },
            React.createElement('button', {
              onClick: () => window.location.reload(),
              className: 'bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded mr-4'
            }, 'Restart System'),
            React.createElement('button', {
              onClick: () => useGameStore.getState().setCurrentScreen('menu'),
              className: 'bg-gray-600 hover:bg-gray-700 text-white px-6 py-2 rounded'
            }, 'Return to Menu')
          ),
          process.env.NODE_ENV === 'development' && this.state.error && React.createElement('details', {
            className: 'mt-6 text-left text-xs text-gray-500'
          },
            React.createElement('summary', { className: 'cursor-pointer' }, 'Error Details (Development)'),
            React.createElement('pre', {
              className: 'mt-2 p-2 bg-gray-900 rounded text-xs overflow-auto'
            },
              this.state.error.toString(),
              this.state.errorInfo?.componentStack
            )
          )
        )
      );
    }

    return React.createElement(React.Fragment, {}, this.props.children);
  }
}

// Hook version for functional components
export function useErrorHandler() {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    console.error('Error caught by useErrorHandler:', error, errorInfo);

    // Pause game state on error
    useGameStore.getState().setGameState('paused');

    // In development, show error in console
    if (process.env.NODE_ENV === 'development') {
      console.group('🚨 Game Error');
      console.error(error);
      if (errorInfo?.componentStack) {
        console.error('Component Stack:', errorInfo.componentStack);
      }
      console.groupEnd();
    }
  };
}
