/**
 * Notifications Page
 *
 * Displays all user notifications with filtering and management options.
 * Requirements: 19.1, 19.2, 19.3, 19.4
 */

import { Metadata } from "next";
import { NotificationsContent } from "./components/NotificationsContent";
import { Header } from "../components/Header";
import { Footer } from "../components/Footer";

export const metadata: Metadata = {
  title: "Notifications",
  description: "View and manage your notifications about politicians you follow.",
};

export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="container-wide py-8">
        <NotificationsContent />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
