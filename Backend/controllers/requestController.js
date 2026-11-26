const Request = require("../models/requestModel");
const Department = require("../models/departmentModel");
const Task = require("../models/taskModel");
const Project = require("../models/projectModel");
const User = require("../models/userModel");
const {
  createNotification,
  notifyUsers,
  notifyPermissionHolders,
} = require("../utils/notificationHelper");
const { enqueueWebSocketEvent, enqueueEmailJob, enqueueEntityVectorJob } = require("../services/queue");
const {
  normalizeRequestType,
  normalizeTaskPriority,
  resolveDepartmentObjectIds,
  resolveProjectObjectId,
  resolveUserObjectIds,
} = require("../utils/entityResolvers");

const REQUEST_POPULATE = [
  { path: "requester", select: "fullname email avatar jobTitle role publicId" },
  { path: "department", select: "name code color" },
  { path: "targetDepartment", select: "name code color" },
  { path: "targetProject", select: "name prefix color" },
  { path: "targetUsers", select: "fullname email avatar publicId role jobTitle" },
  { path: "stages.approver", select: "fullname email avatar publicId" },
];

exports.createRequest = async (req, res) => {
  try {
    const {
      title,
      requestType,
      description,
      departmentId,
      targetDepartmentId,
      targetProjectId,
      project,
      targetUsers = [],
      priority,
      amount,
      currency,
      dateNeeded,
      attachments,
      customStages,
    } = req.body || {};

    const rawTargetDept = targetDepartmentId || req.body?.targetDepartment || null;
    const rawDept = departmentId || req.user?.department || null;
    const rawTargetProj = targetProjectId || req.body?.targetProject || project || null;

    const [resolvedTargetDepts, resolvedOwnDepts, resolvedProjId, cleanTargetUsers] = await Promise.all([
      rawTargetDept ? resolveDepartmentObjectIds([rawTargetDept]) : Promise.resolve([]),
      rawDept ? resolveDepartmentObjectIds([rawDept]) : Promise.resolve([]),
      rawTargetProj ? resolveProjectObjectId(rawTargetProj) : Promise.resolve(null),
      resolveUserObjectIds(Array.isArray(targetUsers) ? targetUsers : [req.body?.targetUser]),
    ]);

    let targetDeptId = resolvedTargetDepts[0] || null;
    let deptId = resolvedOwnDepts[0] || null;
    const targetProjId = resolvedProjId;

    if (!deptId) {
      if (targetDeptId) {
        deptId = targetDeptId;
      } else {
        const defaultDept = await Department.findOne().select("_id").lean();
        deptId = defaultDept?._id || null;
        if (!targetDeptId) targetDeptId = defaultDept?._id || null;
      }
    }
    if (!targetDeptId) targetDeptId = deptId;
    if (!deptId) {
      return res.status(400).json({ success: false, message: "No department available for request routing" });
    }

    const count = await Request.countDocuments();
    const requestCode = `REQ-${100 + count + 1}`;

    let stages = [];
    if (Array.isArray(customStages) && customStages.length > 0) {
      stages = customStages;
    } else {
      stages = [
        {
          stageNumber: 1,
          stageName: "Team / Lead Review",
          roleRequired: "manager",
          department: targetDeptId || deptId,
          status: "pending",
        },
        {
          stageNumber: 2,
          stageName: "Final Sign-off",
          roleRequired: "admin",
          department: targetDeptId || deptId,
          status: "pending",
        },
      ];
    }

    const newRequest = new Request({
      requestCode,
      title,
      requestType: normalizeRequestType(requestType),
      description: description || "",
      department: deptId,
      targetDepartment: targetDeptId,
      targetProject: targetProjId,
      targetUsers: cleanTargetUsers,
      requester: req.user._id,
      priority: normalizeTaskPriority(priority),
      amount: Number(amount) || 0,
      currency: currency || "INR",
      dateNeeded: dateNeeded ? new Date(dateNeeded) : null,
      attachments: attachments || [],
      stages,
      currentStageIndex: 0,
      status: "submitted",
    });

    await newRequest.save();

    const populatedRequest = await Request.findById(newRequest._id)
      .populate(REQUEST_POPULATE)
      .lean();

    // Notify requester + target individuals + dynamic `requests.approve` approvers + Superadmins
    await createNotification({
      recipient: req.user._id,
      sender: req.user._id,
      allowSelf: true,
      publicId: req.user?.publicId,
      type: "approval_request",
      title: `Request Submitted (${requestCode})`,
      message: `Your request ${requestCode} ("${title}") has been dispatched to ${populatedRequest?.targetDepartment?.name || "Approvers"}.`,
      alsoEmail: true,
      recipientEmail: req.user?.email,
      actionUrl: "/requests",
    });

    if (cleanTargetUsers.length > 0) {
      await notifyUsers({
        recipients: cleanTargetUsers,
        sender: req.user._id,
        publicId: req.user?.publicId,
        type: "approval_request",
        title: `New Request Targeted to You (${requestCode})`,
        message: `${req.user.fullname} targeted request ${requestCode}: "${title}".`,
        alsoEmail: true,
        emailType: "task_approval_request",
        emailData: {
          code: requestCode,
          title,
          requesterName: req.user.fullname || req.user.email,
          stageName: stages[0]?.stageName || "Review",
        },
        actionUrl: "/requests",
      });
    }

    await notifyPermissionHolders({
      permissionSlug: "requests.approve",
      sender: req.user._id,
      publicId: req.user?.publicId,
      type: "approval_request",
      title: `Approval Required (${requestCode})`,
      message: `${req.user.fullname} (${req.user?.publicId || "Staff"}) submitted ${requestCode}: "${title}" for ${populatedRequest?.targetDepartment?.name || "Workspace"}.`,
      emailType: "task_approval_request",
      emailData: {
        code: requestCode,
        title,
        requesterName: req.user.fullname || req.user.email,
        stageName: stages[0]?.stageName || "Team / Lead Review",
      },
      actionUrl: "/requests",
    });

    enqueueWebSocketEvent({
      target: "all",
      event: "request:created",
      data: { request: populatedRequest },
    });
    enqueueEntityVectorJob({ entityType: "request", entityId: String(newRequest._id) });

    res.status(201).json({ success: true, request: populatedRequest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRequests = async (req, res) => {
  try {
    const { department, targetDepartment, targetProject, status, type, requester } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (targetDepartment) filter.targetDepartment = targetDepartment;
    if (targetProject) filter.targetProject = targetProject;
    if (status) filter.status = status;
    if (type) filter.requestType = type;
    if (requester) filter.requester = requester;

    const requests = await Request.find(filter)
      .populate(REQUEST_POPULATE)
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, count: requests.length, requests });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRequestById = async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate(REQUEST_POPULATE)
      .populate("createdTask");

    if (!request) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    res.status(200).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.approveStage = async (req, res) => {
  try {
    const { id } = req.params;
    const { comment, notes } = req.body || {};
    const approvalComment = comment || notes || "Approved";
    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    const currentStage = request.stages[request.currentStageIndex];
    if (!currentStage) {
      return res.status(400).json({ success: false, message: "No pending approval stages" });
    }

    currentStage.status = "approved";
    currentStage.approver = req.user._id;
    currentStage.comment = approvalComment;
    currentStage.actionDate = new Date();

    const isLastStage = request.currentStageIndex >= request.stages.length - 1;

    if (isLastStage) {
      request.status = "approved";

      let targetProj = request.targetProject
        ? await Project.findById(request.targetProject)
        : await Project.findOne();
      if (targetProj) {
        targetProj.taskSequence = (targetProj.taskSequence || 100) + 1;
        await targetProj.save();
        const newTask = new Task({
          key: `${targetProj.prefix}-${targetProj.taskSequence}`,
          project: targetProj._id,
          department: request.targetDepartment || request.department,
          assignees: request.targetUsers || [],
          assignee: request.targetUsers?.[0] || null,
          assignedDepartments: request.targetDepartment ? [request.targetDepartment] : [],
          title: `[Approved ${request.requestCode}] ${request.title}`,
          description: `Action item originated from ${request.requestCode}:\n${request.description}`,
          type: "approval",
          status: "todo",
          priority: request.priority,
          reporter: request.requester,
          dueDate: request.dateNeeded,
          attachments: request.attachments,
        });
        await newTask.save();
        request.createdTask = newTask._id;
      }
    } else {
      request.currentStageIndex += 1;
      request.status = "in_review";
    }

    await request.save();
    const populatedRequest = await Request.findById(request._id)
      .populate(REQUEST_POPULATE)
      .lean();

    await createNotification({
      recipient: request.requester,
      sender: req.user._id,
      publicId: populatedRequest?.requester?.publicId,
      type: "approval_request",
      title: isLastStage ? `Request Approved (${request.requestCode})` : `Stage Approved (${request.requestCode})`,
      message: `${req.user.fullname} signed off ${currentStage.stageName} on ${request.requestCode}.`,
      alsoEmail: true,
      emailType: "task_approval_decision",
      emailData: {
        code: request.requestCode,
        title: request.title,
        decision: isLastStage ? "Approved" : `Stage Approved (${currentStage.stageName})`,
        reviewerName: req.user.fullname || req.user.email,
        comment: approvalComment,
      },
      actionUrl: "/requests",
    });

    enqueueWebSocketEvent({
      target: "all",
      event: "request:updated",
      data: { request: populatedRequest },
    });
    enqueueEntityVectorJob({ entityType: "request", entityId: String(request._id) });

    res.status(200).json({ success: true, request: populatedRequest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body || {};
    const rejectionText = reason || notes || "Declined";
    const request = await Request.findById(id);
    if (!request) return res.status(404).json({ success: false, message: "Request not found" });

    const currentStage = request.stages[request.currentStageIndex];
    if (currentStage) {
      currentStage.status = "rejected";
      currentStage.approver = req.user._id;
      currentStage.comment = rejectionText;
      currentStage.actionDate = new Date();
    }

    request.status = "rejected";
    request.rejectionReason = rejectionText;
    await request.save();

    const populatedRequest = await Request.findById(request._id)
      .populate(REQUEST_POPULATE)
      .lean();

    await createNotification({
      recipient: request.requester,
      sender: req.user._id,
      publicId: populatedRequest?.requester?.publicId,
      type: "approval_request",
      title: `Request Declined (${request.requestCode})`,
      message: `${req.user.fullname} declined ${request.requestCode}: "${rejectionText}"`,
      alsoEmail: true,
      emailType: "task_approval_decision",
      emailData: {
        code: request.requestCode,
        title: request.title,
        decision: "Declined",
        reviewerName: req.user.fullname || req.user.email,
        comment: rejectionText,
      },
      actionUrl: "/requests",
    });

    enqueueWebSocketEvent({
      target: "all",
      event: "request:updated",
      data: { request: populatedRequest },
    });
    enqueueEntityVectorJob({ entityType: "request", entityId: String(request._id) });

    res.status(200).json({ success: true, request: populatedRequest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
