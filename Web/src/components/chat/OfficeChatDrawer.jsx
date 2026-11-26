import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  MessageSquare,
  Send,
  X,
  Users,
  UploadCloud,
  Paperclip,
  FileText,
  Search,
  Hash,
  Download,
  FolderOpen,
  ArrowLeft,
  CheckCheck,
  Image as ImageIcon,
  ShieldCheck,
  Loader2,
  FolderKanban,
  Pin,
  PinOff,
} from "lucide-react";
import { useApp } from "../../context/Appcontext";
import {
  getChatConversations,
  getChatMessages,
  sendChatMessage,
  togglePinChatMessage,
  markChatRoomRead,
  uploadSingleChunk,
} from "../../services/api";
import MessageSenderPopover from "./MessageSenderPopover";
import {
  getSocket,
  joinChatRoom,
  leaveChatRoom,
  announcePeer,
  sendSocketChatMessage,
} from "../../services/socket";
import { encryptText, decryptText } from "../../services/crypto";
import ChunkUploader from "../files/ChunkUploader";
import UserAvatar from "../common/UserAvatar";
import {
  getDisplayName,
  getInitials,
  formatTimeIN,
  formatDateIN,
  formatFileSize,
  getDownloadUrl,
} from "../../utils/formatters";
import toast from "react-hot-toast";
import { getGlassTokens } from "../../styles/glassTheme";

const CHANNELS = [
  { id: "dept_general", name: "operations", label: "Operations & General", type: "department" },
  { id: "dept_engineering", name: "engineering", label: "Engineering & QA", type: "department" },
  { id: "dept_hr", name: "people-culture", label: "Human Resources", type: "department" },
  { id: "dept_finance", name: "finance", label: "Finance & Payroll", type: "department" },
];

const CHUNK_SIZE = 1024 * 1024; // 1MB

export default function OfficeChatDrawer({ isOpen, onClose }) {
  const {
    user,
    theme,
    projects,
    teamMembers,
    isSuperAdmin,
    hasPermission,
    chatTargetUser,
    setChatTargetUser,
    chatTargetRoom,
    setChatTargetRoom,
    refreshChatUnread,
  } = useApp();
  const isDark = theme === "dark";
  const g = getGlassTokens(isDark);
  const canSendChat = isSuperAdmin || hasPermission("chat.send");
  const canPinChat = isSuperAdmin || hasPermission("chat.pin") || hasPermission("chat.send");

  const [colleagues, setColleagues] = useState([]);
  const [channelUnread, setChannelUnread] = useState({});
  const [selectedRoom, setSelectedRoom] = useState(CHANNELS[0]);
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [rightTab, setRightTab] = useState("messages"); // 'messages' | 'uploader' | 'files'
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [typingUsers, setTypingUsers] = useState({});
  const [quickUploadProgress, setQuickUploadProgress] = useState(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [inspectedSender, setInspectedSender] = useState(null);
  const [showPinnedList, setShowPinnedList] = useState(false);

  const messagesEndRef = useRef(null);
  const quickFileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const pinnedMessages = useMemo(() => messages.filter((m) => m.isPinned), [messages]);

  const onlineUserIds = useMemo(() => {
    const ids = new Set();
    peers.forEach((p) => {
      if (p.userId) ids.add(p.userId.toString());
    });
    return ids;
  }, [peers]);

  const loadConversations = async () => {
    const res = await getChatConversations();
    if (res.success) {
      setColleagues(res.colleagues || []);
      setChannelUnread(res.channelUnread || {});
    }
  };

  useEffect(() => {
    const onOtherSidebar = (e) => {
      if (isOpen && e?.detail?.id && e.detail.id !== "chat") onClose?.();
    };
    const onCloseAll = (e) => {
      if (isOpen && e?.detail?.except !== "chat") onClose?.();
    };
    window.addEventListener("lira:sidebar-opened", onOtherSidebar);
    window.addEventListener("lira:close-all-sidebars", onCloseAll);
    return () => {
      window.removeEventListener("lira:sidebar-opened", onOtherSidebar);
      window.removeEventListener("lira:close-all-sidebars", onCloseAll);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    window.dispatchEvent(new CustomEvent("lira:sidebar-opened", { detail: { id: "chat" } }));
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  // Handle external direct-chat or room-chat trigger
  useEffect(() => {
    if (isOpen && chatTargetUser && user) {
      const targetId = chatTargetUser._id;
      const sortedIds = [user._id, targetId].sort();
      const directRoomId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
      setSelectedRoom({
        id: directRoomId,
        name: getDisplayName(chatTargetUser),
        label: chatTargetUser.jobTitle || chatTargetUser.departmentName || "Team Member",
        type: "direct",
        recipientId: targetId,
        colleague: chatTargetUser,
      });
      setRightTab("messages");
      setShowMobileSidebar(false);
      setChatTargetUser(null);
    }
  }, [isOpen, chatTargetUser, user, setChatTargetUser]);

  useEffect(() => {
    if (isOpen && chatTargetRoom) {
      setSelectedRoom(chatTargetRoom);
      setRightTab("messages");
      setShowMobileSidebar(false);
      setChatTargetRoom(null);
    }
  }, [isOpen, chatTargetRoom, setChatTargetRoom]);

  // 1. Fetch conversations & announce presence
  useEffect(() => {
    if (!isOpen || !user) return;

    loadConversations();

    const socket = getSocket();
    if (socket) {
      announcePeer({
        userId: user._id,
        name: getDisplayName(user),
        department: user.departmentName || "General",
        publicId: user.publicId,
      });

      const handlePeerList = (list) => setPeers(list || []);
      const handlePeerJoined = (peer) => {
        setPeers((prev) => [...prev.filter((p) => p.socketId !== peer.socketId), peer]);
      };
      const handlePeerLeft = ({ socketId }) => {
        setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
      };
      const handleNotification = () => {
        loadConversations();
      };

      socket.on("peer:list", handlePeerList);
      socket.on("peer:joined", handlePeerJoined);
      socket.on("peer:left", handlePeerLeft);
      socket.on("chat:notification", handleNotification);

      return () => {
        socket.off("peer:list", handlePeerList);
        socket.off("peer:joined", handlePeerJoined);
        socket.off("peer:left", handlePeerLeft);
        socket.off("chat:notification", handleNotification);
      };
    }
  }, [isOpen, user]);

  // 2. Room switching & real-time message subscription
  useEffect(() => {
    if (!selectedRoom || !isOpen) return;

    const roomId = selectedRoom.id;
    joinChatRoom(roomId);
    setTypingUsers({});

    let isMounted = true;
    const loadMessages = async () => {
      setLoading(true);
      const res = await getChatMessages(roomId, 100);
      if (res.success && isMounted) {
        const decryptedList = await Promise.all(
          res.messages.map(async (msg) => {
            const text = await decryptText(msg.encryptedPayload, msg.iv, msg.salt);
            return { ...msg, decryptedText: text };
          })
        );
        setMessages(decryptedList);
        await markChatRoomRead(roomId);
        refreshChatUnread?.();
        // Clear unread count locally
        if (selectedRoom.type === "direct") {
          setColleagues((prev) =>
            prev.map((c) => (c._id === selectedRoom.recipientId ? { ...c, unreadCount: 0 } : c))
          );
        } else {
          setChannelUnread((prev) => ({ ...prev, [roomId]: 0 }));
        }
      }
      if (isMounted) setLoading(false);
    };

    loadMessages();

    const socket = getSocket();
    const handleIncomingMessage = async (newMsg) => {
      if (newMsg.roomId === roomId) {
        const text = await decryptText(newMsg.encryptedPayload, newMsg.iv, newMsg.salt);
        setMessages((prev) => {
          if (newMsg._id && prev.some((m) => m._id === newMsg._id)) return prev;
          return [...prev, { ...newMsg, decryptedText: text }];
        });
        markChatRoomRead(roomId).then(() => refreshChatUnread?.());
      } else {
        loadConversations();
      }
    };

    const handleTyping = ({ userId, userName, isTyping }) => {
      if (!userId || userId === user?._id) return;
      setTypingUsers((prev) => {
        const next = { ...prev };
        if (isTyping) next[userId] = userName || "Colleague";
        else delete next[userId];
        return next;
      });
    };

    const handlePinnedMessage = (payload) => {
      const targetId = payload?.messageId || payload?._id;
      const nextPinned = payload?.isPinned ?? payload?.message?.isPinned;
      const msgObj = payload?.message || payload;
      if (payload?.roomId === roomId && targetId) {
        setMessages((prev) =>
          prev.map((m) =>
            String(m._id) === String(targetId)
              ? {
                  ...m,
                  isPinned: nextPinned,
                  pinnedBy: msgObj?.pinnedBy || null,
                  pinnedAt: msgObj?.pinnedAt || null,
                }
              : m
          )
        );
      }
    };

    if (socket) {
      socket.on("chat:message", handleIncomingMessage);
      socket.on("chat:typing", handleTyping);
      socket.on("chat:pinned", handlePinnedMessage);
    }

    return () => {
      isMounted = false;
      leaveChatRoom(roomId);
      if (socket) {
        socket.off("chat:message", handleIncomingMessage);
        socket.off("chat:typing", handleTyping);
        socket.off("chat:pinned", handlePinnedMessage);
      }
    };
  }, [selectedRoom, isOpen, user?._id]);

  const handleTogglePin = async (messageId) => {
    if (!messageId) return;
    const res = await togglePinChatMessage(messageId);
    if (res.success) {
      setMessages((prev) =>
        prev.map((m) =>
          m._id === messageId
            ? {
                ...m,
                isPinned: res.isPinned,
                pinnedBy: res.message?.pinnedBy || null,
                pinnedAt: res.message?.pinnedAt || null,
              }
            : m
        )
      );
      toast.success(res.isPinned ? "Message pinned" : "Message unpinned");
    }
  };

  // Auto-scroll on new message
  useEffect(() => {
    if (rightTab === "messages") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, rightTab]);

  const emitTyping = (isTyping) => {
    const socket = getSocket();
    if (socket && selectedRoom && user) {
      socket.emit("chat:typing", {
        roomId: selectedRoom.id,
        userId: user._id,
        userName: getDisplayName(user),
        isTyping,
      });
    }
  };

  const handleInputChange = (e) => {
    setInputText(e.target.value);
    emitTyping(true);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => emitTyping(false), 1800);
  };

  const deliverMessage = async (plainText, attachments = []) => {
    if (!selectedRoom) return false;
    const encrypted = await encryptText(plainText);

    const payload = {
      chatType: selectedRoom.type,
      roomId: selectedRoom.id,
      senderId: user?._id,
      recipientId: selectedRoom.recipientId || undefined,
      encryptedPayload: encrypted.ciphertext,
      iv: encrypted.iv,
      salt: encrypted.salt,
      keyId: "lira-aes-gcm-256",
      attachments,
    };

    try {
      const wsRes = await sendSocketChatMessage(payload);
      if (wsRes?.success && wsRes?.message) {
        const msgWithText = { ...wsRes.message, decryptedText: plainText };
        setMessages((prev) => {
          if (prev.some((m) => m._id === msgWithText._id)) return prev;
          return [...prev, msgWithText];
        });
        return true;
      }
    } catch {
      // Fallback to REST endpoint if WebSocket is momentarily disconnected
    }

    const res = await sendChatMessage(payload);
    if (res.success && res.message) {
      const msgWithText = { ...res.message, decryptedText: plainText };
      setMessages((prev) => {
        if (prev.some((m) => m._id === msgWithText._id)) return prev;
        return [...prev, msgWithText];
      });
      return true;
    }
    return false;
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !selectedRoom || sending) return;

    const textToSend = inputText.trim();
    setInputText("");
    emitTyping(false);
    setSending(true);

    const ok = await deliverMessage(textToSend);
    setSending(false);

    if (!ok) {
      setInputText(textToSend);
      toast.error("Failed to deliver message");
    }
  };

  // Direct quick file upload & share inside active chat
  const handleQuickFileUpload = async (file) => {
    if (!file || !selectedRoom) return;
    const uploadId = `up_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));

    setQuickUploadProgress({ name: file.name, percent: 0 });

    try {
      let completedData = null;
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);

        const formData = new FormData();
        formData.append("chunk", chunkBlob, `part_${i}`);
        formData.append("uploadId", uploadId);
        formData.append("chunkIndex", i);
        formData.append("totalChunks", totalChunks);
        formData.append("fileName", file.name);
        formData.append("fileSize", file.size);
        formData.append("mimeType", file.type || "application/octet-stream");
        formData.append("speedLimitKbps", 0);

        const response = await uploadSingleChunk(formData);
        setQuickUploadProgress({
          name: file.name,
          percent: Math.round(((i + 1) / totalChunks) * 100),
        });

        if (response.data?.completed) {
          completedData = response.data;
        }
      }

      if (completedData) {
        const attachment = {
          filename: completedData.fileName,
          originalName: completedData.originalName || file.name,
          url: completedData.fileUrl,
          size: completedData.size || file.size,
          mimetype: file.type || completedData.mimetype || "application/octet-stream",
        };
        const ok = await deliverMessage(`Shared file: ${attachment.originalName}`, [attachment]);
        if (ok) {
          toast.success(`Shared ${attachment.originalName}`);
          setRightTab("messages");
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to share file");
    } finally {
      setQuickUploadProgress(null);
    }
  };

  const handleChunkUploaderComplete = async (fileData) => {
    toast.success(`Uploaded: ${fileData.originalName}`);
    if (selectedRoom) {
      const attachment = {
        filename: fileData.fileName,
        originalName: fileData.originalName,
        url: fileData.fileUrl,
        size: fileData.size || 0,
        mimetype: fileData.mimetype || "application/octet-stream",
      };
      await deliverMessage(`Shared file: ${attachment.originalName}`, [attachment]);
      setRightTab("messages");
    }
  };

  const selectDirectColleague = (colleague) => {
    const sortedIds = [user._id, colleague._id].sort();
    const directRoomId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
    const displayName = getDisplayName(colleague);
    setSelectedRoom({
      id: directRoomId,
      name: displayName,
      label: colleague.jobTitle || colleague.departmentName || "Team Member",
      type: "direct",
      recipientId: colleague._id,
      colleague,
    });
    setRightTab("messages");
    setShowMobileSidebar(false);
  };

  const selectChannel = (chan) => {
    setSelectedRoom(chan);
    setRightTab("messages");
    setShowMobileSidebar(false);
  };

  // All files shared in current conversation
  const sharedFilesInRoom = useMemo(() => {
    const list = [];
    messages.forEach((msg) => {
      if (Array.isArray(msg.attachments) && msg.attachments.length > 0) {
        msg.attachments.forEach((att) => {
          list.push({
            ...att,
            senderName: getDisplayName(msg.sender),
            createdAt: msg.createdAt,
          });
        });
      } else if (msg.decryptedText?.startsWith("[Shared File]")) {
        const raw = msg.decryptedText.replace("[Shared File] ", "");
        const colonIdx = raw.indexOf(": http");
        const name = colonIdx > -1 ? raw.slice(0, colonIdx) : raw;
        const url = colonIdx > -1 ? raw.slice(colonIdx + 2) : "";
        if (url) {
          list.push({
            originalName: name,
            url,
            size: 0,
            senderName: getDisplayName(msg.sender),
            createdAt: msg.createdAt,
          });
        }
      }
    });
    return list.reverse();
  }, [messages]);

  const filteredColleagues = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return colleagues;
    return colleagues.filter(
      (c) =>
        getDisplayName(c).toLowerCase().includes(q) ||
        c.publicId?.toLowerCase().includes(q) ||
        c.departmentName?.toLowerCase().includes(q) ||
        c.jobTitle?.toLowerCase().includes(q)
    );
  }, [colleagues, searchFilter]);

  if (!isOpen) return null;

  const isDirect = selectedRoom?.type === "direct";
  const isRecipientOnline = isDirect && onlineUserIds.has(selectedRoom?.recipientId?.toString());
  const typingNames = Object.values(typingUsers);

  const renderAttachmentCard = (att, isMe) => {
    const downloadHref = getDownloadUrl(att.url);
    const isImage =
      att.mimetype?.startsWith("image/") ||
      /\.(png|jpe?g|gif|webp|svg)$/i.test(att.originalName || "");

    return (
      <div
        key={att._id || att.url || att.originalName}
        className={`mt-1.5 p-2.5 rounded-xl border flex flex-col gap-2 max-w-[270px] ${
          isMe
            ? "bg-white/15 border-white/25 text-white"
            : isDark
            ? "bg-[#12131c] border-white/10 text-slate-200"
            : "bg-slate-50 border-slate-200 text-slate-800"
        }`}
      >
        {isImage && att.url && (
          <a href={downloadHref} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg">
            <img
              src={downloadHref}
              alt={att.originalName}
              className="max-h-40 w-full object-cover rounded-lg border border-black/10"
            />
          </a>
        )}
        <div className="flex items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                isMe
                  ? "bg-white/20 text-white"
                  : isDark
                  ? "bg-indigo-500/20 text-indigo-300"
                  : "bg-indigo-100 text-indigo-600"
              }`}
            >
              {isImage ? <ImageIcon className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold truncate">{att.originalName}</p>
              {att.size > 0 && (
                <p className={`text-[10px] font-mono ${isMe ? "text-white/75" : "text-slate-400"}`}>
                  {formatFileSize(att.size)}
                </p>
              )}
            </div>
          </div>

          <a
            href={downloadHref}
            download={att.originalName}
            target="_blank"
            rel="noreferrer"
            className={`p-1.5 rounded-lg transition-colors shrink-0 ${
              isMe
                ? "bg-white/20 hover:bg-white/30 text-white"
                : isDark
                ? "bg-white/10 hover:bg-white/20 text-indigo-300"
                : "bg-indigo-50 hover:bg-indigo-100 text-indigo-700"
            }`}
            title="Download file"
          >
            <Download className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-[70] flex justify-end">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      />

      {/* Split-Pane Chat Drawer */}
      <div
        className={`relative z-10 w-full sm:w-[700px] lg:w-[820px] h-full border-l lira-glass-drawer flex overflow-hidden animate-in slide-in-from-right duration-200 ${
          isDark ? "text-slate-100" : "text-slate-900"
        }`}
      >
        {/* LEFT SIDEBAR: CHANNELS & DIRECT MESSAGES */}
        <aside
          className={`${
            showMobileSidebar ? "flex absolute inset-y-0 left-0 z-30 w-64" : "hidden sm:flex sm:w-64"
          } flex-col border-r shrink-0 ${g.subHeader}`}
        >
          {/* Sidebar Header */}
          <div className={`px-4 py-3.5 border-b flex items-center justify-between ${g.border}`}>
            <div className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-xl border flex items-center justify-center ${g.badge}`}>
                <MessageSquare className="w-4 h-4" />
              </div>
              <div>
                <h2 className={`text-xs font-extrabold tracking-tight ${g.heading}`}>
                  Lira Office Chat
                </h2>
                <span className="text-[10px] text-emerald-500 font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {onlineUserIds.size} online now
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowMobileSidebar(false)}
              className={`sm:hidden p-1 rounded-lg ${g.muted}`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Input */}
          <div className="p-3">
            <div className="relative">
              <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 ${g.muted}`} />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search people or ID..."
                className={`w-full rounded-xl pl-8 pr-3 py-1.5 text-xs border focus:outline-none ${g.input}`}
              />
            </div>
          </div>

          {/* Scrollable Channels & DMs */}
          <div className="flex-1 overflow-y-auto px-2.5 pb-4 space-y-5">
            {/* Department Channels */}
            <div className="space-y-1">
              <span className={`px-2 text-[10px] font-bold uppercase tracking-wider block ${g.muted}`}>
                Department Channels
              </span>
              {CHANNELS.map((chan) => {
                const isSelected = selectedRoom?.id === chan.id && rightTab === "messages";
                const unread = channelUnread[chan.id] || 0;
                return (
                  <button
                    key={chan.id}
                    onClick={() => selectChannel(chan)}
                    className={`w-full px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer border ${
                      isSelected
                        ? g.selectedRow
                        : `border-transparent ${g.rowHover} ${isDark ? "text-zinc-300" : "text-slate-700"}`
                    }`}
                  >
                    <span className="flex items-center gap-2 truncate">
                      <Hash className="w-3.5 h-3.5 opacity-75 shrink-0" />
                      <span className="truncate">{chan.name}</span>
                    </span>
                    {unread > 0 && !isSelected && (
                      <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold">
                        {unread}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Project Channels */}
            {projects?.length > 0 && (
              <div className="space-y-1">
                <span className={`px-2 text-[10px] font-bold uppercase tracking-wider block ${g.muted}`}>
                  Project Rooms ({projects.length})
                </span>
                {projects.map((proj) => {
                  const projRoomId = `proj_${proj._id}`;
                  const isSelected = selectedRoom?.id === projRoomId && rightTab === "messages";
                  return (
                    <button
                      key={proj._id}
                      onClick={() =>
                        selectChannel({
                          id: projRoomId,
                          name: proj.prefix,
                          label: proj.name,
                          type: "department",
                        })
                      }
                      className={`w-full px-2.5 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer border ${
                        isSelected
                          ? g.selectedRow
                          : `border-transparent ${g.rowHover} ${isDark ? "text-zinc-300" : "text-slate-700"}`
                      }`}
                    >
                      <span className="flex items-center gap-2 truncate">
                        <FolderKanban className="w-3.5 h-3.5 opacity-75 shrink-0" />
                        <span className="truncate">
                          {proj.prefix} · {proj.name}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Direct Messages */}
            <div className="space-y-1">
              <div className="px-2 flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${g.muted}`}>
                  Direct Messages ({filteredColleagues.length})
                </span>
              </div>

              {filteredColleagues.map((colleague) => {
                const displayName = getDisplayName(colleague);
                const sortedIds = [user?._id, colleague._id].sort();
                const dmRoomId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
                const isSelected = selectedRoom?.id === dmRoomId;
                const isOnline = onlineUserIds.has(colleague._id?.toString());

                return (
                  <button
                    key={colleague._id}
                    onClick={() => selectDirectColleague(colleague)}
                    className={`w-full p-2 rounded-xl flex items-center justify-between gap-2 text-left transition-all cursor-pointer border ${
                      isSelected
                        ? g.selectedRow
                        : `border-transparent ${g.rowHover} ${isDark ? "text-zinc-200" : "text-slate-800"}`
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="relative shrink-0">
                        <UserAvatar
                          user={colleague}
                          className="w-8 h-8 rounded-xl border border-white/10"
                          textClass="text-xs"
                        />
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${
                            isDark ? "border-[#14161d]" : "border-white"
                          } ${isOnline ? "bg-emerald-500" : "bg-zinc-500"}`}
                        />
                      </div>

                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{displayName}</p>
                        <p className={`text-[10px] truncate ${g.muted}`}>
                          {colleague.jobTitle || colleague.departmentName || "Staff"}
                        </p>
                      </div>
                    </div>

                    {colleague.unreadCount > 0 && !isSelected && (
                      <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${g.pillActive}`}>
                        {colleague.unreadCount}
                      </span>
                    )}
                  </button>
                );
              })}

              {filteredColleagues.length === 0 && (
                <p className="px-2 py-4 text-[11px] text-slate-500 italic text-center">
                  No colleagues match "{searchFilter}"
                </p>
              )}
            </div>
          </div>
        </aside>

        {/* RIGHT MAIN CONVERSATION PANEL */}
        <div
          className="flex-1 flex flex-col min-w-0 relative"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragLeave={() => setIsDraggingFile(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDraggingFile(false);
            const droppedFile = e.dataTransfer.files?.[0];
            if (droppedFile) handleQuickFileUpload(droppedFile);
          }}
        >
          {/* Drag-and-drop overlay */}
          {isDraggingFile && (
            <div className="absolute inset-0 z-40 bg-zinc-900/60 backdrop-blur-xs border-2 border-dashed border-white/40 flex flex-col items-center justify-center pointer-events-none">
              <UploadCloud className="w-12 h-12 text-zinc-200 mb-2 animate-bounce" />
              <p className="text-sm font-bold text-white">Drop file to encrypt & share in chat</p>
            </div>
          )}

          {/* Chat Header */}
          <div className={`px-4 py-3 border-b flex items-center justify-between gap-3 shrink-0 ${g.subHeader}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                onClick={() => setShowMobileSidebar(true)}
                className={`sm:hidden p-1.5 rounded-lg border ${g.iconBtn}`}
                title="Channels & DMs"
              >
                <Users className="w-4 h-4" />
              </button>

              {isDirect ? (
                <div className="relative shrink-0">
                  <UserAvatar
                    user={selectedRoom?.colleague}
                    name={selectedRoom?.name}
                    className="w-9 h-9 rounded-xl border border-white/10"
                    textClass="text-xs"
                  />
                  <span
                    className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 ${
                      isDark ? "border-[#14161d]" : "border-white"
                    } ${isRecipientOnline ? "bg-emerald-500" : "bg-zinc-500"}`}
                  />
                </div>
              ) : (
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border ${g.badge}`}>
                  <Hash className="w-4 h-4" />
                </div>
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className={`text-sm font-bold truncate ${g.heading}`}>
                    {isDirect ? selectedRoom?.name : `#${selectedRoom?.name}`}
                  </h3>
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                    <ShieldCheck className="w-2.5 h-2.5" />
                    Private
                  </span>
                </div>
                <p className={`text-[11px] truncate ${g.muted}`}>
                  {isDirect
                    ? `${selectedRoom?.colleague?.departmentName || "Team"} • ${
                        selectedRoom?.colleague?.publicId || "Verified Staff"
                      } • ${isRecipientOnline ? "Online" : "Offline"}`
                    : selectedRoom?.label}
                </p>
              </div>
            </div>

            {/* Right Header Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                onClick={() => setRightTab(rightTab === "files" ? "messages" : "files")}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  rightTab === "files" ? g.pillActive : g.btnSecondary
                }`}
                title="Shared files in this conversation"
              >
                <FolderOpen className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Files ({sharedFilesInRoom.length})</span>
              </button>

              <button
                onClick={() => setRightTab(rightTab === "uploader" ? "messages" : "uploader")}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                  rightTab === "uploader" ? g.pillActive : g.btnSecondary
                }`}
                title="Resumable Large File Transfer"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Transfer</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${g.iconBtn}`}
                title="Close chat"
                aria-label="Close Office Chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* VIEW 1: MESSAGES FEED */}
          {rightTab === "messages" && (
            <>
              {pinnedMessages.length > 0 && (
                <div className={`px-4 py-2 border-b text-xs shrink-0 ${g.subtleSurface}`}>
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPinnedList((v) => !v)}
                      className="flex items-center gap-1.5 font-semibold text-amber-400 hover:underline cursor-pointer truncate"
                    >
                      <Pin className="w-3.5 h-3.5 shrink-0" />
                      <span>{pinnedMessages.length} Pinned</span>
                      <span className={`font-normal truncate ${g.muted}`}>
                        — {pinnedMessages[pinnedMessages.length - 1]?.decryptedText}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowPinnedList((v) => !v)}
                      className={`px-2 py-0.5 rounded-lg border text-[10px] font-semibold cursor-pointer ${g.btnSecondary}`}
                    >
                      {showPinnedList ? "Hide" : "Show all"}
                    </button>
                  </div>
                  {showPinnedList && (
                    <div className={`mt-2 pt-2 border-t space-y-1.5 max-h-32 overflow-y-auto ${g.border}`}>
                      {pinnedMessages.map((pm) => (
                        <div key={pm._id} className="flex items-center justify-between gap-2 text-[11px]">
                          <button
                            type="button"
                            onClick={() => {
                              document.getElementById(`msg-${pm._id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                            }}
                            className="truncate text-left hover:underline cursor-pointer"
                          >
                            <strong className="mr-1">{getDisplayName(pm.sender)}:</strong>
                            {pm.decryptedText}
                          </button>
                          {canPinChat && (
                            <button
                              type="button"
                              onClick={() => handleTogglePin(pm._id)}
                              className="text-rose-400 hover:underline shrink-0 text-[10px] cursor-pointer"
                            >
                              Unpin
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex-1 p-4 overflow-y-auto space-y-3.5">
                {loading && (
                  <div className={`flex items-center justify-center py-12 gap-2 text-xs ${g.muted}`}>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Loading messages...</span>
                  </div>
                )}

                {!loading && messages.length === 0 && (
                  <div className="py-16 text-center space-y-3">
                    <div className={`w-14 h-14 mx-auto rounded-2xl border flex items-center justify-center ${g.badge}`}>
                      {isDirect ? <Users className="w-6 h-6" /> : <Hash className="w-6 h-6" />}
                    </div>
                    <div>
                      <h4 className={`text-sm font-bold ${g.heading}`}>
                        {isDirect ? `Direct Chat with ${selectedRoom?.name}` : `Welcome to #${selectedRoom?.name}`}
                      </h4>
                      <p className={`text-xs max-w-xs mx-auto mt-1 ${g.muted}`}>
                        Send a message or drag & drop files here to share with your team.
                      </p>
                    </div>
                  </div>
                )}

                {messages.map((msg, index) => {
                  const senderId = msg.sender?._id || msg.sender;
                  const isMe = senderId === user?._id;
                  const senderName = isMe ? getDisplayName(user) : getDisplayName(msg.sender);
                  const hasAttachments = Array.isArray(msg.attachments) && msg.attachments.length > 0;
                  const isLegacyFile = msg.decryptedText?.startsWith("[Shared File]");

                  let legacyAttachment = null;
                  if (!hasAttachments && isLegacyFile) {
                    const raw = msg.decryptedText.replace("[Shared File] ", "");
                    const colonIdx = raw.indexOf(": http");
                    if (colonIdx > -1) {
                      legacyAttachment = {
                        originalName: raw.slice(0, colonIdx),
                        url: raw.slice(colonIdx + 2),
                        size: 0,
                      };
                    }
                  }

                  const prevMsg = index > 0 ? messages[index - 1] : null;
                  const msgDateStr = formatDateIN(msg.createdAt || Date.now());
                  const prevDateStr = prevMsg ? formatDateIN(prevMsg.createdAt) : null;
                  const showDateDivider = msgDateStr !== prevDateStr;

                  return (
                    <React.Fragment key={msg._id || index}>
                      {showDateDivider && (
                        <div className="flex items-center gap-3 my-2">
                          <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                          <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            {msgDateStr}
                          </span>
                          <div className={`flex-1 h-px ${isDark ? "bg-white/10" : "bg-slate-200"}`} />
                        </div>
                      )}

                      <div id={msg._id ? `msg-${msg._id}` : undefined} className={`group flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"}`}>
                        {!isMe && (
                          <button
                            type="button"
                            onClick={() => setInspectedSender(msg.sender)}
                            className="shrink-0 mb-1 cursor-pointer hover:opacity-85"
                            title="View sender profile"
                          >
                            <UserAvatar
                              user={msg.sender}
                              name={senderName}
                              className="w-7 h-7 rounded-xl border border-white/10"
                              textClass="text-[10px]"
                            />
                          </button>
                        )}

                        <div className={`flex flex-col max-w-[78%] ${isMe ? "items-end" : "items-start"}`}>
                          <div className="flex items-center gap-1.5 mb-1 px-1">
                            <button
                              type="button"
                              onClick={() => setInspectedSender(msg.sender)}
                              className={`text-[10px] font-bold hover:underline cursor-pointer ${isDark ? "text-slate-300" : "text-slate-700"}`}
                            >
                              {isMe ? "You" : senderName}
                            </button>
                            {msg.sender?.publicId && !isMe && (
                              <span className={`text-[9px] font-mono px-1.5 py-0.2 rounded border ${g.badge}`}>
                                {msg.sender.publicId}
                              </span>
                            )}
                            <span className={`text-[9px] font-mono ${g.muted}`}>
                              {formatTimeIN(msg.createdAt || Date.now())}
                            </span>
                            {msg.isPinned && <Pin className="w-2.5 h-2.5 text-amber-400 shrink-0" title="Pinned" />}
                            {isMe && <CheckCheck className={`w-3 h-3 ${g.accentIcon}`} />}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <div
                              className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed ${
                                msg.isPinned ? "ring-1 ring-amber-400/50 " : ""
                              }${
                                isMe
                                  ? isDark
                                    ? "bg-zinc-200 text-zinc-950 font-medium rounded-br-xs"
                                    : "bg-zinc-900 text-white rounded-br-xs"
                                  : `${g.subtleSurface} ${g.heading} border rounded-bl-xs`
                              }`}
                            >
                              {(!hasAttachments || !msg.decryptedText?.startsWith("Shared file:")) &&
                                !legacyAttachment && (
                                  <p className="whitespace-pre-wrap break-words">{msg.decryptedText}</p>
                                )}

                              {hasAttachments &&
                                msg.attachments.map((att) => renderAttachmentCard(att, isMe))}

                              {legacyAttachment && renderAttachmentCard(legacyAttachment, isMe)}
                            </div>

                            {canPinChat && msg._id && (
                              <button
                                type="button"
                                onClick={() => handleTogglePin(msg._id)}
                                className={`p-1 rounded-lg transition-opacity cursor-pointer ${
                                  msg.isPinned
                                    ? "opacity-100 text-amber-400"
                                    : "opacity-0 group-hover:opacity-100 text-slate-400 hover:bg-white/10"
                                }`}
                                title={msg.isPinned ? "Unpin message" : "Pin message"}
                              >
                                {msg.isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}

                {typingNames.length > 0 && (
                  <div className={`text-[11px] italic px-2 animate-pulse ${g.muted}`}>
                    {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing...
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Quick Upload Progress Banner */}
              {quickUploadProgress && (
                <div
                  className={`mx-4 mb-2 px-3 py-2 rounded-xl border text-xs flex items-center justify-between gap-3 ${g.subtleSurface} ${g.heading}`}
                >
                  <span className="truncate font-medium">Uploading {quickUploadProgress.name}...</span>
                  <span className="font-mono font-bold">{quickUploadProgress.percent}%</span>
                </div>
              )}

              {/* Message Composer Bar */}
              {canSendChat ? (
                <form
                  onSubmit={handleSendMessage}
                  className={`p-3 border-t flex items-center gap-2 shrink-0 ${g.subHeader}`}
                >
                  <input
                    ref={quickFileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleQuickFileUpload(file);
                      e.target.value = "";
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => quickFileInputRef.current?.click()}
                    className={`p-2 rounded-xl transition-colors cursor-pointer ${g.iconBtn}`}
                    title="Attach & share file immediately"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  <input
                    type="text"
                    value={inputText}
                    onChange={handleInputChange}
                    placeholder={`Message ${isDirect ? selectedRoom?.name : `#${selectedRoom?.name}`}...`}
                    className={`flex-1 rounded-xl px-3.5 py-2 text-xs border focus:outline-none transition-colors font-medium ${g.input}`}
                  />

                  <button
                    type="submit"
                    disabled={!inputText.trim() || sending}
                    className={`px-3.5 py-2 rounded-xl disabled:opacity-30 text-xs transition-all flex items-center gap-1.5 cursor-pointer ${g.btnPrimary}`}
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </form>
              ) : (
                <div className={`p-3 border-t text-center text-xs ${g.subHeader} ${g.muted}`}>
                  Read-only chat view (sending disabled for your role)
                </div>
              )}
            </>
          )}

          {/* VIEW 2: SHARED FILES GALLERY FOR THIS ROOM */}
          {rightTab === "files" && (
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={`text-sm font-bold ${g.heading}`}>
                    Shared Files in {isDirect ? selectedRoom?.name : `#${selectedRoom?.name}`}
                  </h4>
                  <p className={`text-xs ${g.muted}`}>
                    {sharedFilesInRoom.length} files shared in this conversation
                  </p>
                </div>
                <button
                  onClick={() => setRightTab("messages")}
                  className={`text-xs font-semibold hover:underline flex items-center gap-1 cursor-pointer ${g.heading}`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to Chat
                </button>
              </div>

              {sharedFilesInRoom.length === 0 ? (
                <div
                  className={`p-10 rounded-2xl border-2 border-dashed text-center space-y-2 ${g.border} ${g.muted}`}
                >
                  <FolderOpen className="w-8 h-8 mx-auto opacity-60" />
                  <p className="text-xs font-semibold">No files shared here yet</p>
                  <button
                    onClick={() => setRightTab("uploader")}
                    className={`mt-2 px-3.5 py-1.5 rounded-xl text-xs cursor-pointer ${g.btnPrimary}`}
                  >
                    Upload & Share a File
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sharedFilesInRoom.map((file, i) => (
                    <div
                      key={i}
                      className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 ${g.subtleSurface}`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${g.badge}`}>
                          <FileText className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-xs font-bold truncate ${g.heading}`}>
                            {file.originalName}
                          </p>
                          <p className={`text-[10px] truncate ${g.muted}`}>
                            {file.senderName} • {formatDateIN(file.createdAt)}
                            {file.size > 0 ? ` • ${formatFileSize(file.size)}` : ""}
                          </p>
                        </div>
                      </div>
                      <a
                        href={getDownloadUrl(file.url)}
                        download={file.originalName}
                        target="_blank"
                        rel="noreferrer"
                        className={`p-2 rounded-xl shrink-0 transition-colors ${g.btnPrimary}`}
                        title="Download"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* VIEW 3: RESUMABLE CHUNK UPLOADER HUB */}
          {rightTab === "uploader" && (
            <div className="flex-1 p-5 overflow-y-auto space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={`text-sm font-bold flex items-center gap-1.5 ${g.heading}`}>
                    <UploadCloud className="w-4 h-4" />
                    <span>File Sharing Hub</span>
                  </h4>
                  <p className={`text-xs ${g.muted}`}>
                    Upload and share files directly in {isDirect ? selectedRoom?.name : `#${selectedRoom?.name}`}
                  </p>
                </div>
                <button
                  onClick={() => setRightTab("messages")}
                  className={`text-xs hover:underline font-semibold flex items-center gap-1 cursor-pointer ${g.heading}`}
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Back to chat
                </button>
              </div>

              <ChunkUploader onUploadComplete={handleChunkUploaderComplete} />
            </div>
          )}
        </div>
      </div>

      {inspectedSender && (
        <MessageSenderPopover
          sender={inspectedSender}
          currentUserId={user?._id}
          teamMembers={teamMembers}
          isDark={isDark}
          onClose={() => setInspectedSender(null)}
          onStartDM={selectDirectColleague}
        />
      )}
    </div>
  );
}
