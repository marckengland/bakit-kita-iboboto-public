/**
 * Elections Calendar Component
 *
 * Displays elections in a calendar view format.
 * Requirements: 26.1, 26.6
 */

"use client";

import { useState, useMemo } from "react";
import Link from "next/link";

interface UpcomingElection {
  id: string;
  name: string;
  type: "national" | "local" | "barangay" | "special";
  date: string;
  level: string;
  jurisdiction?: string;
  daysUntil: number;
  isPast: boolean;
  deadlines: ElectionDeadline[];
  positions: ElectionPosition[];
}

interface ElectionDeadline {
  id: string;
  name: string;
  date: string;
  description: string;
  type: string;
  isPast: boolean;
}

interface ElectionPosition {
  id: string;
  title: string;
  level: string;
  jurisdiction?: string;
  slots: number;
  candidates: FiledCandidate[];
}

interface FiledCandidate {
  id: string;
  politicianId: string;
  fullName: string;
  photo: string | null;
  party: string | null;
  position: string;
  filingDate: string;
}

interface ElectionsCalendarProps {
  elections: UpcomingElection[];
}

export function ElectionsCalendar({ elections }: ElectionsCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Get all events (elections and deadlines) for the calendar
  const calendarEvents = useMemo(() => {
    const events: Array<{
      date: string;
      type: "election" | "deadline";
      name: string;
      electionId: string;
      color: string;
    }> = [];

    elections.forEach((election) => {
      // Add election day
      events.push({
        date: election.date,
        type: "election",
        name: election.name,
        electionId: election.id,
        color: getElectionColor(election.type),
      });

      // Add deadlines
      election.deadlines.forEach((deadline) => {
        events.push({
          date: deadline.date,
          type: "deadline",
          name: deadline.name,
          electionId: election.id,
          color: getDeadlineColor(deadline.type),
        });
      });
    });

    return events;
  }, [elections]);

  // Get events for a specific date
  const getEventsForDate = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return calendarEvents.filter((e) => e.date === dateStr);
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPadding = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: Array<{ date: Date | null; isCurrentMonth: boolean }> = [];

    // Add padding for days before the first of the month
    for (let i = 0; i < startPadding; i++) {
      const prevDate = new Date(year, month, -startPadding + i + 1);
      days.push({ date: prevDate, isCurrentMonth: false });
    }

    // Add days of the current month
    for (let i = 1; i <= totalDays; i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }

    // Add padding for days after the last of the month
    const endPadding = 42 - days.length; // 6 rows * 7 days
    for (let i = 1; i <= endPadding; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }

    return days;
  }, [year, month]);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const selectedDateEvents = selectedDate ? getEventsForDate(selectedDate) : [];

  return (
    <div className="card">
      {/* Calendar Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
          {currentDate.toLocaleDateString("en-PH", { month: "long", year: "numeric" })}
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg px-3 py-1.5 text-sm"
          >
            Today
          </button>
          <button
            onClick={goToPreviousMonth}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Previous month"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            onClick={goToNextMonth}
            className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            aria-label="Next month"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Day Headers */}
      <div className="mb-2 grid grid-cols-7 gap-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
          <div key={day} className="py-2 text-center text-xs font-medium text-neutral-500">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map(({ date, isCurrentMonth }, index) => {
          if (!date) {
            return <div key={index} />;
          }

          const events = getEventsForDate(date);
          const hasEvents = events.length > 0;
          const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

          return (
            <button
              key={index}
              onClick={() => setSelectedDate(date)}
              className={`relative min-h-[60px] rounded-lg p-1 text-left transition-colors ${
                isCurrentMonth
                  ? "text-neutral-900 dark:text-white"
                  : "text-neutral-400 dark:text-neutral-600"
              } ${
                isSelected
                  ? "bg-primary-100 ring-primary-500 dark:bg-primary-900/30 ring-2"
                  : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
              } ${isToday(date) ? "font-bold" : ""}`}
            >
              <span
                className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                  isToday(date) ? "bg-primary-500 text-white" : ""
                }`}
              >
                {date.getDate()}
              </span>

              {/* Event Indicators */}
              {hasEvents && (
                <div className="mt-1 flex flex-wrap gap-0.5">
                  {events.slice(0, 3).map((event, i) => (
                    <span
                      key={i}
                      className={`h-1.5 w-1.5 rounded-full ${event.color}`}
                      title={event.name}
                    />
                  ))}
                  {events.length > 3 && (
                    <span className="text-[10px] text-neutral-500">+{events.length - 3}</span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
        <div className="flex items-center gap-1.5">
          <span className="bg-primary-500 h-3 w-3 rounded-full" />
          <span className="text-xs text-neutral-600 dark:text-neutral-400">National Election</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="bg-success-500 h-3 w-3 rounded-full" />
          <span className="text-xs text-neutral-600 dark:text-neutral-400">Local Election</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="bg-warning-500 h-3 w-3 rounded-full" />
          <span className="text-xs text-neutral-600 dark:text-neutral-400">Deadline</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="bg-info-500 h-3 w-3 rounded-full" />
          <span className="text-xs text-neutral-600 dark:text-neutral-400">Barangay Election</span>
        </div>
      </div>

      {/* Selected Date Events */}
      {selectedDate && (
        <div className="mt-4 border-t border-neutral-200 pt-4 dark:border-neutral-700">
          <h3 className="mb-3 font-medium text-neutral-900 dark:text-white">
            {selectedDate.toLocaleDateString("en-PH", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </h3>

          {selectedDateEvents.length === 0 ? (
            <p className="text-sm text-neutral-500">No events on this date</p>
          ) : (
            <div className="space-y-2">
              {selectedDateEvents.map((event, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-700"
                >
                  <span className={`h-3 w-3 flex-shrink-0 rounded-full ${event.color}`} />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-neutral-900 dark:text-white">{event.name}</p>
                    <p className="text-xs text-neutral-500">
                      {event.type === "election" ? "Election Day" : "Deadline"}
                    </p>
                  </div>
                  <Link
                    href={`#${event.electionId}`}
                    className="text-primary-500 text-sm hover:underline"
                  >
                    View
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Helper functions
function getElectionColor(type: string): string {
  switch (type) {
    case "national":
      return "bg-primary-500";
    case "local":
      return "bg-success-500";
    case "barangay":
      return "bg-info-500";
    case "special":
      return "bg-purple-500";
    default:
      return "bg-neutral-500";
  }
}

function getDeadlineColor(type: string): string {
  switch (type) {
    case "voter_registration":
      return "bg-warning-500";
    case "filing_period_start":
    case "filing_period_end":
      return "bg-orange-500";
    case "campaign_start":
    case "campaign_end":
      return "bg-yellow-500";
    case "election_day":
      return "bg-error-500";
    default:
      return "bg-warning-500";
  }
}

// Icon Components
function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
    </svg>
  );
}
