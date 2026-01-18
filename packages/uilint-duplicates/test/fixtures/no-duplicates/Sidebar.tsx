import React, { useState } from 'react';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  children?: NavItem[];
}

interface SidebarProps {
  items: NavItem[];
  activeId?: string;
  onNavigate: (id: string) => void;
  collapsed?: boolean;
}

export function Sidebar({ items, activeId, onNavigate, collapsed = false }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const renderItem = (item: NavItem, depth = 0) => {
    const isActive = activeId === item.id;
    const isExpanded = expandedItems.has(item.id);
    const hasChildren = item.children && item.children.length > 0;

    return (
      <li key={item.id}>
        <button
          onClick={() => hasChildren ? toggleExpand(item.id) : onNavigate(item.id)}
          className={`
            flex items-center gap-3 w-full px-3 py-2 rounded-md text-left
            ${isActive ? 'bg-blue-100 text-blue-700' : 'text-gray-700 hover:bg-gray-100'}
            ${depth > 0 ? 'ml-4' : ''}
          `}
        >
          <span className="w-5 h-5 flex-shrink-0">{item.icon}</span>
          {!collapsed && (
            <>
              <span className="flex-1">{item.label}</span>
              {hasChildren && (
                <svg
                  className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </>
          )}
        </button>
        {hasChildren && isExpanded && !collapsed && (
          <ul className="mt-1">
            {item.children!.map(child => renderItem(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <aside className={`bg-white border-r h-full ${collapsed ? 'w-16' : 'w-64'} transition-all`}>
      <nav className="p-4">
        <ul className="space-y-1">
          {items.map(item => renderItem(item))}
        </ul>
      </nav>
    </aside>
  );
}
