import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  BookmarkSimple,
  Check,
  Clock,
  Export,
  MagnifyingGlass,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import Hls from "hls.js";
import { references } from "./data";

const API_BASE = "http://127.0.0.1:8787";
const SAVED_BOARD_KEY = "youchi-saved-board";
const LEGACY_SAVED_KEY = "reframe-saved";
const DEFAULT_CONTENT_FORMAT = "long";

const contentFormatLabels = {
  long: "롱폼",
  shorts: "숏츠",
};

const intentRules = [
  ["아웃도어", ["등산", "아웃도어", "캠핑", "트레킹", "하이킹", "등산화", "백팩"]],
  ["뷰티", ["화장품", "뷰티", "피부", "스킨", "크림", "세럼"]],
  ["청량함", ["청량", "상쾌", "여름", "수분", "물", "블루"]],
  ["자연광", ["자연광", "햇살", "햇빛", "내추럴"]],
  ["빠른 편집", ["빠른", "속도감", "퀵", "리드미컬"]],
  ["미니멀", ["미니멀", "절제", "심플", "제품"]],
  ["여행", ["여행", "바다", "휴가", "관광"]],
  ["패션", ["패션", "도시", "스타일", "컬렉션"]],
  ["모션그래픽", ["모션", "그래픽", "3d", "애니메이션"]],
  ["15–30초", ["15초", "20초", "30초", "숏폼"]],
];

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
];

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function meaningfulTokens(text) {
  const normalized = genericSearchTerms.reduce(
    (current, term) => current.replaceAll(term, " "),
    text.toLowerCase(),
  );
  return tokenize(normalized).filter(
    (token) => token.length > 1 && !genericSearchTerms.includes(token),
  );
}

function buildSearchTerms(query) {
  const tokens = meaningfulTokens(query);
  const phrases = [];
  for (let size = 2; size <= 3; size += 1) {
    for (let index = 0; index <= tokens.length - size; index += 1) {
      phrases.push(tokens.slice(index, index + size).join(" "));
    }
  }
  return [...new Set([...tokens, ...phrases])].slice(0, 14);
}

function normalizeSavedBoard() {
  try {
    const savedBoard = JSON.parse(localStorage.getItem(SAVED_BOARD_KEY) || "[]");
    if (Array.isArray(savedBoard) && savedBoard.some((item) => typeof item === "object")) {
      return savedBoard.filter((item) => item?.id);
    }

    const legacySavedIds = JSON.parse(localStorage.getItem(LEGACY_SAVED_KEY) || "[]");
    if (Array.isArray(legacySavedIds)) {
      return legacySavedIds
        .map((id) => references.find((reference) => reference.id === id))
        .filter(Boolean);
    }
  } catch {
    return [];
  }
  return [];
}

function toSavedReference(reference) {
  return {
    id: reference.id,
    title: reference.title,
    source: reference.source || "YOUCHI DB",
    channel: reference.channel,
    category: reference.category,
    subscribers: reference.subscribers,
    views: reference.views,
    image: reference.image,
    originUrl: reference.originUrl,
    videoType: reference.videoType,
    videoUrl: reference.videoUrl,
    duration: reference.duration,
    seconds: reference.seconds,
    year: reference.year,
    keywords: reference.keywords || [],
    reason: reference.reason || "저장된 YOUCHI 레퍼런스입니다.",
    description: reference.description,
    moments: reference.moments || [],
    matchedTerms: reference.matchedTerms || [],
    match: reference.match || 0,
    hasEvidence: true,
    savedAt: new Date().toISOString(),
  };
}

function isShortFormReference(reference) {
  const source = `${reference.source || ""} ${reference.videoType || ""}`.toLowerCase();
  const originUrl = `${reference.originUrl || ""}`.toLowerCase();
  const text = [
    reference.title,
    reference.description,
    reference.category,
    ...(reference.keywords || []),
  ]
    .join(" ")
    .toLowerCase();
  const seconds = Number(reference.seconds || 0);
  return (
    source.includes("tiktok") ||
    originUrl.includes("/shorts/") ||
    /(^|\s|#)(shorts|쇼츠)(\s|#|$)/i.test(text) ||
    (seconds > 0 && seconds <= 60)
  );
}

function filterByContentFormat(reference, format) {
  if (format === "shorts") return isShortFormReference(reference);
  return !isShortFormReference(reference);
}

function deriveIntent(query) {
  const lower = query.toLowerCase();
  const tags = intentRules
    .filter(([, terms]) => terms.some((term) => lower.includes(term)))
    .map(([label]) => label);
  return tags.length ? tags.slice(0, 5) : ["카테고리 확인 필요", "추가 수집 필요"];
}

function buildFallbackKeywordInsights(query) {
  const tags = deriveIntent(query);
  const primaryIntent = tags[0] || "광고 레퍼런스";
  const tokens = meaningfulTokens(query);
  const outdoorKeywords = [
    "등산",
    "아웃도어",
    "백패킹",
    "등산화",
    "배낭",
    "기능성",
    "야외 촬영",
    "실사용 장면",
    "내구성",
    "제품 리뷰",
  ];
  const defaultKeywords = [
    ...tokens,
    ...(primaryIntent === "아웃도어" ? outdoorKeywords : []),
    "제품 장점",
    "사용 상황",
    "브랜드 톤",
  ];

  return {
    provider: "YOUCHI 로컬 확장",
    status: "SEO 추천",
    headline: `${query.trim()} 구글 SEO 최적화 추천`,
    summary:
      "SEO 최적화를 추천합니다. 실제 관련 키워드와 영상 방향성을 바탕으로 구글 검색 노출에 유리한 키워드와 제목을 제안합니다.",
    keywords: [...new Set(defaultKeywords)].filter(Boolean).slice(0, 6),
    angles: [
      `${query.trim()}｜고객이 바로 이해하는 ${primaryIntent} 광고 레퍼런스`,
      `${primaryIntent} 제품 사용 장면으로 보는 ${query.trim()} 제작 아이디어`,
      `${query.trim()} 광고 제목 추천: 방문과 구매를 유도하는 영상 구성`,
    ],
    avoid: [
      "검색 의도와 다른 제품군 키워드 남발",
      "이종 카테고리 과매칭",
      "제목에 실제 영상 내용과 다른 과장 키워드 사용",
    ],
    fromGrok: false,
  };
}

function buildSeoGuideTips(query) {
  const trimmed = query.trim() || "핵심 키워드";
  return [
    `"${trimmed}"처럼 핵심 키워드는 제목 앞쪽에 배치하세요.`,
    "제품군, 사용 상황, 기대 효과를 한 문장 안에 함께 넣으면 검색 의도가 더 선명해집니다.",
    "영상 썸네일·제목·설명 첫 문장의 키워드를 같은 방향으로 맞추면 SEO 일관성이 좋아집니다.",
  ];
}

function scoreReference(reference, query, index) {
  const tokens = meaningfulTokens(query);
  const haystack = [
    reference.title,
    reference.reason,
    reference.description,
    ...reference.keywords,
  ]
    .join(" ")
    .toLowerCase();
  const matchedTerms = tokens.filter(
    (token) =>
      token.length > 1 &&
      (haystack.includes(token) ||
        reference.keywords.some(
          (keyword) => token.includes(keyword) || keyword.includes(token),
        )),
  );
  const uniqueMatchedTerms = [...new Set(matchedTerms)];
  const categoryBoost = reference.keywords.filter((keyword) =>
    tokens.some((token) => token.includes(keyword) || keyword.includes(token)),
  ).length;
  return {
    match: Math.min(98, 58 + uniqueMatchedTerms.length * 12 + categoryBoost * 8 - index),
    matchedTerms: uniqueMatchedTerms,
    hasEvidence: uniqueMatchedTerms.length > 0,
  };
}

function LiveVideo({ reference }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!reference || reference.videoType !== "hls" || !videoRef.current) return;

    const video = videoRef.current;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = reference.videoUrl;
      return undefined;
    }

    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(reference.videoUrl);
      hls.attachMedia(video);
      return () => hls.destroy();
    }

    return undefined;
  }, [reference]);

  if (!reference) return null;

  if (reference.videoType === "youtube") {
    return (
      <div className="video-frame">
        <iframe
          src={reference.videoUrl}
          title={`${reference.title} 영상`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  if (reference.videoType === "hls") {
    return (
      <div className="video-frame">
        <video ref={videoRef} controls playsInline poster={reference.image} />
      </div>
    );
  }

  return (
    <div className="video-frame external-preview">
      <img src={reference.image} alt={`${reference.title} 영상 스틸`} />
      <a href={reference.originUrl} target="_blank" rel="noreferrer">
        원본 페이지에서 재생
      </a>
    </div>
  );
}

function buildCreativePrompt(type, query, insights) {
  const keywords = insights.keywords.slice(0, 8).join(", ");
  const angles = insights.angles.slice(0, 3).join(" / ");
  const avoid = insights.avoid.slice(0, 3).join(" / ");

  if (type === "image") {
    return [
      "[이미지 콘셉트]",
      `주제: ${query} 광고 키비주얼`,
      `핵심 키워드: ${keywords}`,
      `장면: 제품이 실제 사용 상황 안에서 자연스럽게 드러나는 광고 컷`,
      `표현 방향: ${angles}`,
      "스타일: 프리미엄 브랜드 광고, 실제 촬영 느낌, 자연광, 선명한 제품 디테일, 과장되지 않은 리얼 톤",
      "구도: 제품과 사용자가 함께 보이고, 첫눈에 제품군이 이해되는 중심 구도",
      `피해야 할 방향: ${avoid}`,
    ].join("\n");
  }

  return [
    "[영상 프롬프트]",
    `주제: ${query} 광고 레퍼런스 기반 15초 숏폼 영상`,
    `핵심 키워드: ${keywords}`,
    "0–3초: 제품군과 사용 상황이 바로 보이는 후킹 컷",
    "3–8초: 제품의 기능/장점이 드러나는 실제 사용 장면",
    "8–12초: 소비자가 얻는 감정이나 결과를 보여주는 전환 컷",
    "12–15초: 제품 클로즈업과 브랜드 메시지로 마무리",
    `소재 방향: ${angles}`,
    "편집 톤: 빠른 리듬, 명확한 컷 전환, 광고 소재로 바로 활용 가능한 구조",
    `피해야 할 방향: ${avoid}`,
  ].join("\n");
}

function referenceContext(reference, query) {
  if (!reference) return query;
  return [
    query,
    reference.title,
    reference.category,
    reference.channel,
    reference.description,
    ...(reference.keywords || []),
  ]
    .filter(Boolean)
    .join(" · ");
}

const cutBlueprints = [
  {
    role: "후킹",
    title: "첫눈에 제품군이 보이는 장면",
    scene: "제품과 사용 상황을 동시에 보여주는 강한 첫 컷",
    motion: "천천히 줌인",
  },
  {
    role: "문제 상황",
    title: "소비자가 공감할 사용 전 상황",
    scene: "불편함이나 필요가 자연스럽게 드러나는 장면",
    motion: "인물을 따라가는 부드러운 이동",
  },
  {
    role: "제품 등장",
    title: "제품이 자연스럽게 등장하는 장면",
    scene: "제품이 문제 해결의 중심으로 들어오는 장면",
    motion: "제품 쪽으로 카메라 이동",
  },
  {
    role: "기능 강조",
    title: "핵심 장점이 보이는 디테일 컷",
    scene: "제품 기능과 소재감이 명확하게 보이는 클로즈업",
    motion: "디테일을 훑는 패닝",
  },
  {
    role: "사용 결과",
    title: "사용 후 감정과 효과가 보이는 장면",
    scene: "사용자가 얻는 만족감과 변화가 드러나는 장면",
    motion: "느린 슬로우 모션",
  },
  {
    role: "엔딩",
    title: "브랜드와 제품을 기억시키는 마무리",
    scene: "제품 클로즈업과 메시지로 마무리하는 엔딩 컷",
    motion: "고정 컷 후 페이드아웃",
  },
];

function makeStoryboardCuts(query, insights, ratio, reference, generation = 1) {
  const keywords = insights.keywords.slice(0, 6).join(", ");
  const style = insights.angles.slice(0, 2).join(" / ");
  const sourceContext = referenceContext(reference, query);

  return cutBlueprints.map((cut, index) => ({
    id: `cut-${index + 1}`,
    number: index + 1,
    role: cut.role,
    title: cut.title,
    scene: cut.scene,
    motion: cut.motion,
    ratio,
    imageVersion: generation,
    videoVersion: 0,
    imageApproved: false,
    videoApproved: false,
    referenceTitle: reference?.title || "",
    imagePrompt: [
      `${query} 광고 ${index + 1}컷`,
      reference ? `참고 레퍼런스: ${reference.title}` : "",
      `역할: ${cut.role}`,
      `장면: ${cut.scene}`,
      `키워드: ${keywords}`,
      `레퍼런스 맥락: ${sourceContext}`,
      `스타일: ${style || "실제 광고 촬영, 자연광, 선명한 제품 디테일"}`,
      `화면비: ${ratio}`,
    ]
      .filter(Boolean)
      .join("\n"),
  }));
}

function SelectedReferenceCard({ reference }) {
  if (!reference) {
    return (
      <div className="selected-reference empty">
        <span className="eyebrow">Selected reference</span>
        <h3>왼쪽에서 레퍼런스 영상을 선택해 주세요</h3>
        <p>
          선택한 영상의 제목, 카테고리, 키워드, 썸네일 정보를 바탕으로 유사한
          6컷 이미지 제작 플로우가 시작됩니다.
        </p>
      </div>
    );
  }

  return (
    <div className="selected-reference">
      <span className="eyebrow">Selected reference</span>
      <div className="selected-reference-card">
        <img src={reference.image} alt="" />
        <div>
          <h3>{reference.title}</h3>
          <p>
            {reference.source} · {reference.category || "카테고리 없음"} ·{" "}
            {reference.duration}
          </p>
          <a href={reference.originUrl} target="_blank" rel="noreferrer">
            원본 영상 보기
          </a>
        </div>
      </div>
      <p className="reference-summary">
        이 레퍼런스의 무드와 장면 구성을 참고해, 직접 복제하지 않고 유사한 광고
        이미지 6컷을 만듭니다.
      </p>
    </div>
  );
}

function ProductionFlow({ query, insights, selectedReference }) {
  const [ratio, setRatio] = useState("9:16");
  const [cuts, setCuts] = useState([]);
  const [storyboardVersion, setStoryboardVersion] = useState(1);
  const [finalOutput, setFinalOutput] = useState(null);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [productionError, setProductionError] = useState("");

  const hasImages = cuts.length === 6;
  const allImagesApproved =
    hasImages && cuts.every((cut) => cut.imageUrl && cut.imageApproved);
  const hasVideos = hasImages && cuts.every((cut) => cut.videoVersion > 0);
  const allVideosApproved = hasVideos && cuts.every((cut) => cut.videoApproved);

  useEffect(() => {
    setCuts([]);
    setFinalOutput(null);
    setStoryboardVersion(1);
    setProductionError("");
    setImageGenerating(false);
  }, [selectedReference?.id]);

  async function createStoryboard() {
    if (!selectedReference) return;
    const nextCuts = makeStoryboardCuts(
      query,
      insights,
      ratio,
      selectedReference,
      storyboardVersion,
    );
    setCuts(
      nextCuts.map((cut) => ({
        ...cut,
        imageStatus: "generating",
      })),
    );
    setStoryboardVersion((version) => version + 1);
    setFinalOutput(null);
    setProductionError("");
    setImageGenerating(true);

    try {
      const response = await fetch(`${API_BASE}/api/creative/images`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          ratio,
          reference: selectedReference,
          cuts: nextCuts,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "이미지 생성 실패");

      const imagesByCut = new Map(
        (payload.images || []).map((image) => [image.cutId, image]),
      );
      setCuts((current) =>
        current.map((cut) => {
          const image = imagesByCut.get(cut.id);
          return image
            ? {
                ...cut,
                imageUrl: image.imageUrl,
                imageStatus: "generated",
                revisedPrompt: image.revisedPrompt,
              }
            : { ...cut, imageStatus: "failed" };
        }),
      );
    } catch (error) {
      setProductionError(error.message);
      setCuts((current) =>
        current.map((cut) => ({
          ...cut,
          imageStatus: "failed",
        })),
      );
    } finally {
      setImageGenerating(false);
    }
  }

  function updateCut(cutId, updater) {
    setCuts((current) =>
      current.map((cut) => (cut.id === cutId ? updater(cut) : cut)),
    );
    setFinalOutput(null);
  }

  async function regenerateImage(cutId) {
    const target = cuts.find((cut) => cut.id === cutId);
    if (!target || !selectedReference) return;

    const nextCut = {
      ...target,
      imageVersion: target.imageVersion + 1,
      imageApproved: false,
      videoVersion: 0,
      videoApproved: false,
      imageStatus: "generating",
      imagePrompt: `${target.imagePrompt}\n재생성 요청: 같은 콘셉트 유지, 구도와 제품 표현만 개선 · v${target.imageVersion + 1}`,
    };

    updateCut(cutId, () => nextCut);
    setProductionError("");

    try {
      const response = await fetch(`${API_BASE}/api/creative/image`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          query,
          ratio,
          reference: selectedReference,
          cut: nextCut,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || "이미지 재생성 실패");

      updateCut(cutId, (cut) => ({
        ...cut,
        imageUrl: payload.image.imageUrl,
        imageStatus: "generated",
        revisedPrompt: payload.image.revisedPrompt,
      }));
    } catch (error) {
      setProductionError(error.message);
      updateCut(cutId, (cut) => ({
        ...cut,
        imageStatus: "failed",
      }));
    }
  }

  function createVideos() {
    setCuts((current) =>
      current.map((cut) => ({
        ...cut,
        videoVersion: cut.videoVersion || 1,
        videoApproved: false,
      })),
    );
    setFinalOutput(null);
  }

  function regenerateVideo(cutId) {
    updateCut(cutId, (cut) => ({
      ...cut,
      videoVersion: cut.videoVersion + 1,
      videoApproved: false,
    }));
  }

  function renderFinal() {
    setFinalOutput({
      name: `YOUCHI_${query.replace(/\s+/g, "_")}_${ratio.replace(":", "x")}_reference_based_6cuts.mp4`,
      duration: "15초",
      status: "MP4 렌더링 준비 완료",
    });
  }

  return (
    <div className="production-flow">
      <div className="production-flow-head">
        <span className="eyebrow">Ad production flow</span>
        <h3>레퍼런스 기반 제작 플로우</h3>
        <p>
          선택한 영상을 바탕으로 유사한 6컷 이미지를 만들고, 선택한 이미지를
          영상화한 뒤 최종 MP4로 합칩니다.
        </p>
      </div>

      <div className="production-step">
        <div className="step-title">
          <strong>1. 레퍼런스 기반 이미지 6컷 만들기</strong>
          <span>
            {hasImages
              ? "6컷 준비됨"
              : selectedReference
                ? "비율 선택 필요"
                : "레퍼런스 선택 필요"}
          </span>
        </div>
        <div className="ratio-selector" aria-label="화면 비율 선택">
          {["16:9", "9:16"].map((value) => (
            <button
              type="button"
              className={ratio === value ? "selected" : ""}
              key={value}
              onClick={() => setRatio(value)}
            >
              {value === "16:9" ? "16:9 가로형" : "9:16 숏폼형"}
            </button>
          ))}
        </div>
        <button
          className="primary-flow-button"
          type="button"
          disabled={!selectedReference || imageGenerating}
          onClick={createStoryboard}
        >
          {imageGenerating ? "AI 이미지 생성 중…" : "레퍼런스 기반 이미지 6컷 만들기"}
        </button>
      </div>

      {productionError && (
        <div className="production-error">
          {productionError}
        </div>
      )}

      {hasImages && (
        <div className="cut-grid">
          {cuts.map((cut) => (
            <article className="cut-card" key={cut.id}>
              <div className={`cut-preview ratio-${cut.ratio.replace(":", "-")}`}>
                {cut.imageUrl ? (
                  <img src={cut.imageUrl} alt={`${cut.role} 생성 이미지`} />
                ) : (
                  <>
                    <span>CUT {String(cut.number).padStart(2, "0")}</span>
                    <strong>
                      {cut.imageStatus === "generating"
                        ? "AI 이미지 생성 중"
                        : cut.imageStatus === "failed"
                          ? "이미지 생성 필요"
                          : cut.role}
                    </strong>
                    <small>image v{cut.imageVersion}</small>
                  </>
                )}
                {cut.imageUrl && (
                  <>
                    <span>CUT {String(cut.number).padStart(2, "0")}</span>
                    <small>image v{cut.imageVersion}</small>
                  </>
                )}
              </div>
              <div className="cut-body">
                <h4>{cut.title}</h4>
                <p>{cut.scene}</p>
                {cut.referenceTitle && <em>기반 레퍼런스: {cut.referenceTitle}</em>}
                <div className="cut-actions">
                  <button
                    type="button"
                    disabled={cut.imageStatus === "generating"}
                    onClick={() => regenerateImage(cut.id)}
                  >
                    {cut.imageStatus === "generating" ? "생성 중…" : "이미지 재생성"}
                  </button>
                  <button
                    type="button"
                    className={cut.imageApproved ? "approved" : ""}
                    disabled={!cut.imageUrl || cut.imageStatus === "generating"}
                    onClick={() =>
                      updateCut(cut.id, (current) => ({
                        ...current,
                        imageApproved: !current.imageApproved,
                      }))
                    }
                  >
                    {cut.imageApproved ? "확정됨" : "이 컷 확정"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="production-step">
        <div className="step-title">
          <strong>2. 영상화 하기</strong>
          <span>{hasVideos ? "모션 컷 준비됨" : "이미지 6컷 확정 후 가능"}</span>
        </div>
        <button
          className="primary-flow-button"
          type="button"
          disabled={!allImagesApproved}
          onClick={createVideos}
        >
          영상화 하기
        </button>
      </div>

      {hasVideos && (
        <div className="motion-list">
          {cuts.map((cut) => (
            <article className="motion-card" key={`${cut.id}-motion`}>
              <div>
                <span>CUT {cut.number}</span>
                <strong>{cut.motion}</strong>
                <p>video v{cut.videoVersion}</p>
              </div>
              <div className="cut-actions">
                <button type="button" onClick={() => regenerateVideo(cut.id)}>
                  영상 재생성
                </button>
                <button
                  type="button"
                  className={cut.videoApproved ? "approved" : ""}
                  onClick={() =>
                    updateCut(cut.id, (current) => ({
                      ...current,
                      videoApproved: !current.videoApproved,
                    }))
                  }
                >
                  {cut.videoApproved ? "확정됨" : "영상 확정"}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <div className="production-step">
        <div className="step-title">
          <strong>3. 최종 결과물 생성</strong>
          <span>{allVideosApproved ? "MP4 생성 가능" : "영상 6컷 확정 후 가능"}</span>
        </div>
        <button
          className="primary-flow-button"
          type="button"
          disabled={!allVideosApproved}
          onClick={renderFinal}
        >
          최종 결과물 생성
        </button>
      </div>

      {finalOutput && (
        <div className="final-output">
          <strong>{finalOutput.status}</strong>
          <p>{finalOutput.name}</p>
          <span>{ratio} · {finalOutput.duration} · 6컷 연결</span>
        </div>
      )}
    </div>
  );
}

function KeywordInsightPanel({
  query,
  insights,
  loading,
  onKeywordClick,
  selectedReference,
}) {
  const data = insights || buildFallbackKeywordInsights(query);
  const seoGuideTips = buildSeoGuideTips(query);

  return (
    <aside className="grok-panel" aria-label="구글 SEO 키워드와 제목 추천">
      <SelectedReferenceCard reference={selectedReference} />
      <div className="grok-panel-header">
        <div>
          <span className="eyebrow">Google SEO insight</span>
          <h2>SEO 키워드·제목 추천</h2>
        </div>
      </div>
      <div className="grok-query">
        <span>입력 키워드</span>
        <strong>{query}</strong>
      </div>
      <p className="grok-summary">{loading ? "SEO 키워드와 제목 추천을 불러오는 중입니다." : data.summary}</p>
      <div className="grok-section">
        <h3>SEO 최적화 제목 샘플 3개</h3>
        <ul>
          {data.angles.slice(0, 3).map((angle) => (
            <li key={angle}>{angle}</li>
          ))}
        </ul>
      </div>
      <div className="grok-section keyword-section">
        <h3>키워드 검색 추천 5–6개</h3>
        <div className="keyword-cloud">
          {data.keywords.slice(0, 6).map((keyword) => (
            <button type="button" key={keyword} onClick={() => onKeywordClick(keyword)}>
              {keyword}
            </button>
          ))}
        </div>
      </div>
      <div className="grok-section tip">
        <h3>TIP. SEO 최적화 가이드</h3>
        <ul>
          {seoGuideTips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </div>
      <div className="grok-section avoid">
        <h3>TIP. 피해야 할 사항</h3>
        <ul>
          {data.avoid.slice(0, 3).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
      <ProductionFlow
        query={query}
        insights={data}
        selectedReference={selectedReference}
      />
    </aside>
  );
}

export function App() {
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [intent, setIntent] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [sort, setSort] = useState("related");
  const [contentFormat, setContentFormat] = useState(DEFAULT_CONTENT_FORMAT);
  const [loading, setLoading] = useState(false);
  const [savedOnly, setSavedOnly] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [apiResults, setApiResults] = useState([]);
  const [searchMeta, setSearchMeta] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [keywordInsights, setKeywordInsights] = useState(null);
  const [savedItems, setSavedItems] = useState(() => normalizeSavedBoard());
  const searchTimer = useRef();

  useEffect(() => {
    localStorage.setItem(SAVED_BOARD_KEY, JSON.stringify(savedItems));
    localStorage.setItem(LEGACY_SAVED_KEY, JSON.stringify(savedItems.map((item) => item.id)));
  }, [savedItems]);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const savedIds = useMemo(() => new Set(savedItems.map((item) => item.id)), [savedItems]);

  const allRankedResults = useMemo(() => {
    if (savedOnly) {
      const ranked = [...savedItems];
      if (sort === "latest") ranked.sort((a, b) => (b.year || 0) - (a.year || 0));
      else if (sort === "duration") ranked.sort((a, b) => (a.seconds || 0) - (b.seconds || 0));
      else ranked.sort((a, b) => new Date(b.savedAt || 0) - new Date(a.savedAt || 0));
      return ranked;
    }

    if (!hasSearched) return [];

    const ranked = searchMeta?.usedRemote
      ? [...apiResults]
      : references.map((reference, index) => ({
          ...reference,
          ...scoreReference(reference, submittedQuery, index),
        }));
    if (sort === "latest") ranked.sort((a, b) => b.year - a.year);
    else if (sort === "duration") ranked.sort((a, b) => a.seconds - b.seconds);
    else ranked.sort((a, b) => b.match - a.match);
    return ranked.filter((reference) => reference.hasEvidence);
  }, [apiResults, hasSearched, savedItems, savedOnly, searchMeta, sort, submittedQuery]);

  const formatCounts = useMemo(() => {
    if (savedOnly) return { long: 0, shorts: 0 };
    return allRankedResults.reduce(
      (counts, reference) => {
        counts[isShortFormReference(reference) ? "shorts" : "long"] += 1;
        return counts;
      },
      { long: 0, shorts: 0 },
    );
  }, [allRankedResults, savedOnly]);

  const rankedResults = useMemo(() => {
    if (savedOnly) return allRankedResults;
    return allRankedResults
      .filter((reference) => filterByContentFormat(reference, contentFormat))
      .slice(0, 50);
  }, [allRankedResults, contentFormat, savedOnly]);

  const selected =
    selectedId === null
      ? null
      : rankedResults.find((reference) => reference.id === selectedId) ||
        savedItems.find((reference) => reference.id === selectedId) ||
        references.find((reference) => reference.id === selectedId) ||
        null;

  function submitSearch(event) {
    event?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearchError("");
    setKeywordInsights(null);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const nextQuery = query.trim();
      setSubmittedQuery(nextQuery);
      setSort("related");
      setContentFormat(DEFAULT_CONTENT_FORMAT);
      setSavedOnly(false);
      setSelectedId(null);
      setHasSearched(true);
      try {
        const response = await fetch(
          `${API_BASE}/api/search?q=${encodeURIComponent(nextQuery)}&limit=120`,
        );
        if (!response.ok) throw new Error(`API ${response.status}`);
        const payload = await response.json();
        setApiResults(payload.results || []);
        setSearchMeta({
          usedRemote: true,
          generatedAt: payload.generatedAt,
          queryTerms: payload.queryTerms || buildSearchTerms(nextQuery),
        });
        setIntent(payload.intent?.length ? payload.intent : deriveIntent(nextQuery));
        setKeywordInsights(payload.insights || buildFallbackKeywordInsights(nextQuery));
      } catch {
        setApiResults([]);
        setSearchMeta({ usedRemote: false, queryTerms: buildSearchTerms(nextQuery) });
        setIntent(deriveIntent(nextQuery));
        setKeywordInsights(buildFallbackKeywordInsights(nextQuery));
        setSearchError(
          "YOUCHI DB 검색 API가 꺼져 있습니다. 터미널에서 npm run api를 실행한 뒤 다시 검색해주세요.",
        );
      } finally {
        setLoading(false);
      }
    }, 650);
  }

  function toggleSavedOnly() {
    clearTimeout(searchTimer.current);
    setSelectedId(null);
    setContentFormat(DEFAULT_CONTENT_FORMAT);
    setLoading(false);
    setSearchError("");

    if (savedOnly) {
      setSavedOnly(false);
      if (submittedQuery === "저장된 보드") goHome();
      return;
    }

    setSavedOnly(true);
    setHasSearched(true);
    if (!submittedQuery) setSubmittedQuery("저장된 보드");
    setIntent(["저장된 보드"]);
    setSearchMeta({ usedRemote: false, queryTerms: [] });
    setKeywordInsights(buildFallbackKeywordInsights("저장된 보드"));
  }

  function selectContentFormat(format) {
    setContentFormat(format);
    setSelectedId(null);
  }

  function goHome() {
    clearTimeout(searchTimer.current);
    setQuery("");
    setSubmittedQuery("");
    setIntent([]);
    setSelectedId(null);
    setSort("related");
    setContentFormat(DEFAULT_CONTENT_FORMAT);
    setLoading(false);
    setSavedOnly(false);
    setHasSearched(false);
    setApiResults([]);
    setSearchMeta(null);
    setSearchError("");
    setKeywordInsights(null);
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function toggleSavedReference(reference) {
    setSavedItems((current) =>
      current.some((item) => item.id === reference.id)
        ? current.filter((item) => item.id !== reference.id)
        : [toSavedReference(reference), ...current],
    );
  }

  const suggestionKeywords = useMemo(() => {
    const pool = [
      "신제품 런칭 광고를 만들고 싶어요",
      "고객 후기를 활용한 제품 광고가 필요해요",
      "시즌 프로모션용 숏폼 광고를 찾고 있어요",
      "제품 사용 장면이 잘 보이는 광고를 만들고 싶어요",
      "브랜드 인지도를 높이는 감성 광고를 찾고 있어요",
      "오프라인 매장 방문을 유도하는 광고가 필요해요",
      "프리미엄한 제품 이미지를 보여주는 광고를 만들고 싶어요",
      "짧은 시간 안에 장점이 바로 보이는 광고가 필요해요",
      "SNS에서 공유되기 좋은 숏폼 광고를 찾고 있어요",
      "구매 전환을 높이는 제품 비교 광고를 만들고 싶어요",
      "시즌 한정 이벤트를 알리는 광고가 필요해요",
      "처음 보는 고객도 이해하기 쉬운 설명형 광고를 찾고 있어요",
    ];
    return [...pool].sort(() => Math.random() - 0.5).slice(0, 4);
  }, []);

  return (
    <div className={`app-shell ${!hasSearched ? "home-mode" : "results-mode"}`}>
      <header className="topbar">
        <button className="brand-mark" type="button" onClick={goHome}>
          YOUCHI
        </button>
        <div className="top-actions">
          <button className="home-link" onClick={goHome}>
            홈으로
          </button>
          <button
            className={`saved-link ${savedOnly ? "is-active" : ""}`}
            onClick={toggleSavedOnly}
          >
            <BookmarkSimple size={21} weight={savedOnly ? "fill" : "regular"} />
            저장된 보드
            {savedItems.length > 0 && <span className="saved-count">{savedItems.length}</span>}
          </button>
        </div>
      </header>

      <main className="workspace">
        <section className="catalog">
          {!hasSearched && (
            <div className="hero-heading">
              <h1>AI Ad Conceptor</h1>
              <p>단 한 줄의 키워드로 브랜드 스토리와 광고 소재를 즉시 시각화 하세요.</p>
            </div>
          )}
          {!savedOnly && (
            <form className="prompt-box" onSubmit={submitSearch}>
              {!hasSearched && (
                <div className="prompt-kicker">
                  <Sparkle size={16} weight="fill" />
                  NEW GENERATION AI
                </div>
              )}
              <div className="prompt-row">
                <Sparkle className="prompt-icon" size={24} weight="fill" />
                <textarea
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      submitSearch();
                    }
                  }}
                  aria-label="광고 소재 자연어 검색"
                  placeholder={
                    hasSearched
                      ? "키워드를 입력해 주세요"
                      : "키워드를 입력해 주세요\n예: 도심 속의 시원한 수제 맥주, 미니멀한 라이프스타일 가구"
                  }
                  rows={2}
                />
                <button className="search-submit" type="submit" aria-label="검색">
                  {loading ? (
                    <span className="spinner" />
                  ) : (
                    <>
                      <span>{hasSearched ? "검색" : "생성하기"}</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </div>
              {hasSearched ? (
                <div className="search-analysis">
                  <div className="intent-row">
                    <span>의도 파악</span>
                    {intent.map((tag) => (
                      <button
                        type="button"
                        className="intent-chip"
                        key={tag}
                        onClick={() => {
                          if (!query.includes(tag)) setQuery(`${query}, ${tag}`);
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                  {searchMeta?.queryTerms?.length > 0 && (
                    <div className="query-combo-row">
                      <span>검색 조합</span>
                      {searchMeta.queryTerms.slice(0, 12).map((term) => (
                        <button
                          type="button"
                          className="query-combo-chip"
                          key={term}
                          onClick={() => {
                            if (!query.includes(term)) setQuery(`${query}, ${term}`);
                          }}
                        >
                          {term}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="prompt-helper">
                  <div className="prompt-tools">
                    <span>옵션 설정</span>
                    <span>한국어</span>
                  </div>
                </div>
              )}
            </form>
          )}

          {!hasSearched ? (
            <div className="landing-state">
              <div className="suggestion-row">
                <span>추천 소재:</span>
                {suggestionKeywords.map((keyword) => (
                  <button
                    type="button"
                    key={keyword}
                    onClick={() => setQuery(keyword)}
                  >
                    {keyword}
                  </button>
                ))}
              </div>
              <p>© 2026 YOUCHI AI Creative Suite. All rights reserved.</p>
            </div>
          ) : (
            <div className={`search-results-layout ${savedOnly ? "saved-board-layout" : ""}`}>
              <section
                className={`reference-results ${savedOnly ? "saved-board-results" : ""}`}
                aria-label="영상 레퍼런스 결과"
              >
                <div className="results-toolbar">
                  <div className="results-heading">
                    <span>{savedOnly ? "SAVED BOARD" : "REFERENCE SEARCH"}</span>
                    <h2>{savedOnly ? "저장된 보드" : submittedQuery}</h2>
                    <p>
                      {savedOnly
                        ? "저장해 둔 레퍼런스 영상만 모아 보여줍니다."
                        : "YOUCHI DB에서 의미가 가까운 영상 레퍼런스를 정렬했습니다."}
                      <strong>{rankedResults.length}개</strong>
                    </p>
                  </div>
                  <label>
                    정렬
                    <select value={sort} onChange={(event) => setSort(event.target.value)}>
                      <option value="related">관련도순</option>
                      <option value="latest">최신순</option>
                      <option value="duration">짧은 영상순</option>
                    </select>
                  </label>
                  {!savedOnly && (
                    <div className="format-toggle" aria-label="영상 형식 선택">
                      {Object.entries(contentFormatLabels).map(([format, label]) => (
                        <button
                          type="button"
                          key={format}
                          className={contentFormat === format ? "active" : ""}
                          onClick={() => selectContentFormat(format)}
                        >
                          {label}
                          <span>{formatCounts[format] || 0}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {rankedResults.length ? (
                  <div className="results-grid">
                    {rankedResults.map((reference) => (
                      <article
                        className={`video-card ${
                          selectedId === reference.id ? "selected" : ""
                        }`}
                        key={reference.id}
                      >
                        <button
                          className="thumbnail-button"
                          aria-label={`${reference.title} 상세 보기`}
                          type="button"
                          onClick={() => setSelectedId(reference.id)}
                        >
                          <img src={reference.image} alt="" />
                          <span className="duration">{reference.duration}</span>
                          <span className="play-hint">
                            <ArrowRight size={18} />
                          </span>
                        </button>
                        <div className="card-title-row">
                          <h2>
                            <a href={reference.originUrl} target="_blank" rel="noreferrer">
                              {reference.title}
                            </a>
                          </h2>
                          <a
                            className="source-badge"
                            href={reference.originUrl}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {reference.channel || reference.source}
                          </a>
                          <span className="card-time">{reference.duration}</span>
                        </div>
                        <button
                          className={`card-save-button ${savedIds.has(reference.id) ? "saved" : ""}`}
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            toggleSavedReference(reference);
                          }}
                        >
                          <BookmarkSimple size={15} weight={savedIds.has(reference.id) ? "fill" : "regular"} />
                          {savedIds.has(reference.id) ? "저장됨" : "보드 저장"}
                        </button>
                        <p>{reference.reason}</p>
                        {reference.matchedTerms?.length > 0 && (
                          <div className="matched-terms">
                            {reference.matchedTerms.slice(0, 5).map((term) => (
                              <span key={term}>{term}</span>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <MagnifyingGlass size={32} />
                    <h2>{savedOnly ? "저장된 영상이 아직 없습니다" : "검색 결과가 없습니다"}</h2>
                    <p>
                      {searchError ||
                        (savedOnly
                        ? "마음에 드는 레퍼런스를 열고 보드에 저장해보세요."
                        : "현재 인덱스에 해당 카테고리의 실제 레퍼런스가 없습니다. 소스 수집 범위를 넓히거나 카테고리를 추가해야 합니다.")}
                    </p>
                    {savedOnly && (
                      <button onClick={submittedQuery === "저장된 보드" ? goHome : () => setSavedOnly(false)}>
                        {submittedQuery === "저장된 보드" ? "홈으로" : "전체 결과 보기"}
                      </button>
                    )}
                  </div>
                )}
              </section>

              {!savedOnly && (
                <KeywordInsightPanel
                  query={submittedQuery}
                  insights={keywordInsights}
                  loading={loading}
                  selectedReference={selected}
                  onKeywordClick={(keyword) => {
                    if (!query.includes(keyword)) setQuery(`${query}, ${keyword}`);
                  }}
                />
              )}
            </div>
          )}
        </section>
      </main>
      <div className={`search-toast ${loading ? "show" : ""}`} aria-live="polite">
        <Clock size={18} />
        YOUCHI DB에서 의미가 가까운 레퍼런스를 찾는 중…
      </div>
    </div>
  );
}
