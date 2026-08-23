import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const { population, intervention, comparator, outcome } = await req.json();
  const term = [
    population && `(${population})`,
    intervention && `(${[intervention, comparator].filter(Boolean).join("[tiab] OR ")}[tiab])`,
    outcome && `(${outcome})`
  ].filter(Boolean).join(" AND ");

  try {
    const esearch = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=8&sort=relevance&term=${encodeURIComponent(term)}`
    );
    const ids = (await esearch.json())?.esearchresult?.idlist || [];
    if (!ids.length) return NextResponse.json({ results: [] });

    const esummary = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(",")}`
    );
    const data = await esummary.json();
    const results = ids.map((id: string) => {
      const doc = data?.result?.[id];
      return {
        pmid: id,
        title: doc?.title || "Untitled",
        journal: doc?.fulljournalname || doc?.source || "",
        year: doc?.pubdate?.slice(0, 4) || "",
        authors: doc?.sortfirstauthor || ""
      };
    });
    return NextResponse.json({ results, term });
  } catch {
    return NextResponse.json({ results: [], error: "PubMed search failed" });
  }
}
