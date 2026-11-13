import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useGameStore } from '../lib/stores/useGameStore';
import { buttonVariants } from './ui/button';

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
        className: 'arcade-screen flex flex-col items-center justify-center min-h-screen text-neon-red p-8'
      },
        React.createElement('div', { className: 'arcade-panel panel-red text-center p-8' },
          React.createElement('h1', { className: 'arcade-title text-xl mb-6 text-neon-red' }, 'System Error'),
          React.createElement('p', { className: 'mb-6 text-white/80 text-xl' }, 'A critical error occurred in the Cultural Arcade system.'),
          React.createElement('div', { className: 'flex flex-col sm:flex-row gap-3 justify-center' },
            React.createElement('button', {
              onClick: () => window.location.reload(),
              className: buttonVariants({ variant: 'destructive' })
            }, 'Restart System'),
            React.createElement('button', {
              onClick: () => useGameStore.getState().setCurrentScreen('menu'),
              className: buttonVariants({ variant: 'outline' })
            }, 'Return to Menu')
          ),
          process.env.NODE_ENV === 'development' && this.state.error && React.createElement('details', {
            className: 'mt-6 text-left text-xs text-gray-500'
          },
            React.createElement('summary', { className: 'cursor-pointer' }, 'Error Details (Development)'),
            React.createElement('pre', {
              className: 'mt-2 p-2 bg-black border-2 border-white/20 text-xs overflow-auto'
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
      console.group('Game Error');
      console.error(error);
      if (errorInfo?.componentStack) {
        console.error('Component Stack:', errorInfo.componentStack);
      }
      console.groupEnd();
    }
  };
}
