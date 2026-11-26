const { Worker } = require("bullmq");
const nodemailer = require("nodemailer");
const { redisConfig } = require("../services/queue");

let cachedTransporter = null;
let cachedConfigKey = "";

/**
 * Lazily build or reuse a Nodemailer SMTP transporter if user SMTP credentials exist.
 * Returns null when SMTP credentials are not configured so jobs can skip gracefully.
 */
function getTransporter() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT) || 587;
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (!host || !user || !pass) {
    return null;
  }

  const configKey = `${host}:${port}:${user}:${secure}`;
  if (cachedTransporter && cachedConfigKey === configKey) {
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
  });
  cachedConfigKey = configKey;
  return cachedTransporter;
}

function buildEmailTemplate({ type, data = {} }) {
  const appUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const brand = process.env.PLATFORM || "Lira Workspace";

  switch (type) {
    case "offline_chat_message": {
      const sender = data.senderName || "A teammate";
      const roomLabel = data.roomLabel || "Direct Messages";
      const subject = `[${brand}] New message from ${sender}`;
      const text = `${sender} sent you a message in ${roomLabel} while you were offline.\n\nOpen ${appUrl} to read and reply.`;
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0f1117;color:#f4f4f5;border-radius:12px;border:1px solid #27272a;">
          <h2 style="margin:0 0 12px;font-size:18px;color:#ffffff;">New message from ${sender}</h2>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#d4d4d8;">
            <strong>${sender}</strong> sent you an encrypted message in <strong>${roomLabel}</strong> while you were offline.
          </p>
          <a href="${appUrl}" style="display:inline-block;padding:10px 18px;background:#ffffff;color:#09090b;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
            Open ${brand}
          </a>
        </div>
      `;
      return { subject, text, html };
    }

    case "task_approval_request": {
      const code = data.code || "Task";
      const title = data.title || "Approval Needed";
      const requester = data.requesterName || "A team member";
      const stage = data.stageName || "Review & Approval";
      const subject = `[${brand}] Approval Required: ${code} — ${title}`;
      const text = `${requester} submitted ${code} ("${title}") for ${stage}.\n\nReview and approve at ${appUrl}/requests`;
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0f1117;color:#f4f4f5;border-radius:12px;border:1px solid #27272a;">
          <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#f59e0b22;color:#fbbf24;font-size:11px;font-weight:700;margin-bottom:10px;">APPROVAL REQUIRED</span>
          <h2 style="margin:0 0 10px;font-size:18px;color:#ffffff;">${code}: ${title}</h2>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#d4d4d8;">
            <strong>${requester}</strong> requested your sign-off for <strong>${stage}</strong>.
          </p>
          <a href="${appUrl}/requests" style="display:inline-block;padding:10px 18px;background:#ffffff;color:#09090b;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
            Review & Approve
          </a>
        </div>
      `;
      return { subject, text, html };
    }

    case "task_approval_decision": {
      const code = data.code || "Request";
      const title = data.title || "";
      const decision = data.decision || "updated";
      const reviewer = data.reviewerName || "Reviewer";
      const comment = data.comment || "";
      const isApproved = decision.toLowerCase().includes("approv");
      const subject = `[${brand}] ${code} ${isApproved ? "Approved" : "Declined"}`;
      const text = `${reviewer} marked ${code} ("${title}") as ${decision}.${comment ? `\nNote: ${comment}` : ""}\n\nView details: ${appUrl}/requests`;
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0f1117;color:#f4f4f5;border-radius:12px;border:1px solid #27272a;">
          <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${isApproved ? "#10b98122" : "#ef444422"};color:${isApproved ? "#34d399" : "#f87171"};font-size:11px;font-weight:700;margin-bottom:10px;">
            ${decision.toUpperCase()}
          </span>
          <h2 style="margin:0 0 10px;font-size:18px;color:#ffffff;">${code}: ${title}</h2>
          <p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#d4d4d8;">
            <strong>${reviewer}</strong> updated this approval item to <strong>${decision}</strong>.
          </p>
          ${comment ? `<p style="margin:0 0 16px;padding:10px 12px;background:#18181b;border-radius:8px;font-size:13px;color:#e4e4e7;">"${comment}"</p>` : ""}
          <a href="${appUrl}/requests" style="display:inline-block;padding:10px 18px;background:#ffffff;color:#09090b;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
            Open Requests
          </a>
        </div>
      `;
      return { subject, text, html };
    }

    case "join_request_new": {
      const applicant = data.applicantName || "A new user";
      const publicId = data.publicId || "EMP-NEW";
      const email = data.applicantEmail || "";
      const dept = data.departmentName || "Engineering";
      const subject = `[${brand}] Join Request (${publicId}) — ${applicant}`;
      const text = `${applicant} (${email}, Public ID: ${publicId}) requested to join ${dept}.\n\nReview and approve at ${appUrl}/team`;
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0f1117;color:#f4f4f5;border-radius:12px;border:1px solid #27272a;">
          <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:#6366f122;color:#a5b4fc;font-size:11px;font-weight:700;margin-bottom:10px;">PUBLIC ID: ${publicId}</span>
          <h2 style="margin:0 0 10px;font-size:18px;color:#ffffff;">New Workspace Join Request</h2>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#d4d4d8;">
            <strong>${applicant}</strong> (${email}) applied to join <strong>${dept}</strong> and is awaiting admin approval.
          </p>
          <a href="${appUrl}/team" style="display:inline-block;padding:10px 18px;background:#ffffff;color:#09090b;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
            Review Applicant (${publicId})
          </a>
        </div>
      `;
      return { subject, text, html };
    }

    case "join_request_decision": {
      const publicId = data.publicId || "";
      const decision = data.decision || "updated";
      const dept = data.departmentName || "Workspace";
      const reason = data.reason || "";
      const isApproved = decision.toLowerCase().includes("approv");
      const subject = `[${brand}] Application ${isApproved ? "Approved" : "Declined"} (${publicId})`;
      const text = isApproved
        ? `Your join request (${publicId}) for ${dept} has been approved! Open ${appUrl} to enter the workspace.`
        : `Your join request (${publicId}) was declined${reason ? `: "${reason}"` : "."}`;
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0f1117;color:#f4f4f5;border-radius:12px;border:1px solid #27272a;">
          <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${isApproved ? "#10b98122" : "#ef444422"};color:${isApproved ? "#34d399" : "#f87171"};font-size:11px;font-weight:700;margin-bottom:10px;">
            ${publicId} · ${decision.toUpperCase()}
          </span>
          <h2 style="margin:0 0 10px;font-size:18px;color:#ffffff;">Workspace Application ${isApproved ? "Approved" : "Declined"}</h2>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#d4d4d8;">
            ${isApproved ? `You have been granted access to <strong>${dept}</strong>.` : `Reason: ${reason || "Contact workspace admin"}`}
          </p>
          <a href="${appUrl}" style="display:inline-block;padding:10px 18px;background:#ffffff;color:#09090b;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
            Open ${brand}
          </a>
        </div>
      `;
      return { subject, text, html };
    }

    case "task_assigned": {
      const key = data.key || "TASK";
      const title = data.title || "New Task";
      const assigner = data.assignerName || "A teammate";
      const subject = `[${brand}] Assigned to you: ${key} — ${title}`;
      const text = `${assigner} assigned ${key} ("${title}") to you.\n\nOpen ${appUrl}/board to view details.`;
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0f1117;color:#f4f4f5;border-radius:12px;border:1px solid #27272a;">
          <h2 style="margin:0 0 10px;font-size:18px;color:#ffffff;">${key}: ${title}</h2>
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#d4d4d8;">
            <strong>${assigner}</strong> assigned this task to you.
          </p>
          <a href="${appUrl}/board" style="display:inline-block;padding:10px 18px;background:#ffffff;color:#09090b;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
            View on Board
          </a>
        </div>
      `;
      return { subject, text, html };
    }

    case "workspace_event": {
      const title = data.title || "Workspace Activity Update";
      const message = data.message || "There is a new update in your workspace.";
      const publicId = data.publicId;
      const targetUrl = data.actionUrl ? `${appUrl}${data.actionUrl}` : appUrl;
      const subject = `[${brand}] ${title}${publicId ? ` (${publicId})` : ""}`;
      const text = `${title}${publicId ? ` [${publicId}]` : ""}\n\n${message}\n\nOpen: ${targetUrl}`;
      const html = `
        <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;background:#0f1117;color:#f4f4f5;border-radius:12px;border:1px solid #27272a;">
          <div style="display:inline-block;padding:4px 10px;border-radius:999px;background:#1e1b4b;color:#a5b4fc;font-size:11px;font-weight:700;margin-bottom:12px;">
            ${brand}${publicId ? ` • ${publicId}` : ""}
          </div>
          <h2 style="margin:0 0 10px;font-size:18px;color:#ffffff;">${title}</h2>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.6;color:#d4d4d8;">${message}</p>
          <a href="${targetUrl}" style="display:inline-block;padding:10px 18px;background:#ffffff;color:#09090b;text-decoration:none;border-radius:8px;font-weight:600;font-size:13px;">
            Open Workspace
          </a>
        </div>
      `;
      return { subject, text, html };
    }

    default: {
      const subject = data.subject || `[${brand}] Workspace Notification`;
      const text = data.text || data.message || "You have a new notification in Lira Workspace.";
      const html = `<div style="font-family:Inter,Arial,sans-serif;padding:20px;"><p>${text}</p><p><a href="${appUrl}">Open ${brand}</a></p></div>`;
      return { subject, text, html };
    }
  }
}

const ts = () => new Date().toISOString();

const emailWorker = new Worker(
  "email-notification-queue",
  async (job) => {
    const { to, type, data } = job.data || {};
    if (!to) {
      console.log(`[${ts()}] [EmailWorker] Skipped job=${job.id} (missing recipient)`);
      return { skipped: true, reason: "Missing recipient email" };
    }

    const transporter = getTransporter();
    if (!transporter) {
      // Leave gracefully when user's own SMTP credentials are not configured yet
      console.log(`[${ts()}] [EmailWorker] Skipped SMTP dispatch job=${job.id} to=${to} type=${type} (no SMTP credentials set)`);
      return { skipped: true, reason: "SMTP credentials not configured", to, type };
    }

    const from =
      process.env.SMTP_FROM?.trim() ||
      `"${process.env.PLATFORM || "Lira Workspace"}" <${process.env.SMTP_USER.trim()}>`;
    const { subject, text, html } = buildEmailTemplate({ type, data });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html,
    });

    console.log(`[${ts()}] [EmailWorker] Sent job=${job.id} (${type}) to=${to} messageId=${info.messageId}`);
    return { sent: true, messageId: info.messageId, to, type };
  },
  {
    connection: redisConfig,
    concurrency: 3,
  }
);

emailWorker.on("failed", (job, err) => {
  console.error(`[${ts()}] [EmailWorker] Job ${job?.id} failed:`, err.message);
});

module.exports = emailWorker;

