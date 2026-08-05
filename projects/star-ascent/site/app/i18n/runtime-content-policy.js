export function runtimeContentLocaleForPolicy(policy, locale) {
  if (locale === "en") return "en";
  const directCopyReady = policy?.directComponentReviewBundleComplete === true;
  return directCopyReady && policy?.localeStatus?.[locale] === "REVIEWED" ? locale : "en";
}
