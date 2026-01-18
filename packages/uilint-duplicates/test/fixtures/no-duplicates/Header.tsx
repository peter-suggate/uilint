import React from 'react';

interface HeaderProps {
  title: string;
  showLogo?: boolean;
  onMenuClick?: () => void;
}

export function Header({ title, showLogo = true, onMenuClick }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 bg-white shadow-sm">
      <div className="flex items-center gap-4">
        {showLogo && (
          <img src="/logo.svg" alt="Logo" className="h-8 w-auto" />
        )}
        <h1 className="text-xl font-bold text-gray-900">{title}</h1>
      </div>
      <button
        onClick={onMenuClick}
        className="p-2 rounded-md hover:bg-gray-100"
        aria-label="Open menu"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
    </header>
  );
}
