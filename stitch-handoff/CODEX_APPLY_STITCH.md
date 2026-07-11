# Codex Apply Stitch Design Prompt

Use this prompt after Google Stitch produces a design direction.

## Paste into Codex

이 Stitch/Figma 디자인을 현재 MVP 코드에 입혀줘.

조건:

1. 기능은 유지해줘.
2. 데이터 검색, 저장된 보드, 레퍼런스 선택, 이미지 6컷 생성 플로우는 깨지면 안 돼.
3. 로그인/프로필/계정 UI는 추가하지 마.
4. Stitch/Figma 디자인의 레이아웃, 컬러, 타이포그래피, 카드 스타일, 간격, 반응형 구조를 우선 반영해줘.
5. 적용 전 현재 코드 구조를 확인하고, 변경 파일을 최소화해줘.
6. 반영 후 `npm run build`로 검증해줘.

## Attach or provide one of these

- Figma design URL with node-id
- Stitch export screenshot
- Stitch exported React/HTML/CSS code
- Design direction summary

## Current implementation files

- src/App.jsx
- src/styles.css
- src/data.js
- server.mjs
- DESIGN.md

## Figma URL example format

```text
https://www.figma.com/design/FILE_KEY/FILE_NAME?node-id=0-1
```

If the design is provided as an iframe, extract the `src` URL and use that Figma node URL.
