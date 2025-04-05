import React, { Component, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { getUserFriendlyErrorMessage } from '../lib/errorHandling';

interface RetryableErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
  maxRetries?: number;
}

interface RetryableErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

class RetryableErrorBoundary extends Component<RetryableErrorBoundaryProps, RetryableErrorBoundaryState> {
  constructor(props: RetryableErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error: Error): Partial<RetryableErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    console.error('Error caught by RetryableErrorBoundary:', error, errorInfo);
  }

  handleRetry = (): void => {
    const { maxRetries = 3, onRetry } = this.props;
    const { retryCount } = this.state;
    
    if (retryCount < maxRetries) {
      this.setState(prevState => ({
        hasError: false,
        error: null,
        retryCount: prevState.retryCount + 1
      }));
      
      if (onRetry) {
        onRetry();
      }
    } else {
      alert('Maximum retry attempts reached. Please refresh the page and try again.');
    }
  };

  render(): ReactNode {
    const { children, maxRetries = 3 } = this.props;
    const { hasError, error, retryCount } = this.state;

    if (hasError && error) {
      const friendlyMessage = getUserFriendlyErrorMessage(error);
      
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
            </div>
            <div className="ml-3 w-0 flex-1">
              <h3 className="text-sm font-medium text-red-800">
                An error occurred
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{friendlyMessage}</p>
                <p className="mt-1">
                  Retry attempt {retryCount} of {maxRetries}
                </p>
              </div>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={this.handleRetry}
                  disabled={retryCount >= maxRetries}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50"
                >
                  <RefreshCcw className="h-4 w-4 mr-1" />
                  {retryCount < maxRetries ? 'Try again' : 'Max retries reached'}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return children;
  }
}

export default RetryableErrorBoundary;