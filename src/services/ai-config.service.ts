/**
 * AI Configuration Service
 *
 * Manages AI model configuration and switching between providers.
 * Supports Claude Opus 4.5 (Anthropic) and Gemini Pro 2.5 (Google).
 */

// ============================================
// Types and Interfaces
// ============================================

export type AIProvider = "claude" | "gemini" | "openai" | "deepseek" | "openrouter" | "tokenrouter";

/** How a provider's HTTP contract behaves. */
export type ProviderKind = "anthropic" | "gemini" | "openai";

/**
 * Map a provider to its wire contract: Anthropic native (`/v1/messages`),
 * Gemini native (`generateContent`), or OpenAI-compatible
 * (`/chat/completions` — covers OpenAI, DeepSeek, and OpenRouter).
 */
export function getProviderKind(provider: AIProvider): ProviderKind {
  if (provider === "claude") {
    return "anthropic";
  }
  if (provider === "gemini") {
    return "gemini";
  }
  return "openai";
}

export interface AIModelConfig {
  provider: AIProvider;
  model: string;
  displayName: string;
  maxTokens: number;
  temperature: number;
  description: string;
}

export interface AIConfigSettings {
  chatbot: AIProvider;
  verifier: AIProvider;
}

// ============================================
// Available Models
// ============================================

export const AI_MODELS: Record<AIProvider, AIModelConfig> = {
  claude: {
    provider: "claude",
    model: "claude-opus-4-5-20250514",
    displayName: "Claude Opus 4.5",
    maxTokens: 4096,
    temperature: 0.7,
    description:
      "Anthropic's most capable model. Excellent for nuanced analysis and Filipino language support.",
  },
  gemini: {
    provider: "gemini",
    model: "gemini-3.1-flash-lite",
    displayName: "Gemini 3.1 Pro",
    maxTokens: 8192,
    temperature: 0.7,
    description:
      "Google's advanced model. Strong multilingual capabilities and fast response times.",
  },
  openai: {
    provider: "openai",
    model: "gpt-4o-mini",
    displayName: "OpenAI GPT-4o mini",
    maxTokens: 4096,
    temperature: 0.7,
    description: "OpenAI. Reliable general-purpose model via the Chat Completions API.",
  },
  deepseek: {
    provider: "deepseek",
    model: "deepseek-chat",
    displayName: "DeepSeek Chat",
    maxTokens: 4096,
    temperature: 0.7,
    description: "DeepSeek. Strong, low-cost, OpenAI-compatible model.",
  },
  openrouter: {
    provider: "openrouter",
    model: "meta-llama/llama-3.3-70b-instruct",
    displayName: "OpenRouter (open-weight)",
    maxTokens: 4096,
    temperature: 0.7,
    description: "OpenRouter gateway to open-weight models (Kimi, GLM, Llama, Qwen).",
  },
  tokenrouter: {
    provider: "tokenrouter",
    model: "z-ai/glm-5.3-free",
    displayName: "TokenRouter (gateway)",
    maxTokens: 4096,
    temperature: 0.7,
    description:
      "TokenRouter — OpenAI-compatible multi-provider gateway; models addressed as provider/model.",
  },
};

// ============================================
// Default Configuration
// ============================================

const DEFAULT_CONFIG: AIConfigSettings = {
  // Gemini is the default: it has a free tier and only needs GOOGLE_AI_API_KEY,
  // which is already required by the research pipeline. Switch either to
  // claude / openai / deepseek / openrouter in the AI config when a key is set.
  chatbot: "gemini",
  verifier: "gemini",
};

// ============================================
// In-Memory Config Store (use database in production)
// ============================================

let currentConfig: AIConfigSettings = { ...DEFAULT_CONFIG };

// ============================================
// Configuration Functions
// ============================================

/**
 * Get current AI configuration
 */
export function getAIConfig(): AIConfigSettings {
  return { ...currentConfig };
}

/**
 * Get model config for a specific provider
 */
export function getModelConfig(provider: AIProvider): AIModelConfig {
  return AI_MODELS[provider];
}

/**
 * Get current chatbot model config
 */
export function getChatbotModelConfig(): AIModelConfig {
  return AI_MODELS[currentConfig.chatbot];
}

/**
 * Get current verifier model config
 */
export function getVerifierModelConfig(): AIModelConfig {
  return AI_MODELS[currentConfig.verifier];
}

/**
 * Set chatbot AI provider
 */
export function setChatbotProvider(provider: AIProvider): AIConfigSettings {
  if (!AI_MODELS[provider]) {
    throw new Error(`Invalid AI provider: ${provider}`);
  }
  currentConfig.chatbot = provider;
  return { ...currentConfig };
}

/**
 * Set verifier AI provider
 */
export function setVerifierProvider(provider: AIProvider): AIConfigSettings {
  if (!AI_MODELS[provider]) {
    throw new Error(`Invalid AI provider: ${provider}`);
  }
  currentConfig.verifier = provider;
  return { ...currentConfig };
}

/**
 * Set both providers at once
 */
export function setAIProviders(config: Partial<AIConfigSettings>): AIConfigSettings {
  if (config.chatbot) {
    if (!AI_MODELS[config.chatbot]) {
      throw new Error(`Invalid chatbot provider: ${config.chatbot}`);
    }
    currentConfig.chatbot = config.chatbot;
  }
  if (config.verifier) {
    if (!AI_MODELS[config.verifier]) {
      throw new Error(`Invalid verifier provider: ${config.verifier}`);
    }
    currentConfig.verifier = config.verifier;
  }
  return { ...currentConfig };
}

/**
 * Reset to default configuration
 */
export function resetAIConfig(): AIConfigSettings {
  currentConfig = { ...DEFAULT_CONFIG };
  return { ...currentConfig };
}

/**
 * Get all available providers
 */
export function getAvailableProviders(): AIModelConfig[] {
  return Object.values(AI_MODELS);
}

/**
 * Check if a provider is valid
 */
export function isValidProvider(provider: string): provider is AIProvider {
  return provider in AI_MODELS;
}

// ============================================
// Provider-Specific API Helpers
// ============================================

/**
 * Get API endpoint for provider
 */
export function getAPIEndpoint(provider: AIProvider): string {
  const endpoints: Record<AIProvider, string> = {
    claude: "https://api.anthropic.com/v1/messages",
    gemini: "https://generativelanguage.googleapis.com/v1beta/models",
    openai: "https://api.openai.com/v1/chat/completions",
    deepseek: "https://api.deepseek.com/v1/chat/completions",
    openrouter: "https://openrouter.ai/api/v1/chat/completions",
    tokenrouter: "https://api.tokenrouter.com/v1/chat/completions",
  };
  return endpoints[provider];
}

/**
 * Get required environment variable name for API key
 */
export function getAPIKeyEnvVar(provider: AIProvider): string {
  const envVars: Record<AIProvider, string> = {
    claude: "ANTHROPIC_API_KEY",
    gemini: "GOOGLE_AI_API_KEY",
    openai: "OPENAI_API_KEY",
    deepseek: "DEEPSEEK_API_KEY",
    openrouter: "OPENROUTER_API_KEY",
    tokenrouter: "TOKENROUTER_API_KEY",
  };
  return envVars[provider];
}

/**
 * Format request for specific provider
 */
export function formatProviderRequest(
  provider: AIProvider,
  prompt: string,
  systemPrompt: string,
  options?: { temperature?: number; maxTokens?: number }
): Record<string, unknown> {
  const config = AI_MODELS[provider];
  const temperature = options?.temperature ?? config.temperature;
  const maxTokens = options?.maxTokens ?? config.maxTokens;

  const kind = getProviderKind(provider);

  if (kind === "anthropic") {
    return {
      model: config.model,
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt }],
    };
  } else if (kind === "openai") {
    // OpenAI-compatible Chat Completions (OpenAI, DeepSeek, OpenRouter)
    return {
      model: config.model,
      temperature,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
    };
  } else {
    // Gemini format
    return {
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemPrompt}\n\n${prompt}` }],
        },
      ],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
    };
  }
}

/**
 * Parse response from specific provider
 */
export function parseProviderResponse(
  provider: AIProvider,
  response: Record<string, unknown>
): string {
  const kind = getProviderKind(provider);

  if (kind === "anthropic") {
    const content = response.content as Array<{ text?: string }> | undefined;
    return content?.[0]?.text || "";
  } else if (kind === "openai") {
    // OpenAI-compatible Chat Completions
    const choices = response.choices as Array<{ message?: { content?: string } }> | undefined;
    return choices?.[0]?.message?.content || "";
  } else {
    // Gemini format
    const candidates = response.candidates as
      | Array<{ content?: { parts?: Array<{ text?: string }> } }>
      | undefined;
    return candidates?.[0]?.content?.parts?.[0]?.text || "";
  }
}
