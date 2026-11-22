/**
 * AI Fact-Checker Page
 *
 * Dedicated page for the AI chatbot with full-screen interface.
 * Requirements: 14.1, 14.2, 14.3, 14.4, 37.6
 */

import { Metadata } from "next";
import { ChatbotFullPage } from "./components/ChatbotFullPage";
import { Header } from "../components/Header";

export const metadata: Metadata = {
  title: "Civic assistant | Bakit Kita Iboboto?",
  description:
    "Find reviewed cases and context for a selected profile, with exact citations and clear coverage limits.",
};

export default function ChatbotPage() {
  return (
    <main className="flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <div className="flex flex-1 flex-col">
        <ChatbotFullPage />
      </div>
    </main>
  );
}
