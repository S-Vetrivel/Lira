const CopilotExperience = require("../models/copilotExperienceModel");
const WorkspaceVectorIndex = require("../models/workspaceVectorIndexModel");
const Task = require("../models/taskModel");
const { MODULES_CATALOG } = require("../config/modulesCatalog");
const { PAGE_CATALOG, COPILOT_ACTION_SCHEMAS } = require("../config/copilotActionRegistry");
const { cosineSimilarity, generateEmbeddingVector } = require("./aiService");

const EXPERIENCE_DEDUP_THRESHOLD = 0.94;
const FAILURE_WARN_THRESHOLD = 0.80;

function scrubTextValue(text = "", maxLen = 600) {
  let out = String(text || "");
  out = out.replace(
    /(password|passcode|secret|api[_-]?key|token|bearer)\s*[:=]\s*["']?[^\s"'\n,;]+["']?/gi,
    "$1=<REDACTED>"
  );
  out = out.replace(/\b(?:sk-[a-zA-Z0-9_-]{12,}|AIza[0-9A-Za-z_-]{20,}|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+)\b/g, "<REDACTED>");
  out = out.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "<EMAIL>");
  // Mask long quoted private DM/message payloads before indexing into shared role memory
  out = out.replace(/(["'])(?:(?=(\\?))\2.){70,}?\1/g, '"<REDACTED>"');
  return out.replace(/\s+/g, " ").trim().slice(0, maxLen);
}

/**
 * Remove PII, credentials, tokens, and long message bodies before storing into RAG memory.
 */
function scrubExperiencePrompt(prompt = "") {
  return scrubTextValue(prompt, 500);
}

function scrubPrefillObject(prefill) {
  if (!prefill || typeof prefill !== "object") return {};
  const clean = {};
  for (const [k, v] of Object.entries(prefill)) {
    if (/(password|secret|apikey|token|ciphertext|iv|salt)/i.test(k)) {
      clean[k] = "<REDACTED>";
    } else if (k === "email" && typeof v === "string") {
      clean[k] = "<EMAIL>";
    } else if (k === "message" && typeof v === "string" && v.length > 60) {
      clean[k] = "<REDACTED>";
    } else if (typeof v === "string") {
      clean[k] = scrubTextValue(v, 180);
    } else if (Array.isArray(v)) {
      clean[k] = v.slice(0, 12);
    } else if (v !== null && v !== undefined && typeof v !== "object") {
      clean[k] = v;
    }
  }
  return clean;
}

function scrubExperienceSteps(steps = []) {
  if (!Array.isArray(steps)) return [];
  return steps
    .filter((s) => s && s.type)
    .slice(0, 8)
    .map((s) => ({
      type: String(s.type),
      prefill: scrubPrefillObject(s.prefill || {}),
      ...(s.navigateTo ? { navigateTo: String(s.navigateTo) } : {}),
    }));
}

function sortKeys(obj) {
  if (Array.isArray(obj)) return obj.map(sortKeys);
  if (obj && typeof obj === "object") {
    return Object.keys(obj)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortKeys(obj[key]);
        return acc;
      }, {});
  }
  return obj;
}

function canonicalizeSteps(steps = []) {
  return JSON.stringify(
    (Array.isArray(steps) ? steps : []).map((s) => ({
      type: String(s?.type || ""),
      prefill: sortKeys(s?.prefill || {}),
    }))
  );
}

/**
 * Record & reinforce a copilot interaction (`success`, `correction`, or `failure`).
 * Deduplicates high-similarity (`> 0.94`) matches by incrementing `hitCount` and `lastUsedAt`.
 */
async function recordAndIndexExperience({
  tenantScope = "workspace",
  role = "employee",
  route = "/",
  outcome = "success",
  prompt = "",
  normalizedIntent = "",
  steps = [],
  failureReason = "",
} = {}) {
  const cleanPrompt = scrubExperiencePrompt(prompt);
  if (!cleanPrompt || cleanPrompt.length < 3) return null;
  if (!["success", "correction", "failure"].includes(outcome)) return null;

  const cleanRoute = String(route || "/").split("?")[0] || "/";
  const cleanSteps = scrubExperienceSteps(steps);
  const cleanFailure = scrubTextValue(failureReason, 280);
  const cleanIntent =
    scrubTextValue(normalizedIntent, 120) ||
    cleanSteps
      .map((s) => s.type)
      .filter(Boolean)
      .join(" + ");

  const embedding = await generateEmbeddingVector(cleanPrompt, { allowRemote: true });
  const candidates = await CopilotExperience.find({
    tenantScope,
    role: String(role || "employee"),
    route: cleanRoute,
    outcome,
  })
    .sort({ lastUsedAt: -1 })
    .limit(80)
    .lean();

  const targetSig = canonicalizeSteps(cleanSteps);
  for (const existing of candidates) {
    const sim = cosineSimilarity(embedding, existing.embedding);
    if (sim > EXPERIENCE_DEDUP_THRESHOLD) {
      const sameSteps =
        outcome === "failure"
          ? existing.failureReason === cleanFailure || Boolean(cleanFailure && existing.failureReason)
          : canonicalizeSteps(existing.steps) === targetSig;
      if (sameSteps) {
        await CopilotExperience.updateOne(
          { _id: existing._id },
          {
            $inc: { hitCount: 1 },
            $set: { lastUsedAt: new Date() },
          }
        );
        return {
          deduplicated: true,
          experienceId: String(existing._id),
          hitCount: (existing.hitCount || 1) + 1,
        };
      }
    }
  }

  const created = await CopilotExperience.create({
    tenantScope,
    role: String(role || "employee"),
    route: cleanRoute,
    outcome,
    prompt: cleanPrompt,
    normalizedIntent: cleanIntent,
    steps: cleanSteps,
    failureReason: cleanFailure,
    embedding,
    hitCount: 1,
    lastUsedAt: new Date(),
  });

  return {
    deduplicated: false,
    experienceId: String(created._id),
    hitCount: 1,
  };
}

/**
 * Retrieve top-3 positive (`success`/`correction`) experiences weighted by `similarity * log(hitCount + 1)`
 * plus top-1 high-similarity (`> 0.80`) `failure` guardrail for the caller's exact role.
 */
async function retrieveRelevantExperiences({ prompt = "", role = "employee", route = "/", limitPositive = 3 } = {}) {
  const cleanPrompt = scrubExperiencePrompt(prompt);
  if (!cleanPrompt || cleanPrompt.length < 3) {
    return { positives: [], failureWarning: null, formattedBlock: "" };
  }

  const cleanRoute = String(route || "/").split("?")[0] || "/";
  const [queryVec, docs] = await Promise.all([
    generateEmbeddingVector(cleanPrompt, { allowRemote: true }),
    CopilotExperience.find({
      role: String(role || "employee"),
      outcome: { $in: ["success", "correction", "failure"] },
    })
      .sort({ lastUsedAt: -1 })
      .limit(200)
      .lean(),
  ]);

  if (!docs || docs.length === 0) {
    return { positives: [], failureWarning: null, formattedBlock: "" };
  }

  const positives = [];
  const failures = [];

  for (const doc of docs) {
    const sim = cosineSimilarity(queryVec, doc.embedding);
    if (doc.outcome === "failure") {
      if (sim > FAILURE_WARN_THRESHOLD && doc.failureReason) {
        failures.push({ ...doc, similarity: sim });
      }
    } else if (sim >= 0.25 && Array.isArray(doc.steps) && doc.steps.length > 0) {
      const routeBoost = doc.route === cleanRoute ? 1.08 : 1.0;
      const weightedScore = sim * Math.log((Number(doc.hitCount) || 1) + 1) * routeBoost;
      positives.push({ ...doc, similarity: sim, weightedScore });
    }
  }

  positives.sort((a, b) => b.weightedScore - a.weightedScore);
  failures.sort((a, b) => b.similarity - a.similarity);

  const topPositives = positives.slice(0, limitPositive);
  const topFailure = failures[0] || null;
  const formattedBlock = formatLearnedPatternsForPrompt({ positives: topPositives, failureWarning: topFailure });

  return {
    positives: topPositives,
    failureWarning: topFailure,
    formattedBlock,
  };
}

function formatLearnedPatternsForPrompt({ positives = [], failureWarning = null } = {}) {
  const lines = [];
  for (const exp of positives) {
    const stepJson = JSON.stringify(
      (exp.steps || []).map((s) => ({ type: s.type, prefill: s.prefill || {} }))
    );
    lines.push(`- Prompt: "${exp.prompt}" -> Validated Steps: ${stepJson} (hits=${exp.hitCount || 1})`);
  }
  if (failureWarning?.failureReason) {
    lines.push(`- Past Mistake to Avoid (sim=${failureWarning.similarity.toFixed(2)}): ${failureWarning.failureReason}`);
  }
  if (lines.length === 0) return "";
  return `LEARNED_WORKSPACE_PATTERNS (verified past executions for this role):\n${lines.join("\n")}`;
}

function buildEntityVectorSummary(entityType, doc) {
  if (!doc) return { key: "", title: "", summaryText: "", projectId: null, requesterId: null, metadata: {} };
  if (entityType === "task") {
    const key = doc.key || "";
    const title = doc.title || "";
    const summaryText = scrubTextValue(
      `[${key}] ${title} (status: ${doc.status || "todo"}, priority: ${doc.priority || "medium"}, type: ${doc.type || "task"}) ${doc.description || ""}`,
      900
    );
    return {
      key,
      title,
      summaryText,
      projectId: doc.project?._id || doc.project || null,
      requesterId: doc.reporter?._id || doc.reporter || null,
      metadata: {
        status: doc.status || "todo",
        priority: doc.priority || "medium",
        type: doc.type || "task",
        dueDate: doc.dueDate || null,
      },
    };
  }
  if (entityType === "project") {
    const key = doc.prefix || "";
    const title = doc.name || "";
    const summaryText = scrubTextValue(`[${key}] ${title} (${doc.status || "active"}) ${doc.description || ""}`, 900);
    return {
      key,
      title,
      summaryText,
      projectId: doc._id,
      requesterId: null,
      metadata: { status: doc.status || "active" },
    };
  }
  const key = doc.requestCode || "";
  const title = doc.title || "";
  const summaryText = scrubTextValue(
    `[${key}] ${title} (${doc.requestType || "general"}, status: ${doc.status || "pending"}) ${doc.description || ""}`,
    900
  );
  return {
    key,
    title,
    summaryText,
    projectId: doc.targetProject?._id || doc.targetProject || null,
    requesterId: doc.requester?._id || doc.requester || null,
    metadata: { status: doc.status || "pending", requestType: doc.requestType || "" },
  };
}

/**
 * Upsert semantic vector representation for a Task, Project, or Request document.
 */
async function indexWorkspaceEntity({ entityType, doc }) {
  if (!doc || !doc._id || !["task", "project", "request"].includes(entityType)) return null;
  const info = buildEntityVectorSummary(entityType, doc);
  if (!info.summaryText) return null;

  const embedding = await generateEmbeddingVector(info.summaryText, { allowRemote: true });
  return WorkspaceVectorIndex.findOneAndUpdate(
    { entityType, entityId: doc._id },
    {
      $set: {
        projectId: info.projectId,
        requesterId: info.requesterId,
        key: info.key,
        title: info.title,
        summaryText: info.summaryText,
        metadata: info.metadata,
        embedding,
      },
    },
    { upsert: true, new: true }
  ).lean();
}

async function removeWorkspaceEntityIndex({ entityType, entityId }) {
  if (!entityType || !entityId) return;
  await WorkspaceVectorIndex.deleteOne({ entityType, entityId });
}

/**
 * Retrieve top-K semantically matching tasks strictly restricted to projects the user can access.
 */
async function retrieveSemanticWorkspaceEntities({
  prompt = "",
  accessibleProjIds = [],
  activeProjectId = null,
  canTasks = false,
  topK = 10,
} = {}) {
  const cleanPrompt = scrubExperiencePrompt(prompt);
  if (!canTasks || !cleanPrompt || !Array.isArray(accessibleProjIds) || accessibleProjIds.length === 0) {
    return [];
  }

  const scopedProjFilter = activeProjectId ? [activeProjectId] : accessibleProjIds;
  const [queryVec, vectorDocs] = await Promise.all([
    generateEmbeddingVector(cleanPrompt, { allowRemote: true }),
    WorkspaceVectorIndex.find({
      entityType: "task",
      projectId: { $in: scopedProjFilter },
    })
      .select("entityId projectId key title embedding updatedAt")
      .sort({ updatedAt: -1 })
      .limit(300)
      .lean(),
  ]);

  if (!vectorDocs || vectorDocs.length === 0) return [];

  const rankedIds = vectorDocs
    .map((v) => ({ entityId: v.entityId, sim: cosineSimilarity(queryVec, v.embedding) }))
    .filter((item) => item.sim >= 0.15)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, topK)
    .map((item) => item.entityId);

  if (rankedIds.length === 0) return [];

  const liveTasks = await Task.find({
    _id: { $in: rankedIds },
    project: { $in: scopedProjFilter },
  })
    .select("_id key title status priority type project dueDate")
    .lean();

  const orderMap = new Map(rankedIds.map((id, idx) => [String(id), idx]));
  liveTasks.sort((a, b) => (orderMap.get(String(a._id)) ?? 999) - (orderMap.get(String(b._id)) ?? 999));
  return liveTasks;
}

/**
 * Prune stale single-hit experiences older than `maxAgeDays` (default 60) or referencing
 * deprecated actions/routes no longer present in `MODULES_CATALOG` or `COPILOT_ACTION_SCHEMAS`.
 */
async function pruneStaleExperiences({ maxAgeDays = 60 } = {}) {
  const validActions = new Set(Object.keys(COPILOT_ACTION_SCHEMAS));
  const validRoutes = new Set(["/"]);
  for (const mod of MODULES_CATALOG) {
    if (mod.route && mod.route.startsWith("/")) validRoutes.add(mod.route.split("?")[0]);
  }
  for (const pg of PAGE_CATALOG) {
    if (pg.route) validRoutes.add(pg.route.split("?")[0]);
    for (const al of pg.aliases || []) validRoutes.add(String(al).split("?")[0]);
  }

  const cutoff = new Date(Date.now() - Math.max(1, maxAgeDays) * 24 * 60 * 60 * 1000);
  const docs = await CopilotExperience.find({})
    .select("_id hitCount route steps createdAt lastUsedAt")
    .lean();

  const idsToDelete = [];
  for (const doc of docs) {
    const lastActive = doc.lastUsedAt || doc.createdAt || new Date();
    const isOldSingleHit = (Number(doc.hitCount) || 1) <= 1 && new Date(lastActive) < cutoff;

    const baseRoute = String(doc.route || "/").split("?")[0] || "/";
    const invalidDocRoute = !validRoutes.has(baseRoute);

    const hasDeprecatedStep = (Array.isArray(doc.steps) ? doc.steps : []).some((s) => {
      if (!s || !s.type) return true;
      if (!validActions.has(s.type)) return true;
      const stepNav = s.navigateTo || s.prefill?.route;
      if (stepNav && String(stepNav).startsWith("/")) {
        const navBase = String(stepNav).split("?")[0];
        if (!validRoutes.has(navBase)) return true;
      }
      return false;
    });

    if (isOldSingleHit || invalidDocRoute || hasDeprecatedStep) {
      idsToDelete.push(doc._id);
    }
  }

  if (idsToDelete.length > 0) {
    await CopilotExperience.deleteMany({ _id: { $in: idsToDelete } });
  }
  return { scanned: docs.length, deleted: idsToDelete.length };
}

module.exports = {
  scrubExperiencePrompt,
  scrubExperienceSteps,
  canonicalizeSteps,
  recordAndIndexExperience,
  retrieveRelevantExperiences,
  formatLearnedPatternsForPrompt,
  indexWorkspaceEntity,
  removeWorkspaceEntityIndex,
  retrieveSemanticWorkspaceEntities,
  pruneStaleExperiences,
};
