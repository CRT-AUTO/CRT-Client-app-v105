import React from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { ErrorFallbackProps, getUserFriendlyErrorMessage } from '../lib/errorHandling';

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetErrorBoundary }) => {
  const friendlyMessage = getUserFriendlyErrorMessage(error);
  
  return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-md">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <AlertCircle className="h-5 w-5 text-red-400" aria-hidden="true" />
        </div>
        <div className="ml-3 w-0 flex-1">
          <h3 className="text-sm font-medium text-red-800">
            Something went wrong
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>{friendlyMessage}</p>
            {process.env.NODE_ENV === 'development' && (
              <pre className="mt-2 text-xs bg-red-100 p-2 rounded overflow-auto">
                {error.stack}
              </pre>
            )}
          </div>
          <div className="mt-4">
            <button
              type="button"
              onClick={resetErrorBoundary}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              <RefreshCcw className="h-4 w-4 mr-1" />
              Try again
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ErrorFallback;