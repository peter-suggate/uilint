import React from "react";

interface SmallCardProps {
  title: string;
  description: string;
  imageUrl: string;
  onClick?: () => void;
}

export function SmallCard({ title, description, imageUrl, onClick }: SmallCardProps) {
  return (
    <div
      className="bg-white rounded-lg shadow p-4 cursor-pointer hover:shadow-lg transition-shadow"
      onClick={onClick}
    >
      <img
        src={imageUrl}
        alt={title}
        className="w-full h-32 object-cover rounded-md mb-3"
      />
      <h3 className="font-semibold text-gray-900">{title}</h3>
      <p className="text-sm text-gray-500 mt-1">{description}</p>
    </div>
  );
}
