const Request = require("../models/requestModel");
const Department = require("../models/departmentModel");
const Task = require("../models/taskModel");
const Project = require("../models/projectModel");
const User = require("../models/userModel");
const { createNotification } = require("../utils/notificationHelper");
const { enqueueWebSocketEvent, enqueueEmailJob } = require("../services/queue");

exports.createRequest = async (req, res) => {
  try {
    const {
      title,
      requestType,
      description,
      departmentId,
      targetDepartmentId,
      priority,
      amount,
      currency,
      dateNeeded,
      attachments,
      customStages,
    } = req.body;

    let targetDeptId = targetDepartmentId || req.body.targetDepartment;
    let deptId = departmentId || req.user?.department;

    if (!deptId) {
      if (targetDeptId) {
        deptId = targetDeptId;
      } else {
        const defaultDept = await Department.findOne();
        deptId = defaultDept?._id;
        targetDeptId = defaultDept?._id;
      }
    }
    if (!targetDeptId) targetDeptId = deptId;

    const count = await Request.countDocuments();
    const requestCode = `REQ-${100 + count + 1}`;

    let stages = [];
    if (Array.isArray(customStages) && customStages.length > 0) {
      stages = customStages;
    } else {
      stages = [
        {
          stageNumber: 1,
          stageName: "Department Review",
          roleRequired: "manager",
          department: deptId,
          status: "pending",
        },
        {
          stageNumber: 2,
          stageName: "Final Sign-off",
          roleRequired: "admin",
          department: targetDeptId,
          status: "pending",
        },
      ];
    }

    const newRequest = new Request({
      requestCode,
      title,
      requestType: requestType || "general_request",
      description: description || "",
      department: deptId,
      targetDepartment: targetDeptId,
      requester: req.user._id,
      priority: priority || "medium",
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
      .populate("requester", "fullname email avatar jobTitle role")
      .populate("department", "name code color")
      .populate("targetDepartment", "name code color")
      .lean();

    await createNotification({
      recipient: req.user._id,
      sender: req.user._id,
      type: "task_created",
      title: "Request Submitted",
      message: `Your request ${requestCode} (${title}) has been registered for approval.`,
    });

    enqueueWebSocketEvent({
      target: "all",
      event: "request:created",
      data: { request: populatedRequest },
    });

    // Notify & email approvers (managers/admins) for new approval request
    User.find({
      role: { $in: ["admin", "manager"] },
      status: "active",
      isActive: true,
      _id: { $ne: req.user._id },
    })
      .select("email fullname")
      .lean()
      .then((approvers) => {
        approvers.forEach((approver) => {
          if (approver.email) {
            enqueueEmailJob({
              to: approver.email,
              type: "task_approval_request",
              data: {
                code: requestCode,
                title,
                requesterName: req.user.fullname || req.user.email,
                stageName: stages[0]?.stageName || "Department Review",
              },
            });
          }
        });
      })
      .catch(() => {});

    res.status(201).json({ success: true, request: populatedRequest });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.getRequests = async (req, res) => {
  try {
    const { department, status, type, requester } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (status) filter.status = status;
    if (type) filter.requestType = type;
    if (requester) filter.requester = requester;

    const requests = await Request.find(filter)
      .populate("requester", "fullname email avatar jobTitle role")
      .populate("department", "name code color")
      .populate("targetDepartment", "name code color")
      .populate("stages.approver", "fullname email avatar")
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
      .populate("requester", "fullname email avatar jobTitle role")
      .populate("department", "name code color")
      .populate("targetDepartment", "name code color")
      .populate("stages.approver", "fullname email avatar")
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
    const { comment, notes } = req.body;
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

      let defaultProject = await Project.findOne();
      if (defaultProject) {
        const taskCount = await Task.countDocuments({ project: defaultProject._id });
        const newTask = new Task({
          key: `${defaultProject.prefix}-${taskCount + 101}`,
          project: defaultProject._id,
          department: request.department,
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

    await createNotification({
      recipient: request.requester,
      sender: req.user._id,
      type: "task_updated",
      title: isLastStage ? "Request Fully Approved" : "Request Stage Approved",
      message: `${request.requestCode} passed ${currentStage.stageName} sign-off.`,
    });

    enqueueWebSocketEvent({
      target: "all",
      event: "request:updated",
      data: { request },
    });

    // Send approval email update to requester
    User.findById(request.requester)
      .select("email fullname")
      .lean()
      .then((requester) => {
        if (requester?.email) {
          enqueueEmailJob({
            to: requester.email,
            type: "task_approval_decision",
            data: {
              code: request.requestCode,
              title: request.title,
              decision: isLastStage ? "Approved" : `Stage Approved (${currentStage.stageName})`,
              reviewerName: req.user.fullname || req.user.email,
              comment: approvalComment,
            },
          });
        }
      })
      .catch(() => {});

    res.status(200).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, notes } = req.body;
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

    await createNotification({
      recipient: request.requester,
      sender: req.user._id,
      type: "task_updated",
      title: "Request Declined",
      message: `${request.requestCode} was declined: "${rejectionText}"`,
    });

    enqueueWebSocketEvent({
      target: "all",
      event: "request:updated",
      data: { request },
    });

    // Send declined email update to requester
    User.findById(request.requester)
      .select("email fullname")
      .lean()
      .then((requester) => {
        if (requester?.email) {
          enqueueEmailJob({
            to: requester.email,
            type: "task_approval_decision",
            data: {
              code: request.requestCode,
              title: request.title,
              decision: "Declined",
              reviewerName: req.user.fullname || req.user.email,
              comment: rejectionText,
            },
          });
        }
      })
      .catch(() => {});

    res.status(200).json({ success: true, request });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
