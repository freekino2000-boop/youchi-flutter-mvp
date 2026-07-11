# YOUCHI UI/UX Design Brief for Google Stitch

## Product intent

YOUCHI is an embeddable AI video-reference and ad-production assistant for advertiser-facing platforms. It should feel like a professional creative research tool, not a social product. There is no login, profile, account switcher, or user avatar in the MVP UI because authentication will be handled by the host platform later.

## Core user journey

1. The user lands on a clean prompt-first screen.
2. No reference data is exposed before the user searches.
3. The user enters multiple natural-language keywords such as “outdoor gear ad, functional jacket, backpack, mountain trail, 9:16 short-form”.
4. The left side shows ranked video references from the YOUCHI DB.
5. The right side shows selected reference information, keyword/material direction, and a three-step production flow.
6. The user can save references into a lightweight saved board.
7. The user can select a reference, generate six image cuts, approve/regenerate cuts, videoize them, and prepare a final MP4.

## Design principles

- Prompt-first: the text input is the hero object.
- Hidden until intent: search results appear only after a keyword search.
- Dense but calm: make many references scannable without looking noisy.
- Advertiser-friendly: avoid technical jargon in the main UI.
- Embeddable: the layout should work inside another SaaS or CMS panel.
- No account UI: remove all login/profile/avatar affordances.
- Evidence-based: every result should show why it matched the query.

## Layout

### Desktop

- Top utility bar:
  - Right aligned or compact.
  - Contains only “Home” and “Saved board”.
  - No logo, no profile, no login.
- Main prompt card:
  - Dark surface, subtle purple accent.
  - Textarea placeholder: “키워드를 입력해 주세요”.
  - Submit button on the right.
  - After search, show intent chips and search-combination chips.
- Results area:
  - Two-column split.
  - Left: reference video grid.
  - Right: sticky production panel.
- Video cards:
  - 16:9 thumbnail.
  - Duration badge.
  - Title, source badge, duration.
  - Save-to-board pill.
  - Matched keyword chips.
- Right production panel:
  - Selected reference card.
  - Keyword/material insight.
  - Three production steps:
    1. Generate six reference-based images.
    2. Videoize approved images.
    3. Generate final MP4.

### Mobile / embedded narrow width

- Stack prompt, results, and production panel vertically.
- Keep the saved board accessible in the top bar.
- Cards become single column.
- Production panel loses sticky behavior.

## Visual style

- Theme: premium dark creative-suite UI.
- Background: near-black with subtle radial purple glow.
- Accent: violet / electric purple.
- Typography: Inter + Noto Sans KR.
- Corners: 6–12px.
- Buttons: compact, pill or rounded rectangle.
- Cards: low-contrast borders, clear hover/selected states.
- Status colors:
  - Purple: active / AI / selected.
  - Gray: inactive / metadata.
  - Red: generation error.
  - Green or purple-tinted: approved.

## Google Stitch prompt

Create a high-fidelity desktop and mobile UI for an embeddable SaaS module called YOUCHI. YOUCHI helps advertisers search video references and turn a selected reference into a six-cut ad production flow.

Important constraints:
- Do not include login, sign up, user profile, avatar, or account menu.
- The top bar should only include Home and Saved board.
- Before search, do not show video data. Show only a prompt-first empty state.
- The main placeholder text should be Korean: “키워드를 입력해 주세요”.
- After search, show a split layout: video references on the left, production assistant on the right.
- The user can search with multiple combined keywords and see search-combination chips.
- Each result card should include thumbnail, title, source badge, duration, save-to-board button, and matched keyword chips.
- The right panel should include selected reference info, keyword/material insights, and a three-step workflow:
  1. Generate six reference-based images.
  2. Videoize approved images.
  3. Generate final MP4.
- Make the UI feel premium, calm, dark, professional, and advertiser-friendly.
- Use a dark background, subtle purple accents, dense cards, clear hierarchy, and Korean labels.
- Design both desktop and responsive mobile states.

## Key Korean labels

- 키워드를 입력해 주세요
- 홈으로
- 저장된 보드
- 검색 결과
- 검색 조합
- 의도 파악
- 보드 저장
- 저장됨
- 키워드·소재 방향 제안
- 레퍼런스 기반 제작 플로우
- 레퍼런스 기반 이미지 6컷 만들기
- 영상화 하기
- 최종 결과물 생성

## Embed requirements

- The module should not assume ownership of authentication.
- The host platform may provide the user identity, plan, billing, or workspace.
- The YOUCHI module should accept future host props such as:
  - `workspaceId`
  - `brandId`
  - `initialQuery`
  - `theme`
  - `apiBaseUrl`
  - `hideHeader`
- The UI should remain useful as a standalone local app and as an embedded panel.
