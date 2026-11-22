"use client";

/**
 * AI Configuration Dashboard Component
 *
 * Provides UI for switching between AI providers (Claude/Gemini)
 */

import { useState, useEffect } from "react";

interface AIModelConfig {
  provider: string;
  model: string;
  displayName: string;
  maxTokens: number;
  temperature: number;
  description: string;
}

interface AIConfig {
  chatbot: string;
  verifier: string;
}

export function AIConfigDashboard() {
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [providers, setProviders] = useState<AIModelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  async function fetchConfig() {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/ai-config", {
        headers: {
          "x-admin-role": "super_admin",
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch AI configuration");
      }

      const data = await response.json();
      setConfig(data.currentConfig);
      setProviders(data.availableProviders);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load configuration");
    } finally {
      setLoading(false);
    }
  }

  async function updateConfig(type: "chatbot" | "verifier", provider: string) {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await fetch("/api/admin/ai-config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-role": "super_admin",
        },
        body: JSON.stringify({ [type]: provider }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update configuration");
      }

      const data = await response.json();
      setConfig(data.config);
      setSuccess(`${type === "chatbot" ? "Chatbot" : "Verifier"} model updated successfully`);

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update configuration");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-48 rounded-lg bg-gray-200" />
        </div>
        <div className="animate-pulse">
          <div className="h-48 rounded-lg bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          <p className="font-medium">Error</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="rounded-lg bg-green-50 p-4 text-green-700">
          <p className="font-medium">Success</p>
          <p className="text-sm">{success}</p>
        </div>
      )}

      {/* Chatbot Model Selection */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Chatbot AI Model</h2>
        <p className="mb-4 text-sm text-gray-600">
          Select the AI model used for the public chatbot assistant.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {providers.map((provider) => (
            <button
              key={`chatbot-${provider.provider}`}
              onClick={() => updateConfig("chatbot", provider.provider)}
              disabled={saving}
              className={`rounded-lg border-2 p-4 text-left transition-all ${
                config?.chatbot === provider.provider
                  ? "border-primary-500 bg-primary-50"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              } ${saving ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">{provider.displayName}</h3>
                {config?.chatbot === provider.provider && (
                  <span className="bg-primary-500 rounded-full px-2 py-0.5 text-xs text-white">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">{provider.model}</p>
              <p className="mt-2 text-sm text-gray-600">{provider.description}</p>
              <div className="mt-3 flex gap-4 text-xs text-gray-500">
                <span>Max tokens: {provider.maxTokens.toLocaleString()}</span>
                <span>Temp: {provider.temperature}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Verifier Model Selection */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Data Verifier AI Model</h2>
        <p className="mb-4 text-sm text-gray-600">
          Select the AI model used for verifying and fact-checking data.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {providers.map((provider) => (
            <button
              key={`verifier-${provider.provider}`}
              onClick={() => updateConfig("verifier", provider.provider)}
              disabled={saving}
              className={`rounded-lg border-2 p-4 text-left transition-all ${
                config?.verifier === provider.provider
                  ? "border-primary-500 bg-primary-50"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              } ${saving ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-900">{provider.displayName}</h3>
                {config?.verifier === provider.provider && (
                  <span className="bg-primary-500 rounded-full px-2 py-0.5 text-xs text-white">
                    Active
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-gray-500">{provider.model}</p>
              <p className="mt-2 text-sm text-gray-600">{provider.description}</p>
              <div className="mt-3 flex gap-4 text-xs text-gray-500">
                <span>Max tokens: {provider.maxTokens.toLocaleString()}</span>
                <span>Temp: {provider.temperature}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* API Keys Status */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">API Keys Configuration</h2>
        <p className="mb-4 text-sm text-gray-600">
          Ensure the following environment variables are set in your{" "}
          <code className="rounded bg-gray-100 px-1">.env</code> file:
        </p>

        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <div>
              <p className="font-medium text-gray-900">ANTHROPIC_API_KEY</p>
              <p className="text-sm text-gray-500">Required for Claude Opus 4.5</p>
            </div>
            <a
              href="https://console.anthropic.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 text-sm hover:underline"
            >
              Get API Key →
            </a>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
            <div>
              <p className="font-medium text-gray-900">GOOGLE_AI_API_KEY</p>
              <p className="text-sm text-gray-500">Required for Gemini Pro 2.5</p>
            </div>
            <a
              href="https://makersuite.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-500 text-sm hover:underline"
            >
              Get API Key →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
