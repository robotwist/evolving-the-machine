import React, { Component, ErrorInfo, ReactNode } from 'react';
import { useGameStore } from '../lib/stores/useGameStore';

interface GameErrorBoundaryProps {
  children?: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  gameId?: string;
}

interface GameErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

export class GameErrorBoundary extends Component<GameErrorBoundaryProps, GameErrorBoundaryState> {
  private maxRetries = 3;
  private retryTimeout?: NodeJS.Timeout;

  public state: GameErrorBoundaryState = {
    hasError: false,
    retryCount: 0,
  };

  public static getDerivedStateFromError(error: Error): Partial<GameErrorBoundaryState> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`GameErrorBoundary caught an error in game ${this.props.gameId}:`, error, errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Pause game state on error
    useGameStore.getState().setGameState('paused');

    // Report error to analytics/monitoring (if available)
    this.reportError(error, errorInfo);
  }

  private reportError = (error: Error, errorInfo: ErrorInfo) => {
    // In a real application, you would send this to your error reporting service
    // For now, we'll just log it with additional context
    const errorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      gameId: this.props.gameId,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    };

    console.error('Error Report:', errorReport);
    
    // You could send this to a service like Sentry, LogRocket, etc.
    // Example: Sentry.captureException(error, { extra: errorReport });
  };

  private handleRetry = () => {
    if (this.state.retryCount < this.maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: undefined,
        errorInfo: undefined,
        retryCount: prevState.retryCount + 1,
      }));
    } else {
      // Max retries reached, reload the page
      window.location.reload();
    }
  };

  private handleRestart = () => {
    // Reset game state and return to menu
    const gameStore = useGameStore.getState();
    gameStore.setGameState('playing');
    gameStore.setCurrentScreen('main-menu');
    
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0,
    });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const canRetry = this.state.retryCount < this.maxRetries;
      const retryText = canRetry ? `Retry (${this.state.retryCount + 1}/${this.maxRetries})` : 'Reload Page';

      return React.createElement('div', {
        className: 'flex flex-col items-center justify-center min-h-screen bg-gradient-to-b from-red-900 via-black to-red-900 text-red-400 font-mono p-8'
      },
        React.createElement('div', { className: 'text-center max-w-2xl' },
          React.createElement('div', { className: 'text-8xl mb-6 animate-pulse' }, '🎮'),
          React.createElement('h1', { className: 'text-3xl mb-4 font-bold' }, 'Game System Error'),
          React.createElement('p', { className: 'mb-6 text-gray-300 text-lg' }, 
            'The game encountered an unexpected error. Don\'t worry, your progress is safe!'
          ),
          
          // Error context
          this.props.gameId && React.createElement('div', { 
            className: 'mb-6 p-4 bg-red-900/30 rounded-lg border border-red-500/30' 
          },
            React.createElement('p', { className: 'text-sm text-red-300' }, 
              `Game: ${this.props.gameId}`
            ),
            React.createElement('p', { className: 'text-xs text-gray-400 mt-1' }, 
              `Retry attempt: ${this.state.retryCount + 1}/${this.maxRetries}`
            )
          ),

          // Action buttons
          React.createElement('div', { className: 'space-y-3' },
            React.createElement('button', {
              onClick: this.handleRetry,
              className: `px-8 py-3 rounded-lg font-semibold transition-all ${
                canRetry 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                  : 'bg-orange-600 hover:bg-orange-700 text-white'
              }`
            }, retryText),
            
            React.createElement('button', {
              onClick: this.handleRestart,
              className: 'px-8 py-3 rounded-lg font-semibold bg-gray-600 hover:bg-gray-700 text-white transition-all'
            }, 'Return to Menu'),
            
            React.createElement('button', {
              onClick: () => window.location.reload(),
              className: 'px-8 py-3 rounded-lg font-semibold bg-red-600 hover:bg-red-700 text-white transition-all'
            }, 'Restart Application')
          ),

          // Development error details
          process.env.NODE_ENV === 'development' && this.state.error && React.createElement('details', {
            className: 'mt-8 text-left text-xs text-gray-500 w-full'
          },
            React.createElement('summary', { 
              className: 'cursor-pointer text-red-400 hover:text-red-300' 
            }, '🔍 Error Details (Development Mode)'),
            React.createElement('div', {
              className: 'mt-4 p-4 bg-gray-900 rounded-lg border border-gray-700'
            },
              React.createElement('div', { className: 'mb-3' },
                React.createElement('strong', { className: 'text-red-400' }, 'Error: '),
                React.createElement('span', { className: 'text-gray-300' }, this.state.error.message)
              ),
              React.createElement('div', { className: 'mb-3' },
                React.createElement('strong', { className: 'text-red-400' }, 'Stack: '),
                React.createElement('pre', {
                  className: 'mt-1 text-xs text-gray-400 overflow-auto max-h-32'
                }, this.state.error.stack)
              ),
              this.state.errorInfo?.componentStack && React.createElement('div', {},
                React.createElement('strong', { className: 'text-red-400' }, 'Component Stack: '),
                React.createElement('pre', {
                  className: 'mt-1 text-xs text-gray-400 overflow-auto max-h-32'
                }, this.state.errorInfo.componentStack)
              )
            )
          )
        )
      );
    }

    return React.createElement(React.Fragment, {}, this.props.children);
  }
}

// Hook for functional components to handle errors
export function useGameErrorHandler(gameId?: string) {
  return (error: Error, errorInfo?: { componentStack?: string }) => {
    console.error(`Game error in ${gameId || 'unknown game'}:`, error, errorInfo);

    // Pause game state on error
    useGameStore.getState().setGameState('paused');

    // In development, show detailed error info
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Game Error${gameId ? ` (${gameId})` : ''}`);
      console.error('Error:', error);
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
      if (errorInfo?.componentStack) {
        console.error('Component Stack:', errorInfo.componentStack);
      }
      console.groupEnd();
    }

    // Report error (in a real app, this would go to your error reporting service)
    const errorReport = {
      gameId,
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
    };
    
    console.error('Error Report:', errorReport);
  };
}

// Higher-order component for wrapping game components
export function withGameErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  gameId?: string
) {
  return function WrappedComponent(props: P) {
    return React.createElement(GameErrorBoundary, { gameId },
      React.createElement(Component, props)
    );
  };
}
