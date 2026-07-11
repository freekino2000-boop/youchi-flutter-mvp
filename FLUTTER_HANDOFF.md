# YOUCHI MVP Flutter 전환 개발 전달서

이 문서는 현재 React/Vite 기반 YOUCHI MVP를 Flutter 앱/Flutter Web으로 전환하기 위한 개발자 전달용 명세입니다.

## 1. 전환 목표

현재 MVP의 핵심 경험은 유지하고, 프론트엔드를 Flutter로 재구현합니다.

- 첫 화면: 자연어 키워드 입력 중심
- 검색 결과: 좌측/메인 영역에 레퍼런스 영상 카드 리스트
- AI 제작 영역: 검색 결과 화면에서만 노출
- 저장된 보드: 저장된 레퍼런스 영상만 노출, AI 생성툴/제작 패널 없음
- API 서버: 기존 Node `server.mjs` 유지 가능
- 데이터: YOUCHI DB 검색 API와 로컬 저장 보드 사용

## 2. 현재 기술 구조

### 현재 프론트엔드

- Framework: React + Vite
- 주요 파일:
  - `src/App.jsx`
  - `src/styles.css`
  - `src/data.js`

### 현재 백엔드

- Node 서버: `server.mjs`
- 기본 주소: `http://127.0.0.1:8787`
- 프론트 개발 서버: `http://127.0.0.1:5173`

Flutter 전환 시에도 백엔드는 우선 그대로 사용하고, Flutter에서 HTTP API만 호출하는 방식이 가장 빠릅니다.

## 3. Flutter 권장 구조

```text
lib/
  main.dart
  app.dart
  core/
    constants.dart
    theme.dart
    api_client.dart
    local_storage.dart
  models/
    reference_video.dart
    keyword_insight.dart
    storyboard_cut.dart
    search_response.dart
  screens/
    home_screen.dart
    search_results_screen.dart
    saved_board_screen.dart
  widgets/
    youchi_top_bar.dart
    prompt_card.dart
    reference_video_card.dart
    reference_grid.dart
    keyword_insight_panel.dart
    production_flow_panel.dart
    saved_board_header.dart
    empty_state.dart
```

## 4. 화면 설계

### 4.1 홈 화면

파일 예시: `lib/screens/home_screen.dart`

구성:

- 상단 네비게이션
  - 좌측: `YOUCHI`
  - 우측: `홈으로`, `저장된 보드`
- 중앙 히어로
  - 타이틀: `AI Ad Conceptor`
  - 설명: `단 한 줄의 키워드로 브랜드 스토리와 광고 소재를 즉시 시각화 하세요.`
- 프롬프트 카드
  - 상단 라벨: `NEW GENERATION AI`
  - 입력 placeholder:

```text
키워드를 입력해 주세요
예: 도심 속의 시원한 수제 맥주, 미니멀한 라이프스타일 가구
```

- 버튼: `생성하기`
- 추천 소재 버튼:
  - `#사이버펑크_네온`
  - `#여름_해변_휴가`
  - `#고급스러운_미니멀리즘`
  - `#박진감_넘치는_스포츠`
- 하단 문구:
  - `© 2026 YOUCHI AI Creative Suite. All rights reserved.`

동작:

- 사용자가 키워드 입력 후 생성하기 클릭
- `/api/search?q={query}&limit=50` 호출
- 결과 화면으로 이동

### 4.2 검색 결과 화면

파일 예시: `lib/screens/search_results_screen.dart`

구성:

- 상단 네비게이션
- 검색 입력 박스
- 의도 파악 칩
- 검색 조합 칩
- 메인 레이아웃
  - 좌측/메인: 레퍼런스 영상 카드 그리드
  - 우측: AI 키워드/제작 패널

검색 결과 헤더:

- 라벨: `REFERENCE SEARCH`
- 제목: 사용자가 입력한 검색어
- 설명: `YOUCHI DB에서 의미가 가까운 영상 레퍼런스를 정렬했습니다.`
- 결과 개수 배지: `{count}개`
- 정렬:
  - 관련도순
  - 최신순
  - 짧은 영상순

레퍼런스 카드:

- 썸네일
- 재생 시간
- 제목
- 소스 배지: `YOUCHI DB`
- 저장 버튼
- 매칭 이유
- 매칭 키워드 칩

우측 AI 패널:

- 선택된 레퍼런스 카드
- Grok 키워드 제안
- 관련 키워드
- 소재 방향
- 피해야 할 방향
- 레퍼런스 기반 제작 플로우
  1. 이미지 6컷 만들기
  2. 영상화 하기
  3. 최종 결과물 생성

중요:

- 이 AI 패널은 검색 결과 화면에서만 노출합니다.
- 저장된 보드 화면에서는 절대 노출하지 않습니다.

### 4.3 저장된 보드 화면

파일 예시: `lib/screens/saved_board_screen.dart`

구성:

- 상단 네비게이션
- 저장 보드 헤더
  - 라벨: `SAVED BOARD`
  - 제목: `저장된 보드`
  - 설명: `저장해 둔 레퍼런스 영상만 모아 보여줍니다.`
  - 저장 개수 배지: `{count}개`
- 정렬
  - 관련도순 또는 저장순
  - 최신순
  - 짧은 영상순
- 저장된 레퍼런스 영상 카드 그리드

저장된 보드에서 제거해야 하는 것:

- 검색 입력 박스
- 의도 파악 칩
- 검색 조합 칩
- Grok 패널
- AI 이미지 생성
- 영상화 하기
- 최종 결과물 생성
- 우측 제작 패널 전체

저장된 보드는 “레퍼런스 영상 보관함” 역할만 합니다.

## 5. API 명세

### 5.1 Health

```http
GET /api/health
```

응답 예시:

```json
{
  "ok": true,
  "count": 34470,
  "generatedAt": "2026-07-10T01:04:31.958Z",
  "grokConfigured": true,
  "grokModel": "grok-4",
  "imageProvider": "google",
  "imageConfigured": true,
  "imageModel": "gemini-3.1-flash-image"
}
```

### 5.2 검색

```http
GET /api/search?q={query}&limit=50
```

Flutter 호출 예시:

```dart
final uri = Uri.parse('$apiBase/api/search').replace(
  queryParameters: {
    'q': query,
    'limit': '50',
  },
);

final response = await http.get(uri);
```

응답 주요 필드:

```json
{
  "results": [],
  "intent": [],
  "queryTerms": [],
  "insights": {},
  "generatedAt": "ISO_DATE"
}
```

### 5.3 이미지 6컷 생성

```http
POST /api/creative/images
Content-Type: application/json
```

Body:

```json
{
  "query": "등산용품",
  "ratio": "9:16",
  "reference": {},
  "cuts": []
}
```

### 5.4 특정 컷 이미지 재생성

```http
POST /api/creative/image
Content-Type: application/json
```

Body:

```json
{
  "query": "등산용품",
  "ratio": "9:16",
  "reference": {},
  "cut": {}
}
```

## 6. Flutter 모델 예시

### 6.1 ReferenceVideo

```dart
class ReferenceVideo {
  final String id;
  final String title;
  final String source;
  final String? channel;
  final String? category;
  final String image;
  final String? originUrl;
  final String? videoType;
  final String? videoUrl;
  final String duration;
  final int seconds;
  final int? year;
  final int match;
  final bool hasEvidence;
  final String reason;
  final String? description;
  final List<String> keywords;
  final List<String> matchedTerms;

  ReferenceVideo({
    required this.id,
    required this.title,
    required this.source,
    this.channel,
    this.category,
    required this.image,
    this.originUrl,
    this.videoType,
    this.videoUrl,
    required this.duration,
    required this.seconds,
    this.year,
    required this.match,
    required this.hasEvidence,
    required this.reason,
    this.description,
    required this.keywords,
    required this.matchedTerms,
  });

  factory ReferenceVideo.fromJson(Map<String, dynamic> json) {
    return ReferenceVideo(
      id: json['id'] ?? '',
      title: json['title'] ?? '',
      source: json['source'] ?? 'YOUCHI DB',
      channel: json['channel'],
      category: json['category'],
      image: json['image'] ?? '',
      originUrl: json['originUrl'],
      videoType: json['videoType'],
      videoUrl: json['videoUrl'],
      duration: json['duration'] ?? '',
      seconds: json['seconds'] ?? 0,
      year: json['year'],
      match: json['match'] ?? 0,
      hasEvidence: json['hasEvidence'] ?? true,
      reason: json['reason'] ?? '',
      description: json['description'],
      keywords: List<String>.from(json['keywords'] ?? []),
      matchedTerms: List<String>.from(json['matchedTerms'] ?? []),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'source': source,
      'channel': channel,
      'category': category,
      'image': image,
      'originUrl': originUrl,
      'videoType': videoType,
      'videoUrl': videoUrl,
      'duration': duration,
      'seconds': seconds,
      'year': year,
      'match': match,
      'hasEvidence': hasEvidence,
      'reason': reason,
      'description': description,
      'keywords': keywords,
      'matchedTerms': matchedTerms,
    };
  }
}
```

### 6.2 KeywordInsight

```dart
class KeywordInsight {
  final String provider;
  final String status;
  final String headline;
  final String summary;
  final List<String> keywords;
  final List<String> angles;
  final List<String> avoid;
  final bool fromGrok;

  KeywordInsight({
    required this.provider,
    required this.status,
    required this.headline,
    required this.summary,
    required this.keywords,
    required this.angles,
    required this.avoid,
    required this.fromGrok,
  });

  factory KeywordInsight.fromJson(Map<String, dynamic> json) {
    return KeywordInsight(
      provider: json['provider'] ?? '',
      status: json['status'] ?? '',
      headline: json['headline'] ?? '',
      summary: json['summary'] ?? '',
      keywords: List<String>.from(json['keywords'] ?? []),
      angles: List<String>.from(json['angles'] ?? []),
      avoid: List<String>.from(json['avoid'] ?? []),
      fromGrok: json['fromGrok'] ?? false,
    );
  }
}
```

## 7. 상태 관리

Flutter에서는 다음 중 하나를 권장합니다.

1. 빠른 MVP: `Riverpod`
2. 단순 구조: `Provider`
3. 앱 규모 확장 예정: `Bloc`

권장: `Riverpod`

관리해야 하는 상태:

- `query`
- `submittedQuery`
- `hasSearched`
- `isLoading`
- `searchResults`
- `selectedReference`
- `savedReferences`
- `keywordInsight`
- `sortType`
- `storyboardCuts`
- `selectedRatio`
- `productionError`

## 8. 저장 보드 로컬 저장

React 현재 버전은 `localStorage`를 사용합니다.

Flutter 전환 시:

- Flutter Web: `shared_preferences`
- iOS/Android: `shared_preferences` 또는 `hive`

저장 키:

```text
youchi-saved-board
```

저장 데이터:

```json
[
  {
    "id": "video-id",
    "title": "영상 제목",
    "source": "YOUCHI DB",
    "image": "thumbnail-url",
    "originUrl": "source-url",
    "duration": "0:20",
    "keywords": []
  }
]
```

## 9. 디자인 토큰

Flutter Theme에 반영할 주요 값:

```dart
class YouchiColors {
  static const bg = Color(0xFF0A0A0C);
  static const text = Color(0xFFE5E1E4);
  static const muted = Color(0xFFCBC3D7);
  static const accent = Color(0xFF8B5CF6);
  static const accentBright = Color(0xFFD0BCFF);
  static const accentDeep = Color(0xFF6D28D9);
  static const line = Color(0x52494454);
}
```

주요 스타일:

- 배경: 다크 블랙 `#0A0A0C`
- 포인트: 퍼플 `#8B5CF6`, 라이트 퍼플 `#D0BCFF`
- 카드: 반투명 블랙/글래스 느낌
- Radius:
  - 홈 프롬프트 카드: 24
  - 결과 카드: 12~18
  - 버튼: 12~14
- 폰트:
  - 한글: `Noto Sans KR`
  - 영문: `Inter`

## 10. Flutter 위젯 매핑

| 현재 React 컴포넌트 | Flutter 위젯 |
|---|---|
| `App` | `YouchiApp`, `AppRouter` |
| 홈 히어로 | `HomeHero` |
| 프롬프트 폼 | `PromptCard` |
| 검색 결과 그리드 | `ReferenceGrid` |
| 영상 카드 | `ReferenceVideoCard` |
| Grok/키워드 패널 | `KeywordInsightPanel` |
| 선택 레퍼런스 카드 | `SelectedReferenceCard` |
| 제작 플로우 | `ProductionFlowPanel` |
| 저장 보드 | `SavedBoardScreen` |
| 빈 상태 | `EmptyState` |

## 11. 라우팅 제안

```text
/
/search
/saved
```

라우팅 방식:

- Flutter Web만 우선이면 `go_router` 추천
- 모바일 앱까지 고려하면 `go_router` 유지 가능

예시:

```dart
final router = GoRouter(
  routes: [
    GoRoute(path: '/', builder: (_, __) => const HomeScreen()),
    GoRoute(path: '/search', builder: (_, state) => const SearchResultsScreen()),
    GoRoute(path: '/saved', builder: (_, __) => const SavedBoardScreen()),
  ],
);
```

## 12. 검색 결과와 저장 보드의 핵심 차이

### 검색 결과 화면

```text
검색 입력 O
의도/검색 조합 O
레퍼런스 카드 O
AI 키워드 패널 O
이미지 6컷 제작 O
영상화 플로우 O
```

### 저장된 보드 화면

```text
검색 입력 X
의도/검색 조합 X
레퍼런스 카드 O
AI 키워드 패널 X
이미지 6컷 제작 X
영상화 플로우 X
```

## 13. 개발 우선순위

### 1차

- Flutter 프로젝트 생성
- Theme 구성
- Home/Search/Saved 화면 구현
- `/api/search` 연결
- 저장 보드 로컬 저장 구현

### 2차

- 우측 AI 키워드 패널 구현
- 선택 레퍼런스 기반 제작 플로우 UI 구현
- `/api/creative/images` 연결
- `/api/creative/image` 연결

### 3차

- 영상 플레이어
- YouTube/HLS/external URL 타입별 처리
- 모바일 최적화
- 실제 MP4 렌더링 백엔드 연결

## 14. 개발자에게 전달할 핵심 요청

개발자에게는 아래처럼 전달하면 됩니다.

```text
현재 React/Vite로 구현된 YOUCHI MVP를 Flutter로 전환하고 싶습니다.
백엔드는 기존 Node server.mjs를 우선 유지하고, Flutter 프론트에서 API만 호출하는 구조로 진행해주세요.

핵심 화면은 3개입니다.
1. 홈: 키워드 입력 중심
2. 검색 결과: 레퍼런스 영상 + AI 제작 패널
3. 저장된 보드: 저장된 레퍼런스 영상만 표시, AI 생성툴은 숨김

API는 /api/search, /api/health, /api/creative/images, /api/creative/image를 사용합니다.
디자인은 다크 배경, 퍼플 포인트, 글래스 카드 느낌을 유지해주세요.
저장 보드는 local storage/shared preferences에 저장된 레퍼런스 영상만 보여주면 됩니다.
```

