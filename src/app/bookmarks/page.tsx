/**
 * Bookmarks Page
 *
 * Displays all bookmarked politicians with quick access to their profiles.
 * Requirements: 10.2, 10.5
 */

import { Metadata } from "next";
import { BookmarksContent } from "./components/BookmarksContent";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export const metadata: Metadata = {
  title: "Aking Bookmarks",
  description: "Tingnan ang mga pulitiko na iyong na-bookmark para sa mabilis na access.",
};

export default function BookmarksPage() {
  return (
    <main className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header backLink={{ href: "/", label: "Bumalik sa Home" }} />

      {/* Content */}
      <div className="container-wide py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-neutral-900 sm:text-3xl dark:text-white">
            Aking Bookmarks
          </h1>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            Mga pulitiko na iyong sinusubaybayan
          </p>
        </div>
        <BookmarksContent />
      </div>

      {/* Footer */}
      <Footer />
    </main>
  );
}
