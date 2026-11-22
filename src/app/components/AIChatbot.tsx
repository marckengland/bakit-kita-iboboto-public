/**
 * AI Chatbot Component
 *
 * A bottom composer that expands into a conversation panel.
 * Displays source citations in responses and shows rate limit status.
 * Supports Filipino and English translations.
 *
 * Requirements: 14.1, 14.2, 14.3, 14.4, 37.6, 27.1, 27.4, 32.7
 */

"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ReactMarkdown from "react-markdown";
import type { ChatRecordScope } from "@/lib/senate-chat";
import type { ChatProfile, ReviewedChatAnswer } from "@/lib/reviewed-chat";
import { ReviewedChatAnswerView } from "./ReviewedChatAnswer";

// ============================================
// Types
// ============================================

interface DataSource {
  type: string;
  name: string;
  url?: string;
  date?: string;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: DataSource[];
  confidence?: number;
  isVerified?: boolean;
  createdAt: string;
  answer?: ReviewedChatAnswer;
}

interface RateLimitStatus {
  remaining: number;
  resetAt: string;
  isBlocked: boolean;
  maxRequests?: number;
}

interface AIChatbotProps {
  className?: string;
  mode?: "dock" | "page";
}

// ============================================
// Main Component
// ============================================

export function AIChatbot({ className = "", mode = "dock" }: AIChatbotProps) {
  const t = useTranslations("chatbot");
  const d = useTranslations("chatDock");
  const r = useTranslations("reviewedChat");
  const senate = useTranslations("senateChat");
  const pathname = usePathname();
  const isPage = mode === "page";
  const [isOpen, setIsOpen] = useState(isPage);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<ChatProfile | null>(null);
  const [recordScope, setRecordScope] = useState<ChatRecordScope>("auto");
  const [selectionQuery, setSelectionQuery] = useState("");
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [rateLimitStatus, setRateLimitStatus] = useState<RateLimitStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const previousPath = useRef(pathname);
  const lastAnswerScope = useRef<"cases" | "senate_filings" | null>(null);
  const pendingDraft = useRef("");
  const clearReviewedAnswer = useCallback(() => {
    requestRef.current?.abort();
    setMessages((prev) => prev.filter((item) => item.role === "user"));
    const draft = pendingDraft.current;
    setInputValue((value) => value || draft);
    pendingDraft.current = "";
    setIsLoading(false);
    setRefreshRequired(true);
    setError(null);
  }, []);

  useEffect(() => {
    if (previousPath.current !== pathname) {
      previousPath.current = pathname;
      clearReviewedAnswer();
      if (!isPage) {
        setIsOpen(false);
      }
    }
  }, [pathname, isPage, clearReviewedAnswer]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => () => requestRef.current?.abort(), []);

  useEffect(() => {
    const visibility = () => {
      if (document.visibilityState === "hidden") {
        clearReviewedAnswer();
      }
    };
    window.addEventListener("offline", clearReviewedAnswer);
    window.addEventListener("pagehide", clearReviewedAnswer);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      window.removeEventListener("offline", clearReviewedAnswer);
      window.removeEventListener("pagehide", clearReviewedAnswer);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [clearReviewedAnswer]);

  useEffect(() => {
    const element = chatContainerRef.current;
    if (isPage || !element) {
      return;
    }
    const root = document.documentElement;
    const previous = root.style.getPropertyValue("--assistant-clearance");
    const reserveSpace = () => {
      if (element.classList.contains("assistant-shell-open")) {
        return;
      }
      const bottom = parseFloat(getComputedStyle(element).bottom) || 16;
      root.style.setProperty(
        "--assistant-clearance",
        `${Math.ceil(element.getBoundingClientRect().height + bottom + 16)}px`
      );
    };
    const observer = new ResizeObserver(reserveSpace);
    observer.observe(element);
    reserveSpace();
    return () => {
      observer.disconnect();
      if (previous) {
        root.style.setProperty("--assistant-clearance", previous);
      } else {
        root.style.removeProperty("--assistant-clearance");
      }
    };
  }, [isPage, pathname]);

  useEffect(() => {
    const content = document.getElementById("main-content");
    if (!isOpen || !isMobile || isPage || !content) {
      return;
    }
    const wasInert = content.inert;
    const overflow = document.body.style.overflow;
    content.inert = true;
    document.body.style.overflow = "hidden";
    return () => {
      content.inert = wasInert;
      document.body.style.overflow = overflow;
    };
  }, [isOpen, isMobile, isPage]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const reduced =
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.documentElement.classList.contains("reduced-motion");
    messagesEndRef.current?.scrollIntoView({
      behavior: reduced ? "instant" : "smooth",
      block: "nearest",
    });
  }, [messages, isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    const controller = new AbortController();
    async function readLimit() {
      try {
        const response = await fetch("/api/chatbot/rate-limit", { signal: controller.signal });
        if (response.ok && !controller.signal.aborted) {
          setRateLimitStatus((await response.json()).rateLimitStatus);
        }
      } catch {
        /* The send response also reports the current limit. */
      }
    }
    void readLimit();
    return () => controller.abort();
  }, [isOpen]);

  const closePanel = () => {
    clearReviewedAnswer();
    setIsOpen(false);
    inputRef.current?.focus();
  };

  const handleSendMessage = async (chosen?: ChatProfile) => {
    const message = chosen ? selectionQuery || r("show") : inputValue.trim();
    if (!message || isLoading) {
      return;
    }
    setIsOpen(true);
    setError(null);
    setRefreshRequired(false);
    if (chosen) {
      setSelectedProfile(chosen);
    }
    setIsLoading(true);
    setInputValue("");
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev.filter((item) => item.role === "user").slice(-4), userMessage]);
    const controller = new AbortController();
    requestRef.current = controller;
    pendingDraft.current = message;
    try {
      const response = await fetch("/api/chatbot/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          politicianId: chosen?.id ?? selectedProfile?.id,
          ...((chosen ? lastAnswerScope.current : recordScope) !== "auto" && {
            scope: chosen ? (lastAnswerScope.current ?? recordScope) : recordScope,
          }),
          ...(selectedProfile &&
            lastAnswerScope.current && { selectionScope: lastAnswerScope.current }),
        }),
        cache: "no-store",
        signal: controller.signal,
      });
      const data = await response.json();
      if (controller.signal.aborted) {
        return;
      }
      if (data.rateLimitStatus) {
        setRateLimitStatus(data.rateLimitStatus);
      }
      if (!response.ok) {
        setError(response.status === 429 ? t("rateLimit.exhausted") : d("unavailable"));
        setInputValue(message);
        setMessages((prev) => prev.filter((item) => item.id !== userMessage.id));
        return;
      }
      if (
        !data.answer ||
        typeof data.answer.status !== "string" ||
        !Array.isArray(data.answer.records) ||
        (data.answer.senate && !Array.isArray(data.answer.senate.filings))
      ) {
        throw new Error("Invalid assistant response");
      }
      const returnedScope = data.answer.senate ? "senate_filings" : "cases";
      if (lastAnswerScope.current && lastAnswerScope.current !== returnedScope) {
        setSelectedProfile(null);
      }
      lastAnswerScope.current = returnedScope;
      if (data.answer.senate) {
        setSelectionQuery(data.answer.status === "choose_profile" ? message : "");
      } else {
        setSelectionQuery("");
      }
      if (data.answer.profile) {
        setSelectedProfile(data.answer.profile);
      }
      if (data.answer.status === "profile_not_found") {
        setSelectedProfile(null);
      }
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "",
          answer: data.answer,
          createdAt: data.answer.checkedAt,
        },
      ]);
    } catch (err) {
      if (!controller.signal.aborted) {
        console.error("Chat error:", err);
        setError(d("unavailable"));
        setInputValue(message);
        setMessages((prev) => prev.filter((item) => item.id !== userMessage.id));
      }
    } finally {
      if (!controller.signal.aborted) {
        pendingDraft.current = "";
        setIsLoading(false);
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  if (!isPage && pathname === "/chatbot") {
    return null;
  }

  return (
    <aside
      ref={chatContainerRef}
      id="research-assistant"
      className={`assistant-shell ${isOpen ? "assistant-shell-open" : ""} ${isPage ? "assistant-page" : ""} ${className}`}
      role={isOpen && !isPage ? "dialog" : "complementary"}
      aria-label={d("title")}
      aria-modal={isOpen && isMobile && !isPage ? true : undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen && !isPage) {
          event.stopPropagation();
          closePanel();
        }
        if (event.key === "Tab" && isOpen && isMobile && !isPage) {
          const controls = Array.from(
            chatContainerRef.current?.querySelectorAll<HTMLElement>(
              "button:not(:disabled), a[href], textarea:not(:disabled)"
            ) ?? []
          );
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last?.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first?.focus();
          }
        }
      }}
    >
      {isOpen && (
        <>
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 px-5 py-4 dark:border-neutral-800">
            <div>
              <h2 className="font-semibold">{d("title")}</h2>
              <p className="mt-1 text-xs text-neutral-500">{d("generated")}</p>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={isLoading}
                onClick={() => {
                  setMessages([]);
                  setSelectedProfile(null);
                  setSelectionQuery("");
                  setRecordScope("auto");
                  lastAnswerScope.current = null;
                  setRefreshRequired(false);
                  setError(null);
                  inputRef.current?.focus();
                }}
                className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                aria-label={t("newConversation")}
              >
                <PlusIcon className="h-5 w-5" />
              </button>
              {!isPage && (
                <button
                  type="button"
                  onClick={closePanel}
                  className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  aria-label={d("close")}
                >
                  <CloseIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5"
            role="log"
            aria-live="polite"
            aria-label={d("conversation")}
          >
            {messages.length === 0 ? (
              <WelcomeMessage />
            ) : (
              <div className="space-y-4">
                {messages.map((message) => (
                  <MessageBubble
                    key={message.id}
                    message={message}
                    onSelect={(profile) => {
                      void handleSendMessage(profile);
                    }}
                  />
                ))}
                {isLoading && <TypingIndicator />}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
          {refreshRequired && (
            <p role="status" className="mx-4 mb-3 text-sm">
              {r("refresh")}
            </p>
          )}
          {error && (
            <div
              role="alert"
              className="bg-error-50 dark:bg-error-900/20 mx-4 mb-3 rounded-lg p-3 text-sm text-neutral-900 dark:text-white"
            >
              {error}{" "}
              <Link href="/politicians" onClick={closePanel} className="font-medium underline">
                {d("browse")}
              </Link>
            </div>
          )}
        </>
      )}
      <form
        className="mt-auto shrink-0 px-4 py-3"
        onSubmit={(event) => {
          event.preventDefault();
          void handleSendMessage();
        }}
      >
        {isOpen && (
          <div className="mb-3">
            <label htmlFor="assistant-record-scope" className="mb-1 block text-xs font-medium">
              {senate("recordType")}
            </label>
            <select
              id="assistant-record-scope"
              value={recordScope}
              disabled={isLoading}
              onChange={(event) => {
                setRecordScope(event.target.value as ChatRecordScope);
                setSelectedProfile(null);
                setSelectionQuery("");
                setMessages([]);
                setError(null);
              }}
              className="min-h-11 w-full min-w-0 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 dark:border-neutral-600 dark:bg-neutral-950 dark:text-white"
            >
              <option value="auto">{senate("automatic")}</option>
              <option value="senate_filings">{senate("filings")}</option>
              <option value="cases">{senate("cases")}</option>
            </select>
          </div>
        )}
        {selectedProfile && (
          <div className="mb-2 text-xs">
            <p className="font-medium">{r("selected", { name: selectedProfile.fullName })}</p>
            <button
              type="button"
              disabled={isLoading}
              className="min-h-11 underline"
              onClick={() => {
                setSelectedProfile(null);
                setMessages([]);
                setError(null);
                inputRef.current?.focus();
              }}
            >
              {r("change")}
            </button>
          </div>
        )}
        <div className="mb-2 flex items-center justify-between gap-3 text-xs">
          <label
            htmlFor="assistant-input"
            className="font-semibold text-neutral-700 dark:text-neutral-300"
          >
            {d("label")}
          </label>
          {!isOpen && (messages.length > 0 || error) ? (
            <button
              type="button"
              onClick={() => setIsOpen(true)}
              className="py-1 font-medium underline"
            >
              {d("reopen")}
            </button>
          ) : (
            <Link
              href="/politicians"
              onClick={closePanel}
              className="py-1 text-neutral-600 underline dark:text-neutral-400"
            >
              {d("browse")}
            </Link>
          )}
        </div>
        <div className="flex items-end gap-3">
          <textarea
            ref={inputRef}
            id="assistant-input"
            value={inputValue}
            rows={1}
            maxLength={2000}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={selectedProfile ? r("show") : d("placeholder")}
            readOnly={isLoading}
            aria-describedby="assistant-hint"
            className="min-h-11 min-w-0 flex-1 resize-none rounded-lg bg-transparent py-3 text-base text-neutral-900 outline-offset-4 placeholder:text-neutral-500 dark:text-white"
          />
          <button
            type="submit"
            disabled={!inputValue.trim() || isLoading}
            className="bg-primary-500 hover:bg-primary-600 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white disabled:opacity-50"
            aria-label={t("input.send")}
            aria-controls="research-assistant"
            aria-expanded={isOpen}
          >
            {isLoading ? <LoadingSpinner className="h-5 w-5" /> : <SendIcon className="h-5 w-5" />}
          </button>
        </div>
        <p
          id="assistant-hint"
          className="mt-1 text-xs leading-relaxed text-neutral-500 dark:text-neutral-400"
        >
          {d("hint")}
        </p>
        {isOpen && (
          <>
            {rateLimitStatus && (
              <p className="mt-2 text-xs text-neutral-500">
                {t("rateLimit.remaining")}: {rateLimitStatus.remaining}
              </p>
            )}
            <p className="mt-2 text-xs text-neutral-500">
              {recordScope === "cases"
                ? r("coverage")
                : recordScope === "auto"
                  ? senate("combinedScope")
                  : senate("scope")}
            </p>
          </>
        )}
      </form>
    </aside>
  );
}

// ============================================
// Sub-Components
// ============================================

function WelcomeMessage() {
  const d = useTranslations("chatDock");
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="bg-primary-100 dark:bg-primary-900/30 mb-4 flex h-14 w-14 items-center justify-center rounded-xl">
        <BotIcon className="text-primary-500 h-7 w-7" />
      </div>
      <h3 className="text-lg font-semibold">{d("welcomeTitle")}</h3>
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
        {d("welcomeHint")}
      </p>
    </div>
  );
}

interface MessageBubbleProps {
  message: ChatMessage;
  onSelect: (profile: ChatProfile) => void;
}

function MessageBubble({ message, onSelect }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const d = useTranslations("chatDock");

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-primary-500 text-white"
            : "bg-neutral-100 text-neutral-900 dark:bg-neutral-800 dark:text-white"
        }`}
      >
        {/* Message Content */}
        {message.answer ? (
          <ReviewedChatAnswerView answer={message.answer} onSelect={onSelect} />
        ) : isUser ? (
          <div className="text-sm whitespace-pre-wrap">{message.content}</div>
        ) : (
          <div className="prose prose-sm dark:prose-invert max-w-none text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-4">{children}</ul>,
                ol: ({ children }) => (
                  <ol className="mb-2 list-decimal space-y-1 pl-4">{children}</ol>
                ),
                li: ({ children }) => <li className="text-sm">{children}</li>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                code: ({ children }) => (
                  <code className="rounded bg-neutral-200 px-1 py-0.5 font-mono text-xs dark:bg-neutral-700">
                    {children}
                  </code>
                ),
                pre: ({ children }) => (
                  <pre className="my-2 overflow-x-auto rounded bg-neutral-200 p-2 text-xs dark:bg-neutral-700">
                    {children}
                  </pre>
                ),
                h1: ({ children }) => <h1 className="mb-2 text-base font-bold">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-2 text-sm font-bold">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-1 text-sm font-semibold">{children}</h3>,
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 dark:text-primary-400 underline"
                  >
                    {children}
                  </a>
                ),
                blockquote: ({ children }) => (
                  <blockquote className="my-2 border-l-2 border-neutral-300 pl-3 italic dark:border-neutral-600">
                    {children}
                  </blockquote>
                ),
              }}
            >
              {message.content}
            </ReactMarkdown>
          </div>
        )}

        {/* Source Citations - Requirement 14.3 */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <SourceCitations sources={message.sources} />
        )}

        {!isUser && (
          <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">{d("generated")}</p>
        )}
      </div>
    </div>
  );
}

interface SourceCitationsProps {
  sources: DataSource[];
}

function SourceCitations({ sources }: SourceCitationsProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (sources.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 border-t border-neutral-200 pt-2 dark:border-neutral-700">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center justify-between text-xs font-medium text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-300"
      >
        <span className="flex items-center gap-1">
          <DocumentIcon className="h-3 w-3" />
          {sources.length} {sources.length === 1 ? "source" : "sources"}
        </span>
        <ChevronIcon className={`h-4 w-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
      </button>

      {isExpanded && (
        <ul className="mt-2 space-y-1">
          {sources.map((source, index) => (
            <li key={index} className="text-xs">
              {source.url ? (
                <a
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 flex items-center gap-1 hover:underline"
                >
                  <LinkIcon className="h-3 w-3" />
                  {source.name}
                </a>
              ) : (
                <span className="text-neutral-600 dark:text-neutral-400">{source.name}</span>
              )}
              <span className="ml-1 text-neutral-400">({source.type.replace(/_/g, " ")})</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl bg-neutral-100 px-4 py-3 dark:bg-neutral-800">
        <div className="flex items-center gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-neutral-400" />
        </div>
      </div>
    </div>
  );
}

// ============================================
// Icons
// ============================================

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function BotIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.5}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
      />
    </svg>
  );
}

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
      />
    </svg>
  );
}

function DocumentIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export default AIChatbot;
