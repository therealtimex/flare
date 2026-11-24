export interface NavItem {
  href: string;
  label: string;
  /** Not built yet: rendered greyed and not clickable. */
  soon?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/intake", label: "Intake" },
  { href: "/icp", label: "ICP" },
  { href: "/leads", label: "Leads", soon: true },
  { href: "/outbox", label: "Outbox", soon: true },
  { href: "/pipeline", label: "Pipeline", soon: true },
  { href: "/graph", label: "Graph", soon: true },
  { href: "/analytics", label: "Analytics", soon: true },
];
