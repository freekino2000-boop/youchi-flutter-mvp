import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { references as curatedReferences } from "./src/data.js";

function loadLocalEnv() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

    const separatorIndex = trimmed.indexOf("=");
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^["']|["']$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadLocalEnv();

const PORT = Number(process.env.YOUCHI_API_PORT || 8787);
const INDEX_PATH = path.resolve("server-data/youtube-index.json");
const XAI_API_KEY = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
const XAI_MODEL = process.env.XAI_MODEL || "grok-4";
const XAI_BASE_URL = process.env.XAI_BASE_URL || "https://api.x.ai/v1";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
const IMAGE_PROVIDER = (process.env.IMAGE_PROVIDER || "openai").toLowerCase();
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GOOGLE_IMAGE_MODEL = process.env.GOOGLE_IMAGE_MODEL || "gemini-3.1-flash-image";
const GENERATED_DIR = path.resolve("public/generated");

const genericSearchTerms = [
  "광고",
  "광고영상",
  "영상",
  "레퍼런스",
  "소재",
  "캠페인",
  "브랜드필름",
  "브랜드",
  "제품",
  "용품",
  "관련",
  "추천",
  "찾아줘",
  "보여줘",
  "입력",
  "해주세요",
];

const categoryAliases = [
  {
    label: "아웃도어",
    terms: [
      "등산",
      "등산용품",
      "아웃도어",
      "캠핑",
      "백패킹",
      "차박",
      "트레킹",
      "하이킹",
      "클라이밍",
      "산행",
      "등산화",
      "배낭",
      "백팩",
      "고어텍스",
      "텐트",
      "랜턴",
      "스틱",
      "재킷",
      "자켓",
      "장비",
    ],
  },
  {
    label: "뷰티",
    terms: ["화장품", "뷰티", "스킨케어", "메이크업", "헤어", "샴푸", "틴트", "크림", "세럼"],
  },
  {
    label: "푸드",
    terms: ["먹방", "요리", "간편식", "도시락", "식품", "카페", "디저트"],
  },
  {
    label: "테크",
    terms: ["테크", "리뷰", "노트북", "스마트폰", "카메라", "가전"],
  },
  {
    label: "패션",
    terms: ["패션", "코디", "하울", "스니커즈", "시계", "주얼리"],
  },
];

const sourceLabels = {
  youtube: "YouTube",
  "youtube db": "YouTube",
  tvcf: "TVCF",
  "비드폴리오": "비드폴리오",
  "드롭샷": "드롭샷",
  tiktok: "TikTok",
};

const productTerms = [
  "제품",
  "용품",
  "장비",
  "브랜드",
  "리뷰",
  "후기",
  "구매",
  "추천",
  "신발",
  "등산화",
  "배낭",
  "백팩",
  "텐트",
  "랜턴",
  "스틱",
  "재킷",
  "자켓",
  "의류",
  "광고",
  "소재",
  "캠페인",
  "숏폼",
];

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function compactText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function meaningfulTokens(text) {
  const normalized = genericSearchTerms.reduce(
    (current, term) => current.replaceAll(term, " "),
    String(text || "").toLowerCase(),
  );
  return tokenize(normalized).filter(
    (token) => token.length > 1 && !genericSearchTerms.includes(token),
  );
}

function expandTokens(tokens) {
  const expanded = new Set(tokens);
  const joined = tokens.join(" ");
  for (const group of categoryAliases) {
    if (group.terms.some((term) => joined.includes(term))) {
      for (const term of group.terms) expanded.add(term);
    }
  }
  return [...expanded];
}

function buildQueryProfile(query) {
  const baseTokens = meaningfulTokens(query);
  const compactQuery = compactText(query);
  const aliasTokens = categoryAliases.flatMap((group) =>
    group.terms.filter((term) => compactQuery.includes(compactText(term))),
  );
  const productIntentTokens = productTerms.filter((term) =>
    compactQuery.includes(compactText(term)),
  );
  const queryTokens = unique([...baseTokens, ...aliasTokens, ...productIntentTokens]);
  const expandedTokens = expandTokens(queryTokens);
  const chunks = String(query || "")
    .toLowerCase()
    .split(/[,，\n/|+·ㆍ]+/u)
    .map((chunk) => meaningfulTokens(chunk).join(" "))
    .filter((chunk) => chunk.length > 1);
  const adjacentPhrases = [];
  for (let size = 2; size <= 3; size += 1) {
    for (let index = 0; index <= queryTokens.length - size; index += 1) {
      adjacentPhrases.push(queryTokens.slice(index, index + size).join(" "));
    }
  }

  return {
    baseTokens: queryTokens,
    originalTokens: baseTokens,
    aliasTokens,
    productIntentTokens,
    expandedTokens,
    phrases: unique([...chunks, ...adjacentPhrases]).slice(0, 18),
    intents: searchIntent(query),
  };
}

function tokenEvidence(reference, token) {
  const lowered = String(token || "").toLowerCase();
  const title = String(reference.title || "").toLowerCase();
  const channel = String(reference.channel || "").toLowerCase();
  const category = String(reference.category || "").toLowerCase();
  const description = String(reference.description || "").toLowerCase();
  const keywords = reference.keywords || [];

  if (!lowered) return null;
  if (title.includes(lowered)) return { token, field: "title", weight: 24 };
  if (keywords.some((keyword) => keyword.includes(lowered))) {
    return { token, field: "keyword", weight: 20 };
  }
  if (category.includes(lowered)) return { token, field: "category", weight: 14 };
  if (description.includes(lowered)) return { token, field: "description", weight: 9 };
  if (channel.includes(lowered)) return { token, field: "channel", weight: 5 };
  return null;
}

function searchIntent(query) {
  const joined = query.toLowerCase();
  return categoryAliases
    .filter((group) => group.terms.some((term) => joined.includes(term)))
    .map((group) => group.label);
}

function buildLocalKeywordInsights(query) {
  const baseTokens = meaningfulTokens(query);
  const expanded = expandTokens(baseTokens);
  const intents = searchIntent(query);
  const primaryIntent = intents[0] || "광고 레퍼런스";
  const keywordPool = [
    ...expanded,
    ...(primaryIntent === "아웃도어"
      ? ["기능성", "야외 촬영", "장비 착용", "제품 사용 장면", "험지", "내구성", "백패킹", "실사용 리뷰"]
      : []),
    ...(primaryIntent === "뷰티"
      ? ["사용 전후", "텍스처", "피부 표현", "클로즈업", "루틴", "성분", "광채", "수분감"]
      : []),
    ...(primaryIntent === "패션"
      ? ["착장", "스타일링", "룩북", "도시", "핏", "소재감", "시즌 캠페인"]
      : []),
    "제품 장점",
    "사용 상황",
    "브랜드 톤",
  ];

  return {
    provider: XAI_API_KEY ? "Grok fallback" : "YOUCHI 로컬 확장",
    status: XAI_API_KEY ? "Grok 응답 실패 시 로컬 제안" : "Grok API 키 연결 전",
    headline: `${query.trim()} 검색을 위한 확장 키워드`,
    summary:
      intents.length > 0
        ? `${primaryIntent} 의도로 해석하고, 실제 영상 제목·채널·카테고리와 연결되는 키워드를 우선 확장했습니다.`
        : "입력한 키워드를 기준으로 YOUCHI DB 검색에 사용할 확장 키워드를 제안했습니다.",
    keywords: [...new Set(keywordPool)].filter(Boolean).slice(0, 12),
    angles: [
      `${primaryIntent} 제품이 실제로 사용되는 장면`,
      "제품 특징이 화면에서 바로 보이는 클로즈업",
      "광고 소재로 전환하기 좋은 후킹 컷",
      "브랜드 무드와 소비자 상황이 함께 보이는 영상",
    ],
    avoid: ["키워드만 비슷하고 제품군이 다른 영상", "뷰티·패션 등 이종 카테고리 과매칭", "광고 소재로 활용하기 어려운 단순 일상 브이로그"],
    fromGrok: false,
  };
}

async function buildGrokKeywordInsights(query, topCandidates) {
  const fallback = buildLocalKeywordInsights(query);
  if (!XAI_API_KEY) return fallback;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  const candidates = topCandidates.slice(0, 20).map((reference) => ({
    title: reference.title,
    channel: reference.channel,
    category: reference.category,
    matchedTerms: reference.matchedTerms,
    match: reference.match,
  }));

  try {
    const response = await fetch(`${XAI_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: XAI_MODEL,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "너는 광고 영상 레퍼런스 검색 기획자다. 한국어로만 답하고, 반드시 JSON만 반환한다.",
          },
          {
            role: "user",
            content: JSON.stringify({
              task:
                "사용자 검색어와 YOUCHI DB 상위 후보를 보고 광고 소재 탐색용 관련 키워드, 소재 방향, 제외 조건을 제안해줘. 이미지나 영상을 생성하지 말고 텍스트 JSON만 반환해.",
              query,
              candidates,
              schema: {
                headline: "string",
                summary: "string",
                keywords: ["string"],
                angles: ["string"],
                avoid: ["string"],
              },
            }),
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      let safeReason = "API 응답 오류";
      try {
        const errorPayload = JSON.parse(errorText);
        safeReason = errorPayload.code || errorPayload.error || safeReason;
        if (/credits|licenses/i.test(errorPayload.error || "")) {
          safeReason = "크레딧 또는 라이선스 필요";
        }
      } catch {
        safeReason = errorText.slice(0, 80);
      }
      throw new Error(`xAI ${response.status} · ${safeReason}`);
    }
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content || "{}";
    const parsed = JSON.parse(content);

    return {
      provider: "Grok AI",
      status: `${XAI_MODEL} 제안`,
      headline: parsed.headline || fallback.headline,
      summary: parsed.summary || fallback.summary,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords.slice(0, 12) : fallback.keywords,
      angles: Array.isArray(parsed.angles) ? parsed.angles.slice(0, 6) : fallback.angles,
      avoid: Array.isArray(parsed.avoid) ? parsed.avoid.slice(0, 5) : fallback.avoid,
      fromGrok: true,
    };
  } catch (error) {
    console.warn(`[YOUCHI API] Grok request failed: ${error.message}`);
    return {
      ...fallback,
      provider: "Grok fallback",
      status: error.message.includes("크레딧")
        ? "Grok 크레딧 필요 · 로컬 제안"
        : "Grok 호출 실패 · 로컬 제안",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildHaystack(reference) {
  return [
    reference.title,
    reference.source,
    reference.channel,
    reference.category,
    reference.description,
    ...(reference.keywords || []),
  ]
    .join(" ")
    .toLowerCase();
}

function normalizeSource(source) {
  const raw = String(source || "YouTube").trim();
  const key = raw.toLowerCase();
  return sourceLabels[key] || raw.replace(" DB", "");
}

function normalizeReference(reference, fallbackSource = "YouTube") {
  const keywords = unique(reference.keywords || []);
  return {
    ...reference,
    source: normalizeSource(reference.source || fallbackSource),
    category: reference.category || inferCategory(keywords),
    keywords,
    views: Number(reference.views || 0),
    seconds: Number(reference.seconds || 0),
    year: Number(reference.year || 0) || undefined,
  };
}

function inferCategory(keywords) {
  const joined = keywords.join(" ");
  for (const group of categoryAliases) {
    if (group.terms.some((term) => joined.includes(term))) return group.label;
  }
  return keywords[0] || "광고 레퍼런스";
}

function tiktokImageForIntent(intents) {
  if (intents.includes("아웃도어")) {
    return "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=900&q=80";
  }
  if (intents.includes("뷰티")) {
    return "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=900&q=80";
  }
  if (intents.includes("패션")) {
    return "https://images.unsplash.com/photo-1496747611176-843222e1e57c?auto=format&fit=crop&w=900&q=80";
  }
  if (intents.includes("푸드")) {
    return "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80";
  }
  return "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?auto=format&fit=crop&w=900&q=80";
}

function buildTikTokSearchReferences(query, queryProfile) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const terms = unique([
    trimmed,
    ...queryProfile.baseTokens,
    ...queryProfile.expandedTokens.slice(0, 4),
    "광고",
    "숏폼",
    "틱톡",
  ]).slice(0, 12);
  const searchQuery = unique([trimmed, "광고", "숏폼", "레퍼런스"]).join(" ");
  return [
    normalizeReference(
      {
        id: `tiktok-search-${Buffer.from(trimmed).toString("base64url").slice(0, 28)}`,
        title: `TikTok 검색: ${trimmed} 숏폼 광고 레퍼런스`,
        source: "TikTok",
        channel: "TikTok Search",
        category: queryProfile.intents[0] || "숏폼",
        image: tiktokImageForIntent(queryProfile.intents),
        originUrl: `https://www.tiktok.com/search?q=${encodeURIComponent(searchQuery)}`,
        videoType: "external",
        duration: "검색",
        seconds: 0,
        year: new Date().getFullYear(),
        keywords: terms,
        reason: "TikTok에서 같은 키워드의 숏폼 광고·UGC 레퍼런스를 추가 탐색하는 검색 링크입니다.",
        description:
          "TikTok 공식 검색 페이지로 이동해 최신 숏폼 레퍼런스를 확인합니다. MVP에서는 검색 링크로 연결하고, 운영에서는 허용된 API/커넥터로 메타데이터 수집을 대체합니다.",
        moments: [
          {
            time: "TikTok",
            label: "숏폼 검색 결과",
            image: tiktokImageForIntent(queryProfile.intents),
          },
        ],
      },
      "TikTok",
    ),
  ];
}

function sourceBoost(reference, query) {
  const source = normalizeSource(reference.source);
  const adIntent = /광고|소재|캠페인|레퍼런스|숏폼|틱톡|tiktok/i.test(query);
  if (source === "TVCF") return adIntent ? 18 : 10;
  if (source === "비드폴리오") return adIntent ? 17 : 9;
  if (source === "드롭샷") return adIntent ? 15 : 8;
  if (source === "TikTok") return adIntent ? 14 : 6;
  return 0;
}

function sourceSummary(results) {
  return results.reduce((summary, reference) => {
    const source = normalizeSource(reference.source);
    summary[source] = (summary[source] || 0) + 1;
    return summary;
  }, {});
}

function sourceSortRank(reference) {
  const source = normalizeSource(reference.source);
  if (source === "TVCF") return 50;
  if (source === "비드폴리오") return 48;
  if (source === "드롭샷") return 45;
  if (source === "TikTok") return 42;
  return 0;
}

function score(reference, query, index) {
  const profile = buildQueryProfile(query);
  const { baseTokens, expandedTokens, phrases, intents, productIntentTokens } = profile;
  const source = normalizeSource(reference.source);
  const haystack = buildHaystack(reference);
  const compactHaystack = compactText(haystack);
  const titleText = String(reference.title || "").toLowerCase();
  const productHaystack = [
    reference.title,
    reference.category,
    ...(reference.keywords || []),
  ]
    .join(" ")
    .toLowerCase();
  const productIntent = /제품|용품|장비|브랜드|리뷰|후기|구매|추천|신발|등산화|배낭|백팩|텐트|랜턴|스틱|재킷|자켓|의류/.test(
    query,
  ) || productIntentTokens.length > 0;
  const directEvidence = unique(baseTokens.map((token) => tokenEvidence(reference, token))).filter(Boolean);
  const matched = unique(directEvidence.map((evidence) => evidence.token));
  const expandedMatched = unique(
    expandedTokens.filter((token) => compactHaystack.includes(compactText(token))),
  );
  const phraseMatched = phrases.filter((phrase) => compactHaystack.includes(compactText(phrase)));
  const coverage = baseTokens.length ? matched.length / baseTokens.length : 0;
  const categoryMatch = intents.some((intent) => {
    if (intent === "아웃도어") {
      return /등산|캠핑|백패킹|차박|아웃도어|트레킹|하이킹|클라이밍|등산화|배낭|백팩|고어텍스|텐트|랜턴|스틱|낚시/.test(
        [
          reference.title,
          reference.category,
          reference.description,
          ...(reference.keywords || []),
        ].join(" "),
      );
    }
    return [
      reference.title,
      reference.category,
      reference.description,
      ...(reference.keywords || []),
    ].join(" ").includes(intent);
  });
  const productSignal = /리뷰|후기|사용기|제품|용품|장비|브랜드|구매|언박싱|아울렛|기능성|추천|등산화|배낭|백팩|텐트|쉘터|랜턴|스틱|착용|재킷|자켓|고어텍스|방수/.test(
    productHaystack,
  );
  const evidenceScore = directEvidence.reduce((sum, evidence) => sum + evidence.weight, 0);
  const phraseScore = phraseMatched.length * 12;
  const expandedScore = Math.min(18, expandedMatched.length * 4);
  const coverageScore = Math.round(coverage * 28);
  const lowCoveragePenalty = baseTokens.length >= 3 && coverage < 0.34 ? 22 : 0;
  const categoryIntentPenalty = intents.length > 0 && !categoryMatch && coverage < 0.6 ? 42 : 0;
  const longFormPenalty = productIntent && reference.seconds > 900 ? 14 : 0;
  const noProductSignalPenalty = productIntent && !productSignal ? 18 : 0;
  const productMatched = [...matched, ...phraseMatched].some((term) =>
    /제품|용품|장비|리뷰|후기|구매|추천|등산화|배낭|백팩|텐트|쉘터|랜턴|스틱|재킷|자켓/.test(term),
  );

  if (!matched.length && !categoryMatch && !expandedMatched.length && !phraseMatched.length) return null;
  if (baseTokens.length >= 3 && coverage < 0.2 && !phraseMatched.length && !categoryMatch) return null;
  if (productIntent && source === "YouTube" && !productSignal && !productMatched) return null;

  const viewScore = Math.min(10, Math.log10((reference.views || 0) + 1) * 1.5);
  const rawMatch =
    18 +
        evidenceScore +
        phraseScore +
        expandedScore +
        coverageScore +
        (categoryMatch ? 18 : 0) +
        (titleText.includes(baseTokens[0] || "") ? 8 : 0) +
        (productIntent && productSignal ? 12 : 0) +
        (!productIntent && productSignal ? 4 : 0) +
        sourceBoost(reference, query) +
        viewScore -
        lowCoveragePenalty -
        categoryIntentPenalty -
        noProductSignalPenalty -
        longFormPenalty -
        index * 0.001;
  const match = Math.round(Math.min(98, intents.length > 0 && !categoryMatch ? Math.min(rawMatch, 64) : rawMatch));
  if (match < 35) return null;
  const displayMatches = unique([...matched, ...phraseMatched, ...expandedMatched]).slice(0, 10);

  return {
    ...reference,
    source,
    match,
    matchedTerms: displayMatches,
    queryCoverage: Math.round(coverage * 100),
    hasEvidence: true,
    reason:
      displayMatches.length > 0
        ? `${displayMatches.slice(0, 4).join(", ")} 조합과 연결된 ${source} 레퍼런스입니다.`
        : `${reference.category} 카테고리와 연결된 ${source} 레퍼런스입니다.`,
  };
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
  });
  response.end(JSON.stringify(body));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        reject(new Error("request_body_too_large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error("invalid_json"));
      }
    });
    request.on("error", reject);
  });
}

function imageSizeForRatio(ratio) {
  return ratio === "16:9" ? "1536x1024" : "1024x1536";
}

function googleAspectRatio(ratio) {
  return ratio === "16:9" ? "16:9" : "9:16";
}

function safeFilePart(text) {
  return String(text || "image")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 44) || "image";
}

function buildImageGenerationPrompt({ query, ratio, reference, cut }) {
  return [
    "Create a realistic commercial advertising key visual.",
    "Do not add logos, readable brand names, watermarks, UI, subtitles, or text overlays.",
    "Make it original and do not copy a real video's exact frame or identifiable people.",
    `Output aspect ratio: ${ratio}.`,
    `Product/search topic: ${query}.`,
    reference?.title ? `Reference video mood/title: ${reference.title}.` : "",
    reference?.category ? `Reference category: ${reference.category}.` : "",
    reference?.description ? `Reference context: ${String(reference.description).slice(0, 700)}.` : "",
    cut?.role ? `Storyboard cut role: ${cut.role}.` : "",
    cut?.scene ? `Scene: ${cut.scene}.` : "",
    cut?.imagePrompt ? `Creative prompt: ${cut.imagePrompt}` : "",
    "Style: premium Korean advertising photography, natural light, strong product detail, cinematic but realistic, clean composition.",
  ]
    .filter(Boolean)
    .join("\n");
}

async function generateOpenAIImage({ query, ratio, reference, cut }) {
  if (!OPENAI_API_KEY) {
    const error = new Error("OPENAI_API_KEY가 필요합니다.");
    error.code = "openai_key_missing";
    throw error;
  }

  const prompt = buildImageGenerationPrompt({ query, ratio, reference, cut });
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt,
      size: imageSizeForRatio(ratio),
      quality: "low",
      n: 1,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`OpenAI image ${response.status}: ${errorText.slice(0, 240)}`);
    error.code = "openai_image_failed";
    throw error;
  }

  const payload = await response.json();
  const b64 = payload.data?.[0]?.b64_json;
  if (!b64) {
    const error = new Error("OpenAI image response did not include b64_json.");
    error.code = "openai_image_empty";
    throw error;
  }

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const fileName = `${Date.now()}-${safeFilePart(query)}-${safeFilePart(cut?.id || cut?.role)}-${Math.random().toString(36).slice(2, 8)}.png`;
  const filePath = path.join(GENERATED_DIR, fileName);
  fs.writeFileSync(filePath, Buffer.from(b64, "base64"));

  return {
    cutId: cut?.id,
    imageUrl: `/generated/${fileName}`,
    prompt,
    revisedPrompt: payload.data?.[0]?.revised_prompt || "",
  };
}

function extractGeminiImageData(payload) {
  if (payload?.output_image?.data) return payload.output_image.data;
  if (payload?.outputImage?.data) return payload.outputImage.data;

  const queue = [payload];
  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object") continue;

    const mimeType = current.mime_type || current.mimeType || "";
    if (typeof current.data === "string" && /image/i.test(mimeType)) return current.data;
    if (typeof current.inline_data?.data === "string" && /image/i.test(current.inline_data.mime_type || "")) {
      return current.inline_data.data;
    }
    if (typeof current.inlineData?.data === "string" && /image/i.test(current.inlineData.mimeType || "")) {
      return current.inlineData.data;
    }

    for (const value of Object.values(current)) {
      if (value && typeof value === "object") queue.push(value);
    }
  }

  return null;
}

async function generateGoogleImage({ query, ratio, reference, cut }) {
  if (!GEMINI_API_KEY) {
    const error = new Error("GEMINI_API_KEY가 필요합니다.");
    error.code = "google_key_missing";
    throw error;
  }

  const prompt = buildImageGenerationPrompt({ query, ratio, reference, cut });
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY,
    },
    body: JSON.stringify({
      model: GOOGLE_IMAGE_MODEL,
      input: [{ type: "text", text: prompt }],
      response_format: {
        type: "image",
        mime_type: "image/jpeg",
        aspect_ratio: googleAspectRatio(ratio),
        image_size: "1K",
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error(`Google image ${response.status}: ${errorText.slice(0, 240)}`);
    error.code = "google_image_failed";
    throw error;
  }

  const payload = await response.json();
  const b64 = extractGeminiImageData(payload);
  if (!b64) {
    const error = new Error("Google image response did not include image data.");
    error.code = "google_image_empty";
    throw error;
  }

  fs.mkdirSync(GENERATED_DIR, { recursive: true });
  const fileName = `${Date.now()}-${safeFilePart(query)}-${safeFilePart(cut?.id || cut?.role)}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const filePath = path.join(GENERATED_DIR, fileName);
  fs.writeFileSync(filePath, Buffer.from(b64, "base64"));

  return {
    cutId: cut?.id,
    imageUrl: `/generated/${fileName}`,
    prompt,
    revisedPrompt: "",
  };
}

function isGoogleImageProvider() {
  return IMAGE_PROVIDER === "google" || IMAGE_PROVIDER === "gemini";
}

function currentImageModel() {
  return isGoogleImageProvider() ? GOOGLE_IMAGE_MODEL : OPENAI_IMAGE_MODEL;
}

function imageProviderConfigured() {
  return isGoogleImageProvider() ? Boolean(GEMINI_API_KEY) : Boolean(OPENAI_API_KEY);
}

function imageProviderLabel() {
  return isGoogleImageProvider() ? "Google Gemini" : "OpenAI";
}

async function generateProviderImage(args) {
  if (isGoogleImageProvider()) return generateGoogleImage(args);
  return generateOpenAIImage(args);
}

function sendGenerationError(response, error) {
  console.warn(`[YOUCHI API] Image generation failed: ${error.message}`);
  if (error.code === "google_key_missing") {
    sendJson(response, 400, {
      error: "google_key_missing",
      message: "GEMINI_API_KEY가 필요합니다. .env에 키를 추가한 뒤 npm run api를 재시작해주세요.",
    });
    return;
  }
  if (error.code === "openai_key_missing") {
    sendJson(response, 400, {
      error: "openai_key_missing",
      message: "OPENAI_API_KEY가 필요합니다. .env에 키를 추가한 뒤 npm run api를 재시작해주세요.",
    });
    return;
  }
  if (/billing_hard_limit_reached|Billing hard limit/i.test(error.message)) {
    sendJson(response, 402, {
      error: "openai_billing_limit",
      message: "OpenAI 결제 한도에 도달했습니다. OpenAI 콘솔에서 결제 한도/크레딧을 확인한 뒤 다시 시도해주세요.",
    });
    return;
  }
  if (/PERMISSION_DENIED|permission|API key not valid|INVALID_ARGUMENT|not found|model/i.test(error.message)) {
    sendJson(response, 403, {
      error: "google_permission_required",
      message: "Gemini 이미지 모델 권한 또는 API 키 설정을 확인해주세요. Google AI Studio에서 키, 모델 권한, 사용 가능 지역을 다시 확인하면 됩니다.",
    });
    return;
  }
  if (/RESOURCE_EXHAUSTED|quota|billing|limit/i.test(error.message)) {
    sendJson(response, 402, {
      error: "google_quota_required",
      message: "Gemini 이미지 생성 할당량 또는 결제 설정을 확인해주세요. Google AI Studio/Cloud의 사용량 한도와 결제 상태가 필요할 수 있습니다.",
    });
    return;
  }
  if (/insufficient_quota|quota/i.test(error.message)) {
    sendJson(response, 402, {
      error: "openai_quota_required",
      message: "OpenAI 이미지 생성 할당량이 부족합니다. 결제 상태와 사용량 한도를 확인해주세요.",
    });
    return;
  }
  sendJson(response, 502, {
    error: "image_generation_failed",
    message: "이미지 생성 중 문제가 발생했습니다. API 키, 결제 상태, 모델 권한을 확인해주세요.",
  });
}

let index;
try {
  index = JSON.parse(fs.readFileSync(INDEX_PATH, "utf8"));
} catch (error) {
  console.error(`[YOUCHI API] Cannot read ${INDEX_PATH}`);
  console.error("Run: npm run build:youtube-index");
  throw error;
}

const indexedReferences = (index.references || []).map((reference) =>
  normalizeReference(reference, "YouTube"),
);
const curatedSearchReferences = curatedReferences.map((reference) =>
  normalizeReference(reference, reference.source || "External"),
);

const server = http.createServer((request, response) => {
  if (request.method === "OPTIONS") {
    sendJson(response, 200, { ok: true });
    return;
  }

  const url = new URL(request.url, `http://127.0.0.1:${PORT}`);

  if (url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      count: indexedReferences.length + curatedSearchReferences.length,
      youtubeCount: indexedReferences.length,
      curatedCount: curatedSearchReferences.length,
      dynamicSources: ["TikTok"],
      generatedAt: index.generatedAt,
      grokConfigured: Boolean(XAI_API_KEY),
      grokModel: XAI_API_KEY ? XAI_MODEL : null,
      imageProvider: isGoogleImageProvider() ? "google" : "openai",
      imageConfigured: imageProviderConfigured(),
      imageModel: imageProviderConfigured() ? currentImageModel() : null,
    });
    return;
  }

  if (url.pathname === "/api/search") {
    const query = url.searchParams.get("q") || "";
    const limit = Math.min(Number(url.searchParams.get("limit") || 24), 120);
    if (!query.trim()) {
      sendJson(response, 200, { query, count: 0, results: [] });
      return;
    }
    const queryProfile = buildQueryProfile(query);
    const tiktokReferences = buildTikTokSearchReferences(query, queryProfile);
    const searchPool = [
      ...curatedSearchReferences,
      ...tiktokReferences,
      ...indexedReferences,
    ];

    const results = searchPool
      .map((reference, idx) => score(reference, query, idx))
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.match - a.match ||
          sourceSortRank(b) - sourceSortRank(a) ||
          (b.views || 0) - (a.views || 0),
      )
      .slice(0, limit);

    buildGrokKeywordInsights(query, results).then((insights) => {
      sendJson(response, 200, {
        query,
        count: results.length,
        totalIndexed: searchPool.length,
        sourceSummary: sourceSummary(results),
        generatedAt: index.generatedAt,
        intent: queryProfile.intents,
        queryTerms: unique([
          ...queryProfile.baseTokens,
          ...queryProfile.phrases,
          ...queryProfile.expandedTokens,
        ]).slice(0, 20),
        insights,
        results,
      });
    });
    return;
  }

  if (url.pathname === "/api/creative/images" && request.method === "POST") {
    readJsonBody(request)
      .then(async (body) => {
        const cuts = Array.isArray(body.cuts) ? body.cuts.slice(0, 6) : [];
        if (!cuts.length) {
          sendJson(response, 400, { error: "cuts_required" });
          return;
        }

        const images = [];
        for (const cut of cuts) {
          images.push(
            await generateProviderImage({
              query: body.query || "",
              ratio: body.ratio || "9:16",
              reference: body.reference || null,
              cut,
            }),
          );
        }

        sendJson(response, 200, { images });
      })
      .catch((error) => sendGenerationError(response, error));
    return;
  }

  if (url.pathname === "/api/creative/image" && request.method === "POST") {
    readJsonBody(request)
      .then(async (body) => {
        if (!body.cut) {
          sendJson(response, 400, { error: "cut_required" });
          return;
        }

        const image = await generateProviderImage({
          query: body.query || "",
          ratio: body.ratio || "9:16",
          reference: body.reference || null,
          cut: body.cut,
        });

        sendJson(response, 200, { image });
      })
      .catch((error) => sendGenerationError(response, error));
    return;
  }

  sendJson(response, 404, { error: "not_found" });
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.log(`[YOUCHI API] 이미 실행 중입니다: http://127.0.0.1:${PORT}`);
    console.log("[YOUCHI API] 새로 실행할 필요 없이 브라우저에서 그대로 검색하면 됩니다.");
    console.log("[YOUCHI API] Grok 키를 새로 적용하려면 기존 API 터미널에서 Ctrl+C 후 다시 npm run api를 실행하세요.");
    process.exit(0);
  }

  console.error("[YOUCHI API] 서버 실행 중 문제가 발생했습니다.");
  console.error(error);
  process.exit(1);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(
    `[YOUCHI API] Reference search ready on http://127.0.0.1:${PORT} (${index.count.toLocaleString()} videos)`,
  );
  console.log(
    XAI_API_KEY
      ? `[YOUCHI API] Grok connected with ${XAI_MODEL}`
      : "[YOUCHI API] Grok API key not found. Add XAI_API_KEY to .env, then restart npm run api.",
  );
  console.log(
    imageProviderConfigured()
      ? `[YOUCHI API] Image generation connected with ${imageProviderLabel()} / ${currentImageModel()}`
      : `[YOUCHI API] ${imageProviderLabel()} image key not found. Add ${isGoogleImageProvider() ? "GEMINI_API_KEY" : "OPENAI_API_KEY"} to .env for real image generation.`,
  );
});
