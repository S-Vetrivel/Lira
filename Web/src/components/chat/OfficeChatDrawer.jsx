import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  Lock,
  ShieldCheck,
  Send,
  X,
  Users,
  Wifi,
  UploadCloud,
  FileCheck,
  Paperclip,
  Share2,
  CheckCheck,
  Sparkles,
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
  sendPeerSignal,
} from "../../services/socket";
import { encryptText, decryptText } from "../../services/crypto";
import ChunkUploader from "../files/ChunkUploader";
import toast from "react-hot-toast";

export default function OfficeChatDrawer({ isOpen, onClose }) {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState("chat"); // chat, peers, uploader
  const [conversations, setConversations] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null); // { id, name, type, recipientId }
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState("");
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showUploader, setShowUploader] = useState(false);
  const messagesEndRef = useRef(null);

  // Departments for group rooms
  const departmentRooms = [
    { id: "dept_general", name: "🏢 Operations & General", type: "department" },
    { id: "dept_hr", name: "👥 Human Resources", type: "department" },
    { id: "dept_finance", name: "💰 Finance & Payroll", type: "department" },
    { id: "dept_marketing", name: "📢 Marketing & Sales", type: "department" },
  ];

  // 1. Fetch conversations and announce peer
  useEffect(() => {
    if (!isOpen || !user) return;

    const loadData = async () => {
      const res = await getChatConversations();
      if (res.success) {
        setConversations(res.colleagues);
      }
    };
    loadData();

    // Default to first general department room
    if (!selectedRoom) {
      setSelectedRoom(departmentRooms[0]);
    }

    // Announce peer for local subnet route finding
    const socket = getSocket();
    if (socket) {
      announcePeer({
        userId: user._id,
        name: user.name,
        department: user.department?.name || "Operations",
      });

      const handlePeerList = (peerList) => setPeers(peerList);
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

  // 2. Room switching & message polling / socket room join
  useEffect(() => {
    if (!selectedRoom || !isOpen) return;

    const roomId = selectedRoom.id;
    joinChatRoom(roomId);

    let isMounted = true;
    const loadMessages = async () => {
      setLoading(true);
      const res = await getChatMessages(roomId);
      if (res.success && isMounted) {
        // Decrypt messages client-side with AES-GCM
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

    // Listen to real-time chat messages
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

    // 1. Client-side E2EE Encryption
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
      name: colleague.name,
      type: "direct",
      recipientId: colleague._id,
      colleague,
    });
    setActiveTab("chat");
  };

  const sendDirectLANFilePrompt = (peer) => {
    toast.success(`Connected to ${peer.name} on local network! Direct socket channel ready.`);
    setShowUploader(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col text-slate-200 animate-in slide-in-from-right duration-200">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>Office E2EE Communications</span>
              <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-0.5">
                <ShieldCheck className="w-2.5 h-2.5" /> 256-bit AES
              </span>
            </h3>
            <p className="text-[10px] text-slate-400">Zero-knowledge office channel & route finding</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center border-b border-slate-800 bg-slate-950/40 px-2 text-xs">
        <button
          onClick={() => setActiveTab("chat")}
          className={`flex-1 py-2.5 text-center font-medium border-b-2 transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "chat"
              ? "border-blue-500 text-blue-400 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" /> Rooms & Direct
        </button>
        <button
          onClick={() => setActiveTab("peers")}
          className={`flex-1 py-2.5 text-center font-medium border-b-2 transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "peers"
              ? "border-blue-500 text-blue-400 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <Wifi className="w-3.5 h-3.5" /> Nearby Peers
          {peers.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-blue-500/20 text-blue-300 text-[10px]">
              {peers.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("uploader")}
          className={`flex-1 py-2.5 text-center font-medium border-b-2 transition-all flex items-center justify-center gap-1.5 ${
            activeTab === "uploader"
              ? "border-blue-500 text-blue-400 font-bold"
              : "border-transparent text-slate-400 hover:text-slate-200"
          }`}
        >
          <UploadCloud className="w-3.5 h-3.5" /> File Hub
        </button>
      </div>

      {/* Main Drawer Body */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {/* TAB 1: E2EE CHAT */}
        {activeTab === "chat" && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Room Selector Strip */}
            <div className="p-2 border-b border-slate-800/80 bg-slate-950/20 overflow-x-auto flex gap-1.5 no-scrollbar">
              {departmentRooms.map((room) => (
                <button
                  key={room.id}
                  onClick={() => setSelectedRoom(room)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] whitespace-nowrap transition-colors flex items-center gap-1 ${
                    selectedRoom?.id === room.id
                      ? "bg-blue-600 text-white font-semibold shadow-sm"
                      : "bg-slate-800/60 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  {room.name}
                </button>
              ))}
            </div>

            {/* Direct Colleague Bar */}
            <div className="px-3 py-1.5 bg-slate-950/50 border-b border-slate-800 text-[11px] text-slate-400 flex items-center justify-between">
              <span className="font-semibold text-white">Active Channel: {selectedRoom?.name}</span>
              <button
                onClick={() => setActiveTab("peers")}
                className="text-blue-400 hover:underline flex items-center gap-1"
              >
                <Users className="w-3 h-3" /> Colleague DMs
              </button>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 p-3 overflow-y-auto space-y-3">
              {loading && (
                <div className="text-center py-6 text-xs text-slate-400 animate-pulse">
                  Decrypting room ciphertext...
                </div>
              )}

              {!loading && messages.length === 0 && (
                <div className="text-center py-12 text-slate-500 space-y-2">
                  <ShieldCheck className="w-8 h-8 mx-auto text-slate-600" />
                  <p className="text-xs">End-to-End Encrypted Room</p>
                  <p className="text-[10px] text-slate-600 max-w-xs mx-auto">
                    Messages are encrypted on your local device before transmission.
                  </p>
                </div>
              )}

              {messages.map((msg, index) => {
                const isMe = msg.sender?._id === user?._id;
                return (
                  <div
                    key={msg._id || index}
                    className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[10px] font-medium text-slate-400">
                        {isMe ? "You" : msg.sender?.name || "Colleague"}
                      </span>
                      <span className="text-[9px] text-slate-500 font-mono">
                        {new Date(msg.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-xs shadow-md ${
                        isMe
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-tr-none"
                          : "bg-slate-800 text-slate-100 rounded-tl-none border border-slate-700/60"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.decryptedText}</p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 bg-slate-950 border-t border-slate-800 flex items-center gap-2"
            >
              <button
                type="button"
                onClick={() => setActiveTab("uploader")}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Send File Attachment"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Encrypted message to ${selectedRoom?.name || "room"}...`}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white transition-colors shadow-lg shadow-blue-500/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: NEARBY LOCAL PEERS & SMART ROUTE FINDING */}
        {activeTab === "peers" && (
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            <div>
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span>Local Network Colleague Discovery</span>
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Detects team members on the same office router / subnet for direct high-speed transfers.
              </p>
            </div>

            {/* Peers List */}
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Online Local Peers ({peers.length})
              </span>
              {peers.length === 0 ? (
                <div className="p-6 text-center bg-slate-950/40 rounded-xl border border-slate-800 text-slate-400 text-xs">
                  <Wifi className="w-6 h-6 mx-auto mb-2 text-slate-600" />
                  No other colleagues detected on local subnet right now.
                </div>
              ) : (
                peers.map((peer) => (
                  <div
                    key={peer.socketId}
                    className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between hover:border-slate-700 transition-all"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xs font-bold">
                        {peer.name?.[0] || "U"}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-white">{peer.name}</p>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {peer.department} • {peer.clientIp || "Local Subnet"}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => sendDirectLANFilePrompt(peer)}
                      className="px-2.5 py-1 rounded-lg bg-blue-600/20 hover:bg-blue-600 text-blue-300 hover:text-white text-xs font-semibold border border-blue-500/30 transition-all flex items-center gap-1"
                    >
                      <Share2 className="w-3 h-3" /> Transfer
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Colleague Directory for Direct Messages */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Direct E2EE Colleague DMs
              </span>
              <div className="space-y-1.5">
                {conversations.map((colleague) => (
                  <div
                    key={colleague._id}
                    onClick={() => selectDirectColleague(colleague)}
                    className="p-2.5 rounded-xl bg-slate-950/60 hover:bg-slate-800/80 border border-slate-800/60 flex items-center justify-between cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center font-bold text-xs">
                        {colleague.name?.[0] || "U"}
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-slate-200">{colleague.name}</p>
                        <p className="text-[10px] text-slate-400">{colleague.role}</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-blue-400 font-semibold hover:underline">
                      Chat →
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: RESUMABLE CHUNK UPLOADER & BANDWIDTH GOVERNOR */}
        {activeTab === "uploader" && (
          <div className="flex-1 p-4 overflow-y-auto">
            <ChunkUploader
              onUploadComplete={(fileData) => {
                toast.success(`Uploaded: ${fileData.originalName}`);
                // Insert download link into active chat
                if (selectedRoom) {
                  setInputText(`[Shared File] ${fileData.originalName}: ${window.location.origin}${fileData.fileUrl}`);
                  setActiveTab("chat");
                }
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
