import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputDir = path.resolve(root, "stitch-handoff");
const outputPath = path.join(outputDir, "STITCH_PROMPT.md");
const codexApplyPath = path.join(outputDir, "CODEX_APPLY_STITCH.md");
const designPath = path.resolve(root, "DESIGN.md");
const packagePath = path.resolve(root, "package.json");

function readIfExists(filePath, fallback = "") {
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : fallback;
}

function listExisting(paths) {
  return paths.filter((filePath) => fs.existsSync(path.resolve(root, filePath)));
}

const packageJson = JSON.parse(readIfExists(packagePath, "{}"));
const designBrief = readIfExists(
  designPath,
  "Create a high-fidelity UI design for this MVP. Preserve the product intent, improve hierarchy, and generate a production-ready visual direction.",
);

const sourceFiles = listExisting([
  "src/App.jsx",
  "src/styles.css",
  "src/data.js",
  "server.mjs",
  "DESIGN.md",
]);

const prompt = `# Stitch Design Prompt

Use this prompt in Google Stitch when a Codex-built MVP needs UI/UX design exploration.

## Project

- Name: ${packageJson.name || "MVP"}
- Type: Embeddable web MVP
- Current stack: React + Vite
- Design target: high-fidelity UI direction that Codex can re-apply to the codebase

## Source files Codex should use after Stitch output

${sourceFiles.map((file) => `- ${file}`).join("\n")}

## Design brief

${designBrief}

## What Stitch should produce

Generate a polished desktop and mobile UI design for the current MVP.

Keep the product flow intact, but improve:

1. Visual hierarchy
2. Empty state clarity
3. Search/result layout
4. Result card readability
5. Right-side assistant/workflow panel
6. Saved board behavior
7. Responsive mobile layout
8. Component spacing, color, and typography

Do not add login, signup, account, profile, or avatar UI unless the host platform explicitly requires it.

## Output handoff back to Codex

After Stitch generates a design, export or copy one of the following back into Codex:

1. Screenshot of the selected Stitch design
2. Figma link/export
3. HTML/CSS/React code from Stitch
4. A written summary of the chosen visual direction

Then ask Codex:

"이 Stitch 디자인을 현재 MVP 코드에 입혀줘. 기능은 유지하고 UI/UX만 개선해줘."
`;

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, prompt);

const codexApplyPrompt = `# Codex Apply Stitch Design Prompt

Use this prompt after Google Stitch produces a design direction.

## Paste into Codex

이 Stitch/Figma 디자인을 현재 MVP 코드에 입혀줘.

조건:

1. 기능은 유지해줘.
2. 데이터 검색, 저장된 보드, 레퍼런스 선택, 이미지 6컷 생성 플로우는 깨지면 안 돼.
3. 로그인/프로필/계정 UI는 추가하지 마.
4. Stitch/Figma 디자인의 레이아웃, 컬러, 타이포그래피, 카드 스타일, 간격, 반응형 구조를 우선 반영해줘.
5. 적용 전 현재 코드 구조를 확인하고, 변경 파일을 최소화해줘.
6. 반영 후 \`npm run build\`로 검증해줘.

## Attach or provide one of these

- Figma design URL with node-id
- Stitch export screenshot
- Stitch exported React/HTML/CSS code
- Design direction summary

## Current implementation files

${sourceFiles.map((file) => `- ${file}`).join("\n")}

## Figma URL example format

\`\`\`text
https://www.figma.com/design/FILE_KEY/FILE_NAME?node-id=0-1
\`\`\`

If the design is provided as an iframe, extract the \`src\` URL and use that Figma node URL.
`;

fs.writeFileSync(codexApplyPath, codexApplyPrompt);

console.log(`Stitch prompt generated: ${outputPath}`);
console.log(`Codex apply prompt generated: ${codexApplyPath}`);
console.log("Next: open https://stitch.withgoogle.com/ and paste stitch-handoff/STITCH_PROMPT.md");
