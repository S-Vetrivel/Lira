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
import toast from "react-hot-toast";

export default function Requests() {
  const { user, activeProject, theme } = useApp();
  const isDark = theme === "dark";

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
  const [amount, setAmount] = useState("");
  const [urgency, setUrgency] = useState("medium");
  const [submitting, setSubmitting] = useState(false);

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
  }, []);

  const handleCreateRequest = async (e) => {
    e.preventDefault();
    if (!title.trim() || !targetDepartment) {
      toast.error("Please fill title and target department");
      return;
    }

    setSubmitting(true);
    const res = await createRequest({
      title: title.trim(),
      description: description.trim(),
      requestType,
      targetDepartment,
      amount: amount ? Number(amount) : 0,
      currency: "INR",
      priority: urgency,
      project: activeProject?._id,
    });
    setSubmitting(false);

    if (res.success) {
      setShowCreateModal(false);
      setTitle("");
      setDescription("");
      setAmount("");
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
      className={`flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden transition-colors duration-150 ${
        isDark ? "bg-[#0c0d12] text-slate-200" : "bg-slate-50 text-slate-800"
      }`}
    >
      {/* Top Sub-Header */}
      <div
        className={`px-6 py-3.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          isDark ? "bg-[#0e0f16] border-white/10 text-white" : "bg-white border-slate-200 text-slate-900"
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl border flex items-center justify-center ${
              isDark
                ? "bg-indigo-500/15 border-indigo-500/30 text-indigo-400"
                : "bg-indigo-50 border-indigo-200 text-indigo-600"
            }`}
          >
            <FileCheck2 className="w-4 h-4" />
          </div>
          <div>
            <h1 className={`text-sm sm:text-base font-bold tracking-tight ${isDark ? "text-white" : "text-slate-900"}`}>
              Cross-Department Requests & Sign-Offs
            </h1>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
              Inter-department handoffs, INR budget approvals, and auto-spawning tasks
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className={`p-2 rounded-full border transition-colors cursor-pointer ${
              isDark
                ? "bg-white/5 hover:bg-white/10 border-white/10 text-slate-300"
                : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700"
            }`}
            title="Refresh Requests"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-indigo-400" : ""}`} />
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-md shadow-blue-500/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Formal Request</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div
        className={`px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 shrink-0 ${
          isDark ? "bg-[#12131a] border-white/10" : "bg-white/70 border-slate-200"
        }`}
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
                filterStatus === tab.id
                  ? isDark
                    ? "bg-white text-slate-950 font-bold shadow-xs"
                    : "bg-slate-900 text-white font-bold shadow-xs"
                  : isDark
                  ? "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white border border-white/10"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 font-mono">
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
              className={`p-4 sm:p-5 rounded-2xl border transition-all flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                isDark
                  ? "bg-[#14151c] border-white/10 hover:border-white/20"
                  : "bg-white border-slate-200 hover:border-indigo-300 shadow-xs"
              }`}
            >
              {/* Request Summary */}
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-400">
                    {req.requestCode}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${
                      isDark
                        ? "bg-white/5 border-white/10 text-slate-300"
                        : "bg-slate-100 border-slate-200 text-slate-700"
                    }`}
                  >
                    {req.requestType?.replace(/_/g, " ")}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      req.status === "approved"
                        ? "bg-emerald-500/15 text-emerald-500 border border-emerald-500/30"
                        : req.status === "rejected"
                        ? "bg-rose-500/15 text-rose-500 border border-rose-500/30"
                        : "bg-amber-500/15 text-amber-500 border border-amber-500/30"
                    }`}
                  >
                    {req.status?.replace(/_/g, " ")}
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    {formatDateIN(req.createdAt)}
                  </span>
                </div>

                <h3 className={`text-sm font-bold truncate ${isDark ? "text-white" : "text-slate-900"}`}>
                  {req.title}
                </h3>
                {req.description && (
                  <p className={`text-xs line-clamp-2 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                    {req.description}
                  </p>
                )}

                <div className={`flex flex-wrap items-center gap-4 text-[11px] pt-1 ${isDark ? "text-slate-400" : "text-slate-600"}`}>
                  <span>
                    Requested by:{" "}
                    <strong className={isDark ? "text-slate-200" : "text-slate-900"}>
                      {getDisplayName(req.requester)}
                    </strong>
                  </span>
                  <span>
                    Target:{" "}
                    <strong className={isDark ? "text-slate-200" : "text-slate-900"}>
                      {req.targetDepartment?.name || req.department?.name || "Operations"}
                    </strong>
                  </span>
                  {req.amount > 0 && (
                    <span className="text-emerald-500 font-bold font-mono flex items-center gap-0.5">
                      {formatINR(req.amount)}
                    </span>
                  )}
                </div>
              </div>

              {/* Stages Sequence */}
              <div
                className={`flex flex-wrap items-center gap-2 p-2.5 rounded-xl border shrink-0 ${
                  isDark ? "bg-[#1a1b24] border-white/10" : "bg-slate-50 border-slate-200"
                }`}
              >
                {req.stages?.map((stage, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-xs">
                    <div
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-semibold border ${
                        stage.status === "approved"
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

              {/* Action Buttons for Managers / Admins */}
              {isPending && (user?.role === "manager" || user?.role === "admin") && (
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => {
                      setActionModal({ type: "approve", request: req });
                      setActionNotes("");
                    }}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" /> Approve Stage
                  </button>
                  <button
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
            className={`text-center py-16 rounded-2xl border-2 border-dashed space-y-2 ${
              isDark ? "border-white/10 text-slate-500" : "border-slate-200 text-slate-400"
            }`}
          >
            <FileCheck2 className="w-8 h-8 mx-auto opacity-60" />
            <p className="text-xs font-semibold">No cross-department requests found</p>
          </div>
        )}
      </div>

      {/* Modal: Create Request */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`border rounded-3xl w-full max-w-lg p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150 ${
              isDark ? "bg-[#15161f] border-white/10 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <div className={`flex items-center justify-between pb-3 border-b ${isDark ? "border-white/10" : "border-slate-100"}`}>
              <h2 className="text-sm font-bold flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-indigo-500" />
                <span>Submit Formal Inter-Department Request</span>
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRequest} className="space-y-3.5 text-xs">
              <div>
                <label className={`block font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Request Title *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q4 Cloud Infrastructure Budget Approval"
                  className={`w-full border rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 ${
                    isDark
                      ? "bg-[#12131b] border-white/10 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Request Type
                  </label>
                  <select
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 ${
                      isDark ? "bg-[#12131b] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="budget_approval">Budget Approval</option>
                    <option value="asset_requisition">Asset Requisition</option>
                    <option value="travel_request">Travel Request</option>
                    <option value="vendor_payment">Vendor Payment</option>
                    <option value="compliance_signoff">Compliance Sign-Off</option>
                    <option value="general_request">General Request</option>
                  </select>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Target Department
                  </label>
                  <select
                    value={targetDepartment}
                    onChange={(e) => setTargetDepartment(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 ${
                      isDark ? "bg-[#12131b] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  >
                    {departments.map((dept) => (
                      <option key={dept._id} value={dept._id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Amount (₹ INR)
                  </label>
                  <div className="relative">
                    <IndianRupee className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="number"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="e.g. 25000"
                      className={`w-full border rounded-xl pl-8 pr-3 py-2.5 focus:outline-none focus:border-indigo-500 ${
                        isDark
                          ? "bg-[#12131b] border-white/10 text-white placeholder-slate-500"
                          : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                      }`}
                    />
                  </div>
                </div>

                <div>
                  <label className={`block font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                    Urgency
                  </label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    className={`w-full border rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 ${
                      isDark ? "bg-[#12131b] border-white/10 text-white" : "bg-slate-50 border-slate-200 text-slate-900"
                    }`}
                  >
                    <option value="urgent">Urgent (Immediate)</option>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium</option>
                    <option value="low">Standard / Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={`block font-semibold mb-1 ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                  Details & Justification
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain why this sign-off is required and deliverables expected..."
                  className={`w-full border rounded-xl px-3.5 py-2.5 focus:outline-none focus:border-indigo-500 resize-none ${
                    isDark
                      ? "bg-[#12131b] border-white/10 text-white placeholder-slate-500"
                      : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                  }`}
                />
              </div>

              <div className={`flex items-center justify-end gap-2 pt-3 border-t ${isDark ? "border-white/10" : "border-slate-100"}`}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className={`px-4 py-2 rounded-xl font-semibold transition-colors cursor-pointer ${
                    isDark ? "text-slate-400 hover:bg-white/5" : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold transition-colors shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  {submitting ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Approve / Reject Confirmation */}
      {actionModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            className={`border rounded-3xl w-full max-w-md p-6 space-y-4 shadow-2xl ${
              isDark ? "bg-[#15161f] border-white/10 text-slate-100" : "bg-white border-slate-200 text-slate-900"
            }`}
          >
            <h3 className="text-sm font-bold">
              {actionModal.type === "approve"
                ? `Approve Stage: ${actionModal.request.requestCode}`
                : `Reject Request: ${actionModal.request.requestCode}`}
            </h3>
            <p className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>
              {actionModal.request.title}
            </p>
            <form onSubmit={submitAction} className="space-y-3">
              <textarea
                rows={3}
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={
                  actionModal.type === "approve"
                    ? "Optional sign-off notes..."
                    : "Reason for declining this request..."
                }
                required={actionModal.type === "reject"}
                className={`w-full border rounded-xl p-3 text-xs focus:outline-none focus:border-indigo-500 ${
                  isDark
                    ? "bg-[#12131b] border-white/10 text-white placeholder-slate-500"
                    : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                }`}
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={processingAction}
                  className={`px-4 py-2 rounded-xl text-xs font-bold text-white cursor-pointer ${
                    actionModal.type === "approve"
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
          </div>
        </div>
      )}
    </div>
  );
}
