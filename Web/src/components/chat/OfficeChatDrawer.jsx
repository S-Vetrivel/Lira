import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Lock,
  Send,
  X,
  Users,
  Wifi,
  UploadCloud,
  Paperclip,
  Share2,
  FileText,
  Search,
  ExternalLink,
  Shield,
  Hash,
  ChevronDown,
} from "lucide-react";
import { useApp } from "../../context/Appcontext";
import {
  getChatConversations,
  getChatMessages,
  sendChatMessage,
  markChatRoomRead,
} from "../../services/api";
import {
  getSocket,
  joinChatRoom,
  leaveChatRoom,
  announcePeer,
} from "../../services/socket";
import { encryptText, decryptText } from "../../services/crypto";
import ChunkUploader from "../files/ChunkUploader";
import toast from "react-hot-toast";

export default function OfficeChatDrawer({ isOpen, onClose }) {
  const { user } = useApp();
  const [viewMode, setViewMode] = useState("chat"); // 'chat', 'directory', 'uploader'
  const [conversations, setConversations] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null); // { id, name, type, recipientId, colleague }
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const messagesEndRef = useRef(null);

  // Default departmental channels
  const channels = [
    { id: "dept_general", name: "operations", label: "Operations & General", type: "department" },
    { id: "dept_engineering", name: "engineering", label: "Engineering & QA", type: "department" },
    { id: "dept_hr", name: "people-culture", label: "Human Resources", type: "department" },
    { id: "dept_finance", name: "finance", label: "Finance & Payroll", type: "department" },
  ];

  // 1. Fetch conversations & announce presence
  useEffect(() => {
    if (!isOpen || !user) return;

    const loadData = async () => {
      const res = await getChatConversations();
      if (res.success && res.colleagues) {
        setConversations(res.colleagues);
      }
    };
    loadData();

    if (!selectedRoom) {
      setSelectedRoom(channels[0]);
    }

    const socket = getSocket();
    if (socket) {
      announcePeer({
        userId: user._id,
        name: user.fullname || user.name,
        department: user.departmentName || "General",
        publicId: user.publicId,
      });

      const handlePeerList = (list) => setPeers(list);
      const handlePeerJoined = (peer) => {
        setPeers((prev) => [...prev.filter((p) => p.socketId !== peer.socketId), peer]);
      };
      const handlePeerLeft = ({ socketId }) => {
        setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
      };

      socket.on("peer:list", handlePeerList);
      socket.on("peer:joined", handlePeerJoined);
      socket.on("peer:left", handlePeerLeft);

      return () => {
        socket.off("peer:list", handlePeerList);
        socket.off("peer:joined", handlePeerJoined);
        socket.off("peer:left", handlePeerLeft);
      };
    }
  }, [isOpen, user]);

  // 2. Room switching & real-time message subscription
  useEffect(() => {
    if (!selectedRoom || !isOpen) return;

    const roomId = selectedRoom.id;
    joinChatRoom(roomId);

    let isMounted = true;
    const loadMessages = async () => {
      setLoading(true);
      const res = await getChatMessages(roomId);
      if (res.success && isMounted) {
        const decryptedList = await Promise.all(
          res.messages.map(async (msg) => {
            const text = await decryptText(msg.encryptedPayload, msg.iv, msg.salt);
            return { ...msg, decryptedText: text };
          })
        );
        setMessages(decryptedList);
        markChatRoomRead(roomId);
      }
      setLoading(false);
    };

    loadMessages();

    const socket = getSocket();
    const handleIncomingMessage = async (newMsg) => {
      if (newMsg.roomId === roomId) {
        const text = await decryptText(newMsg.encryptedPayload, newMsg.iv, newMsg.salt);
        setMessages((prev) => [...prev, { ...newMsg, decryptedText: text }]);
        markChatRoomRead(roomId);
      }
    };

    if (socket) {
      socket.on("chat:message", handleIncomingMessage);
    }

    return () => {
      isMounted = false;
      leaveChatRoom(roomId);
      if (socket) {
        socket.off("chat:message", handleIncomingMessage);
      }
    };
  }, [selectedRoom, isOpen]);

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputText.trim() || !selectedRoom) return;

    const textToSend = inputText.trim();
    setInputText("");

    const encrypted = await encryptText(textToSend);

    const payload = {
      chatType: selectedRoom.type,
      roomId: selectedRoom.id,
      recipientId: selectedRoom.recipientId || undefined,
      encryptedPayload: encrypted.ciphertext,
      iv: encrypted.iv,
      salt: encrypted.salt,
      keyId: "lira-aes-gcm-256",
    };

    const res = await sendChatMessage(payload);
    if (!res.success) {
      toast.error("Failed to deliver message");
    }
  };

  const selectDirectColleague = (colleague) => {
    const sortedIds = [user._id, colleague._id].sort();
    const directRoomId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
    setSelectedRoom({
      id: directRoomId,
      name: colleague.fullname || colleague.name,
      label: colleague.fullname || colleague.name,
      type: "direct",
      recipientId: colleague._id,
      colleague,
    });
    setViewMode("chat");
  };

  if (!isOpen) return null;

  const isDirect = selectedRoom?.type === "direct";

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-[#0c0d14] border-l border-white/10 shadow-2xl flex flex-col text-slate-200 animate-in slide-in-from-right duration-200 select-none">
      {/* 1. Sleek Header */}
      <div className="px-4 py-3 border-b border-white/10 bg-[#12141e]/90 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 font-bold shrink-0">
            {isDirect ? (
              <span className="text-xs uppercase">
                {(selectedRoom?.name || "U")[0]}
              </span>
            ) : (
              <Hash className="w-4 h-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                {isDirect ? `@${selectedRoom?.name}` : `#${selectedRoom?.name}`}
              </h3>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                E2EE
              </span>
            </div>
            <p className="text-[10px] text-slate-400 truncate">
              {isDirect
                ? `${selectedRoom?.colleague?.departmentName || "Team"} • ${selectedRoom?.colleague?.publicId || "Active"}`
                : selectedRoom?.label}
            </p>
          </div>
        </div>

        {/* Header Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setViewMode(viewMode === "directory" ? "chat" : "directory")}
            className={`p-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              viewMode === "directory"
                ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
            title="Team Directory & DMs"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="text-[11px] hidden sm:inline">DMs</span>
          </button>

          <button
            onClick={() => setViewMode(viewMode === "uploader" ? "chat" : "uploader")}
            className={`p-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
              viewMode === "uploader"
                ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                : "text-slate-400 hover:text-white hover:bg-white/5"
            }`}
            title="File Sharing Hub"
          >
            <UploadCloud className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Channel Quick Switcher Bar */}
      {viewMode === "chat" && (
        <div className="px-3 py-2 border-b border-white/5 bg-[#141622]/60 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          {channels.map((chan) => {
            const isSelected = selectedRoom?.id === chan.id;
            return (
              <button
                key={chan.id}
                onClick={() => setSelectedRoom(chan)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-all flex items-center gap-1 cursor-pointer ${
                  isSelected
                    ? "bg-purple-600 text-white shadow-md shadow-purple-500/20 font-semibold"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Hash className="w-3 h-3 opacity-70" />
                <span>{chan.name}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* 3. Main View Area */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* VIEW A: CHAT FEED */}
        {viewMode === "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Messages Feed */}
            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {loading && (
                <div className="text-center py-8 text-xs text-slate-500 animate-pulse">
                  Decrypting local messages...
                </div>
              )}

              {/* Minimal Room Welcome Banner */}
              {!loading && messages.length === 0 && (
                <div className="py-10 text-center space-y-2.5 select-none">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    {isDirect ? <Users className="w-5 h-5" /> : <Hash className="w-5 h-5" />}
                  </div>
                  <div>
                    <h4 className="text-xs sm:text-sm font-bold text-white">
                      {isDirect ? `Chat with ${selectedRoom?.name}` : `Welcome to #${selectedRoom?.name}`}
                    </h4>
                    <p className="text-[11px] text-slate-400 max-w-xs mx-auto mt-0.5">
                      Messages in this conversation are protected with client-side 256-bit AES encryption.
                    </p>
                  </div>
                </div>
              )}

              {/* Message Items */}
              {messages.map((msg, index) => {
                const isMe = msg.sender?._id === user?._id || msg.sender === user?._id;
                const senderName = isMe ? "You" : msg.sender?.fullname || msg.sender?.name || "Colleague";
                const isFileShare = msg.decryptedText?.startsWith("[Shared File]");

                return (
                  <div
                    key={msg._id || index}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-1 px-1">
                      <span className="text-[10px] font-semibold text-slate-400">
                        {senderName}
                      </span>
                      {msg.sender?.publicId && !isMe && (
                        <span className="text-[9px] font-mono px-1 rounded bg-white/5 text-purple-300">
                          {msg.sender.publicId}
                        </span>
                      )}
                      <span className="text-[9px] text-slate-500 font-mono">
                        {new Date(msg.createdAt || Date.now()).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {isFileShare ? (
                      <div className="max-w-[85%] p-3 rounded-2xl bg-[#191b28] border border-white/10 shadow-lg space-y-1.5 text-left">
                        <div className="flex items-center gap-2 text-purple-300 text-xs font-semibold">
                          <FileText className="w-4 h-4 shrink-0" />
                          <span className="truncate">Attached File</span>
                        </div>
                        <p className="text-[11px] text-slate-300 break-all select-all">
                          {msg.decryptedText.replace("[Shared File] ", "")}
                        </p>
                      </div>
                    ) : (
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-md ${
                          isMe
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none font-medium"
                            : "bg-[#181a26] text-slate-100 rounded-tl-none border border-white/10"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.decryptedText}</p>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Minimal Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-[#11131c] border-t border-white/10 flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => setViewMode("uploader")}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                title="Send File Attachment"
              >
                <Paperclip className="w-4 h-4" />
              </button>

              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Message ${isDirect ? `@${selectedRoom?.name}` : `#${selectedRoom?.name}`}...`}
                className="flex-1 bg-[#191b26] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors font-medium"
              />

              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-30 text-white transition-all shadow-md shadow-blue-500/20 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}

        {/* VIEW B: TEAM DIRECTORY & DMs */}
        {viewMode === "directory" && (
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Search team by name or ID..."
                className="w-full bg-[#161824] border border-white/10 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block px-1">
                Workspace Colleagues ({conversations.length})
              </span>

              {conversations
                .filter(
                  (c) =>
                    !searchFilter ||
                    c.fullname?.toLowerCase().includes(searchFilter.toLowerCase()) ||
                    c.publicId?.toLowerCase().includes(searchFilter.toLowerCase())
                )
                .map((colleague) => (
                  <div
                    key={colleague._id}
                    onClick={() => selectDirectColleague(colleague)}
                    className="p-2.5 rounded-xl bg-[#141622] hover:bg-[#1b1e2e] border border-white/5 hover:border-purple-500/30 flex items-center justify-between cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-300 font-bold text-xs uppercase">
                        {(colleague.fullname || colleague.name || "U")[0]}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold text-white">
                            {colleague.fullname || colleague.name}
                          </p>
                          {colleague.publicId && (
                            <span className="text-[9px] font-mono px-1 rounded bg-white/5 text-purple-300">
                              {colleague.publicId}
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {colleague.departmentName || colleague.jobTitle || "Team Member"}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-purple-400 font-semibold hover:underline">
                      Chat →
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* VIEW C: RESUMABLE CHUNK UPLOADER */}
        {viewMode === "uploader" && (
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-purple-400" />
                <span>Upload File to MinIO</span>
              </h4>
              <button
                onClick={() => setViewMode("chat")}
                className="text-xs text-purple-400 hover:underline font-medium"
              >
                Back to chat
              </button>
            </div>

            <ChunkUploader
              onUploadComplete={(fileData) => {
                toast.success(`Uploaded: ${fileData.originalName}`);
                if (selectedRoom) {
                  setInputText(`[Shared File] ${fileData.originalName}: ${window.location.origin}${fileData.fileUrl}`);
                  setViewMode("chat");
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
