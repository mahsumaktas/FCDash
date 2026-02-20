import {
  LayoutDashboard, MessageSquare, Bot, List, Shield,
  Cpu, Radio, Wrench, Clock, Server, Mic, Settings,
  ScrollText, BarChart3, type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: boolean; // for approval count
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/agents", label: "Agents", icon: Bot },
  { href: "/sessions", label: "Sessions", icon: List },
  { href: "/approvals", label: "Approvals", icon: Shield, badge: true },
  { href: "/models", label: "Models", icon: Cpu },
  { href: "/channels", label: "Channels", icon: Radio },
  { href: "/skills", label: "Skills", icon: Wrench },
  { href: "/cron", label: "Cron", icon: Clock },
  { href: "/nodes", label: "Nodes", icon: Server },
  { href: "/voice", label: "Voice", icon: Mic },
  { href: "/config", label: "Config", icon: Settings },
  { href: "/logs", label: "Logs", icon: ScrollText },
  { href: "/usage", label: "Usage", icon: BarChart3 },
];
