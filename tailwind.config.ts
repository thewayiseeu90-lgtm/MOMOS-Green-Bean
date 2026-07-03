import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // 생두 산지의 색감에서 따온 팔레트 — 흔한 AI 다크모드/크림톤 기본값을 피한다
        bark: "#2B241D",      // 로스팅 직전 원두 색 — 본문 텍스트
        parchment: "#FAF6EE", // 파치먼트 커피 색 — 배경
        clay: "#B5572B",      // 에티오피아 적토 — 강조색(위험/긴급)
        moss: "#5C6B47",      // 워싱스테이션 주변 식물 — 완료/승인
        sand: "#E4D9C3",      // 보더/구분선
        ink: "#1F2A24",       // 헤더용 짙은 그린-블랙
      },
      fontFamily: {
        display: ["'Fraunces'", "serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
