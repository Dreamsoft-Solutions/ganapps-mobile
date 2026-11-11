import {
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  Clock,
  Heart,
  Info,
  type LucideIcon,
  MapPin,
  MessageCircle,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkles,
  Square,
  SquareCheck,
  Star,
  Sun,
  Users,
  X,
} from 'lucide-react-native';
import { cssInterop } from 'nativewind';

/**
 * Resolves semantic utility colors at the app's JSX boundary before Lucide creates its SVG.
 *
 * Register new icons that receive semantic className colors here; explicit color props and
 * LucideProvider defaults remain unchanged when no color utility is supplied.
 *
 * @param icon - The Lucide component receiving semantic class names.
 * @returns Nothing.
 */
export function registerIconInterop(icon: LucideIcon): void {
  if (!icon) return;
  cssInterop(icon, { className: { target: false, nativeStyleToProp: { color: 'color' } } });
}

const semanticIcons: readonly LucideIcon[] = [
  ArrowLeft,
  BadgeCheck,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Circle,
  CircleAlert,
  CircleCheck,
  Clock,
  Heart,
  Info,
  MapPin,
  MessageCircle,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Share2,
  Sparkles,
  Square,
  SquareCheck,
  Star,
  Sun,
  Users,
  X,
];
for (const icon of semanticIcons) registerIconInterop(icon);
