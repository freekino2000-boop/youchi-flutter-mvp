# YOUCHI MVP

자연어로 광고 소재를 설명하면 여러 영상 레퍼런스 소스에서 의미가 가까운 결과를 찾아 보여주는 인터랙티브 MVP입니다.

## 현재 구현

### Flutter 프론트엔드

- `youchi_flutter/`에 Flutter Web 프론트엔드 추가
- 홈 / 검색 결과 / 저장된 보드 화면 구현
- 검색 결과 화면에서만 AI 키워드·이미지 6컷·영상화 플로우 노출
- 저장된 보드는 AI 생성툴 없이 저장된 레퍼런스 영상만 표시
- 기존 Node API 서버와 연동
- `shared_preferences` 기반 저장 보드 로컬 저장

### 기존 React/Vite 프론트엔드

- 첫 화면에서는 레퍼런스 데이터·결과 카드·상세 패널 비노출
- 자연어 검색 이후에만 실제 공개 소스 기반 결과 표시
- 로컬 유튜브 채널 탐색기 DB를 검색 API로 연결
- TVCF, 비드폴리오, 드롭샷 외부 레퍼런스 링크를 검색 API에 통합
- TikTok은 키워드 기반 숏폼 검색 링크 소스로 추가
- 키워드 기반 의미 유사도 MVP 랭킹
- 제품/용품 검색에서는 장비·제품 신호가 없는 단순 브이로그를 후순위/제외 처리
- 관련도·최신·러닝타임 정렬
- 썸네일 선택 시 상세 패널에서 실제 영상 또는 원본 재생 링크 표시
- TVCF HLS 영상, 비드폴리오 YouTube 임베드, 드롭샷 원본 포트폴리오 링크 연동
- 핵심 매칭 장면과 개별 원본 소스 링크
- 로컬 저장 보드
- 모바일 반응형 레이아웃

## Flutter 실행

터미널 1 — API 서버:

```bash
npm install
npm run api
```

터미널 2 — Flutter Web:

```bash
cd youchi_flutter
flutter pub get
flutter run -d chrome
```

프로덕션 빌드:

```bash
cd youchi_flutter
flutter build web
```

기본 API 주소는 `http://127.0.0.1:8787`입니다. 다른 주소를 쓰려면 빌드/실행 시 아래 값을 넘깁니다.

```bash
flutter run -d chrome --dart-define=YOUCHI_API_BASE=http://127.0.0.1:8787
```

## 기존 React/Vite 실행

```bash
npm install
npm run api
npm run dev
```

필요 시 `npm run build:youtube-index`는 바탕화면의 `유튜브 채널 탐색기/data/pool.json`에서
영상 레퍼런스용 축약 인덱스를 재생성합니다.

`npm run api`는 `http://127.0.0.1:8787/api/search`에서 검색 결과만 반환합니다.
프런트엔드는 이 API를 호출해 상위 결과만 화면에 표시합니다.

## 정적 HTML 빌드

```bash
npm run build
```

생성되는 `dist/index.html`과 `dist/assets/`는 일반 정적 웹 호스팅에서
실행할 수 있습니다. 저장소의 `main` 브랜치에 푸시하면 포함된 GitHub
Actions 워크플로가 GitHub Pages 배포를 자동 실행합니다.

## 실제 서비스 전환 구조

현재 MVP는 실제 공개 레퍼런스의 메타데이터와 재생 가능한 링크를 로컬 인덱스로 보유합니다. 운영 환경에서는 아래 구조로 교체합니다.

1. 소스별 커넥터가 이용약관·robots.txt·공식 API 범위 안에서 제목, 설명, 태그, 썸네일 URL, 원본 URL을 수집합니다.
2. 정규화 워커가 중복 제거와 카테고리·브랜드·러닝타임 필드를 통일합니다.
3. 한국어 임베딩 모델로 검색 문장과 메타데이터 임베딩을 생성합니다.
4. PostgreSQL + pgvector 또는 OpenSearch에서 벡터 유사도와 키워드 점수를 혼합 검색합니다.
5. 재랭커가 의미 유사도, 최신성, 소스 신뢰도, 중복도를 반영해 상위 결과를 반환합니다.
6. 프런트엔드에는 검색 결과와 출처 링크만 노출하며 원본 영상은 저장하지 않습니다.

권장 API:

- `POST /api/search` — 자연어 검색 및 재랭킹
- `GET /api/references/:id` — 상세 메타데이터
- `POST /api/boards/:id/items` — 보드 저장
- `POST /internal/connectors/:source/sync` — 관리자용 소스 동기화

## 소스 처리 원칙

- 사용자가 자연어 검색을 실행하기 전까지 결과 데이터는 화면에 렌더하지 않습니다.
- 원본 영상 파일을 복제하거나 재호스팅하지 않고, 공개 페이지·공개 임베드·공개 HLS 링크만 연결합니다.
- 직접 재생 URL이 공개되지 않은 소스는 대시보드 안에서 포스터와 원본 페이지 이동 버튼으로 처리합니다.
- 유튜브 대용량 DB 원본은 서버에서만 읽고, 사용자 화면에는 검색 결과에 필요한 최소 필드만 전달합니다.
