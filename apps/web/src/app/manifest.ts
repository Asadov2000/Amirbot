import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Amir Care Mini App",
    short_name: "Amir Care",
    description: "Семейный трекер ребёнка для Telegram Mini App",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f7fb",
    theme_color: "#090d12",
    lang: "ru-RU",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
