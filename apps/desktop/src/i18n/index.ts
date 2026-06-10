import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { messages } from "./messages";

function normalizeLanguage(language: string | null): "en" | "zh-CN" {
  return language === "en" || language === "zh-CN" ? language : "zh-CN";
}

const language = normalizeLanguage(localStorage.getItem("language"));

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: messages.en },
      "zh-CN": { translation: messages["zh-CN"] },
    },
    lng: language,
    fallbackLng: "zh-CN",
    interpolation: {
      escapeValue: false,
    },
    keySeparator: ".",
    nsSeparator: false,
  });

export { i18n };
export { normalizeLanguage };
