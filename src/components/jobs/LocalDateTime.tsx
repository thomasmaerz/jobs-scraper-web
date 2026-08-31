"use client";

import { useEffect, useState } from "react";

export default function LocalDateTime({ value }: { value: string }) {
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    setFormatted(
      new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value)),
    );
  }, [value]);

  return formatted ? <span>Scraped {formatted}</span> : null;
}
