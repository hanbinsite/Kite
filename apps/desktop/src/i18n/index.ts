import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { messages } from "./messages";

// i18n should read language from the same source as UIStore
// UIStore is the single source of truth for language preference
const language = (localStorage.getItem("language") as "en" | "zh-CN") || "zh-CN";

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
  });

export { i18n };
