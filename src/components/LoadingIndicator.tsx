import React from 'react';

interface LoadingIndicatorProps {
  size?: 'small' | 'medium' | 'large';
  fullScreen?: boolean;
  message?: string;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ 
  size = 'medium', 
  fullScreen = false,
  message
}) => {
  const getSize = () => {
    switch(size) {
      case 'small': return 'h-5 w-5';
      case 'large': return 'h-12 w-12';
      default: return 'h-8 w-8';
    }
  };

  const spinner = (
    <div className={`animate-spin rounded-full border-b-2 border-indigo-600 ${getSize()}`}></div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-gray-50 bg-opacity-75 flex items-center justify-center z-50">
        <div className="text-center">
          {spinner}
          {message && <p className="mt-3 text-sm text-gray-600">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center items-center p-4">
      {spinner}
      {message && <p className="ml-3 text-sm text-gray-600">{message}</p>}
    </div>
  );
};

export default LoadingIndicator;