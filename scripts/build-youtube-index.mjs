import fs from "node:fs";
import path from "node:path";

const SOURCE_PATH =
  process.env.YOUTUBE_POOL_PATH ||
  "/Users/freekino_pnwat/Desktop/유튜브 채널 탐색기/data/pool.json";
const OUT_PATH = path.resolve("server-data/youtube-index.json");

function parseSeconds(duration = "") {
  const parts = String(duration).split(":").map((part) => Number(part));
  if (parts.some((part) => Number.isNaN(part))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

function compactText(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

const raw = JSON.parse(fs.readFileSync(SOURCE_PATH, "utf8"));
const references = [];

for (const channel of raw.channels || []) {
  for (const video of channel.topVideos || []) {
    if (!video.videoId || !video.title || !video.thumbnail) continue;

    const keywords = [
      channel.category,
      ...(video.tags || []),
      ...String(video.title)
        .split(/[,\s/·\-_|()[\]{}"'!?.,;:]+/)
        .filter((token) => token.length >= 2),
    ]
      .filter(Boolean)
      .slice(0, 24);

    references.push({
      id: `youtube-${video.videoId}`,
      title: compactText(video.title),
      source: "YOUCHI DB",
      channel: compactText(channel.name),
      category: compactText(channel.category),
      subscribers: channel.subscribers || 0,
      views: video.views || 0,
      image: video.thumbnail,
      originUrl: `https://www.youtube.com/watch?v=${video.videoId}`,
      videoType: "youtube",
      videoUrl: `https://www.youtube.com/embed/${video.videoId}`,
      duration: video.duration || "00:00",
      seconds: parseSeconds(video.duration),
      year: Number(String(video.uploadDate || "").slice(0, 4)) || 0,
      keywords: [...new Set(keywords)],
      reason: `${compactText(channel.name)} 채널의 ${compactText(
        channel.category || "유튜브",
      )} 레퍼런스입니다.`,
      description: compactText(video.description || channel.description || video.title).slice(
        0,
        320,
      ),
      moments: [
        {
          time: "00:00",
          label: "영상 오프닝",
          image: video.thumbnail,
        },
        {
          time: video.duration || "00:00",
          label: "전체 구성 확인",
          image: video.thumbnail,
        },
      ],
    });
  }
}

const payload = {
  generatedAt: new Date().toISOString(),
  sourcePath: SOURCE_PATH,
  sourceUpdatedAt: raw.updatedAt,
  count: references.length,
  references,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(payload));
console.log(`Wrote ${references.length.toLocaleString()} YouTube references to ${OUT_PATH}`);
