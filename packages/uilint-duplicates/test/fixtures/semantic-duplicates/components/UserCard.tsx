import React from 'react';

interface UserCardProps {
  user: {
    name: string;
    email: string;
    avatar: string;
  };
}

export function UserCard({ user }: UserCardProps) {
  return (
    <div className="p-4 border rounded-lg shadow-sm bg-white">
      <img
        src={user.avatar}
        alt={user.name}
        className="w-16 h-16 rounded-full mx-auto"
      />
      <h3 className="text-lg font-semibold mt-2 text-center">{user.name}</h3>
      <p className="text-gray-600 text-sm text-center">{user.email}</p>
    </div>
  );
}
