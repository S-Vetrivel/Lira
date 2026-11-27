import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const ROUTE_SEO_META = [
  {
    match: (p) => p === "/" || p === "/welcome" || p === "/landing",
    title: "Lira Workspace — Team Operations, Sprint Boards, Calendar & Approvals",
    description:
      "Unify Kanban boards, schedule deadlines, departments, INR approval workflows, encrypted team chat, and role-governed AI workflows.",
    robots: "index, follow",
  },
  {
    match: (p) => p.startsWith("/login"),
    title: "Sign In — Lira Workspace",
    description: "Sign in to your Lira Workspace account to manage boards, schedules, and approvals.",
    robots: "index, follow",
  },
  {
    match: (p) => p.startsWith("/signup"),
    title: "Create Account — Lira Workspace",
    description: "Register and join your organization workspace on Lira.",
    robots: "index, follow",
  },
  {
    match: (p) => p.startsWith("/dashboard") || p.startsWith("/analytics"),
    title: "Analytics & Overview — Lira Workspace",
    description: "Workspace throughput metrics, team velocity, and delivery tracking.",
    robots: "noindex, nofollow",
  },
  {
    match: (p) => p.startsWith("/board"),
    title: "Sprint Board — Lira Workspace",
    description: "Manage project tasks, priorities, subtasks, and QA approvals.",
    robots: "noindex, nofollow",
  },
  {
    match: (p) => p.startsWith("/table") || p.startsWith("/grid"),
    title: "Task Table Grid — Lira Workspace",
    description: "Tabular filterable task matrix with inline updates and CSV export.",
    robots: "noindex, nofollow",
  },
  {
    match: (p) => p.startsWith("/calendar"),
    title: "Schedule Calendar — Lira Workspace",
    description: "Track task due dates, daily schedules, and sprint milestones.",
    robots: "noindex, nofollow",
  },
  {
    match: (p) => p.startsWith("/requests"),
    title: "Requests & Approvals — Lira Workspace",
    description: "Review and approve multi-stage organizational and INR budget requests.",
    robots: "noindex, nofollow",
  },
  {
    match: (p) => p.startsWith("/my-work"),
    title: "My Day & Tasks — Lira Workspace",
    description: "Personal deliverable queue and assigned action items.",
    robots: "noindex, nofollow",
  },
  {
    match: (p) => p.startsWith("/projects"),
    title: "Workspaces & Departments — Lira Workspace",
    description: "Manage projects, departments, files, links, and project chat.",
    robots: "noindex, nofollow",
  },
  {
    match: (p) => p.startsWith("/team"),
    title: "Team Directory & Onboarding — Lira Workspace",
    description: "Staff roster, department assignments, and join request governance.",
    robots: "noindex, nofollow",
  },
  {
    match: (p) => p.startsWith("/roles"),
    title: "Roles, Modules & AI Vault — Lira Workspace",
    description: "Configure RBAC roles, module permissions, and AI provider credentials.",
    robots: "noindex, nofollow",
  },
  {
    match: (p) => p.startsWith("/audit"),
    title: "Audit Trail & Live Sessions — Lira Workspace",
    description: "Real-time online presence, AI key usage logs, and action trail.",
    robots: "noindex, nofollow",
  },
  {
    match: (p) => p.startsWith("/broadcast"),
    title: "Push & Broadcast Console — Lira Workspace",
    description: "Send targeted or org-wide Web Push, In-App, and Email broadcasts with AI drafting.",
    robots: "noindex, nofollow",
  },
  {
    match: (p) => p.startsWith("/profile"),
    title: "Profile & Personal AI Keys — Lira Workspace",
    description: "Manage profile details, availability, and personal AI BYOK credentials.",
    robots: "noindex, nofollow",
  },
];

function upsertMeta(selector, attrs) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = document.createElement("meta");
    Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    document.head.appendChild(el);
  }
  return el;
}

export function RouteSeoSync() {
  const { pathname } = useLocation();

  useEffect(() => {
    const entry = ROUTE_SEO_META.find((r) => r.match(pathname)) || ROUTE_SEO_META[0];
    document.title = entry.title;

    const desc = upsertMeta('meta[name="description"]', { name: "description" });
    desc.setAttribute("content", entry.description);

    const robots = upsertMeta('meta[name="robots"]', { name: "robots" });
    robots.setAttribute("content", entry.robots);

    const ogTitle = upsertMeta('meta[property="og:title"]', { property: "og:title" });
    ogTitle.setAttribute("content", entry.title);

    const ogDesc = upsertMeta('meta[property="og:description"]', { property: "og:description" });
    ogDesc.setAttribute("content", entry.description);

    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.setAttribute("rel", "canonical");
      document.head.appendChild(canonical);
    }
    canonical.setAttribute("href", `${window.location.origin}${pathname}`);
  }, [pathname]);

  return null;
}

