import { useEffect } from 'react';

const APP_NAME = 'SkillSphere';

/** Sets the browser tab title to "<title> · SkillSphere" (or just the app name when empty). */
export const useDocumentTitle = (title?: string | null) => {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : `${APP_NAME} — Hyperlocal freelance marketplace`;
  }, [title]);
};
