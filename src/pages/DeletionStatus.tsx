import React, { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle, ArrowLeft } from 'lucide-react';

export default function DeletionStatus() {
  const [status, setStatus] = useState<'pending' | 'completed' | 'error'>('pending');
  const [confirmationCode, setConfirmationCode] = useState<string | null>(null);
  const location = useLocation();

  useEffect(() => {
    // Extract confirmation code from URL
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    setConfirmationCode(code);
    
    // In a real implementation, you would fetch the actual status from your API
    // For this demo, we'll simulate a completed deletion after 2 seconds
    if (code) {
      const timer = setTimeout(() => {
        setStatus('completed');
      }, 2000);
      
      return () => clearTimeout(timer);
    } else {
      setStatus('error');
    }
  }, [location]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          {status === 'completed' ? (
            <CheckCircle className="h-12 w-12 text-green-600" />
          ) : status === 'error' ? (
            <AlertTriangle className="h-12 w-12 text-red-600" />
          ) : (
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          )}
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Data Deletion Status
        </h2>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {status === 'pending' && (
            <div className="text-center">
              <p className="mb-4 text-gray-700">
                We're processing your data deletion request.
              </p>
              {confirmationCode && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-500">Confirmation Code:</p>
                  <p className="text-lg font-mono font-medium text-gray-900">{confirmationCode}</p>
                </div>
              )}
              <div className="mt-6 flex items-center justify-center">
                <div className="animate-pulse flex space-x-2">
                  <div className="h-2 w-2 bg-indigo-600 rounded-full"></div>
                  <div className="h-2 w-2 bg-indigo-600 rounded-full"></div>
                  <div className="h-2 w-2 bg-indigo-600 rounded-full"></div>
                </div>
              </div>
            </div>
          )}

          {status === 'completed' && (
            <div className="text-center">
              <div className="bg-green-50 p-4 rounded-md mb-4">
                <p className="text-green-800">
                  Your data has been successfully deleted.
                </p>
              </div>
              {confirmationCode && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <p className="text-sm text-gray-500">Confirmation Code:</p>
                  <p className="text-lg font-mono font-medium text-gray-900">{confirmationCode}</p>
                </div>
              )}
              <p className="mt-4 text-sm text-gray-500">
                All personal data associated with your account has been removed from our systems.
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="bg-red-50 p-4 rounded-md mb-4">
                <p className="text-red-800">
                  There was an issue processing your data deletion request.
                </p>
              </div>
              <p className="mt-4 text-sm text-gray-500">
                Please try again or contact our support team for assistance.
              </p>
            </div>
          )}

          <div className="mt-6">
            <Link to="/" className="flex items-center justify-center text-sm text-indigo-600 hover:text-indigo-500">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}