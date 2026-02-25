const configuredBasePath = process.env.NODE_ENV === "production"
  ? (process.env.NEXT_PUBLIC_BASE_PATH ?? "/project-universe-")
  : "";

export const BASE_PATH = configuredBasePath === "/"
  ? ""
  : configuredBasePath.replace(/\/+$/, "");
