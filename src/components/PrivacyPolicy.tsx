import React from 'react';
import { ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <Link to="/" className="flex items-center text-sm text-indigo-600 hover:text-indigo-500">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Home
          </Link>
        </div>
        
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
            <p className="mt-1 text-sm text-gray-500">Last updated: {new Date().toLocaleDateString()}</p>
          </div>
          
          <div className="px-4 py-5 sm:p-6 prose max-w-none">
            <h2 className="text-xl font-semibold text-gray-900">Introduction</h2>
            <p>
              This Privacy Policy describes how we collect, use, and handle your information when you use our AI Assistant Platform.
              We are committed to protecting your privacy and ensuring you have a positive experience on our platform.
            </p>
            
            <h2 className="text-xl font-semibold text-gray-900 mt-6">Information We Collect</h2>
            <p>We collect the following types of information:</p>
            <ul className="list-disc pl-5 mt-2">
              <li>Account information: When you register, we collect your email address and create a secure account.</li>
              <li>Social media information: If you connect your Facebook or Instagram accounts, we access information necessary to respond to messages on your behalf.</li>
              <li>Conversation data: We store messages between you, your customers, and our AI assistant to improve response quality.</li>
              <li>Usage data: We collect information about how you interact with our platform to improve our services.</li>
            </ul>
            
            <h2 className="text-xl font-semibold text-gray-900 mt-6">How We Use Your Information</h2>
            <p>We use your information for the following purposes:</p>
            <ul className="list-disc pl-5 mt-2">
              <li>To provide and maintain our service</li>
              <li>To respond to messages on your connected social media accounts</li>
              <li>To improve and personalize your experience</li>
              <li>To analyze usage patterns and optimize our platform</li>
              <li>To communicate with you about service-related issues</li>
            </ul>
            
            <h2 className="text-xl font-semibold text-gray-900 mt-6">Data Retention and Deletion</h2>
            <p>
              We retain your data for as long as your account is active or as needed to provide you services.
              If you wish to delete your data, you have the following options:
            </p>
            <ul className="list-disc pl-5 mt-2">
              <li>Delete your account through the Settings page</li>
              <li>Request deletion of specific data by contacting our support team</li>
              <li>If you connected your Facebook account and later disconnect it or delete your Facebook account, we will automatically receive a data deletion request and remove your Facebook-related data</li>
            </ul>
            
            <h2 className="text-xl font-semibold text-gray-900 mt-6">Data Deletion Request</h2>
            <p>
              You can request deletion of your data at any time by:
            </p>
            <ul className="list-disc pl-5 mt-2">
              <li>Emailing us at privacy@aiassistantplatform.com</li>
              <li>Using the "Delete My Data" option in your account settings</li>
              <li>Removing our app from your Facebook or Instagram settings</li>
            </ul>
            <p className="mt-2">
              When we receive a data deletion request, we will confirm receipt and provide you with a confirmation code.
              You can check the status of your deletion request using the provided link and confirmation code.
              We will complete the deletion process within 30 days of receiving your request.
            </p>
            
            <h2 className="text-xl font-semibold text-gray-900 mt-6">Third-Party Services</h2>
            <p>
              Our platform integrates with third-party services including:
            </p>
            <ul className="list-disc pl-5 mt-2">
              <li>Facebook and Instagram for social media messaging</li>
              <li>Voiceflow for AI assistant capabilities</li>
            </ul>
            <p className="mt-2">
              These services have their own privacy policies, and we encourage you to review them.
            </p>
            
            <h2 className="text-xl font-semibold text-gray-900 mt-6">Contact Us</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at:
            </p>
            <p className="mt-2">
              Email: privacy@aiassistantplatform.com<br />
              Address: 123 AI Street, San Francisco, CA 94105
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}