import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export const metadata: Metadata = { title: "Privacy and corrections" };

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Header />
      <article className="container-wide max-w-2xl space-y-6 py-10 text-neutral-700 dark:text-neutral-300">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">
          Privacy and corrections
        </h1>
        <p>Senate guest pilot. Updated November 23, 2026.</p>
        <p>
          Private report delivery is unavailable for this pilot. Sender setup and a successful inbox
          delivery check are incomplete. The contact form is not a working reporting channel yet. No
          response time is promised. The operator identity, privacy contact arrangements, access
          rules, and retention periods still need approval before public operation.
        </p>

        <section className="space-y-3" aria-labelledby="browser-storage">
          <h2 id="browser-storage" className="text-xl font-bold text-neutral-900 dark:text-white">
            Your browser and visits
          </h2>
          <p>
            You can browse the pilot as a guest. Your browser can store saved profile IDs, theme and
            accessibility preferences, and a language preference cookie. Saved profiles can reveal
            political interests to someone who can access your browser. Clear this site&apos;s
            cookies and site data in your browser settings to remove those local preferences and
            saved IDs.
          </p>
          <p>
            Requests reach the hosting infrastructure, which can process IP addresses, requested
            URLs, browser information, and timestamps. This notice does not promise anonymous visits
            or that infrastructure logs are absent. Provider access, locations, and retention
            settings have not been approved for a public deployment.
          </p>
          <p>
            The reviewed-records chat sends your question and selected profile to this site. That
            route reads reviewed records without sending your question to a language model or saving
            a conversation in the application database. Abuse controls count requests and can
            process client IP addresses or account identifiers without saving question text in those
            counters. Infrastructure logs have separate settings. Do not put sensitive information
            in questions or search URLs.
          </p>
        </section>

        <section className="space-y-3" aria-labelledby="ordinary-feedback">
          <h2 id="ordinary-feedback" className="text-xl font-bold text-neutral-900 dark:text-white">
            Ordinary feedback is stored in the database
          </h2>
          <p>
            The footer&apos;s Feedback form remains part of the guest pilot. When accepted, it saves
            your category, subject, description, source URL, and attachments in the application
            database. It accepts up to five PNG, JPEG, GIF, or PDF files, each at most 256 KiB,
            within a total request limit of 2 MiB. Include only information needed to explain the
            issue.
          </p>
          <p>
            Feedback records include browser information and timestamps. If you do not select the
            anonymous option, a record can also include your optional email, a verified account ID,
            and a client IP address when trusted-address collection is enabled. The anonymous option
            leaves email, account ID, and IP out of the feedback record. It does not remove your
            message, attachments, browser information, or timestamps. Request limits and hosting
            services can still process identifiers and metadata. The option does not guarantee
            anonymity.
          </p>
          <p>
            Saving ordinary feedback does not send a private email, change a public record, or
            confirm review. No review or response time is promised. Access, retention, backup, and
            deletion arrangements still need owner approval. Do not use ordinary feedback for
            sensitive reports, identity documents, passwords, or API keys. The separate private
            contact form described below remains unavailable.
          </p>
        </section>

        <section className="space-y-3" aria-labelledby="private-reports">
          <h2 id="private-reports" className="text-xl font-bold text-neutral-900 dark:text-white">
            What the contact form sends when enabled
          </h2>
          <p>
            The form sends a report category, message, optional profile or source URL, optional
            reply email, and a retry identifier to this site. A reply email is optional. Attachments
            are not accepted. Include only what is needed to explain the issue. Do not send
            passwords, API keys, identity documents, or private information about other people.
          </p>
          <p>
            The contact route sends report details through Resend to a private maintainer inbox. It
            does not save the report in the application database or publish it. Its Redis send limit
            stores a shared hourly count, not report contents or reporter IP addresses. Contact
            delivery error logs contain generic errors and provider status codes.
          </p>
          <p>
            Resend, the receiving email service, inbox users, and hosting infrastructure can process
            or retain information under their own settings. No approved retention period or deletion
            deadline is published yet. An accepted submission means the sending provider accepted
            the email request. It does not prove inbox arrival, review, or a reply.
          </p>
        </section>

        <section className="space-y-3" aria-labelledby="corrections">
          <h2 id="corrections" className="text-xl font-bold text-neutral-900 dark:text-white">
            Prepare a correction or privacy request
          </h2>
          <p>
            Record the page URL, person or bill, exact wording at issue, and the date you saw it.
            For a correction, include the proposed wording and public evidence with the relevant
            page or passage. Distinguish a filing from an enacted law, and an allegation from a
            finding. For a privacy request, identify the information and the change you request
            without repeating unnecessary sensitive details.
          </p>
          <p>
            Reports do not update public records automatically. A factual correction needs evidence
            review and approval before publication. There is no automatic approval, removal, or
            response deadline. The general feedback form is separate and must not be used as a
            substitute for private reports.
          </p>
          <p>
            Keep your draft until a verified private channel is available. The{" "}
            <Link href="/contact" className="underline underline-offset-4">
              contact page
            </Link>{" "}
            shows the form&apos;s configuration status. Configuration alone does not prove delivery.
          </p>
        </section>
      </article>
      <Footer />
    </main>
  );
}
