import React, { ReactNode } from 'react';

interface TextProps {
  children: ReactNode;
  className?: string;
}

export function Heading({ children, className = '' }: TextProps) {
  return (
    <h1 className={`text-4xl font-bold text-gray-900 mb-2 ${className}`}>
      {children}
    </h1>
  );
}

export function SubHeading({ children, className = '' }: TextProps) {
  return (
    <h2 className={`text-xl text-gray-600 ${className}`}>
      {children}
    </h2>
  );
}

export function BodyText({ children, className = '' }: TextProps) {
  return (
    <p className={`text-base text-gray-600 leading-relaxed ${className}`}>
      {children}
    </p>
  );
}

