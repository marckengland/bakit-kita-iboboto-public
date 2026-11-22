/**
 * User Profile/Settings Page
 *
 * Displays user profile information and settings.
 * Requirements: 16.2, 16.3, 16.4
 */

import { Metadata } from "next";
import { ProfileContent } from "../components/ProfileContent";
import { Header } from "../../components/Header";
import { Footer } from "../../components/Footer";

export const metadata: Metadata = {
  title: "Aking Profile",
  description: "I-manage ang iyong account settings at preferences.",
};

export default function ProfilePage() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header */}
      <Header />

      {/* Main Content */}
      <main className="container-narrow py-8">
        <ProfileContent />
      </main>

      {/* Footer */}
      <Footer />
    </div>
  );
}
