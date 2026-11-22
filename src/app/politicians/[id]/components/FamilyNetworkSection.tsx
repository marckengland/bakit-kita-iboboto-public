/**
 * Family Network Section Component
 *
 * Displays interactive family tree visualization showing political dynasty relationships,
 * relationship types, positions held by family members, and concurrent/sequential positions.
 * Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import type { RelationshipType, GovernmentLevel } from "@prisma/client";

// ============================================
// Types
// ============================================

interface DataSourceAttribution {
  sourceType: string;
  sourceName: string;
  sourceUrl?: string | null;
  documentDate?: Date | null;
  retrievedAt: Date;
  confidence: number | null;
  isAIProcessed: boolean;
}

interface FamilyMemberPosition {
  id: string;
  title: string;
  level: GovernmentLevel;
  jurisdiction: string;
  startDate: Date;
  endDate: Date | null;
  isCurrent: boolean;
}

interface FamilyMember {
  id: string;
  politicianId: string;
  fullName: string;
  photo: string | null;
  relationshipType: RelationshipType;
  positions: FamilyMemberPosition[];
  isInDatabase: boolean;
  sources: DataSourceAttribution[];
}

interface PositionOverlap {
  politicianId: string;
  politicianName: string;
  relatedPoliticianId: string;
  relatedPoliticianName: string;
  relationshipType: RelationshipType;
  overlapType: "concurrent" | "sequential";
  position1: {
    title: string;
    jurisdiction: string;
    startDate: Date;
    endDate: Date | null;
  };
  position2: {
    title: string;
    jurisdiction: string;
    startDate: Date;
    endDate: Date | null;
  };
  overlapPeriod?: {
    start: Date;
    end: Date;
  };
}

interface FamilyNetwork {
  politicianId: string;
  politicianName: string;
  familyMembers: FamilyMember[];
  totalFamilyMembersInPolitics: number;
  concurrentPositions: number;
  sequentialPositions: number;
  positionOverlaps: PositionOverlap[];
  isDynasty: boolean;
  dynastySeverity: "none" | "info";
}

interface FamilyNetworkSectionProps {
  politicianId: string;
  initialNetwork?: FamilyNetwork | null;
}

// ============================================
// Helper Functions
// ============================================

function formatDate(date: Date | string | null | undefined): string {
  if (!date) {
    return "Present";
  }
  const d = new Date(date);
  return d.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "short",
  });
}

function getRelationshipLabel(type: RelationshipType): string {
  const labels: Record<RelationshipType, string> = {
    spouse: "Spouse",
    parent: "Parent",
    child: "Child",
    sibling: "Sibling",
    in_law: "In-law",
    cousin: "Cousin",
    second_cousin: "Second Cousin",
    grandparent: "Grandparent",
    grandchild: "Grandchild",
  };
  return labels[type] || type;
}

function getRelationshipIcon(type: RelationshipType): React.ReactNode {
  switch (type) {
    case "spouse":
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "parent":
    case "grandparent":
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M5.293 7.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L6.707 7.707a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "child":
    case "grandchild":
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M14.707 12.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l2.293-2.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "sibling":
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
        </svg>
      );
    default:
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
        </svg>
      );
  }
}

function getLevelBadgeClass(level: GovernmentLevel): string {
  const classes: Record<GovernmentLevel, string> = {
    national: "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300",
    regional: "bg-secondary-100 text-secondary-700 dark:bg-secondary-900 dark:text-secondary-300",
    provincial: "bg-accent-100 text-accent-700 dark:bg-accent-900 dark:text-accent-300",
    city: "bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300",
    municipal: "bg-warning-100 text-warning-700 dark:bg-warning-900 dark:text-warning-300",
    barangay: "bg-neutral-100 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300",
  };
  return classes[level] || classes.barangay;
}

// ============================================
// Main Component
// ============================================

export function FamilyNetworkSection({
  politicianId,
  initialNetwork = null,
}: FamilyNetworkSectionProps) {
  const t = useTranslations("dataStates");
  const [network, setNetwork] = useState<FamilyNetwork | null>(initialNetwork);
  const [loading, setLoading] = useState(!initialNetwork);
  const [expandedMemberId, setExpandedMemberId] = useState<string | null>(null);
  const [showOverlaps, setShowOverlaps] = useState(false);

  const fetchNetwork = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/politicians/${politicianId}/family-network`);
      if (response.ok) {
        const data = await response.json();
        setNetwork(data);
      }
    } catch (error) {
      console.error("Failed to fetch family network:", error);
    } finally {
      setLoading(false);
    }
  }, [politicianId]);

  useEffect(() => {
    if (!initialNetwork) {
      fetchNetwork();
    }
  }, [fetchNetwork, initialNetwork]);

  // Handle no data - Requirement 24.7
  if (!loading && (!network || network.familyMembers.length === 0)) {
    return (
      <div className="card">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neutral-100 dark:bg-neutral-800">
            <svg className="h-5 w-5 text-neutral-500" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Family Network
            </h2>
            <p className="text-sm text-neutral-500">Political family connections</p>
          </div>
        </div>
        <div className="rounded-lg bg-neutral-50 p-8 text-center dark:bg-neutral-800">
          <svg
            className="mx-auto h-12 w-12 text-neutral-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 8h.01M11 12h1v4m9-4a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="mt-4 font-medium text-neutral-900 dark:text-white">
            {network ? t("familyEmpty") : t("unavailable")}
          </p>
          <p className="mt-2 text-sm text-neutral-500">{network && t("familyHint")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-accent-100 dark:bg-accent-900 flex h-10 w-10 items-center justify-center rounded-full">
            <svg
              className="text-accent-600 dark:text-accent-400 h-5 w-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900 dark:text-white">
              Family Network
            </h2>
            <p className="text-sm text-neutral-500">
              {network?.totalFamilyMembersInPolitics || 0} family member
              {(network?.totalFamilyMembersInPolitics || 0) !== 1 ? "s" : ""} in politics
            </p>
          </div>
        </div>
        {/* Dynasty Indicator - Requirement 24.5, 24.7 */}
        {network?.isDynasty && (
          <DynastyBadge
            concurrentPositions={network.concurrentPositions}
            sequentialPositions={network.sequentialPositions}
          />
        )}
      </div>

      {loading ? (
        <FamilyNetworkSkeleton />
      ) : network ? (
        <>
          {/* Summary Cards - Requirements 24.4, 24.5 */}
          <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard
              label="Family in Politics"
              value={network.totalFamilyMembersInPolitics.toString()}
              icon={
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
                </svg>
              }
            />
            <SummaryCard
              label="Concurrent Positions"
              value={network.concurrentPositions.toString()}
              variant={network.concurrentPositions > 0 ? "warning" : "default"}
              icon={
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            />
            <SummaryCard
              label="Sequential Positions"
              value={network.sequentialPositions.toString()}
              variant={network.sequentialPositions > 0 ? "info" : "default"}
              icon={
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            />
            <SummaryCard
              label="Dynasty Status"
              value={network.isDynasty ? "Yes" : "No"}
              variant={network.isDynasty ? "info" : "success"}
              icon={
                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
                    clipRule="evenodd"
                  />
                </svg>
              }
            />
          </div>

          {/* Position Overlaps Toggle */}
          {network.positionOverlaps.length > 0 && (
            <div className="mb-6">
              <button
                onClick={() => setShowOverlaps(!showOverlaps)}
                className="text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-2 text-sm font-medium"
              >
                <svg
                  className={`h-4 w-4 transition-transform ${showOverlaps ? "rotate-90" : ""}`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
                View Position Overlaps ({network.positionOverlaps.length})
              </button>
              {showOverlaps && <PositionOverlapsList overlaps={network.positionOverlaps} />}
            </div>
          )}

          {/* Family Members Tree - Requirements 24.1, 24.2, 24.3, 24.6 */}
          <FamilyTree
            members={network.familyMembers}
            expandedMemberId={expandedMemberId}
            onToggle={setExpandedMemberId}
          />

          {/* Disclaimer */}
          <div className="mt-6 rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800">
            <p className="text-xs text-neutral-500">
              <strong>Note:</strong> Political dynasty status is informational only and does not
              imply any wrongdoing. Dynasty indicators are based on documented family relationships
              and political positions from official records.
            </p>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

interface SummaryCardProps {
  label: string;
  value: string;
  variant?: "default" | "success" | "warning" | "info";
  icon?: React.ReactNode;
}

function SummaryCard({ label, value, variant = "default", icon }: SummaryCardProps) {
  const variantStyles = {
    default: "text-neutral-900 dark:text-white",
    success: "text-success-600 dark:text-success-400",
    warning: "text-warning-600 dark:text-warning-400",
    info: "text-primary-600 dark:text-primary-400",
  };

  const iconStyles = {
    default: "text-neutral-400",
    success: "text-success-500",
    warning: "text-warning-500",
    info: "text-primary-500",
  };

  return (
    <div className="rounded-lg bg-neutral-50 p-4 dark:bg-neutral-800">
      <div className="flex items-center justify-between">
        <p className="text-sm text-neutral-500">{label}</p>
        {icon && <span className={iconStyles[variant]}>{icon}</span>}
      </div>
      <p className={`mt-1 text-2xl font-bold ${variantStyles[variant]}`}>{value}</p>
    </div>
  );
}

interface DynastyBadgeProps {
  concurrentPositions: number;
  sequentialPositions: number;
}

/**
 * Dynasty Badge Component
 * Requirements: 24.5, 24.7
 */
function DynastyBadge({ concurrentPositions, sequentialPositions }: DynastyBadgeProps) {
  return (
    <div className="bg-accent-100 dark:bg-accent-900 flex items-center gap-2 rounded-full px-4 py-2">
      <svg
        className="text-accent-600 dark:text-accent-400 h-5 w-5"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z"
          clipRule="evenodd"
        />
      </svg>
      <div>
        <span className="text-accent-700 dark:text-accent-300 text-sm font-semibold">
          Political Dynasty
        </span>
        <span className="text-accent-600 dark:text-accent-400 ml-2 text-xs">
          {concurrentPositions > 0 && `${concurrentPositions} concurrent`}
          {concurrentPositions > 0 && sequentialPositions > 0 && " • "}
          {sequentialPositions > 0 && `${sequentialPositions} sequential`}
        </span>
      </div>
    </div>
  );
}

interface FamilyTreeProps {
  members: FamilyMember[];
  expandedMemberId: string | null;
  onToggle: (id: string | null) => void;
}

/**
 * Family Tree Component
 * Requirements: 24.1, 24.2, 24.3, 24.6
 */
function FamilyTree({ members, expandedMemberId, onToggle }: FamilyTreeProps) {
  // Group members by relationship type
  const groupedMembers = groupByRelationship(members);

  return (
    <div className="space-y-4">
      {Object.entries(groupedMembers).map(([relationship, relationshipMembers]) => (
        <RelationshipGroup
          key={relationship}
          relationship={relationship as RelationshipType}
          members={relationshipMembers}
          expandedMemberId={expandedMemberId}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}

function groupByRelationship(members: FamilyMember[]): Record<string, FamilyMember[]> {
  const order: RelationshipType[] = [
    "spouse",
    "parent",
    "child",
    "sibling",
    "grandparent",
    "grandchild",
    "in_law",
    "cousin",
  ];
  const grouped: Record<string, FamilyMember[]> = {};

  for (const type of order) {
    const typeMembers = members.filter((m) => m.relationshipType === type);
    if (typeMembers.length > 0) {
      grouped[type] = typeMembers;
    }
  }

  return grouped;
}

interface RelationshipGroupProps {
  relationship: RelationshipType;
  members: FamilyMember[];
  expandedMemberId: string | null;
  onToggle: (id: string | null) => void;
}

function RelationshipGroup({
  relationship,
  members,
  expandedMemberId,
  onToggle,
}: RelationshipGroupProps) {
  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-700">
      {/* Group Header - Requirement 24.2 */}
      <div className="flex items-center gap-3 bg-neutral-50 p-4 dark:bg-neutral-800">
        <div className="bg-accent-100 text-accent-600 dark:bg-accent-900 dark:text-accent-400 rounded-full p-2">
          {getRelationshipIcon(relationship)}
        </div>
        <div>
          <h3 className="font-medium text-neutral-900 dark:text-white">
            {getRelationshipLabel(relationship)}
            {members.length > 1 ? "s" : ""}
          </h3>
          <p className="text-sm text-neutral-500">
            {members.length} family member{members.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Family Members */}
      <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
        {members.map((member) => (
          <FamilyMemberCard
            key={member.id}
            member={member}
            isExpanded={expandedMemberId === member.id}
            onToggle={() => onToggle(expandedMemberId === member.id ? null : member.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface FamilyMemberCardProps {
  member: FamilyMember;
  isExpanded: boolean;
  onToggle: () => void;
}

/**
 * Family Member Card Component
 * Requirements: 24.1, 24.2, 24.3, 24.6
 */
function FamilyMemberCard({ member, isExpanded, onToggle }: FamilyMemberCardProps) {
  const hasPositions = member.positions.length > 0;
  const currentPosition = member.positions.find((p) => p.isCurrent);

  return (
    <div className="bg-white dark:bg-neutral-800">
      {/* Clickable Header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between p-4 text-left hover:bg-neutral-50 dark:hover:bg-neutral-700"
      >
        <div className="flex items-center gap-3">
          {/* Photo */}
          <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
            {member.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={member.photo}
                alt={member.fullName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-neutral-400">
                <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
            )}
          </div>

          {/* Name and Current Position */}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-neutral-900 dark:text-white">
                {member.fullName}
              </span>
              {/* Requirement 24.6 - Click-through to profile */}
              {member.isInDatabase && (
                <Link
                  href={`/politicians/${member.politicianId}`}
                  onClick={(e) => e.stopPropagation()}
                  className="text-primary-500 hover:text-primary-600"
                  title="View profile"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </Link>
              )}
            </div>
            {/* Requirement 24.3 - Show current position */}
            {currentPosition ? (
              <p className="text-sm text-neutral-500">
                {currentPosition.title}, {currentPosition.jurisdiction}
              </p>
            ) : hasPositions && member.positions[0] ? (
              <p className="text-sm text-neutral-500">Former: {member.positions[0].title}</p>
            ) : (
              <p className="text-sm text-neutral-400 italic">No political positions</p>
            )}
          </div>
        </div>

        {/* Expand Icon */}
        {hasPositions && (
          <svg
            className={`h-5 w-5 text-neutral-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Expanded Content - Requirement 24.3 */}
      {isExpanded && hasPositions && (
        <div className="border-t border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-900">
          <h4 className="mb-3 text-xs font-semibold text-neutral-500 uppercase">
            Political Positions Held
          </h4>
          <div className="space-y-3">
            {member.positions.map((position) => (
              <PositionCard key={position.id} position={position} />
            ))}
          </div>

          {/* Source Attribution */}
          {member.sources.length > 0 && member.sources[0] && (
            <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
              <p className="text-xs text-neutral-400">
                Source: {member.sources[0].sourceName}
                {member.sources[0].documentDate && (
                  <> • {formatDate(member.sources[0].documentDate)}</>
                )}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PositionCardProps {
  position: FamilyMemberPosition;
}

/**
 * Position Card Component
 * Requirement 24.3
 */
function PositionCard({ position }: PositionCardProps) {
  return (
    <div className="rounded-lg bg-white p-3 dark:bg-neutral-800">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-neutral-900 dark:text-white">{position.title}</span>
            {position.isCurrent && (
              <span className="badge bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300">
                Current
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-500">{position.jurisdiction}</p>
        </div>
        <span className={`badge text-xs ${getLevelBadgeClass(position.level)}`}>
          {position.level}
        </span>
      </div>
      <p className="mt-2 text-xs text-neutral-400">
        {formatDate(position.startDate)} – {formatDate(position.endDate)}
      </p>
    </div>
  );
}

interface PositionOverlapsListProps {
  overlaps: PositionOverlap[];
}

/**
 * Position Overlaps List Component
 * Requirement 24.4
 */
function PositionOverlapsList({ overlaps }: PositionOverlapsListProps) {
  const concurrentOverlaps = overlaps.filter((o) => o.overlapType === "concurrent");
  const sequentialOverlaps = overlaps.filter((o) => o.overlapType === "sequential");

  return (
    <div className="mt-4 space-y-4">
      {/* Concurrent Positions - Requirement 24.4 */}
      {concurrentOverlaps.length > 0 && (
        <div className="border-warning-200 dark:border-warning-800 rounded-lg border">
          <div className="bg-warning-50 dark:bg-warning-900/20 flex items-center gap-3 p-3">
            <svg
              className="text-warning-600 dark:text-warning-400 h-5 w-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-warning-700 dark:text-warning-300 text-sm font-medium">
              Concurrent Positions ({concurrentOverlaps.length})
            </span>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {concurrentOverlaps.map((overlap, index) => (
              <OverlapItem key={index} overlap={overlap} />
            ))}
          </div>
        </div>
      )}

      {/* Sequential Positions - Requirement 24.4 */}
      {sequentialOverlaps.length > 0 && (
        <div className="border-primary-200 dark:border-primary-800 rounded-lg border">
          <div className="bg-primary-50 dark:bg-primary-900/20 flex items-center gap-3 p-3">
            <svg
              className="text-primary-600 dark:text-primary-400 h-5 w-5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M3 3a1 1 0 000 2v8a2 2 0 002 2h2.586l-1.293 1.293a1 1 0 101.414 1.414L10 15.414l2.293 2.293a1 1 0 001.414-1.414L12.414 15H15a2 2 0 002-2V5a1 1 0 100-2H3zm11.707 4.707a1 1 0 00-1.414-1.414L10 9.586 8.707 8.293a1 1 0 00-1.414 0l-2 2a1 1 0 101.414 1.414L8 10.414l1.293 1.293a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-primary-700 dark:text-primary-300 text-sm font-medium">
              Sequential Positions ({sequentialOverlaps.length})
            </span>
          </div>
          <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
            {sequentialOverlaps.map((overlap, index) => (
              <OverlapItem key={index} overlap={overlap} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface OverlapItemProps {
  overlap: PositionOverlap;
}

function OverlapItem({ overlap }: OverlapItemProps) {
  return (
    <div className="bg-white p-3 dark:bg-neutral-800">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-neutral-900 dark:text-white">
          {overlap.politicianName}
        </span>
        <span className="text-neutral-400">↔</span>
        <span className="font-medium text-neutral-900 dark:text-white">
          {overlap.relatedPoliticianName}
        </span>
        <span className="badge bg-neutral-100 text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
          {getRelationshipLabel(overlap.relationshipType)}
        </span>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div className="rounded bg-neutral-50 p-2 dark:bg-neutral-900">
          <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            {overlap.position1.title}
          </p>
          <p className="text-xs text-neutral-500">{overlap.position1.jurisdiction}</p>
          <p className="text-xs text-neutral-400">
            {formatDate(overlap.position1.startDate)} – {formatDate(overlap.position1.endDate)}
          </p>
        </div>
        <div className="rounded bg-neutral-50 p-2 dark:bg-neutral-900">
          <p className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
            {overlap.position2.title}
          </p>
          <p className="text-xs text-neutral-500">{overlap.position2.jurisdiction}</p>
          <p className="text-xs text-neutral-400">
            {formatDate(overlap.position2.startDate)} – {formatDate(overlap.position2.endDate)}
          </p>
        </div>
      </div>
      {overlap.overlapPeriod && (
        <p className="text-warning-600 dark:text-warning-400 mt-2 text-xs">
          Overlap period: {formatDate(overlap.overlapPeriod.start)} –{" "}
          {formatDate(overlap.overlapPeriod.end)}
        </p>
      )}
    </div>
  );
}

/**
 * Skeleton Loader
 */
function FamilyNetworkSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg bg-neutral-100 p-4 dark:bg-neutral-800">
            <div className="h-4 w-20 rounded bg-neutral-200 dark:bg-neutral-700" />
            <div className="mt-2 h-8 w-12 rounded bg-neutral-200 dark:bg-neutral-700" />
          </div>
        ))}
      </div>

      {/* Family Members */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700">
        <div className="bg-neutral-50 p-4 dark:bg-neutral-800">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-neutral-200 dark:bg-neutral-700" />
            <div>
              <div className="h-4 w-24 rounded bg-neutral-200 dark:bg-neutral-700" />
              <div className="mt-1 h-3 w-16 rounded bg-neutral-200 dark:bg-neutral-700" />
            </div>
          </div>
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border-t border-neutral-200 p-4 dark:border-neutral-700">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-neutral-200 dark:bg-neutral-700" />
              <div>
                <div className="h-4 w-32 rounded bg-neutral-200 dark:bg-neutral-700" />
                <div className="mt-1 h-3 w-24 rounded bg-neutral-200 dark:bg-neutral-700" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
