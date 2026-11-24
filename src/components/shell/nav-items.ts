export interface NavItem {
  href: string;
  label: string;
  /** Not built yet: rendered greyed and not clickable. */
  soon?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/intake", label: "Intake" },
  { href: "/icp", label: "ICP" },
  { href: "/leads", label: "Leads" },
  { href: "/outbox", label: "Outbox" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/analytics", label: "Analytics" },
];
