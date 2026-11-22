/**
 * Admin AI Configuration Page
 *
 * Allows super admins to switch between AI providers for chatbot and verifier.
 */

import { Metadata } from "next";
import { AIConfigDashboard } from "./components/AIConfigDashboard";

export const metadata: Metadata = {
  title: "AI Configuration - Admin",
  description: "Configure AI model providers for chatbot and verification",
};

export default function AdminAIConfigPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">AI Configuration</h1>
          <p className="mt-2 text-gray-600">
            Configure AI model providers for the chatbot and data verification systems.
          </p>
        </div>
        <AIConfigDashboard />
      </div>
    </main>
  );
}
