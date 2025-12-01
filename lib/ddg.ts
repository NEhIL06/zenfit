// lib/ddg.ts

export async function duckSearch(query: string) {
  const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(
    query
  )}&format=json&no_html=1&skip_disambig=1`;

  const res = await fetch(url);

  if (!res.ok) throw new Error("DuckDuckGo API failed");

  const data = await res.json();
  const out: any[] = [];

  if (data.RelatedTopics) {
    for (const t of data.RelatedTopics) {
      if (t.Text) {
        out.push({
          title: t.Text.split(" - ")[0],
          description: t.Text,
          url: t.FirstURL,
        });
      }
    }
  }

  return out.slice(0, 5);
}
