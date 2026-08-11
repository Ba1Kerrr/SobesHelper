import axios from "axios";

export interface FlRuProject {
  title: string;
  link: string;
  pubDate: string;
  description: string;
}

// FL.ru has no application/apply API for freelance projects - only public
// RSS feeds for browsing. So this is read-only: fetch + parse, no auto-apply.
// Only the unfiltered feed URL is used - fl.ru's category/subcategory query
// params require numeric IDs looked up per category, which aren't reliably
// documented, so category filtering is done client-side over the fetched
// titles/descriptions instead of guessing those IDs.
const FEED_URL = "https://www.fl.ru/rss/all.xml";

function extractTag(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, "i"));
  if (!match) return "";
  return match[1].replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, "$1").trim();
}

function parseFeed(xml: string): FlRuProject[] {
  const items: FlRuProject[] = [];
  const itemMatches = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  for (const itemXml of itemMatches) {
    items.push({
      title: extractTag(itemXml, "title"),
      link: extractTag(itemXml, "link"),
      pubDate: extractTag(itemXml, "pubDate"),
      description: extractTag(itemXml, "description").replace(/<[^>]+>/g, "").slice(0, 300),
    });
  }
  return items;
}

export async function fetchFlRuFeed(): Promise<FlRuProject[]> {
  const response = await axios.get(FEED_URL, { responseType: "text", timeout: 15000 });
  return parseFeed(response.data);
}
