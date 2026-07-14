import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Naruhodo! - AIが「なるほど」まで届ける翻訳",
    short_name: "Naruhodo!",
    description: "ニュアンスの解説やトーン別の翻訳提案、添削もできるAI翻訳ツール。",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#38b8fe",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
