import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { Check, CheckCheck, Download, FileText, Pin, PinOff, SmilePlus } from "lucide-react";
import clsx from "clsx";
import { fileUrl } from "../services/api";

const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🔥"];

function timeHHMM(d) {
  try { return format(new Date(d), "HH:mm"); } catch { return ""; }
}

function messageStatus(message) {
  if (message.read_at) return "read";
  if (message.delivered_at) return "delivered";
  return "sent";
}

function groupedReactions(reactions = []) {
  return reactions.reduce((acc, r) => {
    acc[r.reaction] = acc[r.reaction] || [];
    acc[r.reaction].push(r);
    return acc;
  }, {});
}

export default function MessageBubble({
  message,
  isMe,
  showSender = false,
  canPin = false,
  onReact,
  onRemoveReaction,
  onPin,
  onUnpin,
  currentUserId,
}) {
  const cls = clsx(
    "bubble group",
    isMe ? "bubble-me" : "bubble-them",
    isMe ? "ml-auto" : "mr-auto",
  );
  const status = messageStatus(message);
  const reactionGroups = groupedReactions(message.reactions);
  const myReaction = (message.reactions || []).find((r) => r.user_id === currentUserId);
  const [showPicker, setShowPicker] = useState(false);
  const bubbleRef = useRef(null);

  useEffect(() => {
    if (!showPicker) return;
    function onPointerDown(e) {
      if (!bubbleRef.current?.contains(e.target)) setShowPicker(false);
    }
    function onKeyDown(e) {
      if (e.key === "Escape") setShowPicker(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showPicker]);

  function react(reaction) {
    if (myReaction?.reaction === reaction) onRemoveReaction?.(message);
    else onReact?.(message, reaction);
    setShowPicker(false);
  }

  return (
    <div id={`message-${message.id}`} className={clsx("w-full flex", isMe ? "justify-end" : "justify-start")}>
      <div
        ref={bubbleRef}
        className={cls}
        onDoubleClick={() => message.type !== "system" && setShowPicker((v) => !v)}
      >
        {showPicker && message.type !== "system" && (
          <div
            className={clsx(
              "absolute z-20 bottom-full mb-1 flex items-center gap-1 rounded-full bg-white px-1.5 py-1 shadow-soft border border-ink-100",
              isMe ? "right-0" : "left-0",
            )}
          >
            {REACTIONS.map((reaction) => (
              <button
                type="button"
                key={reaction}
                onClick={() => react(reaction)}
                className={clsx(
                  "w-8 h-8 rounded-full text-base hover:bg-ink-100 transition",
                  myReaction?.reaction === reaction && "bg-brand-50 ring-1 ring-brand-200",
                )}
              >
                {reaction}
              </button>
            ))}
          </div>
        )}

        {!isMe && showSender && (
          <div className="text-[11px] font-semibold text-brand-700 mb-0.5 leading-none">
            {message.sender_name}
          </div>
        )}

        {message.type === "system" ? (
          <div className="italic text-sm">{message.content}</div>
        ) : (
          <>
            {message.attachments?.map((a) => (
              <Attachment key={a.id} a={a} />
            ))}
            {message.content && (
              <div className="whitespace-pre-wrap break-words leading-snug text-[15px]">
                {message.content}
              </div>
            )}
          </>
        )}

        {Object.keys(reactionGroups).length > 0 && (
        <div className={clsx("flex items-center gap-1 mt-0.5 flex-wrap", isMe ? "justify-end" : "justify-start")}>
          {Object.entries(reactionGroups).map(([reaction, users]) => (
            <button
              key={reaction}
              type="button"
              title={users.map((u) => u.display_name || u.username).join(", ")}
              onClick={() => react(reaction)}
              className={clsx(
                "text-[11px] leading-none px-1.5 py-0.5 rounded-full border",
                isMe ? "bg-white/15 border-white/20" : "bg-ink-50 border-ink-200",
              )}
            >
              {reaction} {users.length}
            </button>
          ))}
        </div>
        )}

        {message.type !== "system" && (
          <div className={clsx(
            "absolute top-1/2 -translate-y-1/2 flex gap-1 transition-opacity opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto",
            isMe ? "justify-end" : "justify-start",
            isMe ? "-left-9" : "-right-9",
          )}>
            <button
              type="button"
              className="w-7 h-7 rounded-full bg-white text-ink-700 border border-ink-100 shadow-bubble flex items-center justify-center hover:bg-ink-50"
              title="Réagir"
              onClick={() => setShowPicker((v) => !v)}
            >
              <SmilePlus className="w-4 h-4" />
            </button>
            {canPin && (
              <button
                type="button"
                className="w-7 h-7 rounded-full bg-white text-ink-700 border border-ink-100 shadow-bubble flex items-center justify-center hover:bg-ink-50"
                title={message.is_pinned ? "Désépingler" : "Épingler"}
                onClick={() => (message.is_pinned ? onUnpin?.(message) : onPin?.(message))}
              >
                {message.is_pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        )}

        <div className={clsx(
          "flex items-center gap-1 text-[10px] mt-0 leading-none",
          isMe ? "text-white/70 justify-end" : "text-ink-500 justify-end",
        )}>
          {message.is_edited && <span>modifié ·</span>}
          {message.is_pinned ? <Pin className="w-3 h-3" /> : null}
          {timeHHMM(message.created_at)}
          {isMe && (
            status === "read"
              ? <CheckCheck className="w-3.5 h-3.5 text-sky-300" />
              : status === "delivered"
                ? <CheckCheck className="w-3.5 h-3.5" />
                : <Check className="w-3.5 h-3.5" />
          )}
        </div>
      </div>
    </div>
  );
}

function Attachment({ a }) {
  const url = fileUrl(a.url);
  if (a.mime_type?.startsWith("image/")) {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="block mb-1">
        <img src={url} alt={a.file_name} className="rounded-xl max-h-72 object-cover" />
      </a>
    );
  }
  if (a.mime_type?.startsWith("video/")) {
    return <video src={url} controls className="rounded-xl max-h-72 mb-1" />;
  }
  if (a.mime_type?.startsWith("audio/")) {
    return (
      <div className="min-w-[220px] mb-1">
        <audio src={url} controls className="w-full" />
        {a.duration ? <div className="text-[10px] opacity-70 mt-0.5">{Math.round(a.duration / 1000)}s</div> : null}
      </div>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer"
       className="flex items-center gap-2 px-3 py-2 rounded-xl bg-black/5 hover:bg-black/10 mb-1">
      <FileText className="w-5 h-5" />
      <div className="flex-1 min-w-0">
        <div className="truncate text-sm font-medium">{a.file_name}</div>
        <div className="text-xs opacity-80">{Math.round((a.file_size || 0) / 1024)} Ko</div>
      </div>
      <Download className="w-4 h-4 opacity-70" />
    </a>
  );
}
