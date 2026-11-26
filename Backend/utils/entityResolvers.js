const mongoose = require("mongoose");
const Department = require("../models/departmentModel");
const Project = require("../models/projectModel");
const User = require("../models/userModel");
const { escapeRegex } = require("./envSecrets");

const VALID_TASK_TYPES = new Set(["task", "bug", "client_request", "approval", "compliance", "routine"]);
const TASK_TYPE_ALIASES = {
  feature: "task",
  story: "task",
  epic: "task",
  chore: "task",
  improvement: "task",
  enhancement: "task",
  general: "task",
  work: "task",
  defect: "bug",
  issue: "bug",
  error: "bug",
  fix: "bug",
  hotfix: "bug",
  incident: "bug",
  client: "client_request",
  customer_request: "client_request",
  support: "client_request",
  signoff: "approval",
  review: "approval",
  audit: "compliance",
  sop: "compliance",
  policy: "compliance",
  recurring: "routine",
  scheduled: "routine",
};

const VALID_TASK_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const TASK_PRIORITY_ALIASES = {
  critical: "urgent",
  blocker: "urgent",
  highest: "urgent",
  immediate: "urgent",
  p0: "urgent",
  p1: "urgent",
  important: "high",
  p2: "high",
  normal: "medium",
  standard: "medium",
  moderate: "medium",
  p3: "medium",
  minor: "low",
  trivial: "low",
  lowest: "low",
  p4: "low",
};

const VALID_TASK_STATUSES = new Set([
  "todo",
  "in_progress",
  "review",
  "submitted_for_review",
  "redo_requested",
  "done",
  "cancelled",
]);
const TASK_STATUS_ALIASES = {
  to_do: "todo",
  open: "todo",
  backlog: "todo",
  pending: "todo",
  new: "todo",
  inprogress: "in_progress",
  wip: "in_progress",
  working: "in_progress",
  doing: "in_progress",
  active: "in_progress",
  in_review: "review",
  qa: "review",
  testing: "review",
  submitted: "submitted_for_review",
  pending_review: "submitted_for_review",
  redo: "redo_requested",
  revision: "redo_requested",
  rework: "redo_requested",
  changes_requested: "redo_requested",
  completed: "done",
  complete: "done",
  closed: "done",
  resolved: "done",
  finished: "done",
  canceled: "cancelled",
  archived: "cancelled",
};

const VALID_REQUEST_TYPES = new Set([
  "budget_approval",
  "travel_request",
  "asset_requisition",
  "leave_approval",
  "vendor_payment",
  "compliance_signoff",
  "general_request",
]);
const REQUEST_TYPE_ALIASES = {
  general_signoff: "general_request",
  general: "general_request",
  signoff: "general_request",
  access_request: "general_request",
  hiring: "general_request",
  other: "general_request",
  procurement: "asset_requisition",
  equipment: "asset_requisition",
  asset: "asset_requisition",
  hardware: "asset_requisition",
  software: "asset_requisition",
  budget: "budget_approval",
  expense: "budget_approval",
  funding: "budget_approval",
  travel: "travel_request",
  trip: "travel_request",
  leave: "leave_approval",
  pto: "leave_approval",
  vacation: "leave_approval",
  time_off: "leave_approval",
  vendor: "vendor_payment",
  payment: "vendor_payment",
  invoice: "vendor_payment",
  compliance: "compliance_signoff",
  audit: "compliance_signoff",
};

function normalizeEnumValue(raw, validSet, aliases, fallback) {
  const key = String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
  if (!key) return fallback;
  if (validSet.has(key)) return key;
  return aliases[key] || fallback;
}

function normalizeTaskType(raw) {
  return normalizeEnumValue(raw, VALID_TASK_TYPES, TASK_TYPE_ALIASES, "task");
}

function normalizeTaskPriority(raw) {
  return normalizeEnumValue(raw, VALID_TASK_PRIORITIES, TASK_PRIORITY_ALIASES, "medium");
}

function normalizeTaskStatus(raw) {
  return normalizeEnumValue(raw, VALID_TASK_STATUSES, TASK_STATUS_ALIASES, "todo");
}

function normalizeRequestType(raw) {
  return normalizeEnumValue(raw, VALID_REQUEST_TYPES, REQUEST_TYPE_ALIASES, "general_request");
}

/**
 * Resolve mixed department inputs (ObjectIds, codes like "ENG", or names like "Engineering")
 * into valid deduplicated Department ObjectId strings so User/Project/Task/Request queries never throw CastError.
 */
async function resolveDepartmentObjectIds(rawInputs = []) {
  const flat = [];
  for (const item of Array.isArray(rawInputs) ? rawInputs : [rawInputs]) {
    if (!item) continue;
    if (Array.isArray(item)) flat.push(...item);
    else flat.push(item);
  }
  const validIds = new Set();
  const lookupTerms = [];
  for (const val of flat) {
    const str = typeof val === "object" && val?._id ? String(val._id) : String(val).trim();
    if (!str) continue;
    if (mongoose.isValidObjectId(str)) {
      validIds.add(str);
    } else {
      lookupTerms.push(str);
    }
  }
  if (lookupTerms.length > 0) {
    const upperCodes = lookupTerms.map((t) => t.toUpperCase());
    const nameRegexes = lookupTerms.map((t) => new RegExp(`^${escapeRegex(t)}$`, "i"));
    const found = await Department.find({
      $or: [{ code: { $in: upperCodes } }, { name: { $in: nameRegexes } }],
    })
      .select("_id")
      .lean();
    for (const d of found) validIds.add(String(d._id));
  }
  return Array.from(validIds);
}

/**
 * Resolve a single department input (ObjectId, code, or name) to its live document.
 */
async function resolveDepartmentDoc(rawInput, selectFields = "_id name code description color") {
  const str = typeof rawInput === "object" && rawInput?._id ? String(rawInput._id) : String(rawInput || "").trim();
  if (!str) return null;
  if (mongoose.isValidObjectId(str)) {
    const byId = await Department.findById(str).select(selectFields).lean();
    if (byId) return byId;
  }
  return Department.findOne({
    $or: [{ code: str.toUpperCase() }, { name: new RegExp(`^${escapeRegex(str)}$`, "i") }],
  })
    .select(selectFields)
    .lean();
}

/**
 * Resolve a project reference (ObjectId, prefix, or name) and verify it exists in MongoDB
 * under `accessFilter`. Never returns a stale/non-existent ObjectId.
 */
async function resolveProjectObjectId(rawInput, accessFilter = { status: { $ne: "archived" } }) {
  const str = typeof rawInput === "object" && rawInput?._id ? String(rawInput._id) : String(rawInput || "").trim();
  if (!str) return null;

  if (mongoose.isValidObjectId(str)) {
    const existing = await Project.findOne({ _id: str, ...accessFilter }).select("_id").lean();
    return existing?._id ? String(existing._id) : null;
  }

  const exact = await Project.findOne({
    ...accessFilter,
    $or: [{ prefix: str.toUpperCase() }, { name: new RegExp(`^${escapeRegex(str)}$`, "i") }],
  })
    .select("_id")
    .lean();
  if (exact?._id) return String(exact._id);

  const partial = await Project.findOne({
    ...accessFilter,
    name: new RegExp(escapeRegex(str), "i"),
  })
    .select("_id")
    .sort({ createdAt: -1 })
    .lean();
  return partial?._id ? String(partial._id) : null;
}

/**
 * Resolve mixed user inputs (ObjectIds, emails, EMP-* publicIds, or fullnames) into valid User ObjectId strings.
 */
async function resolveUserObjectIds(rawInputs = []) {
  const flat = [];
  for (const item of Array.isArray(rawInputs) ? rawInputs : [rawInputs]) {
    if (!item) continue;
    if (Array.isArray(item)) flat.push(...item);
    else flat.push(item);
  }
  const validIds = new Set();
  const lookupTerms = [];
  for (const val of flat) {
    const str = typeof val === "object" && val?._id ? String(val._id) : String(val).trim();
    if (!str) continue;
    if (mongoose.isValidObjectId(str)) {
      validIds.add(str);
    } else {
      lookupTerms.push(str);
    }
  }
  if (lookupTerms.length > 0) {
    const lowerEmails = lookupTerms.map((t) => t.toLowerCase());
    const upperPublicIds = lookupTerms.map((t) => t.toUpperCase());
    const nameRegexes = lookupTerms.map((t) => new RegExp(`^${escapeRegex(t)}$`, "i"));
    const found = await User.find({
      isActive: { $ne: false },
      $or: [
        { email: { $in: lowerEmails } },
        { publicId: { $in: upperPublicIds } },
        { fullname: { $in: nameRegexes } },
      ],
    })
      .select("_id")
      .lean();
    for (const u of found) validIds.add(String(u._id));
  }
  return Array.from(validIds);
}

module.exports = {
  normalizeTaskType,
  normalizeTaskPriority,
  normalizeTaskStatus,
  normalizeRequestType,
  resolveDepartmentObjectIds,
  resolveDepartmentDoc,
  resolveProjectObjectId,
  resolveUserObjectIds,
};

