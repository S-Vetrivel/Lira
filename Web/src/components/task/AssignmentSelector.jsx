import React, { useMemo } from "react";
import { Users, Building2, Check, Sparkles, Lock } from "lucide-react";
import UserAvatar from "../common/UserAvatar";
import { getDisplayName } from "../../utils/formatters";
import { getGlassTokens } from "../../styles/glassTheme";

/**
 * Unified assignment selector supporting:
 * - Individual user or multi-user group (`assignees`)
 * - Project-invoked teams (`project.departments`) & other workspace teams (`assignedDepartments`)
 * - Permission gating via `tasks.assign` (`canAssign`)
 */
export default function AssignmentSelector({
  teamMembers = [],
  departments = [],
  project = null,
  selectedAssignees = [],
  selectedDepartments = [],
  onChangeAssignees,
  onChangeDepartments,
  canAssign = true,
  isDark = true,
}) {
  const g = getGlassTokens(isDark);

  const invokedDeptIds = useMemo(() => {
    const ids = new Set();
    if (!project) return ids;
    if (project.department) ids.add(String(project.department._id || project.department));
    if (Array.isArray(project.departments)) {
      project.departments.forEach((d) => ids.add(String(d._id || d)));
    }
    return ids;
  }, [project]);

  const sortedDepartments = useMemo(() => {
    return [...departments].sort((a, b) => {
      const aInv = invokedDeptIds.has(String(a._id)) ? 0 : 1;
      const bInv = invokedDeptIds.has(String(b._id)) ? 0 : 1;
      return aInv - bInv;
    });
  }, [departments, invokedDeptIds]);

  const toggleUser = (uid) => {
    if (!canAssign) return;
    const sid = String(uid);
    const exists = selectedAssignees.some((id) => String(id) === sid);
    const next = exists
      ? selectedAssignees.filter((id) => String(id) !== sid)
      : [...selectedAssignees, sid];
    onChangeAssignees?.(next);
  };

  const toggleDept = (did) => {
    if (!canAssign) return;
    const sid = String(did);
    const exists = selectedDepartments.some((id) => String(id) === sid);
    const next = exists
      ? selectedDepartments.filter((id) => String(id) !== sid)
      : [...selectedDepartments, sid];
    onChangeDepartments?.(next);
  };

  return (
    <div className={`p-3 rounded-xl border space-y-3 ${g.subtleSurface}`}>
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[11px] font-bold flex items-center gap-1.5 ${g.heading}`}>
          <Users className="w-3.5 h-3.5 text-indigo-400" />
          <span>Assign Users & Teams</span>
        </span>
        {!canAssign ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400">
            <Lock className="w-3 h-3" /> Read-only
          </span>
        ) : (
          <span className={`text-[10px] font-mono ${g.muted}`}>
            {selectedAssignees.length} user(s) · {selectedDepartments.length} team(s)
          </span>
        )}
      </div>

      {/* Teams / Departments Selection */}
      {sortedDepartments.length > 0 && (
        <div className="space-y-1.5">
          <span className={`text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1 ${g.muted}`}>
            <Building2 className="w-3 h-3" /> Teams / Departments (★ = Invoked in Project)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sortedDepartments.map((d) => {
              const isSelected = selectedDepartments.some((id) => String(id) === String(d._id));
              const isInvoked = invokedDeptIds.has(String(d._id));
              return (
                <button
                  key={d._id}
                  type="button"
                  disabled={!canAssign}
                  onClick={() => toggleDept(d._id)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-all ${
                    !canAssign ? "opacity-60 cursor-not-allowed " : "cursor-pointer "
                  }${
                    isSelected
                      ? "bg-indigo-600 border-indigo-500 text-white"
                      : g.btnSecondary
                  }`}
                >
                  {isInvoked && <Sparkles className="w-2.5 h-2.5 text-amber-300 shrink-0" />}
                  <span>{d.code || d.name}</span>
                  {isSelected && <Check className="w-3 h-3 shrink-0" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Individual Users or Group Selection */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span className={`text-[10px] font-semibold uppercase tracking-wider ${g.muted}`}>
            Individuals / Group
          </span>
          {canAssign && selectedAssignees.length > 0 && (
            <button
              type="button"
              onClick={() => onChangeAssignees?.([])}
              className="text-[10px] text-rose-400 hover:underline cursor-pointer"
            >
              Clear users
            </button>
          )}
        </div>
        <div className="max-h-32 overflow-y-auto flex flex-wrap gap-1.5 pr-1">
          {teamMembers.map((m) => {
            const isSelected = selectedAssignees.some((id) => String(id) === String(m._id));
            return (
              <button
                key={m._id}
                type="button"
                disabled={!canAssign}
                onClick={() => toggleUser(m._id)}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-medium transition-all ${
                  !canAssign ? "opacity-60 cursor-not-allowed " : "cursor-pointer "
                }${
                  isSelected
                    ? "bg-emerald-600 border-emerald-500 text-white font-semibold"
                    : g.btnSecondary
                }`}
              >
                <UserAvatar user={m} className="w-4 h-4 rounded-full" textClass="text-[7px]" />
                <span className="truncate max-w-[120px]">{getDisplayName(m)}</span>
                {isSelected && <Check className="w-3 h-3 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

