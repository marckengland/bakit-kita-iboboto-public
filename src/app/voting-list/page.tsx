/**
 * Voting List Page
 *
 * Displays the user's voting list organized by position level.
 * Requirements: 17.2, 17.5
 */

import { Metadata } from "next";
import { VotingListContent } from "./components/VotingListContent";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export const metadata: Metadata = {
  title: "Aking Voting List",
  description: "Pamahalaan ang iyong listahan ng mga kandidato na iboboto mo.",
};

export default function VotingListPage() {
  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header backLink={{ href: "/", label: "Bumalik sa Home" }} />

      {/* Content */}
      <div className="container-wide py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl dark:text-white">
            Aking Voting List
          </h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Mga kandidato na plano mong iboto sa darating na eleksyon
          </p>
        </div>
        <VotingListContent />
      </div>

      {/* Footer */}
      <Footer />
    </main>
  );
}
