export function mergeReviewConfig(base, patch) {
  const result = structuredClone(base);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) delete result[key];
    else if (typeof value === "object" && !Array.isArray(value))
      result[key] = mergeReviewConfig(result[key] || {}, value);
    else result[key] = structuredClone(value);
  }
  return result;
}

export function assertReviewIsolation(config) {
  if (
    config.identifier !== "app.harbor.context-review" ||
    config.productName !== "Harbor Context Review"
  )
    throw new Error("Unsafe review identity.");
  if (config.bundle?.active || config.bundle?.fileAssociations?.length)
    throw new Error("Review builds must not install file associations or installers.");
  if (config.plugins?.updater || config.bundle?.createUpdaterArtifacts)
    throw new Error("Review updater must be disabled.");
  if (
    config.plugins?.["deep-link"]?.desktop?.schemes?.length ||
    config.plugins?.["deep-link"]?.mobile?.length
  )
    throw new Error("Review deep-link schemes must be empty.");
}
