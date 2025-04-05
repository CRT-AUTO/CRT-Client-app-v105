import React, { Component, ReactNode } from 'react';
import * as Sentry from '@sentry/react';
import ErrorFallback from './ErrorFallback';
import { captureError } from '../lib/sentry';

interface AppErrorBoundaryProps {
  children: ReactNode;
  fallback?: (props: { error: Error; resetErrorBoundary: () => void }) => ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log the error to an error reporting service
    console.error('Error caught by AppErrorBoundary:', error, errorInfo);
    
    // Report to Sentry in production
    captureError(error, { 
      errorInfo,
      component: 'AppErrorBoundary'
    });
  }

  resetErrorBoundary = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided, otherwise use default ErrorFallback
      if (this.props.fallback) {
        return this.props.fallback({
          error: this.state.error,
          resetErrorBoundary: this.resetErrorBoundary
        });
      }
      
      return (
        <ErrorFallback 
          error={this.state.error} 
          resetErrorBoundary={this.resetErrorBoundary} 
        />
      );
    }

    return this.props.children;
  }
}

// For production, wrap with Sentry's error boundary
export default import.meta.env.PROD 
  ? Sentry.withErrorBoundary(AppErrorBoundary, {
      fallback: (props) => (
        <ErrorFallback 
          error={props.error} 
          resetErrorBoundary={props.resetErrorBoundary} 
        />
      ),
    })
  : AppErrorBoundary;