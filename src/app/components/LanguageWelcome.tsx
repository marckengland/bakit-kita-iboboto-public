"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { locales, localeMetadata, localeNames, type Locale } from "@/i18n/config";

export function LanguageWelcome({ shouldPrompt }: { shouldPrompt: boolean }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("languageWelcome");
  const [showPrompt, setShowPrompt] = useState(shouldPrompt);
  const [selected, setSelected] = useState(locale);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!showPrompt) {
      return;
    }
    const element = dialog.current;
    if (!element) {
      return;
    }
    element.showModal();
    element.querySelector<HTMLInputElement>("input:checked")?.focus();
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
    };
  }, [showPrompt]);

  const choose = (choice: Locale) => {
    document.cookie = `NEXT_LOCALE=${choice};path=/;max-age=31536000;SameSite=Lax`;
    setShowPrompt(false);
    if (choice !== locale) {
      window.location.reload();
    }
  };

  if (!showPrompt) {
    return null;
  }

  return (
    <dialog
      ref={dialog}
      className="language-welcome w-[calc(100%-2rem)] max-w-md rounded-2xl border border-neutral-200 bg-white p-6 text-neutral-900 shadow-xl sm:p-8 dark:border-neutral-700 dark:bg-neutral-900 dark:text-white"
      aria-labelledby="language-title"
      aria-describedby="language-description"
      onCancel={(event) => {
        event.preventDefault();
        choose(locale);
      }}
    >
      <p className="text-primary-600 dark:text-primary-400 text-xs font-semibold tracking-widest uppercase">
        Bakit Kita Iboboto?
      </p>
      <h2 id="language-title" className="mt-4 text-2xl font-semibold tracking-tight">
        {t("title")}
      </h2>
      <p
        id="language-description"
        className="mt-2 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400"
      >
        {t("description")}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          choose(selected);
        }}
      >
        <fieldset className="mt-6 space-y-3">
          <legend className="sr-only">{t("title")}</legend>
          {locales.map((option) => (
            <label
              key={option}
              className="has-checked:border-primary-500 has-checked:bg-primary-50 dark:has-checked:bg-primary-950 flex cursor-pointer items-center gap-4 rounded-xl border border-neutral-300 p-4 dark:border-neutral-700"
            >
              <input
                type="radio"
                name="welcome-language"
                value={option}
                checked={selected === option}
                onChange={() => setSelected(option)}
                className="accent-primary-500 h-5 w-5"
              />
              <span>
                <span className="block font-medium">{localeNames[option]}</span>
                <span className="mt-1 block text-sm text-neutral-600 dark:text-neutral-400">
                  {localeMetadata[option].description}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
        <button type="submit" className="btn-primary mt-6 w-full">
          {t("continue")}
        </button>
        <button
          type="button"
          onClick={() => choose(locale)}
          className="mt-2 min-h-11 w-full text-sm text-neutral-600 underline dark:text-neutral-400"
        >
          {t("keep")}
        </button>
      </form>
      <p className="mt-4 text-center text-xs leading-relaxed text-neutral-500">{t("later")}</p>
    </dialog>
  );
}
