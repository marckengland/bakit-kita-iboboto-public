import type { Metadata } from "next";
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
          Send a profile correction, privacy request, security report, or question to the project
          maintainer. Reports are reviewed privately and never added to profiles automatically.
        </p>
        <ContactForm available={privateContactAvailable()} />
      </div>
      <Footer />
    </main>
  );
}
