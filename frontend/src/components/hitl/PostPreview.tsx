"use client";

interface PostPreviewProps {
  platform: "x" | "instagram" | "linkedin" | "facebook" | "telegram" | "tiktok";
  content: string;
  hashtags?: string[];
  mediaUrls?: string[];
  scheduledAt: string;
}

const PLATFORM_LABELS: Record<PostPreviewProps["platform"], string> = {
  x: "X (Twitter)",
  instagram: "Instagram",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  telegram: "Telegram",
  tiktok: "TikTok",
};

const PLATFORM_COLORS: Record<PostPreviewProps["platform"], string> = {
  x: "bg-black text-white",
  instagram: "bg-gradient-to-r from-purple-500 to-pink-500 text-white",
  linkedin: "bg-blue-700 text-white",
  facebook: "bg-blue-600 text-white",
  telegram: "bg-sky-500 text-white",
  tiktok: "bg-black text-white",
};

export function PostPreview({ platform, content, hashtags = [], mediaUrls = [], scheduledAt }: PostPreviewProps) {
  const hashtagText = hashtags.map((h) => `#${h}`).join(" ");
  const fullText = hashtagText ? `${content}\n\n${hashtagText}` : content;

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <div className={`px-3 py-2 text-xs font-semibold ${PLATFORM_COLORS[platform]}`}>
        {PLATFORM_LABELS[platform]}
      </div>
      <div className="p-4 bg-white space-y-3">
        {mediaUrls[0] && (
          <img
            src={mediaUrls[0]}
            alt="Post media"
            className="w-full rounded object-cover max-h-48"
          />
        )}
        <p className="text-sm text-gray-800 whitespace-pre-wrap">{fullText}</p>
        <p className="text-xs text-gray-400">
          Scheduled: {new Date(scheduledAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
}
