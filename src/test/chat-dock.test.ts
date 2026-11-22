import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import { expect, it } from "vitest";
import messages from "../i18n/messages/en.json";
import { AIChatbot } from "../app/components/AIChatbot";

it("offers a labelled chat composer without requiring a floating launcher", () => {
  const html = renderToStaticMarkup(
    createElement(NextIntlClientProvider, {
      locale: "en",
      messages,
      timeZone: "UTC",
      children: createElement(AIChatbot),
    })
  );
  expect(html).toContain("textarea");
  expect(html).toContain("Ask about public records");
  expect(html).toContain("Browse profiles");
  expect(html).toContain("AI can make mistakes");
});
