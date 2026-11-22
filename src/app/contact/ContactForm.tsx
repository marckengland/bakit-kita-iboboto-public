"use client";

import { useRef, useState, type FormEvent } from "react";

const inputClass =
  "mt-2 block w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white";

export function ContactForm({ available }: { available: boolean }) {
  const [category, setCategory] = useState("correction");
  const [message, setMessage] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [replyEmail, setReplyEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const requestId = useRef<string | null>(null);

  function edited() {
    requestId.current = null;
    setError("");
    setAccepted(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!available || sending) {
      return;
    }
    setSending(true);
    setError("");
    setAccepted(false);
    try {
      requestId.current ??= crypto.randomUUID();
      const result = await fetch("/api/contact", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          message,
          profileUrl,
          replyEmail,
          requestId: requestId.current,
        }),
      });
      const receipt: unknown = await result.json();
      if (
        !result.ok ||
        !receipt ||
        typeof receipt !== "object" ||
        !("ok" in receipt) ||
        receipt.ok !== true
      ) {
        const detail =
          receipt &&
          typeof receipt === "object" &&
          "error" in receipt &&
          typeof receipt.error === "string"
            ? receipt.error
            : "We could not confirm your report was accepted. Please try again.";
        setError(detail);
        return;
      }
      setAccepted(true);
      setMessage("");
      setProfileUrl("");
      setReplyEmail("");
      requestId.current = null;
    } catch {
      setError("We could not confirm your report was accepted. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-8 space-y-5">
      {!available && (
        <p
          role="status"
          className="rounded-lg border border-neutral-300 p-4 text-neutral-700 dark:text-neutral-300"
        >
          Private contact is not enabled on this installation. Reports cannot be sent yet.
        </p>
      )}
      <fieldset disabled={!available || sending} className="space-y-5 disabled:opacity-60">
        <label className="block text-sm font-medium text-neutral-900 dark:text-white">
          Report type
          <select
            className={inputClass}
            value={category}
            onChange={(event) => {
              edited();
              setCategory(event.target.value);
            }}
          >
            <option value="correction">Profile correction</option>
            <option value="privacy">Privacy request</option>
            <option value="security">Security report</option>
            <option value="general">General question</option>
          </select>
        </label>
        <label className="block text-sm font-medium text-neutral-900 dark:text-white">
          Message
          <textarea
            className={inputClass}
            required
            minLength={10}
            maxLength={4000}
            rows={7}
            value={message}
            onChange={(event) => {
              edited();
              setMessage(event.target.value);
            }}
          />
        </label>
        <label className="block text-sm font-medium text-neutral-900 dark:text-white">
          Profile or source URL (optional)
          <input
            className={inputClass}
            type="url"
            maxLength={1000}
            value={profileUrl}
            onChange={(event) => {
              edited();
              setProfileUrl(event.target.value);
            }}
          />
        </label>
        <label className="block text-sm font-medium text-neutral-900 dark:text-white">
          Your email (optional, for a reply)
          <input
            className={inputClass}
            type="email"
            autoComplete="email"
            maxLength={254}
            value={replyEmail}
            onChange={(event) => {
              edited();
              setReplyEmail(event.target.value);
            }}
          />
        </label>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Your message and optional details are sent through Resend to the project maintainer. This
          form does not save reports in the application database or publish them. Email services may
          retain copies under their configured policies. Share only what is needed for review; do
          not include passwords or API keys. Attachments are not accepted.
        </p>
        <button
          type="submit"
          className="rounded-lg bg-blue-700 px-5 py-3 font-medium text-white disabled:cursor-not-allowed"
        >
          {sending ? "Sending…" : "Send privately"}
        </button>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
      {accepted && (
        <p role="status" className="text-sm text-green-700 dark:text-green-400">
          Your report was accepted for private delivery. Thank you.
        </p>
      )}
    </form>
  );
}
