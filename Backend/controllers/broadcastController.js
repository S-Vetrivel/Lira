const BroadcastNotification = require("../models/broadcastNotificationModel");
const Notification = require("../models/notificationModel");
const User = require("../models/userModel");
const Department = require("../models/departmentModel");
const Role = require("../models/roleModel");
const Project = require("../models/projectModel");
const { getOnlineUserIdsAsync, getIO, emitTargetEvent } = require("../config/socket");
const { enqueueWebSocketEvent, enqueueEmailJob } = require("../services/queue");
const { sendPushToUserDetailed, isVapidConfigured } = require("../services/pushService");
const { queryAI } = require("../services/aiService");

function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_USER?.trim() && process.env.SMTP_PASS?.trim());
}

exports.getBroadcastOverview = async (req, res) => {
  try {
    const [onlineIds, users, departments, roles, history] = await Promise.all([
      getOnlineUserIdsAsync(),
      User.find({ isActive: true, status: { $nin: ["pending_approval", "rejected"] } })
        .select("_id fullname email publicId role department departmentName jobTitle pushSubscription lastSeenAt avatar profilePicture")
        .sort({ fullname: 1 })
        .lean(),
      Department.find().select("_id name code color").sort({ name: 1 }).lean(),
      Role.find().select("_id name displayName").sort({ isSystem: -1, name: 1 }).lean(),
      BroadcastNotification.find()
        .populate("sentBy", "fullname email publicId avatar profilePicture")
        .populate("targetDepartments", "name code")
        .sort({ createdAt: -1 })
        .limit(40)
        .lean(),
    ]);

    const onlineSet = new Set(onlineIds.map(String));
    const pushSubscribedCount = users.filter((u) => Boolean(u.pushSubscription)).length;
    const onlineCount = users.filter((u) => onlineSet.has(String(u._id))).length;

    res.status(200).json({
      success: true,
      capabilities: {
        isVapidConfigured,
        isSmtpConfigured: isSmtpConfigured(),
      },
      summary: {
        totalActiveUsers: users.length,
        onlineCount,
        offlineCount: Math.max(0, users.length - onlineCount),
        pushSubscribedCount,
      },
      departments,
      roles,
      users: users.map((u) => ({
        _id: u._id,
        fullname: u.fullname,
        email: u.email,
        publicId: u.publicId,
        role: u.role,
        department: u.department,
        departmentName: u.departmentName,
        jobTitle: u.jobTitle,
        hasPush: Boolean(u.pushSubscription),
        isOnline: onlineSet.has(String(u._id)),
        lastSeenAt: u.lastSeenAt || null,
      })),
      history,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

exports.sendBroadcast = async (req, res) => {
  try {
    const {
      title,
      message,
      category = "announcement",
      actionUrl = "/",
      audienceType = "all",
      targetDepartments = [],
      targetRoles = [],
      targetUsers = [],
      channels = {},
      aiGenerated = false,
      aiPrompt = "",
      includeSelf = true,
    } = req.body;

    if (!String(title || "").trim() || !String(message || "").trim()) {
      return res.status(400).json({ success: false, message: "Broadcast title and message are required." });
    }

    const cleanChannels = {
      inApp: channels.inApp !== false,
      webPush: channels.webPush !== false,
      email: channels.email === true,
      offlineOnlyEmail: Boolean(channels.offlineOnlyEmail),
    };

    const onlineSet = new Set((await getOnlineUserIdsAsync()).map(String));
    const userFilter = {
      isActive: true,
      status: { $nin: ["pending_approval", "rejected"] },
    };
    if (!includeSelf && req.user?._id) {
      userFilter._id = { $ne: req.user._id };
    }

    if (audienceType === "department" && Array.isArray(targetDepartments) && targetDepartments.length > 0) {
      userFilter.department = { $in: targetDepartments };
    } else if (audienceType === "role" && Array.isArray(targetRoles) && targetRoles.length > 0) {
      userFilter.role = { $in: targetRoles.map((r) => String(r).toLowerCase()) };
    } else if (audienceType === "users" && Array.isArray(targetUsers) && targetUsers.length > 0) {
      userFilter._id = { $in: targetUsers };
    }

    let recipients = await User.find(userFilter)
      .select("_id email fullname publicId role department pushSubscription")
      .lean();

    if (audienceType === "online_only") {
      recipients = recipients.filter((u) => onlineSet.has(String(u._id)));
    } else if (audienceType === "offline_only") {
      recipients = recipients.filter((u) => !onlineSet.has(String(u._id)));
    }

    const stats = {
      totalRecipients: recipients.length,
      onlineAtSend: 0,
      offlineAtSend: 0,
      inAppDelivered: 0,
      webPushSent: 0,
      webPushNoSubscription: 0,
      webPushFailed: 0,
      emailsQueued: 0,
    };

    const cleanTitle = String(title).trim();
    const cleanMessage = String(message).trim();
    const cleanUrl = String(actionUrl || "/").trim() || "/";
    const senderName = req.user?.fullname || req.user?.email || "Workspace Admin";
    const categoryBadge = category === "urgent" ? "URGENT" : category === "maintenance" ? "MAINTENANCE" : category === "release_update" ? "RELEASE UPDATE" : "ANNOUNCEMENT";

    const broadcastDoc = await BroadcastNotification.create({
      title: cleanTitle,
      message: cleanMessage,
      category,
      actionUrl: cleanUrl,
      audienceType,
      targetDepartments: audienceType === "department" ? targetDepartments : [],
      targetRoles: audienceType === "role" ? targetRoles : [],
      targetUsers: audienceType === "users" ? targetUsers : [],
      channels: cleanChannels,
      aiGenerated: Boolean(aiGenerated),
      aiPrompt: String(aiPrompt || "").slice(0, 400),
      stats,
      sentBy: req.user._id,
    });

    await Promise.allSettled(
      recipients.map(async (u) => {
        const uid = String(u._id);
        const isOnline = onlineSet.has(uid);
        if (isOnline) stats.onlineAtSend += 1;
        else stats.offlineAtSend += 1;

        if (cleanChannels.inApp) {
          const notif = await Notification.create({
            recipient: uid,
            sender: req.user._id,
            publicId: req.user?.publicId,
            type: category === "announcement" || category === "release_update" ? "announcement" : "broadcast",
            title: cleanTitle,
            message: cleanMessage,
          });
          const populatedNotif = await Notification.findById(notif._id)
            .populate("sender", "fullname email avatar profilePicture publicId")
            .lean();

          const io = getIO();
          if (io) {
            emitTargetEvent("user", uid, "notification:new", populatedNotif);
            emitTargetEvent("user", uid, "broadcast:alert", {
              broadcastId: String(broadcastDoc._id),
              title: cleanTitle,
              message: cleanMessage,
              category,
              actionUrl: cleanUrl,
              senderName,
              createdAt: broadcastDoc.createdAt,
            });
          } else {
            await Promise.allSettled([
              enqueueWebSocketEvent({
                target: "user",
                room: uid,
                event: "notification:new",
                data: populatedNotif,
              }),
              enqueueWebSocketEvent({
                target: "user",
                room: uid,
                event: "broadcast:alert",
                data: {
                  broadcastId: String(broadcastDoc._id),
                  title: cleanTitle,
                  message: cleanMessage,
                  category,
                  actionUrl: cleanUrl,
                  senderName,
                  createdAt: broadcastDoc.createdAt,
                },
              }),
            ]);
          }
          stats.inAppDelivered += 1;
        }

        if (cleanChannels.webPush) {
          const pushRes = await sendPushToUserDetailed(uid, {
            title: `[${categoryBadge}] ${cleanTitle}`,
            body: cleanMessage,
            message: cleanMessage,
            url: cleanUrl,
            tag: `broadcast-${broadcastDoc._id}`,
          });
          if (pushRes.delivered) stats.webPushSent += 1;
          else if (pushRes.reason === "no_subscription") stats.webPushNoSubscription += 1;
          else stats.webPushFailed += 1;
        }

        if (cleanChannels.email && u.email) {
          const shouldSendEmail = !cleanChannels.offlineOnlyEmail || !isOnline;
          if (shouldSendEmail) {
            await enqueueEmailJob({
              to: u.email,
              type: "broadcast_announcement",
              data: {
                title: cleanTitle,
                message: cleanMessage,
                category,
                actionUrl: cleanUrl,
                senderName,
              },
            });
            stats.emailsQueued += 1;
          }
        }
      })
    );

    const saved = await BroadcastNotification.findByIdAndUpdate(
      broadcastDoc._id,
      { $set: { stats } },
      { new: true }
    )
      .populate("sentBy", "fullname email publicId avatar profilePicture")
      .populate("targetDepartments", "name code")
      .lean();

    if (getIO()) {
      emitTargetEvent("all", null, "broadcast:history-updated", saved);
    } else {
      enqueueWebSocketEvent({
        target: "all",
        event: "broadcast:history-updated",
        data: saved,
      }).catch(() => {});
    }

    res.status(201).json({
      success: true,
      broadcast: saved,
      stats,
      message: `Broadcast delivered to ${stats.totalRecipients} recipient(s) (${stats.inAppDelivered} in-app, ${stats.webPushSent} push, ${stats.emailsQueued} email).`,
    });
  } catch (err) {
    console.error("[BroadcastController] sendBroadcast error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
};

function buildLocalBroadcastFallback({ brief, tone = "professional", category = "announcement", audienceHint = "all" }) {
  const cleanBrief = String(brief || "Important workspace update").trim();
  const titlePrefix =
    category === "urgent"
      ? "Action Required:"
      : category === "maintenance"
      ? "Scheduled Maintenance:"
      : category === "release_update"
      ? "New Workspace Release:"
      : "Team Update:";
  const headline = cleanBrief.length > 65 ? `${cleanBrief.slice(0, 62)}...` : cleanBrief;
  return {
    title: `${titlePrefix} ${headline.charAt(0).toUpperCase()}${headline.slice(1)}`,
    message:
      tone === "friendly"
        ? `Hi everyone — quick heads up regarding ${cleanBrief}. Please check the workspace when you get a moment and reach out in chat if you have questions.`
        : `Team notice: ${cleanBrief}. Please review the latest status in Lira Workspace and coordinate with your lead on any action items.`,
    category,
    suggestedAudienceType: audienceHint || "all",
    suggestedActionUrl: category === "release_update" ? "/" : "/projects",
    suggestedChannels: {
      inApp: true,
      webPush: true,
      email: category === "urgent" || category === "maintenance",
      offlineOnlyEmail: category !== "urgent",
    },
    source: "local-composer",
  };
}

exports.draftBroadcastWithAI = async (req, res) => {
  try {
    const {
      brief,
      tone = "professional",
      category = "announcement",
      audienceHint = "all",
      provider,
      model,
    } = req.body;

    if (!String(brief || "").trim()) {
      return res.status(400).json({ success: false, message: "Please enter a brief topic for AI to draft." });
    }

    const [projects, departments] = await Promise.all([
      Project.find({ status: "active" }).select("name prefix").limit(8).lean(),
      Department.find().select("name code").limit(10).lean(),
    ]);

    const systemPrompt = `You are Lira Workspace's Push Broadcast AI Composer.
Write crisp, clear organizational broadcast notifications ready to push to Web, PWA, and Email.
Valid categories: "info" | "announcement" | "urgent" | "maintenance" | "release_update".
Valid audience types: "all" | "online_only" | "offline_only" | "department" | "role" | "users".
Valid routes: "/", "/board", "/table", "/calendar", "/requests", "/my-work", "/projects", "/team", "/roles", "/audit", "/broadcast", "/profile".
Active workspaces: ${JSON.stringify(projects.map((p) => `${p.prefix}: ${p.name}`))}
Active departments: ${JSON.stringify(departments.map((d) => `${d.code}: ${d.name}`))}
Return STRICT valid JSON only:
{
  "title": "Concise punchy headline under 80 chars",
  "message": "Clear 2-3 sentence notification body ready for push, in-app banner, and email",
  "category": "info|announcement|urgent|maintenance|release_update",
  "suggestedAudienceType": "all|online_only|offline_only|department|role|users",
  "suggestedActionUrl": "/",
  "suggestedChannels": { "inApp": true, "webPush": true, "email": true, "offlineOnlyEmail": false }
}`;

    try {
      const aiRes = await queryAI({
        prompt: `Brief: ${brief}\nTone: ${tone}\nRequested category: ${category}\nAudience hint: ${audienceHint}`,
        systemPrompt,
        provider: provider || undefined,
        model: model || undefined,
        moduleKey: "broadcast",
        taskType: "broadcast_composer",
        userId: req.user._id,
        jsonMode: true,
        maxOutputTokens: 700,
      });

      const cleaned = String(aiRes.text || "")
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/```\s*$/i, "")
        .trim();
      const parsed = JSON.parse(cleaned);

      return res.status(200).json({
        success: true,
        draft: {
          title: parsed.title || buildLocalBroadcastFallback({ brief, tone, category }).title,
          message: parsed.message || buildLocalBroadcastFallback({ brief, tone, category }).message,
          category: parsed.category || category,
          suggestedAudienceType: parsed.suggestedAudienceType || audienceHint,
          suggestedActionUrl: parsed.suggestedActionUrl || "/",
          suggestedChannels: parsed.suggestedChannels || { inApp: true, webPush: true, email: true, offlineOnlyEmail: false },
          provider: aiRes.provider,
          model: aiRes.model,
          source: "ai",
        },
      });
    } catch (aiErr) {
      if (aiErr.statusCode === 403 || aiErr.deniedMeta) {
        return res.status(403).json({
          success: false,
          needsKey: true,
          message: aiErr.message || "AI key access required to run Broadcast AI Composer.",
        });
      }
      return res.status(200).json({
        success: true,
        draft: buildLocalBroadcastFallback({ brief, tone, category, audienceHint }),
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};
