"use client";

import React from "react";

interface PriceDisplayProps {
  amount: number;
  originalAmount?: number;
  currency?: string;
  size?: "sm" | "md" | "lg";
}

/**
 * Price display with optional discount indicator
 * Uses Intl.NumberFormat for formatting
 */
export function PriceDisplay({
  amount,
  originalAmount,
  currency = "USD",
  size = "md",
}: PriceDisplayProps) {
  const formatter = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });

  const formattedPrice = formatter.format(amount);
  const formattedOriginal = originalAmount ? formatter.format(originalAmount) : null;

  const discountPercent = originalAmount
    ? Math.round(((originalAmount - amount) / originalAmount) * 100)
    : null;

  const sizeStyles = {
    sm: "text-sm",
    md: "text-lg",
    lg: "text-2xl",
  };

  return (
    <div className="flex items-baseline gap-2 flex-wrap">
      <span className={`font-bold text-gray-900 ${sizeStyles[size]}`}>{formattedPrice}</span>
      {formattedOriginal && (
        <>
          <span className="text-sm text-gray-500 line-through">{formattedOriginal}</span>
          <span className="text-sm font-medium text-green-600 bg-green-100 px-1.5 py-0.5 rounded">
            {discountPercent}% off
          </span>
        </>
      )}
    </div>
  );
}
