const configuredBasePath = process.env.NEXT_PUBLIC_BASE_PATH
  ?? (process.env.NODE_ENV === "production" ? "/project-universe-" : "");

export const BASE_PATH = configuredBasePath === "/"
  ? ""
  : configuredBasePath.replace(/\/+$/, "");
