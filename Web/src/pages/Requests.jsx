import React, { useState, useEffect } from "react";
import {
  FileCheck2,
  Plus,
  Clock,
  CheckCircle2,
  XCircle,
  Building2,
  DollarSign,
  ArrowRight,
  Send,
  AlertCircle,
  Layers,
  ChevronRight,
  Search,
} from "lucide-react";
import { useApp } from "../context/Appcontext";
import {
  getRequests,
  createRequest,
  approveRequestStage,
  rejectRequest,
  getDepartments,
} from "../services/api";
import toast from "react-hot-toast";

export default function Requests() {
  const { user, activeProject } = useApp();
  const [requests, setRequests] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [approvalNotes, setApprovalNotes] = useState("");
  const [selectedRequest, setSelectedRequest] = useState(null);

  // New Request Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [requestType, setRequestType] = useState("budget_approval");
  const [targetDepartment, setTargetDepartment] = useState("");
  const [amount, setAmount] = useState("");
  const [urgency, setUrgency] = useState("medium");

  const loadData = async () => {
    setLoading(true);
    const [reqRes, deptRes] = await Promise.all([getRequests(), getDepartments()]);
    if (reqRes.success) setRequests(reqRes.requests);
    if (deptRes.success) {
      setDepartments(deptRes.departments);
      if (deptRes.departments.length > 0) {
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

    const payload = {
      title,
      description,
      requestType,
      targetDepartment,
      amount: amount ? Number(amount) : 0,
      urgency,
      project: activeProject?._id,
    };

    const res = await createRequest(payload);
    if (res.success) {
      setShowCreateModal(false);
      setTitle("");
      setDescription("");
      setAmount("");
      loadData();
    }
  };

  const handleApproveStage = async (requestId) => {
    const res = await approveRequestStage(requestId, approvalNotes);
    if (res.success) {
      setApprovalNotes("");
      setSelectedRequest(null);
      loadData();
    }
  };

  const handleReject = async (requestId) => {
    const res = await rejectRequest(requestId, approvalNotes || "Request rejected");
    if (res.success) {
      setApprovalNotes("");
      setSelectedRequest(null);
      loadData();
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (filterStatus === "all") return true;
    return r.status === filterStatus;
  });

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-950 text-slate-200">
      {/* Top Header */}
      <div className="p-4 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <FileCheck2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold text-white tracking-tight">
              Cross-Department Requests & Sign-Offs
            </h1>
            <p className="text-xs text-slate-400">
              Inter-department handoffs, multi-stage approval sequences, and auto-spawning tasks
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors flex items-center gap-1.5 shadow-md shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" /> New Formal Request
        </button>
      </div>

      {/* Filter Bar */}
      <div className="p-3 bg-slate-900/40 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-400 font-medium">Status Filter:</span>
          {["all", "pending", "approved", "rejected"].map((st) => (
            <button
              key={st}
              onClick={() => setFilterStatus(st)}
              className={`px-3 py-1 rounded-lg capitalize transition-colors font-semibold ${
                filterStatus === st
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-slate-800/60 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              {st}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-500 font-mono">
          {filteredRequests.length} requests
        </span>
      </div>

      {/* Requests Feed */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredRequests.map((req) => (
          <div
            key={req._id}
            className="p-4 bg-slate-900/80 rounded-2xl border border-slate-800/80 hover:border-slate-700 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
          >
            {/* Request Summary */}
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-blue-400">
                  {req.requestCode}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-slate-800 text-slate-300">
                  {req.requestType.replace("_", " ")}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    req.status === "approved"
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                      : req.status === "rejected"
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                  }`}
                >
                  {req.status.toUpperCase()}
                </span>
              </div>

              <h3 className="text-sm font-bold text-white truncate">{req.title}</h3>
              <p className="text-xs text-slate-400 line-clamp-1">{req.description}</p>

              <div className="flex items-center gap-4 text-[11px] text-slate-400 font-mono pt-1">
                <span>Requested by: <strong className="text-slate-200">{req.requester?.name}</strong></span>
                <span>Target: <strong className="text-slate-200">{req.targetDepartment?.name || "Operations"}</strong></span>
                {req.amount > 0 && (
                  <span className="text-emerald-400 font-bold">
                    ${req.amount.toLocaleString()}
                  </span>
                )}
              </div>
            </div>

            {/* Stages Sequence */}
            <div className="flex items-center gap-2 bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 shrink-0">
              {req.stages?.map((stage, idx) => (
                <div key={idx} className="flex items-center gap-1.5 text-xs">
                  <div
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold ${
                      stage.status === "approved"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : stage.status === "rejected"
                        ? "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                        : "bg-amber-500/10 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {stage.status === "approved" ? (
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Clock className="w-3 h-3 text-amber-400" />
                    )}
                    <span>{stage.stageName}</span>
                  </div>
                  {idx < req.stages.length - 1 && (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                  )}
                </div>
              ))}
            </div>

            {/* Action Buttons for Managers / Approvers */}
            {req.status === "pending" && (user?.role === "manager" || user?.role === "admin") && (
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => handleApproveStage(req._id)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center gap-1 shadow-sm"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Approve Stage
                </button>
                <button
                  onClick={() => handleReject(req._id)}
                  className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white font-semibold text-xs border border-rose-500/30 transition-colors flex items-center gap-1"
                >
                  <XCircle className="w-3.5 h-3.5" /> Reject
                </button>
              </div>
            )}
          </div>
        ))}

        {filteredRequests.length === 0 && !loading && (
          <div className="text-center py-16 text-slate-500 space-y-2">
            <FileCheck2 className="w-8 h-8 mx-auto text-slate-600" />
            <p className="text-xs">No cross-department requests found</p>
          </div>
        )}
      </div>

      {/* Modal: Create Request */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl text-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <FileCheck2 className="w-4 h-4 text-blue-400" />
              <span>Submit Formal Inter-Department Request</span>
            </h2>

            <form onSubmit={handleCreateRequest} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 font-semibold mb-1">Request Title</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Q4 Marketing Video Production Budget"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Request Type</label>
                  <select
                    value={requestType}
                    onChange={(e) => setRequestType(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="budget_approval">Budget Approval</option>
                    <option value="asset_requisition">Asset Requisition</option>
                    <option value="travel_request">Travel Request</option>
                    <option value="legal_review">Legal Review</option>
                    <option value="general_admin">General Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Target Department</label>
                  <select
                    value={targetDepartment}
                    onChange={(e) => setTargetDepartment(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-blue-500"
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
                  <label className="block text-slate-400 font-semibold mb-1">Amount ($ USD)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="e.g. 2500"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 font-semibold mb-1">Urgency</label>
                  <select
                    value={urgency}
                    onChange={(e) => setUrgency(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="urgent">Urgent (Immediate)</option>
                    <option value="high">High Priority</option>
                    <option value="medium">Medium</option>
                    <option value="low">Standard / Low</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 font-semibold mb-1">Details & Justification</label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain why this sign-off is required and deliverables expected..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors shadow-md shadow-blue-500/20"
                >
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
