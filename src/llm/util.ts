export function normalizeApiBaseUrl(url: string): string {
  if (!url) return "https://api.openai.com/v1";
  url = url.trim();
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  if (!url.endsWith("/v1")) {
    url = url.endsWith("/") ? url + "v1" : url + "/v1";
  }
  return url;
}
