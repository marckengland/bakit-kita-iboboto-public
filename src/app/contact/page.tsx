import type { Metadata } from "next";
import Link from "next/link";
import { privateContactAvailable } from "@/lib/private-contact";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";
import { ContactForm } from "./ContactForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Private contact | Bakit Kita Iboboto?" };

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <Header />
      <div className="container-wide max-w-2xl py-10">
        <h1 className="text-3xl font-bold text-neutral-900 dark:text-white">Private contact</h1>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          This form is intended for profile corrections, privacy requests, security reports, and
          questions to the project maintainer. A submitted report never updates profiles
          automatically.
        </p>
        <p className="mt-3 text-neutral-600 dark:text-neutral-400">
          Private delivery is unavailable for this pilot while sender setup and delivery checks are
          incomplete. There is no promised response time. Read the{" "}
          <Link href="/privacy" className="underline underline-offset-4">
            Privacy and corrections
          </Link>{" "}
          information before sharing any details.
        </p>
        <ContactForm available={privateContactAvailable()} />
      </div>
      <Footer />
    </main>
  );
}
