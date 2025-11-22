import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function TermsScreen() {
  const navigate = useNavigate();

  return (
    <div className="w-full bg-gray-50 min-h-screen">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="mb-4 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-2">Terms & Policies</h1>
          <p className="text-gray-600 text-lg">Last updated: {new Date().toLocaleDateString()}</p>
        </div>

        {/* Content */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6 md:p-8 space-y-8">
          {/* Terms of Service */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Terms of Service</h2>
            <div className="prose prose-gray max-w-none space-y-4">
              <p className="text-gray-700 leading-relaxed">
                Welcome to AroundYou. By accessing or using our platform, you agree to be bound by these Terms of Service.
              </p>
              
              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">1. Acceptance of Terms</h3>
              <p className="text-gray-700 leading-relaxed">
                By creating an account, placing an order, or using any of our services, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">2. User Accounts</h3>
              <p className="text-gray-700 leading-relaxed">
                You are responsible for maintaining the confidentiality of your account credentials. You agree to notify us immediately of any unauthorized use of your account.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">3. Orders and Payments</h3>
              <p className="text-gray-700 leading-relaxed">
                All orders are subject to acceptance by the merchant. Prices are set by individual merchants and may vary. Payment must be completed before order fulfillment.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">4. Delivery</h3>
              <p className="text-gray-700 leading-relaxed">
                Delivery times and fees are determined by individual merchants. We are not responsible for delays caused by third-party delivery services or circumstances beyond our control.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">5. Refunds and Cancellations</h3>
              <p className="text-gray-700 leading-relaxed">
                Refund and cancellation policies are set by individual merchants. Please contact the merchant directly for refund requests.
              </p>
            </div>
          </section>

          {/* Privacy Policy */}
          <section className="border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Privacy Policy</h2>
            <div className="prose prose-gray max-w-none space-y-4">
              <p className="text-gray-700 leading-relaxed">
                Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your personal information.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">1. Information We Collect</h3>
              <p className="text-gray-700 leading-relaxed">
                We collect information you provide directly, including name, email address, delivery addresses, and payment information. We also collect usage data and location information to improve our services.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">2. How We Use Your Information</h3>
              <p className="text-gray-700 leading-relaxed">
                We use your information to process orders, communicate with you, improve our services, and comply with legal obligations. We do not sell your personal information to third parties.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">3. Data Security</h3>
              <p className="text-gray-700 leading-relaxed">
                We implement appropriate security measures to protect your personal information. However, no method of transmission over the internet is 100% secure.
              </p>

              <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">4. Your Rights</h3>
              <p className="text-gray-700 leading-relaxed">
                You have the right to access, update, or delete your personal information. You can manage your account settings or contact us for assistance.
              </p>
            </div>
          </section>

          {/* Contact */}
          <section className="border-t border-gray-200 pt-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Contact Us</h2>
            <p className="text-gray-700 leading-relaxed">
              If you have any questions about these Terms & Policies, please contact us at:
            </p>
            <p className="text-gray-700 leading-relaxed mt-2">
              <strong>Email:</strong> support@aroundyou.com<br />
              <strong>Phone:</strong> +92 XXX XXXXXXX
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

