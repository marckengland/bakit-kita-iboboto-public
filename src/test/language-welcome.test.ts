import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { expect, it } from "vitest";
import messages from "../i18n/messages/en.json";
import { LanguageWelcome } from "../app/components/LanguageWelcome";

function render(shouldPrompt: boolean) {
  return renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: "en",
      messages,
      timeZone: "UTC",
      children: createElement(LanguageWelcome, { shouldPrompt }),
    })
  );
}

it("offers all supported languages on the first visit", () => {
  const html = render(true);
  expect(html).toContain("Choose your language");
  expect(html.match(/type="radio"/g)).toHaveLength(3);
  expect(html).toContain("English");
  expect(html).toContain("Filipino");
  expect(html).toContain("Taglish");
});

it("leaves returning visitors in their chosen language", () => {
  expect(render(false)).toBe("");
});
