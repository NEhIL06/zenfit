// lib/ddg.ts

export async function webSearchfunc(query: string) {
  const res = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json`
  );

  const data = await res.json();

  return data.query.search.slice(0, 5).map((r: any) => ({
    title: r.title,
    description: r.snippet,
    url: `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title)}`,
  }));
}


