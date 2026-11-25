const bcrypt = require("bcryptjs");
const User = require("../models/userModel");
const Department = require("../models/departmentModel");
const Project = require("../models/projectModel");
const Task = require("../models/taskModel");
const ActivityLog = require("../models/activityLogModel");
const Comment = require("../models/commentModel");
const Notification = require("../models/notificationModel");

const seedDatabase = async () => {
  try {
    const adminEmail = (process.env.DEFAULT_SUPERADMIN_EMAIL || "admin@incuman.com").toLowerCase();
    let existingAdmin = await User.findOne({ email: adminEmail });
    const salt = await bcrypt.genSalt(10);
    const superadminPass = await bcrypt.hash(
      process.env.DEFAULT_SUPERADMIN_PASSWORD || "5fJn1aPsaNmn3ei7YnxNW7c9X0su4ZBl",
      salt
    );

    if (!existingAdmin) {
      console.log(`👑 Creating superadmin user: ${adminEmail}`);
      existingAdmin = await User.create({
        fullname: "Alex Vance (Admin)",
        email: adminEmail,
        password: superadminPass,
        role: "admin",
        departmentName: "Executive / IT",
        jobTitle: "Head of Operations & IT",
        avatar: "/avatars/alex.jpg",
        status: "active",
        publicId: "EMP-ADMIN-01",
      });
    }

    const deptCount = await Department.countDocuments();
    if (deptCount > 0) {
      console.log("ℹ️ Database already seeded with workspace data.");
      return;
    }

    console.log("🌱 Seeding office workspace data...");

    const standardPass = await bcrypt.hash("password123", salt);

    // 1. Create Default Users (3 clear levels: Admin, Manager, Employee)
    const adminUser = existingAdmin;

    const managerEng = await User.create({
      fullname: "Sarah Connor (Manager)",
      email: "sarah@incuman.com",
      password: standardPass,
      role: "manager",
      departmentName: "Engineering",
      jobTitle: "Engineering Lead",
      avatar: "/avatars/sarah.jpg",
      status: "active",
    });

    const managerOps = await User.create({
      fullname: "David Miller (Manager)",
      email: "david@incuman.com",
      password: standardPass,
      role: "manager",
      departmentName: "Operations",
      jobTitle: "Operations Lead",
      avatar: "/avatars/david.jpg",
      status: "active",
    });

    const employeeRahul = await User.create({
      fullname: "Rahul Sharma",
      email: "rahul@incuman.com",
      password: standardPass,
      role: "employee",
      departmentName: "Engineering",
      jobTitle: "Frontend Engineer",
      avatar: "/avatars/rahul.jpg",
      status: "active",
    });

    const employeeVetri = await User.create({
      fullname: "Vetrivel K",
      email: "vetri@incuman.com",
      password: standardPass,
      role: "employee",
      departmentName: "Engineering",
      jobTitle: "Backend & Systems Engineer",
      avatar: "/avatars/vetri.jpg",
      status: "active",
    });

    const employeeArun = await User.create({
      fullname: "Arun Kumar",
      email: "arun@incuman.com",
      password: standardPass,
      role: "employee",
      departmentName: "Engineering",
      jobTitle: "QA & Cloud Specialist",
      avatar: "/avatars/arun.jpg",
      status: "active",
    });

    const employeePriya = await User.create({
      fullname: "Priya Patel",
      email: "priya@incuman.com",
      password: standardPass,
      role: "employee",
      departmentName: "Operations",
      jobTitle: "Product Designer",
      avatar: "/avatars/priya.jpg",
      status: "active",
    });

    // 2. Create Departments
    const deptEng = await Department.create({
      name: "Engineering",
      code: "ENG",
      description: "Software development, architecture, cloud infrastructure, and QA",
      color: "#2563EB",
      lead: managerEng._id,
    });

    const deptOps = await Department.create({
      name: "Operations",
      code: "OPS",
      description: "Office administration, asset management, client deliverables, and HR",
      color: "#059669",
      lead: managerOps._id,
    });

    const deptMkt = await Department.create({
      name: "Marketing",
      code: "MKT",
      description: "Growth, content design, customer outreach, and branding",
      color: "#DB2777",
      lead: adminUser._id,
    });

    const deptHR = await Department.create({
      name: "Human Resources",
      code: "HR",
      description: "Recruitment, payroll, employee welfare, and office policy",
      color: "#7C3AED",
      lead: adminUser._id,
    });

    // Update users with department references
    await User.updateMany({ departmentName: "Engineering" }, { department: deptEng._id });
    await User.updateMany({ departmentName: "Operations" }, { department: deptOps._id });

    // 3. Create Projects with Short Prefixes
    const projEng = await Project.create({
      name: "Lira Core Platform",
      prefix: "ENG",
      description: "Next-gen Jira-style office task management and collaboration tool",
      department: deptEng._id,
      lead: managerEng._id,
      members: [adminUser._id, managerEng._id, employeeRahul._id, employeeVetri._id, employeeArun._id],
      color: "#2563EB",
      taskSequence: 104,
      startDate: new Date(),
    });

    const projOps = await Project.create({
      name: "Office IT & Operations",
      prefix: "OPS",
      description: "Hardware procurement, vendor management, and internal services",
      department: deptOps._id,
      lead: managerOps._id,
      members: [adminUser._id, managerOps._id, employeePriya._id, employeeArun._id],
      color: "#059669",
      taskSequence: 22,
      startDate: new Date(),
    });

    // 4. Create Sample Tasks with real auto-number IDs (ENG-101, ENG-102, OPS-15...)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Task 1: ENG-101 (In Progress)
    const task1 = await Task.create({
      key: "ENG-101",
      project: projEng._id,
      title: "Implement drag-and-drop Kanban workspace with real-time sync",
      description: "Build interactive multi-column board with immediate optimistic updates and Redis websocket broadcast.\n\n### Acceptance Criteria:\n- Drag cards across To Do, In Progress, Review, and Done\n- Instant socket notification to connected teammates\n- Smooth animations and badge indicators",
      type: "task",
      status: "in_progress",
      priority: "urgent",
      assignee: employeeRahul._id,
      reporter: managerEng._id,
      dueDate: tomorrow,
      estimatedHours: 8,
      loggedHours: 4.5,
      subtasks: [
        { title: "Configure HTML5/React drag drop sensors", completed: true, assignee: employeeRahul._id },
        { title: "Hook status patch endpoint to backend", completed: true, assignee: employeeRahul._id },
        { title: "Broadcast real-time column movements", completed: false, assignee: employeeRahul._id },
      ],
      workLogs: [
        {
          user: employeeRahul._id,
          hours: 2.5,
          note: "Drafted Kanban column layout and responsive cards",
          date: yesterday,
        },
        {
          user: employeeRahul._id,
          hours: 2.0,
          note: "Connected drag event handlers to PATCH /api/tasks/:id/status",
          date: new Date(),
        },
      ],
    });

    // Task 2: ENG-102 (Review)
    const task2 = await Task.create({
      key: "ENG-102",
      project: projEng._id,
      title: "Socket.IO multi-node Redis cluster adapter & queue workers",
      description: "Set up BullMQ worker process and Redis adapter for distributed websocket scaling across cluster workers.",
      type: "task",
      status: "review",
      priority: "high",
      assignee: employeeVetri._id,
      reporter: managerEng._id,
      dueDate: tomorrow,
      estimatedHours: 6,
      loggedHours: 6,
      subtasks: [
        { title: "Configure @socket.io/redis-adapter", completed: true },
        { title: "Implement websocketWorker for BullMQ", completed: true },
        { title: "Add cluster.js multi-node runner", completed: true },
      ],
      workLogs: [
        {
          user: employeeVetri._id,
          hours: 6.0,
          note: "Implemented Redis pub/sub queue and cluster launcher",
          date: new Date(),
        },
      ],
    });

    // Task 3: ENG-103 (To Do - Overdue Alert)
    const task3 = await Task.create({
      key: "ENG-103",
      project: projEng._id,
      title: "Fix memory leak in media thumbnail generator stream",
      description: "When processing 50MB+ image uploads, the buffer stream intermittently triggers out of memory warnings.",
      type: "bug",
      status: "todo",
      priority: "high",
      assignee: employeeArun._id,
      reporter: managerEng._id,
      dueDate: yesterday, // Overdue
      estimatedHours: 4,
      loggedHours: 0,
      subtasks: [
        { title: "Profile memory allocation during large uploads", completed: false },
        { title: "Switch to pipeline stream chunking", completed: false },
      ],
    });

    // Task 4: ENG-104 (Done)
    const task4 = await Task.create({
      key: "ENG-104",
      project: projEng._id,
      title: "Integrate Google Gemini 1.5 Flash task breakdown API",
      description: "Empower leads to click 'AI Breakdown' to auto-generate checklists and time estimates.",
      type: "task",
      status: "done",
      priority: "medium",
      assignee: employeeRahul._id,
      reporter: adminUser._id,
      dueDate: yesterday,
      estimatedHours: 5,
      loggedHours: 5,
      subtasks: [
        { title: "Integrate Gemini REST API endpoint", completed: true },
        { title: "Add prompt parser and JSON schema validator", completed: true },
        { title: "Create front-end AI breakdown button", completed: true },
      ],
      workLogs: [
        {
          user: employeeRahul._id,
          hours: 5.0,
          note: "Integrated Gemini 1.5 Flash with fallback heuristics",
          date: yesterday,
        },
      ],
    });

    // Task 5: OPS-15 (Approval Request)
    const task5 = await Task.create({
      key: "OPS-15",
      project: projOps._id,
      title: "Ergonomic monitor arms & dual 4K displays for Dev Team",
      description: "Requesting approval for 3x dual-monitor mounts and 4K displays for new engineering hires.",
      type: "approval",
      status: "in_progress",
      priority: "medium",
      assignee: adminUser._id,
      reporter: managerOps._id,
      dueDate: nextWeek,
      estimatedHours: 2,
      loggedHours: 1,
      subtasks: [
        { title: "Collect hardware requirements from engineering", completed: true },
        { title: "Review vendor quotes and warranty terms", completed: false },
        { title: "Final purchase sign-off by Alex Vance", completed: false },
      ],
    });

    // 5. Create Comments & Activity Logs
    await Comment.create({
      task: task1._id,
      author: managerEng._id,
      text: "@Rahul please ensure the column headers display the live card counter!",
      mentions: [employeeRahul._id],
    });

    await Comment.create({
      task: task1._id,
      author: employeeRahul._id,
      text: "@Sarah Connor Done! Added badge counts for To Do, In Progress, Review, and Done.",
      mentions: [managerEng._id],
    });

    await ActivityLog.create({
      task: task1._id,
      project: projEng._id,
      user: managerEng._id,
      action: "created",
      details: {
        field: "creation",
        message: "Sarah Connor created task ENG-101",
      },
    });

    await ActivityLog.create({
      task: task1._id,
      project: projEng._id,
      user: managerEng._id,
      action: "assigned",
      details: {
        field: "assignee",
        message: "Sarah Connor assigned this task to Rahul Sharma",
      },
    });

    await ActivityLog.create({
      task: task1._id,
      project: projEng._id,
      user: employeeRahul._id,
      action: "status_changed",
      details: {
        field: "status",
        oldValue: "todo",
        newValue: "in_progress",
        message: "Rahul Sharma moved status from To Do to In Progress",
      },
    });

    await ActivityLog.create({
      task: task1._id,
      project: projEng._id,
      user: employeeRahul._id,
      action: "logged_work",
      details: {
        field: "workLogs",
        newValue: 2.5,
        message: 'Rahul Sharma logged 2.5h work: "Drafted Kanban column layout and responsive cards"',
      },
    });

    // Create Notification
    await Notification.create({
      recipient: employeeRahul._id,
      sender: managerEng._id,
      task: task1._id,
      type: "assigned",
      message: 'Sarah Connor assigned you task ENG-101: "Implement drag-and-drop Kanban workspace"',
      isRead: false,
    });

    console.log("✅ Office workspace database seeded successfully!");
    console.log("----------------------------------------------------------------");
    console.log("🔑 DEMO ACCOUNTS:");
    console.log(`   👑 ADMIN:    admin@incuman.com   / ${process.env.DEFAULT_SUPERADMIN_PASSWORD || "password123"}`);
    console.log(`   👔 MANAGER:  sarah@incuman.com   / password123`);
    console.log(`   👨‍💻 EMPLOYEE: rahul@incuman.com   / password123`);
    console.log("----------------------------------------------------------------");
  } catch (error) {
    console.error("❌ Seed error:", error);
  }
};

module.exports = seedDatabase;
