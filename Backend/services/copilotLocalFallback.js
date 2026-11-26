const { MODULES_CATALOG } = require("../config/modulesCatalog");
const { escapeHtml } = require("./copilotSecurity");

function buildEntityDisambiguationCardHtml(items = []) {
  const cards = items
    .slice(0, 8)
    .map((item) => {
      const payload = escapeHtml(JSON.stringify(item.step || {}));
      const avatarHtml = item.avatar
        ? `<img src="${escapeHtml(item.avatar)}" alt="${escapeHtml(item.title)}" class="w-10 h-10 rounded-full object-cover border shrink-0" style="border-color: var(--lira-border);" />`
        : `<div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shrink-0 border" style="background: var(--lira-accent-bg); color: var(--lira-accent-text); border-color: var(--lira-border);">${escapeHtml(
            item.initials ||
              String(item.title || "L")
                .split(/\s+/)
                .map((w) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()
          )}</div>`;
      const actionAttr = item.replyText ? `data-lira-reply="${escapeHtml(item.replyText)}"` : `data-lira-step="${payload}"`;
      const isDanger = item.danger === true;

      return `<div class="p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 w-full transition-colors" style="background: var(--lira-card); border-color: var(--lira-border); color: var(--lira-text);">
        <div class="flex items-center gap-3 min-w-0">
          ${avatarHtml}
          <div class="min-w-0">
            <div class="font-bold text-xs truncate" style="color: var(--lira-text);">${escapeHtml(item.title)}</div>
            ${item.subtitle ? `<div class="text-[11px] truncate" style="color: var(--lira-muted);">${escapeHtml(item.subtitle)}</div>` : ""}
            ${item.meta ? `<div class="text-[10px] font-mono mt-0.5 truncate" style="color: var(--lira-muted);">${escapeHtml(item.meta)}</div>` : ""}
          </div>
        </div>
        <button type="button" ${actionAttr} class="px-3 py-1.5 rounded-lg text-[11px] font-bold shrink-0 cursor-pointer border" style="background: ${
          isDanger ? "var(--lira-danger-bg)" : "var(--lira-accent-bg)"
        }; color: ${isDanger ? "var(--lira-danger-text)" : "var(--lira-accent-text)"}; border-color: var(--lira-border);">${escapeHtml(item.buttonLabel || "Select")}</button>
      </div>`;
    })
    .join("");

  return `<div class="space-y-2 w-full">${cards}</div>`;
}

function buildUserDisambiguationCardHtml(users = [], actionType = "delete_user", actionVerb = "Remove") {
  return buildEntityDisambiguationCardHtml(
    users.map((u) => ({
      title: u.name,
      subtitle: `${u.jobTitle || u.role} • ${u.dept || "General"}`,
      meta: u.publicId || u.role,
      avatar: u.avatar,
      danger: actionType === "delete_user",
      buttonLabel: actionVerb,
      step: {
        type: actionType,
        label: `${actionVerb} ${u.name}`,
        prefill: { userId: u.id, targetName: u.name },
      },
    }))
  );
}

function buildRoleDisambiguationCardHtml(roles = [], actionIntentOrOpts = "default") {
  const { isDel, isDefault } =
    typeof actionIntentOrOpts === "string"
      ? { isDel: actionIntentOrOpts === "delete", isDefault: actionIntentOrOpts === "default" }
      : {
          isDel: actionIntentOrOpts?.actionType === "delete_role" || actionIntentOrOpts?.isDel === true,
          isDefault: Boolean(actionIntentOrOpts?.isDefault),
        };
  return buildEntityDisambiguationCardHtml(
    roles.map((r) => {
      const mods = (r.modules || []).slice(0, 6).join(", ") || "none";
      const step = isDel
        ? { type: "delete_role", label: `Delete ${r.displayName}`, prefill: { roleId: r.id, name: r.name } }
        : isDefault
        ? { type: "update_role", label: `Make ${r.displayName} Default`, prefill: { roleId: r.id, name: r.name, isDefault: true } }
        : { type: "update_role", label: `Select ${r.displayName}`, prefill: { roleId: r.id, name: r.name } };

      return {
        title: `${r.displayName}${r.isDefault ? " (Current Default)" : ""}`,
        subtitle: `Slug: ${r.name} • Modules: ${mods}`,
        initials: "RL",
        danger: isDel,
        buttonLabel: isDel ? "Delete Role" : isDefault ? "Set as Default" : "Configure Role",
        step,
      };
    })
  );
}

function buildRoleModulesCheckboxHtml(roleObj = {}) {
  const assignedSet = new Set(Array.isArray(roleObj.modules) ? roleObj.modules : []);
  const roleId = roleObj._id ? String(roleObj._id) : roleObj.id ? String(roleObj.id) : "";
  const roleName = roleObj.name || "";
  const displayName = roleObj.displayName || roleName || "Custom Role";

  const checkboxes = MODULES_CATALOG.map((mod) => {
    const isChecked = assignedSet.has(mod.key);
    return `<label class="flex items-start gap-2.5 p-2 rounded-lg border cursor-pointer transition-colors" style="background: var(--lira-surface); border-color: var(--lira-border); color: var(--lira-text);">
      <input type="checkbox" data-lira-checkbox-group="modules" value="${escapeHtml(mod.key)}"${isChecked ? " checked" : ""} class="mt-0.5 shrink-0 accent-zinc-500 cursor-pointer" />
      <div class="min-w-0">
        <div class="text-[11px] font-bold leading-tight truncate" style="color: var(--lira-text);">${escapeHtml(mod.name)}</div>
        <div class="text-[10px] leading-snug mt-0.5" style="color: var(--lira-muted);">${escapeHtml(mod.description)}</div>
      </div>
    </label>`;
  }).join("");

  return `<div data-lira-form="update_role" class="p-3.5 rounded-xl border space-y-3 w-full" style="background: var(--lira-card); border-color: var(--lira-border); color: var(--lira-text);">
    <div class="flex items-center justify-between gap-2">
      <div class="min-w-0">
        <div class="text-xs font-bold truncate" style="color: var(--lira-text);">Configure Modules: ${escapeHtml(displayName)}</div>
        <div class="text-[10px]" style="color: var(--lira-muted);">Check modules to assign to role <span class="font-mono">${escapeHtml(roleName)}</span></div>
      </div>
      ${roleObj.isDefault ? `<span class="px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0" style="background: var(--lira-accent-bg); color: var(--lira-accent-text);">Default</span>` : ""}
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-0.5">${checkboxes}</div>
    <label class="flex items-center gap-2 pt-1 text-[11px] font-semibold cursor-pointer" style="color: var(--lira-text);">
      <input type="checkbox" data-lira-field="isDefault"${roleObj.isDefault ? " checked" : ""} class="accent-zinc-500 cursor-pointer" />
      <span>Set as default role for new members</span>
    </label>
    <div class="flex justify-end pt-1">
      <button type="button" data-lira-submit-form="update_role" data-lira-role-id="${escapeHtml(roleId)}" data-lira-role-name="${escapeHtml(roleName)}" class="px-3.5 py-2 rounded-lg text-[11px] font-bold cursor-pointer border" style="background: var(--lira-accent-bg); color: var(--lira-accent-text); border-color: var(--lira-border);">Save Selected Modules</button>
    </div>
  </div>`;
}

// Note: Deliberately omit rewriting valid English domain words like "grid" inside arbitrary text so
// task titles ("Fix CSS grid layout bug") are preserved faithfully! Route matching handles "grid|table" cleanly.
const TYPO_REPLACEMENTS = [
  [/\b(craete|crete|creat|cretae|creeate)\b/gi, "create"],
  [/\b(updte|updt|updat|udpate)\b/gi, "update"],
  [/\b(delte|deleet|delet|dlete)\b/gi, "delete"],
  [/\b(remve|rmove|reomve|remov)\b/gi, "remove"],
  [/\b(roel|roels|rols|rloe|rolse|rle)\b/gi, "role"],
  [/\b(defualt|defult|defalt|deafult|dflt)\b/gi, "default"],
  [/\b(moduels|modles|moduls|mdoules)\b/gi, "modules"],
  [/\b(moduel|modul|mdoule)\b/gi, "module"],
  [/\b(calander|calender|calndr|clendar)\b/gi, "calendar"],
  [/\b(projct|proejct|projec|prject)\b/gi, "project"],
  [/\b(wrkspace|workspce|wrokspace)\b/gi, "workspace"],
  [/\b(departmnts?|departemtns?|departemnts?|departemnt|deparments?|deprtments?|deptments?|depts?)\b/gi, "departments"],
  [/\b(requst|reqest|requset|reqeust)\b/gi, "request"],
  [/\b(aprove|aprov|apporve|aproov)\b/gi, "approve"],
  [/\b(rejct|rjct|rejcet)\b/gi, "reject"],
  [/\b(usre|uesr|usr)\b/gi, "user"],
  [/\b(membr|memebr|mebmer)\b/gi, "member"],
  [/\b(tsak|taks|tsaks)\b/gi, "task"],
  [/\b(tble|tabke|tabel)\b/gi, "table"],
  [/\b(dashbord|dasboard|dashbaord)\b/gi, "dashboard"],
  [/\b(profle|proflie|proifle)\b/gi, "profile"],
  [/\b(audi|audt|audti)\b/gi, "audit"],
  [/\b(notfications|notifcations|notificaitons)\b/gi, "notifications"],
  [/\b(assgn|asign)\b/gi, "assign"],
  [/\b(submt|sbmit)\b/gi, "submit"],
  [/\b(chckbox|chekcbox|chekbox|checkbx)\b/gi, "checkbox"],
  [/\b(opn|opne)\b/gi, "open"],
  [/\b(shw|sohw)\b/gi, "show"],
  [/\b(lst)\b/gi, "list"],
  [/\b(chosse|chuse|chooze|choos)\b/gi, "choose"],
  [/\b(slect|selet|slct)\b/gi, "select"],
  [/\b(mke|mak|maek)\b/gi, "make"],
  [/\b(curser|crsr|cusor)\b/gi, "cursor"],
];

const KNOWN_VOCAB = new Set([
  "hi", "hello", "hey", "ok", "okay", "yes", "yeah", "no", "help", "what", "who", "how", "why", "where", "when", "which",
  "list", "show", "create", "make", "add", "new", "edit", "update", "change", "set", "delete", "remove", "confirm", "proceed",
  "open", "go", "navigate", "approve", "reject", "decline", "submit", "assign", "move", "mark", "read", "undo",
  "send", "dm", "chat", "message", "pin", "task", "tasks", "bug", "ticket", "board", "kanban", "table", "grid",
  "calendar", "schedule", "today", "tomorrow", "my", "day", "work", "request", "requests", "budget",
  "project", "projects", "workspace", "workspaces", "department", "departments", "team", "user", "users",
  "member", "members", "role", "roles", "default", "module", "modules", "permissions", "audit", "logs",
  "online", "profile", "theme", "dark", "light", "notifications", "ai", "key", "keys", "grant", "revoke",
  "chart", "graph", "csv", "pdf", "ppt", "report", "diagram", "cursor", "review", "auto", "summary",
  "superadmin", "superadmins", "admin", "manager", "employee", "testing", "status", "priority", "urgent",
  "high", "medium", "low", "all", "for", "to", "in", "on", "of", "the", "a", "an", "and", "or", "with",
  "as", "by", "me", "it", "this", "that", "please", "bro", "choose", "select", "click", "clean", "seeded",
]);

function damerauLevenshtein(a = "", b = "") {
  const s = String(a);
  const t = String(b);
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && s[i - 1] === t[j - 2] && s[i - 2] === t[j - 1]) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + cost);
      }
    }
  }
  return dp[m][n];
}

function normalizeTypoText(raw = "") {
  let out = String(raw || "");
  for (const [rx, rep] of TYPO_REPLACEMENTS) {
    out = out.replace(rx, rep);
  }
  return out;
}

function isUnintelligiblePrompt(rawPrompt = "", scopedCtx = {}) {
  const normalized = normalizeTypoText(rawPrompt).trim().toLowerCase();
  if (!normalized || normalized.length < 2) return true;
  const tokens = normalized.replace(/[^a-z0-9_-]+/g, " ").trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const entityWords = new Set();
  for (const r of scopedCtx.roles || []) {
    String(r.name || "").toLowerCase().split(/[_-\s]+/).forEach((w) => w && entityWords.add(w));
    String(r.displayName || "").toLowerCase().split(/[_-\s]+/).forEach((w) => w && entityWords.add(w));
  }
  for (const p of scopedCtx.projects || []) {
    String(p.name || "").toLowerCase().split(/\s+/).forEach((w) => w && entityWords.add(w));
    if (p.prefix) entityWords.add(String(p.prefix).toLowerCase());
  }
  for (const u of scopedCtx.teammates || []) {
    String(u.name || "").toLowerCase().split(/\s+/).forEach((w) => w && entityWords.add(w));
  }

  let meaningful = 0;
  for (const tok of tokens) {
    if (KNOWN_VOCAB.has(tok) || entityWords.has(tok) || /^[a-z0-9]{2,8}-\d+$/.test(tok) || /^\d+$/.test(tok)) {
      meaningful += 1;
      continue;
    }
    if (tok.length >= 4 && tok.length <= 12) {
      for (const word of KNOWN_VOCAB) {
        if (Math.abs(word.length - tok.length) <= 2 && damerauLevenshtein(tok, word) <= (tok.length >= 6 ? 2 : 1)) {
          meaningful += 1;
          break;
        }
      }
    }
  }

  return meaningful === 0;
}

function inspectCustomRolesCleanup(promptText = "", roles = []) {
  const lower = normalizeTypoText(promptText).toLowerCase();
  if (!/\broles?\b/i.test(lower)) return null;
  const isCleanup =
    /\b(clear|clean\s*up|wipe|purge)\b.*\broles?\b/i.test(lower) ||
    /\b(remove|delete)\b.*\b(all\s+custom|inactive|test|unused|non[\s-]?system|extra)\b.*\broles?\b/i.test(lower) ||
    /\bonly\s+(remove|delete|clear)\b.*\broles?\b/i.test(lower);
  if (!isCleanup) return null;

  const coreSlugs = new Set(["superadmin", "admin", "manager", "employee"]);
  const customRoles = (Array.isArray(roles) ? roles : []).filter(
    (r) => !r.isSystem && !coreSlugs.has(String(r.name || "").toLowerCase())
  );
  return { customRoles };
}

function findAmbiguousRoleMatches(promptText = "", roles = []) {
  const clean = normalizeTypoText(promptText);
  const lower = clean.toLowerCase();
  if (!/\brole\b/i.test(lower)) return null;

  const isCreateIntent = /\b(create|new|add)\s+(?:a\s+|an\s+|new\s+)?(?:platform\s+)?role\b/i.test(lower);
  const ignoreNames = new Set(["a", "an", "new", "the", "this", "that", "default", "platform", "modules", "module", "role", "roles"]);

  const quotedMatch =
    clean.match(/\brole\s+(?:named|called|key\s+)?["']([^"']{2,40})["']/i) ||
    clean.match(/["']([a-zA-Z0-9_-]{2,40})["']\s+(?:as\s+)?default\b/i);
  const wordMatch =
    clean.match(/\b(?:make|set|update|configure|edit|delete|remove)\s+(?:the\s+|platform\s+)?role\s+(?:named\s+|called\s+)?([a-zA-Z0-9_-]{2,40})\b/i) ||
    clean.match(/\b(?:make|set|update|configure|edit|delete|remove)\s+(?:the\s+|platform\s+)?([a-zA-Z0-9_-]{2,40})\s+role\b/i);
  const rawCandidate = (quotedMatch?.[1] || wordMatch?.[1] || "").trim();
  const candidate = rawCandidate && !ignoreNames.has(rawCandidate.toLowerCase()) ? rawCandidate : "";
  if (!candidate) return null;

  const q = candidate.toLowerCase();
  const normalizedQ = q.replace(/[^a-z0-9]+/g, "");
  const exactMatch = (roles || []).find(
    (r) =>
      String(r.name || "").toLowerCase() === q ||
      String(r.displayName || "").toLowerCase() === q ||
      String(r.name || "").toLowerCase().replace(/[^a-z0-9]+/g, "") === normalizedQ
  );
  if (exactMatch && !isCreateIntent) return null;

  const partialMatches = (roles || []).filter((r) => {
    const nm = String(r.name || "").toLowerCase();
    const dn = String(r.displayName || "").toLowerCase();
    return nm.includes(q) || dn.includes(q) || (normalizedQ.length >= 3 && (nm.replace(/[^a-z0-9]+/g, "").includes(normalizedQ) || dn.replace(/[^a-z0-9]+/g, "").includes(normalizedQ)));
  });

  if (partialMatches.length >= 2 || (!isCreateIntent && partialMatches.length === 1 && q.length < String(partialMatches[0].name || "").length)) {
    return {
      query: candidate,
      matches: partialMatches,
      isDel: /\b(delete|remove)\b/i.test(lower),
      isDefault: /\bdefault\b/i.test(lower),
    };
  }
  return null;
}

function runLocalCopilotFallback({ prompt, scopedCtx, history = [] }) {
  const text = String(prompt || "").trim();
  const cleanText = normalizeTypoText(text);
  const lower = cleanText.toLowerCase();
  const allowed = new Set(scopedCtx.allowedActions || []);
  const allowedRoutesSet = new Set((scopedCtx.allowedRoutes || []).map((r) => r.route));
  const steps = [];
  const cursorGuide = /\b(with\s+(the\s+)?cursor|watch\s+it|how\s+to\s+add|walk\s*through|demo\s+with\s+cursor)\b/i.test(lower);
  const todayStr = new Date().toISOString().slice(0, 10);

  if (isUnintelligiblePrompt(text, scopedCtx)) {
    const choices = [];
    if (allowed.has("create_task")) {
      choices.push({ label: "Create a New Task", sublabel: "Open or create a workspace task on Kanban Board", step: { type: "navigate", label: "Open Kanban Board", prefill: { route: "/board" } } });
    }
    if (allowedRoutesSet.has("/table")) {
      choices.push({ label: "Open Table View", sublabel: "Browse and filter workspace issues in tabular view", step: { type: "navigate", label: "Open Table View", prefill: { route: "/table" } } });
    }
    if (allowedRoutesSet.has("/roles")) {
      choices.push({ label: "Configure Roles & Modules", sublabel: "Manage dynamic roles, default role, and AI vault", step: { type: "navigate", label: "Open Roles & Access Control", prefill: { route: "/roles" } } });
    }
    return {
      status: "clarify",
      reply: "I didn't quite understand that message — could you rephrase or pick what you'd like to do?",
      navigateTo: null,
      intent: null,
      steps: [],
      uiHtml: "",
      choices,
      artifacts: [],
      cursorGuide: false,
    };
  }

  const matchedUsers = (scopedCtx.teammates || []).filter((u) => {
    const full = String(u.name || "").trim().toLowerCase();
    if (!full || full.length < 3) return false;
    const parts = full.split(/\s+/).filter((p) => p.length >= 3);
    return parts.some((tok) => lower.includes(tok)) || lower.includes(full);
  });

  const matchedProj =
    (scopedCtx.projects || []).find((p) => lower.includes(p.name.toLowerCase()) || lower.includes(p.prefix.toLowerCase())) ||
    (scopedCtx.projects || []).find((p) => String(p.id) === String(scopedCtx.activeProjectId || "")) ||
    scopedCtx.projects?.[0];

  const recentTaskKey = [...history].reverse().find((h) => h.taskKey)?.taskKey || "";
  let navigateTo = null;

  // 0a. Teammate removal disambiguation
  if (/\b(remove|delete|deactivate)\b.*\b(user|member|staff)\b/i.test(lower) && !/\ball\s+users|except\s+superadmin|non[\s-]?superadmin/i.test(lower) && allowed.has("delete_user")) {
    if (matchedUsers.length > 1) {
      return {
        status: "clarify",
        reply: `I found ${matchedUsers.length} matching team members. Which person should be removed?`,
        navigateTo: "/team",
        intent: null,
        steps: [],
        uiHtml: buildUserDisambiguationCardHtml(matchedUsers, "delete_user", "Remove User"),
        choices: matchedUsers.map((u) => ({
          label: `Remove ${u.name}`,
          sublabel: `${u.jobTitle || u.role} • ${u.publicId || ""} • ${u.dept}`,
          step: { type: "delete_user", label: `Remove ${u.name}`, prefill: { userId: u.id, targetName: u.name } },
        })),
        artifacts: [],
        cursorGuide: false,
      };
    }
    if (matchedUsers.length === 1) {
      steps.push({ type: "delete_user", label: `Remove ${matchedUsers[0].name}`, prefill: { userId: matchedUsers[0].id, targetName: matchedUsers[0].name } });
      navigateTo = "/team";
    }
  }

  // 0b. Charts / CSV / PDF / PPT / Diagram Exports
  const wantsChart = /\b(chart|graph|bar\s*chart|pie\s*chart|breakdown|analytics)\b/i.test(lower);
  const wantsCsv = /\bcsv\b/i.test(lower);
  const wantsPdf = /\bpdf\b/i.test(lower);
  const wantsPpt = /\b(ppt|pptx|powerpoint|slides?|deck|presentation)\b/i.test(lower);
  const wantsDiagram = /\b(workspace\s+)?(diagram|infographic|visual\s*summary|architecture\s*chart)\b/i.test(lower);

  if (wantsChart || wantsCsv || wantsPdf || wantsPpt || wantsDiagram) {
    const tasks = scopedCtx.recentTasks || [];
    const counts = {
      "To Do": tasks.filter((t) => t.status === "todo").length,
      "In Progress": tasks.filter((t) => t.status === "in_progress").length,
      "In Review": tasks.filter((t) => t.status === "review" || t.status === "submitted_for_review").length,
      Done: tasks.filter((t) => t.status === "done").length,
    };
    const headers = ["Key", "Title", "Status", "Priority"];
    const rows = tasks.slice(0, 15).map((t) => [t.key, t.title, t.status, t.priority]);
    const artifacts = [];
    if (wantsChart) artifacts.push({ type: "chart", chartType: /\bpie\b/i.test(lower) ? "pie" : "bar", title: "Workspace Tasks by Status", labels: Object.keys(counts), values: Object.values(counts) });
    if (wantsCsv) artifacts.push({ type: "csv", title: "Workspace-Tasks-Export", headers, rows });
    if (wantsPdf) artifacts.push({ type: "pdf", title: "Lira Workspace Status Report", subtitle: `Prepared for ${scopedCtx.currentUser?.name || "Workspace Member"}`, sections: [{ heading: "Executive Summary", bullets: [`Accessible Projects: ${(scopedCtx.projects || []).length}`, `Departments: ${(scopedCtx.departments || []).length}`, `Recent Tasks Analyzed: ${tasks.length}`] }], table: { title: "Recent Tasks", headers, rows } });
    if (wantsPpt) artifacts.push({ type: "ppt", title: "Lira Workspace Briefing", subtitle: `Status Overview (${todayStr})`, slides: [{ title: "Workspace Snapshot", bullets: [`Active Projects: ${(scopedCtx.projects || []).map((p) => p.name).join(", ") || "None"}`, `Tasks Breakdown — To Do: ${counts["To Do"]}, In Progress: ${counts["In Progress"]}, Review: ${counts["In Review"]}, Done: ${counts.Done}`] }, { title: "Recent Deliverables", table: { headers, rows: rows.slice(0, 6) } }] });
    if (wantsDiagram) artifacts.push({ type: "image", title: "Workspace Status Diagram", svgMarkup: `<svg viewBox="0 0 360 140" xmlns="http://www.w3.org/2000/svg" class="w-full h-auto"><rect x="4" y="4" width="352" height="132" rx="14" fill="currentColor" fill-opacity="0.05" stroke="currentColor" stroke-opacity="0.18"/><text x="20" y="30" font-size="12" font-weight="700" fill="currentColor">Workspace Flow Summary</text><rect x="20" y="48" width="95" height="62" rx="10" fill="#6366f1" fill-opacity="0.2" stroke="#818cf8"/><text x="67" y="76" font-size="11" text-anchor="middle" fill="currentColor" font-weight="700">Projects: ${(scopedCtx.projects || []).length}</text><rect x="132" y="48" width="95" height="62" rx="10" fill="#a855f7" fill-opacity="0.2" stroke="#c084fc"/><text x="179" y="76" font-size="11" text-anchor="middle" fill="currentColor" font-weight="700">Tasks: ${tasks.length}</text><rect x="244" y="48" width="95" height="62" rx="10" fill="#10b981" fill-opacity="0.2" stroke="#34d399"/><text x="291" y="76" font-size="11" text-anchor="middle" fill="currentColor" font-weight="700">Done: ${counts.Done}</text></svg>` });
    return { status: "ok", reply: "Visual report ready.", navigateTo: null, intent: null, steps: [], uiHtml: "", choices: [], artifacts, cursorGuide: false };
  }

  // 0c. Role management
  if (/\brole\b|\broles\b/i.test(lower) && /\b(create|new|make|add|configure|update|edit|set|assign|list|choose|select|delete|remove|clear|clean)\b/i.test(lower)) {
    const customCleanup = inspectCustomRolesCleanup(cleanText, scopedCtx.roles || []);
    if (customCleanup && allowed.has("delete_role")) {
      if (customCleanup.customRoles.length === 0) {
        return { status: "ok", reply: "No custom roles exist to remove — only core roles remain.", navigateTo: "/roles", intent: null, steps: [], uiHtml: "", choices: [], artifacts: [], cursorGuide: false };
      }
      return {
        status: "clarify",
        reply: `Found ${customCleanup.customRoles.length} custom role(s). Select one to delete:`,
        navigateTo: "/roles",
        intent: null,
        steps: [],
        uiHtml: buildRoleDisambiguationCardHtml(customCleanup.customRoles, { actionType: "delete_role" }),
        choices: customCleanup.customRoles.map((r) => ({ label: `Delete ${r.displayName}`, sublabel: `Slug: ${r.name}`, step: { type: "delete_role", label: `Delete ${r.displayName}`, prefill: { roleId: r.id, name: r.name } } })),
        artifacts: [],
        cursorGuide: false,
      };
    }

    const ambiguousRoles = findAmbiguousRoleMatches(cleanText, scopedCtx.roles || []);
    if (ambiguousRoles && (allowed.has("update_role") || allowed.has("delete_role"))) {
      const actionType = ambiguousRoles.isDel ? "delete_role" : "update_role";
      return {
        status: "clarify",
        reply: `Found ${ambiguousRoles.matches.length} roles matching "${ambiguousRoles.query}". Select which role to update:`,
        navigateTo: "/roles",
        intent: null,
        steps: [],
        uiHtml: buildRoleDisambiguationCardHtml(ambiguousRoles.matches, { actionType, isDefault: ambiguousRoles.isDefault }),
        choices: ambiguousRoles.matches.map((r) => ({
          label: ambiguousRoles.isDel ? `Delete ${r.displayName}` : `Select "${r.displayName}"`,
          sublabel: `Slug: ${r.name}`,
          step: ambiguousRoles.isDel
            ? { type: "delete_role", label: `Delete ${r.displayName}`, prefill: { roleId: r.id, name: r.name } }
            : { type: "update_role", label: `Configure ${r.displayName}`, prefill: { roleId: r.id, name: r.name, ...(ambiguousRoles.isDefault ? { isDefault: true } : {}) } },
        })),
        artifacts: [],
        cursorGuide: false,
      };
    }

    const roleNameMatch =
      cleanText.match(/(?:role\s+(?:named|called|key)\s+)["']?([a-zA-Z0-9_-]{2,40})["']?/i) ||
      cleanText.match(/(?:create|make|add|configure|update|delete|remove)\s+(?:a\s+|the\s+)?(?:new\s+)?(?:platform\s+)?role\s+(?:named\s+|called\s+)?["']?([a-zA-Z0-9_-]{2,40})["']?/i);
    const ignoreNames = new Set(["a", "an", "new", "the", "this", "that", "default", "platform", "modules", "module", "all"]);
    const rawRoleCandidate = roleNameMatch?.[1]?.trim() || "";
    const resolvedRoleName = rawRoleCandidate && !ignoreNames.has(rawRoleCandidate.toLowerCase()) ? rawRoleCandidate : "";
    const existingRole =
      (scopedCtx.roles || []).find(
        (r) =>
          (resolvedRoleName && (r.name === resolvedRoleName.toLowerCase().replace(/[^a-z0-9_]+/g, "_") || r.displayName?.toLowerCase() === resolvedRoleName.toLowerCase())) ||
          lower.includes(String(r.name || "").toLowerCase()) ||
          lower.includes(String(r.displayName || "").toLowerCase())
      ) || null;
    const isDefault = /\b(set\s+.*default|as\s+default|default\s+role)\b/i.test(lower);

    if (/\b(delete|remove)\b/i.test(lower) && existingRole && allowed.has("delete_role") && !/\ball\b/i.test(lower)) {
      steps.push({ type: "delete_role", label: `Delete role "${existingRole.displayName}"`, prefill: { roleId: existingRole.id, name: existingRole.name } });
      navigateTo = "/roles";
    } else if (/\b(create|new|make|add)\b/i.test(lower) && !existingRole && resolvedRoleName && allowed.has("create_role")) {
      steps.push({ type: "create_role", label: `Create role "${resolvedRoleName}"${isDefault ? " (default)" : ""}`, prefill: { name: resolvedRoleName, displayName: resolvedRoleName, isDefault, modules: ["dashboard"] } });
      navigateTo = "/roles";
    } else if (existingRole && allowed.has("update_role") && !/\b(delete|remove)\b/i.test(lower)) {
      steps.push({ type: "update_role", label: isDefault ? `Set "${existingRole.displayName}" as default role` : `Configure "${existingRole.displayName}"`, prefill: { roleId: existingRole.id, name: existingRole.name, ...(isDefault ? { isDefault: true } : {}) } });
      navigateTo = "/roles";
    }
  }

  // 0d. Project & Department Creation (preserve raw original `text` for names!)
  if (steps.length === 0 && /\b(create|new|make|setup|add)\s+(?:a\s+|an\s+|new\s+)?(?:project\s*workspace|workspace|project)\b/i.test(lower) && allowed.has("create_project")) {
    const nm = text.match(/(?:named|called)\s+["']?([^"',.;]+?)(?:\s+with\s+prefix|\s*$)/i);
    const pref = text.match(/\bprefix\s+["']?([a-zA-Z0-9]{2,8})["']?/i);
    const projName = nm?.[1]?.trim() || "Workspace Project";
    steps.push({ type: "create_project", label: `Create project "${projName}"`, prefill: { name: projName, prefix: (pref?.[1] || projName.slice(0, 4)).toUpperCase(), description: text } });
    navigateTo = "/projects";
  }
  if (steps.length === 0 && /\b(create|new|make|setup|add)\s+(?:a\s+|an\s+|new\s+)?department\b/i.test(lower) && allowed.has("create_department")) {
    const dm = text.match(/(?:named|called)\s+["']?([^"',.;]+?)(?:\s+with\s+code|\s*$)/i);
    const cd = text.match(/\bcode\s+["']?([a-zA-Z0-9]{2,6})["']?/i);
    const deptName = dm?.[1]?.trim() || "New Department";
    steps.push({ type: "create_department", label: `Create department "${deptName}"`, prefill: { name: deptName, code: (cd?.[1] || deptName.slice(0, 4)).toUpperCase(), description: text } });
    navigateTo = "/projects";
  }

  // 0e. Mark notifications read / Task Review & Approval
  if (steps.length === 0 && /\bmark\b.*\bnotifications?\b.*\bread\b/i.test(lower) && allowed.has("mark_notifications_read")) {
    steps.push({ type: "mark_notifications_read", label: "Mark all notifications read", prefill: {} });
  }
  const keyMatch = text.match(/\b([A-Z0-9]{2,8}-\d+)\b/i);
  if (steps.length === 0 && (keyMatch || recentTaskKey)) {
    const tk = keyMatch ? keyMatch[1].toUpperCase() : recentTaskKey;
    if (/\bsubmit\b.*\breview\b/i.test(lower) && allowed.has("submit_task_review")) {
      steps.push({ type: "submit_task_review", label: `Submit ${tk} for review`, prefill: { taskKey: tk } });
      navigateTo = `/board?task=${tk}`;
    } else if (/\bapprove\b/i.test(lower) && /\btask|ticket\b/i.test(lower) && allowed.has("approve_task")) {
      steps.push({ type: "approve_task", label: `Approve ${tk}`, prefill: { taskKey: tk } });
      navigateTo = `/board?task=${tk}`;
    } else if (/\b(redo|revision)\b/i.test(lower) && allowed.has("redo_task")) {
      steps.push({ type: "redo_task", label: `Request revision on ${tk}`, prefill: { taskKey: tk, reason: text } });
      navigateTo = `/board?task=${tk}`;
    }
  }

  // 1. Create / Schedule Task intent (uses raw `text` so title words like "grid" are NEVER mangled!)
  if (
    (/\b(create|make|add|draft|schedule)\b.*\b(task|ticket|bug|issue|calendar|event|schedule)\b/i.test(lower) ||
      (scopedCtx.currentRoute?.startsWith("/calendar") && /\b(add|schedule|create)\b/i.test(lower))) &&
    allowed.has("create_task")
  ) {
    const titleMatch =
      text.match(/(?:titled|called|named)\s+["']?([^"',.;]+)["']?/i) ||
      text.match(/(?:task|ticket|bug)\s+(?:for|to|about)\s+([^,.;]+)/i);
    let cleanTitle = titleMatch ? titleMatch[1].trim() : /\bcalendar\b/i.test(lower) ? "Calendar Scheduled Task" : text.slice(0, 80);
    cleanTitle = cleanTitle.replace(/\s+(and\s+(assign|post|put|message|dm|navigate|open).*)$/i, "").trim();

    const priority = /\burgent|critical\b/i.test(lower) ? "urgent" : /\bhigh\b/i.test(lower) ? "high" : /\blow\b/i.test(lower) ? "low" : "medium";
    const taskType = /\bbug|fix|error\b/i.test(lower) ? "bug" : "task";
    const isCalendarContext = scopedCtx.currentRoute?.startsWith("/calendar") || /\b(calendar|schedule|today|deadline|due)\b/i.test(lower);
    const isoDateMatch = text.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
    const dueDate = isoDateMatch ? isoDateMatch[1] : isCalendarContext ? todayStr : undefined;

    steps.push({
      type: "create_task",
      label: `Create ${priority} ${taskType}`,
      prefill: {
        projectId: matchedProj?.id || "",
        title: cleanTitle || "Workspace Task",
        description: text,
        priority,
        type: taskType,
        ...(dueDate ? { dueDate } : {}),
        assignees: matchedUsers.map((u) => u.id),
      },
    });
    navigateTo = isCalendarContext ? "/calendar" : "/board";
  }

  // 2. Post to Project Chat
  if (/\b(chat|channel|announce|put\s+in.*chat|post\s+in.*chat|message\s+(the\s+)?(project|team|channel))\b/i.test(lower) && allowed.has("send_project_chat")) {
    steps.push({
      type: "send_project_chat",
      label: "Post update in workspace chat",
      prefill: {
        projectId: matchedProj?.id || "",
        roomId: matchedProj?.id ? `project_${matchedProj.id}` : "dept_general",
        message: `Task update {{taskKey}} {{taskTitle}}${matchedUsers.length ? ` — assigned to ${matchedUsers.map((u) => u.name).join(", ")}` : ""}`.trim(),
      },
    });
  }

  // 3. Direct Message teammate(s)
  if (/\b(dm|direct\s*message|ping|message\s+\w+\s+directly|notify\s+\w+\s+in\s+dm)\b/i.test(lower) && allowed.has("send_dm") && matchedUsers.length > 0) {
    for (const targetU of matchedUsers) {
      steps.push({
        type: "send_dm",
        label: `DM ${targetU.name}`,
        prefill: { recipientId: targetU.id, message: `Hi ${targetU.name}, please check ${steps[0]?.prefill?.title || recentTaskKey || "this workspace task"}.` },
      });
    }
  }

  // 4. Request submission
  if (steps.length === 0 && /\b(request|sign[\s-]?off|budget|approval)\b/i.test(lower) && allowed.has("create_request")) {
    const amtMatch = text.match(/(\d{3,})/);
    steps.push({
      type: "create_request",
      label: "Submit workspace request",
      prefill: { title: text.slice(0, 70), requestType: amtMatch ? "budget_approval" : "general_request", amount: amtMatch ? amtMatch[1] : "", description: text },
    });
    navigateTo = "/requests";
  }

  // 4b. Update task status
  if (steps.length === 0 && /\b(move|change|update|set|mark)\b/i.test(lower) && (keyMatch || recentTaskKey) && allowed.has("update_task_status")) {
    const statusTarget = /\bin[\s_-]?progress\b/i.test(lower) ? "in_progress" : /\breview\b/i.test(lower) ? "in_review" : /\bdone|complete/i.test(lower) ? "done" : "todo";
    const resolvedKey = keyMatch ? keyMatch[1].toUpperCase() : recentTaskKey;
    steps.push({ type: "update_task_status", label: `Move ${resolvedKey} to ${statusTarget}`, prefill: { taskKey: resolvedKey, status: statusTarget } });
    navigateTo = `/board?task=${resolvedKey}`;
  }

  // 5b. Superadmin ONLY bulk user cleanup
  if (steps.length === 0 && /\b(remove|delete)\b.*\b(all\s+users|except\s+superadmin|non[\s-]?superadmin)/i.test(lower) && allowed.has("remove_non_superadmins")) {
    steps.push({ type: "remove_non_superadmins", label: "Remove all non-Superadmin users", prefill: { excludeRoles: ["superadmin"] } });
    navigateTo = "/team";
  }

  // 5c. Targeted Project / Department / Role / Task Deletion
  if (steps.length === 0 && /\b(delete|remove|wipe|purge)\b/i.test(lower)) {
    const mentionsProj = /\b(projects?|workspaces?)\b/i.test(lower);
    const mentionsDept = /\bdepartments?\b/i.test(lower);
    const mentionsRole = /\broles?\b/i.test(lower);
    const isAll = /\ball\b/i.test(lower);
    const delSteps = [];

    if (mentionsRole && allowed.has("delete_role")) {
      const deletableRoles = (scopedCtx.roles || []).filter((r) => !r.isSystem && String(r.name || "").toLowerCase() !== "superadmin");
      const targetRoles = isAll
        ? deletableRoles
        : deletableRoles.filter((r) => lower.includes(String(r.name || "").toLowerCase()) || lower.includes(String(r.displayName || "").toLowerCase()));
      targetRoles.forEach((r) => {
        delSteps.push({ type: "delete_role", label: `Delete role "${r.displayName || r.name}"`, prefill: { roleId: r.id, name: r.name } });
      });
    }
    if (mentionsProj && allowed.has("delete_project")) {
      const targetProjects = isAll
        ? scopedCtx.projects || []
        : (scopedCtx.projects || []).filter((p) => lower.includes(p.name.toLowerCase()) || (p.prefix && lower.includes(p.prefix.toLowerCase())));
      targetProjects.forEach((p) => {
        delSteps.push({ type: "delete_project", label: `Delete workspace "${p.name}"`, prefill: { projectId: p.id, prefix: p.prefix, name: p.name } });
      });
    }
    if (mentionsDept && allowed.has("delete_department")) {
      const targetDepts = isAll
        ? scopedCtx.departments || []
        : (scopedCtx.departments || []).filter((d) => lower.includes(d.name.toLowerCase()));
      targetDepts.forEach((d) => {
        delSteps.push({ type: "delete_department", label: `Delete department "${d.name}"`, prefill: { departmentId: d.id, name: d.name } });
      });
    }
    if (keyMatch && allowed.has("delete_task")) {
      const tk = keyMatch[1].toUpperCase();
      delSteps.push({ type: "delete_task", label: `Delete task ${tk}`, prefill: { taskKey: tk } });
    }

    if (delSteps.length > 0) {
      if (isAll || delSteps.length >= 2) {
        return {
          status: "clarify",
          reply: `Confirm permanent deletion of ${delSteps.length} workspace item(s):`,
          navigateTo: mentionsProj ? "/projects" : "/roles",
          intent: null,
          steps: delSteps,
          uiHtml: buildEntityDisambiguationCardHtml(
            delSteps.map((s) => ({ title: s.label, subtitle: s.type.replace(/_/g, " "), danger: true, buttonLabel: "Delete", step: s }))
          ),
          choices: delSteps.slice(0, 8).map((s) => ({ label: s.label, sublabel: "Delete individually", step: s })),
          artifacts: [],
          cursorGuide: false,
        };
      }
      steps.push(delSteps[0]);
      navigateTo = mentionsProj ? "/projects" : keyMatch ? `/board?task=${keyMatch[1].toUpperCase()}` : "/roles";
    }
  }

  // Never turn an unfulfilled mutating/destructive request into a bogus route navigation
  const hasMutatingVerb = /\b(delete|remove|wipe|purge|clear|destroy|erase|drop|create|add|update|edit|modify|approve|reject)\b/i.test(lower);
  if (steps.length === 0 && hasMutatingVerb) {
    return {
      status: "clarify",
      reply: "Which exact workspace item should be modified or deleted? Name the task key, project, department, user, or role.",
      navigateTo: null,
      intent: null,
      steps: [],
      uiHtml: "",
      choices: [],
      artifacts: [],
      cursorGuide: false,
    };
  }

  const ROUTE_ALIAS_TESTS = [
    { route: "/my-work", rx: /\b(my[\s-]?day|my[\s-]?work|assigned\s+tasks)\b/i },
    { route: "/board", rx: /\b(board|kanban|sprint)\b/i },
    { route: "/table", rx: /\b(grid|table)\b/i },
    { route: "/calendar", rx: /\b(calendar|schedule)\b/i },
    { route: "/requests", rx: /\b(requests?|approvals?)\b/i },
    { route: "/projects", rx: /\b(projects?|workspaces?|departments?)\b/i },
    { route: "/team", rx: /\b(team|directory|members?|staff)\b/i },
    { route: "/profile?tab=ai", rx: /\b(profile|personal\s+ai|my\s+ai\s+key|byok)\b/i },
    { route: "/roles?tab=ai", rx: /\b(ai\s+vault|global\s+key|ai\s+models)\b/i },
    { route: "/roles", rx: /\b(roles?|permissions?)\b/i },
    { route: "/audit", rx: /\b(audit|usage\s+logs?|online\s+users?)\b/i },
    { route: "/", rx: /\b(dashboard|home|overview)\b/i },
  ];
  const matchedAlias = ROUTE_ALIAS_TESTS.find(
    (a) => a.rx.test(lower) && (scopedCtx.allowedRoutes || []).some((r) => r.route === a.route)
  );
  const routeHit =
    matchedAlias ||
    (scopedCtx.allowedRoutes || []).find((r) => {
      const lbl = r.label.toLowerCase();
      return lower.includes(r.moduleKey) || lbl.split(/[\s&]+/).some((w) => w.length > 3 && lower.includes(w));
    });
  if (!navigateTo && routeHit) {
    navigateTo = routeHit.route;
  }
  if (steps.length === 0 && navigateTo) {
    steps.push({ type: "navigate", label: `Open ${navigateTo}`, prefill: { route: navigateTo } });
  }

  return {
    status: "ok",
    reply:
      steps.length > 0
        ? `Prepared ${steps.length} action${steps.length > 1 ? "s" : ""}: ${steps.map((s) => s.label).join(", ")}.`
        : "Ask me to create or update tasks, post in chat, submit requests, run analytics, or navigate.",
    navigateTo,
    intent: steps[0] || null,
    steps,
    uiHtml: "",
    choices: [],
    artifacts: [],
    cursorGuide,
  };
}

module.exports = {
  TYPO_REPLACEMENTS,
  normalizeTypoText,
  isUnintelligiblePrompt,
  inspectCustomRolesCleanup,
  findAmbiguousRoleMatches,
  buildEntityDisambiguationCardHtml,
  buildUserDisambiguationCardHtml,
  buildRoleDisambiguationCardHtml,
  buildRoleModulesCheckboxHtml,
  runLocalCopilotFallback,
};

