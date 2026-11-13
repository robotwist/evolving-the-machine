import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary, useErrorHandler } from '../ErrorBoundary';
import { useGameStore } from '../../lib/stores/useGameStore';

// Mock the game store
jest.mock('../../lib/stores/useGameStore', () => ({
  useGameStore: {
    getState: jest.fn(() => ({
      setGameState: jest.fn(),
      setCurrentScreen: jest.fn(),
    })),
  },
}));

// Test component that throws an error
const ThrowError: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return React.createElement('div', {}, 'No error');
};

// Test component that uses the error handler hook
const TestErrorHandler: React.FC = () => {
  const handleError = useErrorHandler();

  return React.createElement('div', {},
    React.createElement('button', {
      onClick: () => handleError(new Error('Hook test error'))
    }, 'Trigger Error'),
    React.createElement('div', { 'data-testid': 'error-handler-test' }, 'Hook test component')
  );
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    // Clear console.error mock
    jest.clearAllMocks();
    // Mock console methods
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should render children when there is no error', () => {
    render(
      React.createElement(ErrorBoundary, {},
        React.createElement(ThrowError, { shouldThrow: false })
      )
    );

    expect(screen.getByText('No error')).toBeInTheDocument();
  });

  it('should render error UI when there is an error', () => {
    // Suppress console.error for this test
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      React.createElement(ErrorBoundary, {},
        React.createElement(ThrowError, { shouldThrow: true })
      )
    );

    expect(screen.getByText('System Error')).toBeInTheDocument();
    expect(screen.getByText('A critical error occurred in the Cultural Arcade system.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Restart System' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to Menu' })).toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it('should render custom fallback when provided', () => {
    const customFallback = React.createElement('div', {}, 'Custom error fallback');

    render(
      React.createElement(ErrorBoundary, { fallback: customFallback },
        React.createElement(ThrowError, { shouldThrow: true })
      )
    );

    expect(screen.getByText('Custom error fallback')).toBeInTheDocument();
  });

  it('should call game store methods when error occurs', () => {
    const setGameState = jest.fn();
    const setCurrentScreen = jest.fn();

    (useGameStore.getState as jest.Mock).mockReturnValue({
      setGameState,
      setCurrentScreen,
    });

    render(
      React.createElement(ErrorBoundary, {},
        React.createElement(ThrowError, { shouldThrow: true })
      )
    );

    expect(setGameState).toHaveBeenCalledWith('paused');
  });

  it('should show error details in development mode', () => {
    // Mock development environment
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    render(
      React.createElement(ErrorBoundary, {},
        React.createElement(ThrowError, { shouldThrow: true })
      )
    );

    expect(screen.getByText('Error Details (Development)')).toBeInTheDocument();

    // Restore original environment
    process.env.NODE_ENV = originalEnv;
  });

  it('should reload page when restart button is clicked', () => {
    // jsdom's window.location is non-configurable, so reload() can't be mocked;
    // instead assert on the "navigation not implemented" error jsdom emits.
    const virtualConsole = (window as unknown as {
      _virtualConsole: {
        on: (event: string, listener: (error: Error) => void) => void;
        off: (event: string, listener: (error: Error) => void) => void;
      };
    })._virtualConsole;
    const jsdomErrors: string[] = [];
    const recordError = (error: Error) => jsdomErrors.push(error.message);

    render(
      React.createElement(ErrorBoundary, {},
        React.createElement(ThrowError, { shouldThrow: true })
      )
    );

    virtualConsole.on('jsdomError', recordError);
    fireEvent.click(screen.getByRole('button', { name: 'Restart System' }));
    virtualConsole.off('jsdomError', recordError);

    expect(jsdomErrors).toContain('Not implemented: navigation (except hash changes)');
  });

  it('should handle error through useErrorHandler hook', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleGroupSpy = jest.spyOn(console, 'group').mockImplementation(() => {});
    const consoleGroupEndSpy = jest.spyOn(console, 'groupEnd').mockImplementation(() => {});

    render(React.createElement(TestErrorHandler));

    expect(screen.getByTestId('error-handler-test')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Trigger Error' }));

    expect(consoleSpy).toHaveBeenCalledWith('Error caught by useErrorHandler:', expect.any(Error), undefined);
    expect(consoleGroupSpy).toHaveBeenCalledWith('Game Error');

    consoleSpy.mockRestore();
    consoleGroupSpy.mockRestore();
    consoleGroupEndSpy.mockRestore();
    process.env.NODE_ENV = originalEnv;
  });
});
