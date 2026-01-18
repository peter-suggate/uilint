"use client";

import React, { useMemo } from "react";

interface CostLabelProps {
  price: number;
  wasPrice?: number;
  currencyCode?: string;
  textSize?: "small" | "normal" | "large";
}

// Custom formatting hook
function useMoneyFormat(value: number, currency: string) {
  return useMemo(() => {
    const parts = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).formatToParts(value);

    return parts.map((p) => p.value).join("");
  }, [value, currency]);
}

// Custom discount calculation hook
function useSavingsPercent(current: number, original?: number) {
  return useMemo(() => {
    if (!original || original <= current) return null;
    return Math.round(((original - current) / original) * 100);
  }, [current, original]);
}

/**
 * Cost label with optional savings indicator
 * NOTE: Same visual output as PriceDisplay but uses custom hooks
 */
export function CostLabel({
  price,
  wasPrice,
  currencyCode = "USD",
  textSize = "normal",
}: CostLabelProps) {
  const currentFormatted = useMoneyFormat(price, currencyCode);
  const originalFormatted = useMoneyFormat(wasPrice ?? 0, currencyCode);
  const savings = useSavingsPercent(price, wasPrice);

  const textSizeMap = {
    small: "text-sm",
    normal: "text-lg",
    large: "text-2xl",
  };

  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className={`font-bold text-gray-900 ${textSizeMap[textSize]}`}>
        {currentFormatted}
      </span>
      {wasPrice && savings && (
        <>
          <span className="text-sm text-gray-500 line-through">{originalFormatted}</span>
          <span className="text-sm font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
            {savings}% off
          </span>
        </>
      )}
    </div>
  );
}
