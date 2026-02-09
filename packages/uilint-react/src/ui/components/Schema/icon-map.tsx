/**
 * Icon Map
 *
 * Maps IconName strings from uilint-core to Lucide React icons.
 */

import type { IconName } from "uilint-core";
import {
  Target,
  Link,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  X,
  Check,
  AlertTriangle,
  AlertCircle,
  Info,
  HelpCircle,
  Eye,
  Camera,
  Crop,
  ScanLine,
  Search,
  Filter,
  Brain,
  Sparkles,
  Code,
  File,
  FileCode,
  Folder,
  GitBranch,
  Copy,
  Clipboard,
  Book,
  BookOpen,
  Bookmark,
  Play,
  Pause,
  RefreshCw,
  Trash2,
  Edit,
  Settings,
  Plus,
  Minus,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps IconName to Lucide icon component.
 * Uses Partial since IconName accepts any string for forward compatibility.
 */
const iconMap: Partial<Record<IconName, LucideIcon>> = {
  // UI Navigation
  target: Target,
  link: Link,
  "external-link": ExternalLink,
  "chevron-right": ChevronRight,
  "chevron-down": ChevronDown,
  "chevron-up": ChevronUp,
  x: X,
  check: Check,
  "alert-triangle": AlertTriangle,
  "alert-circle": AlertCircle,
  info: Info,
  "help-circle": HelpCircle,
  // Analysis
  eye: Eye,
  camera: Camera,
  crop: Crop,
  scan: ScanLine,
  search: Search,
  filter: Filter,
  brain: Brain,
  sparkles: Sparkles,
  // Code
  code: Code,
  file: File,
  "file-code": FileCode,
  folder: Folder,
  "git-branch": GitBranch,
  copy: Copy,
  clipboard: Clipboard,
  // Content
  book: Book,
  "book-open": BookOpen,
  bookmark: Bookmark,
  // Actions
  play: Play,
  pause: Pause,
  refresh: RefreshCw,
  trash: Trash2,
  edit: Edit,
  settings: Settings,
  plus: Plus,
  minus: Minus,
  // Status
  loader: Loader2,
  "check-circle": CheckCircle,
  "x-circle": XCircle,
  clock: Clock,
};

/**
 * Gets the Lucide icon component for an IconName
 */
export function getIcon(name: IconName): LucideIcon {
  return iconMap[name as keyof typeof iconMap] ?? Info;
}

/**
 * Renders an icon by name
 */
export function Icon({
  name,
  size = 16,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const IconComponent = getIcon(name);
  return <IconComponent size={size} className={className} style={style} />;
}
