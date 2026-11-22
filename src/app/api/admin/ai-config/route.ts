/**
 * Admin AI Configuration API Route
 *
 * Allows super admins to switch between AI providers (Claude/Gemini)
 */

import { NextRequest, NextResponse } from "next/server";
import { roleHasPermission, AdminRole } from "@/services/admin-role.service";
import {
  getAIConfig,
  setAIProviders,
  getAvailableProviders,
  isValidProvider,
  AIProvider,
} from "@/services/ai-config.service";

// GET - Get current AI configuration
export async function GET(request: NextRequest) {
  try {
    const adminRole = request.headers.get("x-admin-role") as AdminRole | null;

    if (!adminRole || !roleHasPermission(adminRole, "system_configuration")) {
      return NextResponse.json(
        { error: "Unauthorized. Super Admin role required." },
        { status: 403 }
      );
    }

    const config = getAIConfig();
    const providers = getAvailableProviders();

    return NextResponse.json({
      currentConfig: config,
      availableProviders: providers,
    });
  } catch (error) {
    console.error("Error getting AI config:", error);
    return NextResponse.json({ error: "Failed to get AI configuration" }, { status: 500 });
  }
}

// POST - Update AI configuration
export async function POST(request: NextRequest) {
  try {
    const adminRole = request.headers.get("x-admin-role") as AdminRole | null;

    if (!adminRole || !roleHasPermission(adminRole, "system_configuration")) {
      return NextResponse.json(
        { error: "Unauthorized. Super Admin role required." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { chatbot, verifier } = body;

    // Validate providers
    if (chatbot && !isValidProvider(chatbot)) {
      return NextResponse.json({ error: `Invalid chatbot provider: ${chatbot}` }, { status: 400 });
    }

    if (verifier && !isValidProvider(verifier)) {
      return NextResponse.json(
        { error: `Invalid verifier provider: ${verifier}` },
        { status: 400 }
      );
    }

    const updates: Partial<{ chatbot: AIProvider; verifier: AIProvider }> = {};
    if (chatbot) {
      updates.chatbot = chatbot;
    }
    if (verifier) {
      updates.verifier = verifier;
    }

    const newConfig = setAIProviders(updates);

    return NextResponse.json({
      success: true,
      config: newConfig,
    });
  } catch (error) {
    console.error("Error updating AI config:", error);
    return NextResponse.json({ error: "Failed to update AI configuration" }, { status: 500 });
  }
}
