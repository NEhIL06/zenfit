// lib/ddg.ts

export async function webSearchfunc(query: string) {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`
    );

    if (!res.ok) {
      console.error(`[WebSearch] Wikipedia API error: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.error(`[WebSearch] Response body: ${text.slice(0, 200)}...`);
      return [];
    }

    const text = await res.text();
    try {
      const data = JSON.parse(text);
      return data.query.search.slice(0, 5).map((r: any) => ({
        title: r.title,
        description: r.snippet,
        url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title)}`,
      }));
    } catch (parseErr) {
      console.error(`[WebSearch] JSON parse error: ${parseErr}`);
      console.error(`[WebSearch] Received text: ${text.slice(0, 200)}...`);
      return [];
    }
  } catch (err) {
    console.error(`[WebSearch] Fetch error: ${err}`);
    return [];
  }
}


