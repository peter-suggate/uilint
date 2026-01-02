import React from "react";

interface CardProps {
  title: string;
  description: string;
}

export function Card({ title, description }: CardProps) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
      <p className="text-gray-600 mt-2">{description}</p>
    </div>
  );
}

export function CardAlt({ title, description }: CardProps) {
  // Intentionally different: p-5 instead of p-6, rounded-lg instead of rounded-xl
  return (
    <div className="bg-white p-5 rounded-lg shadow">
      <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      <p className="text-gray-500 mt-2">{description}</p>
    </div>
  );
}
