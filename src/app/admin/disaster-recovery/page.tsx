/**
 * Disaster Recovery Admin Page
 *
 * Admin interface for managing backups, restoration, and monitoring
 * disaster recovery status.
 *
 * Validates: Requirements 40.1, 40.2, 40.3, 40.4, 40.5, 40.6, 40.7
 */

import DisasterRecoveryDashboard from "./components/DisasterRecoveryDashboard";

export const metadata = {
  title: "Disaster Recovery - Admin | Bakit Kita Iboboto",
  description: "Manage backups, restoration, and disaster recovery procedures",
};

export default function DisasterRecoveryPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <DisasterRecoveryDashboard />
    </div>
  );
}
