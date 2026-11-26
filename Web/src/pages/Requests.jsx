import React, { useState, useEffect } from "react";
import {
  FileCheck2,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  IndianRupee,
  ChevronRight,
  RefreshCw,
  X,
} from "lucide-react";
import { useApp } from "../context/Appcontext";
import {
  getRequests,
  createRequest,
  approveRequestStage,
  rejectRequest,
  getDepartments,
} from "../services/api";
import { formatINR, formatDateIN, getDisplayName } from "../utils/formatters";
import SideDrawer from "../components/common/SideDrawer";
import UserAvatar from "../components/common/UserAvatar";
import { subscribeRealtimeEvents } from "../services/socket";
import toast from "react-hot-toast";
import { getGlassTokens } from "../styles/glassTheme";

export default function Requests() {
  const {
    user,
    activeProject,
    projects,
    teamMembers,
    isSuperAdmin,
    hasPermission,
    aiPrefillDraft,
    setAiPrefillDraft,
    theme,
  } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);
  const canCreateReq = isSuperAdmin || hasPermission("requests.create");
  const canApproveReq = isSuperAdmin || hasPermission("requests.approve");

  const [requests, setRequests] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Approval / Rejection action modal
  const [actionModal, setActionModal] = useState(null); // { type: 'approve' | 'reject', request }
  const [actionNotes, setActionNotes] = useState("");
  const [processingAction, setProcessingAction] = useState(false);

  // New Request Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestType, setRequestType] = useState("budget_approval");
  const [targetDepartment, setTargetDepartment] = useState("");
  const [targetProject, setTargetProject] = useState("");
  const [targetUsers, setTargetUsers] = useState([]);
  const [amount, setAmount] = useState("");
  const [urgency, setUrgency] = useState("medium");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!aiPrefillDraft?.type) return;
    if (aiPrefillDraft.type === "create_request" && aiPrefillDraft.data) {
      const d = aiPrefillDraft.data;
      if (d.title) setTitle(d.title);
      if (d.description) setDescription(d.description);
      if (d.requestType) setRequestType(d.requestType);
      if (d.targetDepartment) setTargetDepartment(d.targetDepartment);
      if (d.amount) setAmount(String(d.amount));
      if (d.urgency || d.priority) setUrgency(d.urgency || d.priority);
      setShowCreateModal(true);
      setAiPrefillDraft(null);
    } else if (["approve_request", "reject_request"].includes(aiPrefillDraft.type)) {
      const d = aiPrefillDraft.data || {};
      const matched =
        requests.find(
          (r) =>
            (d.requestId && String(r._id) === String(d.requestId)) ||
            (d.title && r.title?.toLowerCase().includes(String(d.title).toLowerCase()))
        ) || requests.find((r) => r.status === "pending");
      if (matched) {
        setActionModal({ type: aiPrefillDraft.type === "approve_request" ? "approve" : "reject", request: matched });
        setActionNotes(d.note || "");
      }
      setAiPrefillDraft(null);
    }
  }, [aiPrefillDraft, setAiPrefillDraft, requests]);

  const loadData = async () => {
    setLoading(true);
    const [reqRes, deptRes] = await Promise.all([getRequests(), getDepartments()]);
    if (reqRes.success) setRequests(reqRes.requests);
    if (deptRes.success) {
      setDepartments(deptRes.departments);
      if (deptRes.departments.length > 0 && !targetDepartment) {
        setTargetDepartment(deptRes.departments[0]._id);
      }
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
    return subscribeRealtimeEvents(["request:created", "request:updated", "department:updated"], () => loadData());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTargetUser = (uid) => {
    setTargetUsers((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!title.trim() || (!targetDepartment && !targetProject && targetUsers.length === 0)) {
      toast.error("Please fill title and select a target team, project, or member");
      return;
    }

    setSubmitting(true);
    const res = await createRequest({
      title: title.trim(),
      description: description.trim(),
      requestType,
      targetDepartment: targetDepartment || null,
      targetProjectId: targetProject || null,
      targetUsers,
      amount: amount ? Number(amount) : 0,
      currency: "INR",
      priority: urgency,
    });
    setSubmitting(false);

    if (res.success) {
      setShowCreateModal(false);
      setTitle("");
      setDescription("");
      setAmount("");
      setTargetProject("");
      setTargetUsers([]);
      loadData();
    }
  };

  const submitAction = async (e) => {
    e.preventDefault();
    if (!actionModal) return;
    setProcessingAction(true);

    if (actionModal.type === "approve") {
      const res = await approveRequestStage(
        actionModal.request._id,
        actionNotes.trim() || "Approved"
      );
      if (res.success) {
        setActionModal(null);
        setActionNotes("");
        loadData();
      }
    } else {
      const res = await rejectRequest(
        actionModal.request._id,
        actionNotes.trim() || "Request declined"
      );
      if (res.success) {
        setActionModal(null);
        setActionNotes("");
        loadData();
      }
    }
    setProcessingAction(false);
  };

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === "all") return true;
    if (filterStatus === "pending") {
      return r.status === "submitted" || r.status === "in_review";
    }
    return r.status === filterStatus;
  });

  return (
    <div
      className={`flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden transition-colors duration-150 ${isDark ? "text-slate-200" : "text-slate-800"
        }`}
    >
      {/* Top Sub-Header */}
      <div
        className={`px-6 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${g.subHeader}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl border flex items-center justify-center ${g.badge}`}>
            <FileCheck2 className="w-4 h-4" />
          </div>
          <div>
            <h1 className={`text-sm sm:text-base font-bold tracking-tight ${g.heading}`}>
              Cross-Department Requests & Sign-Offs
            </h1>
            <p className={`text-xs ${g.muted}`}>
              Inter-department approvals, INR budget requests, and sign-offs
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className={`p-2 rounded-full border transition-colors cursor-pointer ${g.iconBtn}`}
            title="Refresh Requests"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>

          {canCreateReq && (
            <button
              data-ai-target="new-request-btn"
              onClick={() => setShowCreateModal(true)}
              className={`px-4 py-2 rounded-full font-semibold text-xs flex items-center gap-1.5 cursor-pointer ${g.btnPrimary}`}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Request</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className={`px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${g.subtleSurface}`}
      >
        <div className="flex items-center gap-1.5 text-xs overflow-x-auto">
          {[
            { id: "all", label: "All" },
            { id: "pending", label: "Pending Review" },
            { id: "approved", label: "Approved" },
            { id: "rejected", label: "Rejected" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterStatus(tab.id)}
              className={`px-3.5 py-1.5 rounded-full font-semibold transition-all whitespace-nowrap cursor-pointer ${
                filterStatus === tab.id ? g.pillActive : g.pillInactive
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className={`text-xs font-mono ${g.muted}`}>
          {filteredRequests.length} {filteredRequests.length === 1 ? "request" : "requests"}
        </span>
      </div>

      {/* Requests Feed */}
      <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-3">
        {filteredRequests.map((req) => {
          const isPending = req.status === "submitted" || req.status === "in_review";
          return (
            <div
              key={req._id}
              className="p-4 sm:p-5 rounded-2xl lira-glass flex flex-col lg:flex-row lg:items-center justify-between gap-4"
            >
              {/* Request Summary */}
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`font-mono text-xs font-bold ${g.heading}`}>
                    {req.requestCode}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${g.badge}`}>
                    {req.requestType?.replace(/_/g, " ")}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${req.status === "approved"
                      ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                      : req.status === "rejected"
                        ? "bg-rose-500/15 text-rose-500 border border-rose-500/30"
                        : "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                      }`}
                  >
                    {req.status?.replace(/_/g, " ")}
                  </span>
                  <span className={`text-[10px] font-mono ${g.muted}`}>
                    {formatDateIN(req.createdAt)}
                  </span>
                </div>

                <h3 className={`text-sm font-bold truncate ${g.heading}`}>
                  {req.title}
                </h3>
                {req.description && (
                  <p className={`text-xs line-clamp-2 ${g.muted}`}>
                    {req.description}
                  </p>
                )}

                <div className={`flex flex-wrap items-center gap-4 text-[11px] pt-1 ${g.muted}`}>
                  <span>
                    Requested by:{" "}
                    <strong className={g.heading}>
                      {getDisplayName(req.requester)}
                    </strong>
                  </span>
                  <span>
                    Target Team:{" "}
                    <strong className={g.heading}>
                      {req.targetDepartment?.name || req.department?.name || "Operations"}
                    </strong>
                  </span>
                  {req.targetProject && (
                    <span>
                      Project:{" "}
                      <strong className={g.heading}>
                        [{req.targetProject.prefix}] {req.targetProject.name}
                      </strong>
                    </span>
                  )}
                  {Array.isArray(req.targetUsers) && req.targetUsers.length > 0 && (
                    <span>
                      Target Staff:{" "}
                      <strong className={g.heading}>
                        {req.targetUsers.map((u) => getDisplayName(u)).join(", ")}
                      </strong>
                    </span>
                  )}
                  {req.amount > 0 && (
                    <span className="text-emerald-500 font-bold font-mono flex items-center gap-0.5">
                      {formatINR(req.amount)}
                    </span>
                  )}
                </div>
              </div>

              {/* Stages Sequence */}
              <div className={`flex flex-wrap items-center gap-2 p-2.5 rounded-xl border shrink-0 ${g.subtleSurface}`}>
                {req.stages?.map((stage, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs">
                    <div
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${stage.status === "approved"
                        ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
                        : stage.status === "rejected"
                          ? "bg-rose-500/15 text-rose-500 border-rose-500/30"
                          : "bg-amber-500/10 text-amber-500 border-amber-500/30"
                        }`}
                    >
                      {stage.status === "approved" ? (
                        <CheckCircle2 className="w-3 h-3" />
                      ) : stage.status === "rejected" ? (
                        <XCircle className="w-3 h-3" />
                      ) : (
                        <Clock className="w-3 h-3" />
                      )}
                      <span>{stage.stageName}</span>
                    </div>
                    {idx < req.stages.length - 1 && (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                ))}
              </div>

              {/* Action Buttons for Dynamic Approvers & Superadmin */}
              {isPending && canApproveReq && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    data-ai-target="request-approve-btn"
                    onClick={() => {
                      setActionModal({ type: "approve", request: req });
                      setActionNotes("");
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve Stage
                  </button>
                  <button
                    data-ai-target="request-reject-btn"
                    onClick={() => {
                      setActionModal({ type: "reject", request: req });
                      setActionNotes("");
                    }}
                    className="px-3.5 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-600 text-rose-400 hover:text-white font-semibold text-xs border border-rose-500/30 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <XCircle className="w-3.5 h-3.5" /> Reject
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {filteredRequests.length === 0 && !loading && (
          <div
            className={`text-center py-16 rounded-2xl border-2 border-dashed space-y-2 ${isDark ? "border-white/10 text-slate-500" : "border-slate-200 text-slate-400"
              }`}
          >
            <FileCheck2 className="w-8 h-8 mx-auto opacity-60" />
            <p className="text-xs font-semibold">No cross-department requests found</p>
          </div>
        )}
      </div>

      {/* Side Drawer: Create Request */}
      <SideDrawer
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Submit Formal Inter-Department Request"
        subtitle="Route an official approval, procurement, or policy request"
        icon={FileCheck2}
        widthClass="max-w-lg"
      >
        <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
          <div>
            <label className={`block font-semibold mb-1.5 ${g.heading}`}>
              Request Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Q4 Cloud Infrastructure Budget Approval"
              className={`w-full border rounded-xl px-3.5 py-2.5 focus:outline-none ${g.input}`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block font-semibold mb-1.5 ${g.heading}`}>
                Request Type
              </label>
              <select
                value={requestType}
                onChange={(e) => setRequestType(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2.5 focus:outline-none ${g.input}`}
              >
                <option value="budget_approval" className={isDark ? "bg-[#14151a]" : "bg-white"}>Budget Approval</option>
                <option value="asset_requisition" className={isDark ? "bg-[#14151a]" : "bg-white"}>Asset Requisition</option>
                <option value="travel_request" className={isDark ? "bg-[#14151a]" : "bg-white"}>Travel Request</option>
                <option value="vendor_payment" className={isDark ? "bg-[#14151a]" : "bg-white"}>Vendor Payment</option>
                <option value="compliance_signoff" className={isDark ? "bg-[#14151a]" : "bg-white"}>Compliance Sign-Off</option>
                <option value="general_request" className={isDark ? "bg-[#14151a]" : "bg-white"}>General Request</option>
              </select>
            </div>

            <div>
              <label className={`block font-semibold mb-1.5 ${g.heading}`}>
                Target Team / Department
              </label>
              <select
                value={targetDepartment}
                onChange={(e) => setTargetDepartment(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2.5 focus:outline-none ${g.input}`}
              >
                <option value="" className={isDark ? "bg-[#14151a]" : "bg-white"}>Any / Workspace Wide</option>
                {departments.map((dept) => (
                  <option key={dept._id} value={dept._id} className={isDark ? "bg-[#14151a]" : "bg-white"}>
                    {dept.code ? `[${dept.code}] ` : ""}{dept.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={`block font-semibold mb-1.5 ${g.heading}`}>
              Target Project Workspace (Optional)
            </label>
            <select
              value={targetProject}
              onChange={(e) => setTargetProject(e.target.value)}
              className={`w-full border rounded-xl px-3 py-2.5 focus:outline-none ${g.input}`}
            >
              <option value="" className={isDark ? "bg-[#14151a]" : "bg-white"}>None / Non-project request</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id} className={isDark ? "bg-[#14151a]" : "bg-white"}>
                  [{p.prefix}] {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={`block font-semibold mb-1.5 ${g.heading}`}>
              Target Team Members / Individuals ({targetUsers.length} selected)
            </label>
            <div className={`max-h-28 overflow-y-auto flex flex-wrap gap-1.5 p-2 rounded-xl border ${g.subtleSurface}`}>
              {teamMembers.map((m) => {
                const selected = targetUsers.includes(m._id);
                return (
                  <button
                    key={m._id}
                    type="button"
                    onClick={() => toggleTargetUser(m._id)}
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium cursor-pointer transition-all ${
                      selected ? "bg-indigo-600 border-indigo-500 text-white" : g.btnSecondary
                    }`}
                  >
                    <UserAvatar user={m} className="w-4 h-4 rounded-full" textClass="text-[7px]" />
                    <span>{getDisplayName(m)}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={`block font-semibold mb-1.5 ${g.heading}`}>
                Amount (₹ INR)
              </label>
              <div className="relative">
                <IndianRupee className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${g.muted}`} />
                <input
                  type="number"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="e.g. 25000"
                  className={`w-full border rounded-xl pl-8 pr-3 py-2.5 focus:outline-none ${g.input}`}
                />
              </div>
            </div>

            <div>
              <label className={`block font-semibold mb-1.5 ${g.heading}`}>
                Urgency
              </label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className={`w-full border rounded-xl px-3 py-2.5 focus:outline-none ${g.input}`}
              >
                <option value="urgent" className={isDark ? "bg-[#14151a]" : "bg-white"}>Urgent (Immediate)</option>
                <option value="high" className={isDark ? "bg-[#14151a]" : "bg-white"}>High Priority</option>
                <option value="medium" className={isDark ? "bg-[#14151a]" : "bg-white"}>Medium</option>
                <option value="low" className={isDark ? "bg-[#14151a]" : "bg-white"}>Standard / Low</option>
              </select>
            </div>
          </div>

          <div>
            <label className={`block font-semibold mb-1.5 ${g.heading}`}>
              Details & Justification
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain why this sign-off is required and deliverables expected..."
              className={`w-full border rounded-xl px-3.5 py-2.5 focus:outline-none resize-none ${g.input}`}
            />
          </div>

          <div className={`flex items-center justify-end gap-2 pt-4 border-t ${g.border}`}>
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              className={`px-4 py-2 rounded-xl font-semibold transition-colors cursor-pointer ${g.btnSecondary}`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              data-ai-target="save-request-btn"
              className={`px-5 py-2 rounded-xl font-semibold transition-colors cursor-pointer ${g.btnPrimary}`}
            >
              {submitting ? "Submitting..." : "Submit Request"}
            </button>
          </div>
        </form>
      </SideDrawer>

      {/* Side Drawer: Approve / Reject Confirmation */}
      <SideDrawer
        isOpen={Boolean(actionModal)}
        onClose={() => setActionModal(null)}
        title={
          actionModal?.type === "approve"
            ? `Approve Stage: ${actionModal?.request?.requestCode || ""}`
            : `Reject Request: ${actionModal?.request?.requestCode || ""}`
        }
        subtitle={actionModal?.request?.title}
        icon={actionModal?.type === "approve" ? CheckCircle2 : XCircle}
        widthClass="max-w-md"
      >
        {actionModal && (
          <form onSubmit={submitAction} className="space-y-4">
            <div
              className={`p-3.5 rounded-xl border text-xs space-y-1 ${isDark ? "bg-white/[0.02] border-white/[0.08]" : "bg-slate-50 border-slate-200"
                }`}
            >
              <p className={isDark ? "text-slate-400" : "text-slate-500"}>
                Requested by:{" "}
                <strong className={isDark ? "text-white" : "text-slate-900"}>
                  {getDisplayName(actionModal.request.requester)}
                </strong>
              </p>
              {actionModal.request.amount > 0 && (
                <p className="text-emerald-500 font-bold font-mono">
                  Amount: {formatINR(actionModal.request.amount)}
                </p>
              )}
            </div>

            <div>
              <label className={`block text-xs font-semibold mb-1.5 ${g.heading}`}>
                {actionModal.type === "approve" ? "Sign-Off Notes (Optional)" : "Rejection Reason *"}
              </label>
              <textarea
                rows={4}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={
                  actionModal.type === "approve"
                    ? "Optional sign-off notes..."
                    : "Reason for declining this request..."
                }
                required={actionModal.type === "reject"}
                className={`w-full border rounded-xl p-3 text-xs focus:outline-none ${g.input}`}
              />
            </div>

            <div className={`flex justify-end gap-2 pt-3 border-t ${isDark ? "border-white/10" : "border-slate-100"}`}>
              <button
                type="button"
                onClick={() => setActionModal(null)}
                className={`px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer ${isDark ? "text-slate-400 hover:bg-white/5" : "text-slate-600 hover:bg-slate-100"
                  }`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processingAction}
                className={`px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer ${actionModal.type === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-500"
                  : "bg-rose-600 hover:bg-rose-500"
                  }`}
              >
                {processingAction
                  ? "Processing..."
                  : actionModal.type === "approve"
                    ? "Confirm Approval"
                    : "Confirm Rejection"}
              </button>
            </div>
          </form>
        )}
      </SideDrawer>
    </div>
  );
}
