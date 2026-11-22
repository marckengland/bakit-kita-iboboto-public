"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";

export function RotatingTagline() {
  const t = useTranslations("home");
  const taglines = [
    t("rotatingTaglines.line1"),
    t("rotatingTaglines.line2"),
    t("rotatingTaglines.line3"),
    t("rotatingTaglines.line4"),
  ];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsVisible(false);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % taglines.length);
        setIsVisible(true);
      }, 400);
    }, 3500);

    return () => clearInterval(interval);
  }, [taglines.length]);

  return (
    <span
      className={`from-primary-500 to-secondary-500 inline-block bg-gradient-to-r bg-clip-text text-transparent transition-opacity duration-400 ${
        isVisible ? "opacity-100" : "opacity-0"
      }`}
      aria-live="polite"
    >
      {taglines[currentIndex]}
    </span>
  );
}
