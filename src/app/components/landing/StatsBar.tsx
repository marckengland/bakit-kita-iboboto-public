"use client";

import { useState, useEffect, useRef } from "react";

interface StatItemProps {
  value: number;
  suffix?: string;
  label: string;
}

function useCountUp(target: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && !started) {
          setStarted(true);
        }
      },
      { threshold: 0.3 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) {
      return;
    }
    const steps = 60;
    const increment = target / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [started, target, duration]);

  return { count, ref };
}

function StatItem({ value, suffix = "+", label }: StatItemProps) {
  const { count, ref } = useCountUp(value);

  return (
    <div ref={ref} className="flex flex-col items-center px-4 py-2 sm:px-8">
      <span className="text-primary-500 text-2xl font-bold sm:text-3xl">
        {count.toLocaleString()}
        {suffix}
      </span>
      <span className="mt-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
        {label}
      </span>
    </div>
  );
}

interface StatsBarProps {
  stats: {
    politicians: number;
    bills: number;
    sources: string;
  };
}

export function StatsBar({ stats }: StatsBarProps) {
  return (
    <div className="mx-auto mt-16 max-w-3xl">
      <div className="flex items-center justify-center divide-x divide-neutral-200 rounded-2xl border border-neutral-200 bg-white/80 py-4 shadow-sm backdrop-blur-sm dark:divide-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/80">
        <StatItem value={stats.politicians} label="Politicians Tracked" />
        <StatItem value={stats.bills} label="Bills Monitored" />
        <div className="flex flex-col items-center px-4 py-2 sm:px-8">
          <span className="text-primary-500 text-2xl font-bold sm:text-3xl">{stats.sources}</span>
          <span className="mt-1 text-xs font-medium text-neutral-500 dark:text-neutral-400">
            Official Sources
          </span>
        </div>
      </div>
    </div>
  );
}
