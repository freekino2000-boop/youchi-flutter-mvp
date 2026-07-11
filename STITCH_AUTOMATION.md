# Codex + Google Stitch 디자인 자동화 워크플로우

이 프로젝트에서는 Stitch를 앱 내부 버튼으로 노출하지 않습니다. Stitch는 Codex가 MVP를 만든 뒤 UI/UX 디자인을 입히기 위한 외부 디자인 공정으로 사용합니다.

## 현재 가능한 자동화 수준

2026년 7월 기준으로 Google Stitch의 공개 REST API는 명확히 공개되어 있지 않습니다. 따라서 완전 자동으로 “Codex → Stitch 프로젝트 생성 → 디자인 산출물 회수 → 코드 반영”까지 실행하는 방식은 아직 안정적으로 붙이기 어렵습니다.

대신 아래 반자동 루프를 표준화합니다.

## 표준 루프

1. Codex로 MVP 기능을 먼저 만든다.
2. 디자인 의도와 제품 구조를 `DESIGN.md`에 정리한다.
3. 아래 명령으로 Stitch용 프롬프트를 생성한다.

```bash
npm run design:stitch
```

4. 생성된 파일을 Stitch에 붙여 넣는다.

```text
stitch-handoff/STITCH_PROMPT.md
```

5. Stitch에서 디자인을 생성하고 가장 좋은 안을 고른다.
6. Stitch 결과를 Codex에 다시 전달한다. 이때 아래 파일의 문구를 그대로 사용하면 된다.

```text
stitch-handoff/CODEX_APPLY_STITCH.md
```

가능한 전달 방식:

- Stitch 디자인 스크린샷
- Figma 링크 또는 export
- Stitch가 생성한 HTML/CSS/React 코드
- 선택한 디자인 방향 설명

7. Codex에 이렇게 요청한다.

```text
이 Stitch 디자인을 현재 MVP 코드에 입혀줘. 기능은 유지하고 UI/UX만 개선해줘.
```

Figma iframe을 받은 경우에는 `src` 값 안의 Figma URL을 사용한다.

예:

```html
<iframe src="https://embed.figma.com/design/FILE_KEY/FILE_NAME?node-id=0-1&embed-host=share"></iframe>
```

Codex에는 아래처럼 전달한다.

```text
이 Figma 디자인을 현재 MVP 코드에 입혀줘:
https://embed.figma.com/design/FILE_KEY/FILE_NAME?node-id=0-1&embed-host=share
```

## 앞으로 API가 공개되면 붙일 위치

Stitch API, SDK, MCP 서버가 공식 문서로 안정화되면 아래 스크립트를 확장하면 됩니다.

```text
scripts/create-stitch-brief.mjs
```

확장 방향:

- `STITCH_API_KEY` 환경변수 추가
- Stitch 프로젝트 자동 생성
- 현재 로컬 스크린샷/코드 컨텍스트 업로드
- 생성된 디자인 variant ID 저장
- 선택 variant를 Figma 또는 코드로 export
- Codex가 export 결과를 `src/App.jsx`, `src/styles.css`에 반영

## 운영 원칙

- 앱 내부에는 Stitch 버튼을 넣지 않는다.
- 광고주/사용자는 Stitch를 볼 필요가 없다.
- Stitch는 제작자/운영자가 MVP UI 품질을 올리는 내부 디자인 도구로 사용한다.
- 기능 구현과 디자인 적용을 분리한다.
- 기능은 Codex가 유지하고, 시각 방향은 Stitch로 탐색한다.
