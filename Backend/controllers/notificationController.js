const Notification = require("../models/notificationModel");
const User = require("../models/userModel");
const { getVapidPublicKey, isVapidConfigured } = require("../services/pushService");

exports.getVapidPublicKeyHandler = (req, res) => {
  res.status(200).json({
    success: true,
    vapidPublicKey: getVapidPublicKey(),
    isVapidConfigured,
  });
};

exports.getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user._id })
      .populate("sender", "fullname email avatar profilePicture")
      .populate("task", "key title status priority")
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      isRead: false,
    });

    res.status(200).json({ success: true, unreadCount, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    await Notification.findOneAndUpdate(
      { _id: id, recipient: req.user._id },
      { isRead: true }
    );
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { isRead: true }
    );
    res.status(200).json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.subscribePush = async (req, res) => {
  try {
    const { subscription } = req.body;
    if (!subscription) {
      return res.status(400).json({ success: false, message: "Subscription payload required" });
    }

    await User.findByIdAndUpdate(req.user._id, { pushSubscription: subscription });
    res.status(200).json({ success: true, message: "Web Push subscription registered successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
