"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, CheckSquare, Settings, User } from "lucide-react";

export function Navigation() {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home", icon: Home },
    { href: "/todos", label: "Todos", icon: CheckSquare },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/profile", label: "Profile", icon: User },
  ];

  return (
    <nav className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex">
            {/* Logo with inconsistent styling */}
            <div className="flex-shrink-0 flex items-center">
              <h1 className="text-xl font-bold text-blue-600">TodoApp</h1>
            </div>

            {/* Navigation links with various inconsistent styles */}
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {links.map((link, idx) => {
                const isActive = pathname === link.href;
                const Icon = link.icon;

                // Deliberate inconsistencies: different active states, padding, colors
                if (idx === 0) {
                  // Home - blue underline
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive
                          ? "border-blue-500 text-gray-900"
                          : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {link.label}
                    </Link>
                  );
                } else if (idx === 1) {
                  // Todos - background highlight
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-semibold ${
                        isActive
                          ? "bg-blue-100 text-blue-700"
                          : "text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="w-5 h-5 mr-1" />
                      {link.label}
                    </Link>
                  );
                } else if (idx === 2) {
                  // Settings - green accent
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`inline-flex items-center px-2 pt-1 border-b-2 text-base ${
                        isActive
                          ? "border-green-500 text-green-700"
                          : "border-transparent text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-3" />
                      {link.label}
                    </Link>
                  );
                } else {
                  // Profile - different style altogether
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={`inline-flex items-center px-4 py-1 rounded-full text-sm font-medium ${
                        isActive
                          ? "bg-purple-600 text-white"
                          : "text-gray-500 hover:text-purple-600"
                      }`}
                    >
                      <Icon className="w-4 h-4 mr-2" />
                      {link.label}
                    </Link>
                  );
                }
              })}
            </div>
          </div>

          {/* Right side - user section with inconsistent button */}
          <div className="flex items-center">
            <button className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm">
              Sign Out
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu - deliberately different styling */}
      <div className="sm:hidden">
        <div className="pt-2 pb-3 space-y-1">
          {links.map((link) => {
            const isActive = pathname === link.href;
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                  isActive
                    ? "bg-blue-50 border-blue-500 text-blue-700"
                    : "border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center">
                  <Icon className="w-5 h-5 mr-3" />
                  {link.label}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
