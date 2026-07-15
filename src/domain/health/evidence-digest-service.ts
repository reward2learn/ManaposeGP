import type { DbClient } from '@/lib/db';
import { resolveOpenAiKey } from '@/lib/openai';

// ── Public interfaces ─────────────────────────────────────────────────────────

export interface PubMedArticle {
  pmid: string;
  title: string;
  authors: string[];
  journal: string;
  pubDate: string;
  abstract: string;
  url: string;
}

export interface DigestEntry {
  pmid: string;
  title: string;
  journal: string;
  pubDate: string;
  keyFindings: string;
  clinicalImplications: string;
  evidenceStrength: string;
  takeaway: string;
  url: string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PUBMED_DEFAULT_QUERY =
  '(menopause OR perimenopause OR "menopausal hormone therapy") AND (clinical trial OR meta-analysis OR "systematic review" OR "randomized controlled trial") AND 2025:2026[pdat]';

const PUBMED_ESEARCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi';
const PUBMED_EFETCH_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi';

const MAX_ARTICLES = 20;
const DIGEST_MODEL = 'gpt-4o';

const SUMMARY_SYSTEM_PROMPT =
  `You are an evidence-based medicine assistant for Australian GPs.
Summarize this medical research article for Australian GPs. Include:
- Key findings (1-2 sentences)
- Clinical implications (1-2 sentences)
- Evidence strength (RCT/Meta-analysis/Systematic review/Observational)
- Takeaway for practice

Keep under 150 words total.
Respond ONLY with a JSON object with these keys: keyFindings, clinicalImplications, evidenceStrength, takeaway.
Do not include any markdown formatting, code fences, or extra text.`;

// ── PubMed API ────────────────────────────────────────────────────────────────

interface PubMedEsearchResult {
  esearchresult?: {
    count?: string;
    idlist?: string[];
  };
}

/**
 * Queries the PubMed E-utilities API (free, no key needed).
 * Fetches article IDs via esearch, then fetches abstracts via efetch.
 * Returns up to `maxResults` articles (default 20).
 */
export async function searchPubMed(
  query: string = PUBMED_DEFAULT_QUERY,
  maxResults: number = MAX_ARTICLES,
): Promise<PubMedArticle[]> {
  const retMax = Math.min(Math.max(1, maxResults), 20);

  // ── Step 1: Search for article IDs ──────────────────────────────────────────
  const searchUrl = new URL(PUBMED_ESEARCH_URL);
  searchUrl.searchParams.set('db', 'pubmed');
  searchUrl.searchParams.set('retmax', String(retMax));
  searchUrl.searchParams.set('retmode', 'json');
  searchUrl.searchParams.set('sort', 'date');
  searchUrl.searchParams.set('term', query);

  let searchData: PubMedEsearchResult;
  try {
    const searchResp = await fetch(searchUrl.toString());
    if (!searchResp.ok) {
      throw new Error(`PubMed esearch returned ${searchResp.status}`);
    }
    searchData = (await searchResp.json()) as PubMedEsearchResult;
  } catch (err) {
    console.error('[evidence-digest] PubMed esearch failed:', err instanceof Error ? err.message : err);
    return [];
  }

  const idList = searchData.esearchresult?.idlist ?? [];
  if (idList.length === 0) {
    return [];
  }

  // ── Step 2: Fetch article details ───────────────────────────────────────────
  const fetchUrl = new URL(PUBMED_EFETCH_URL);
  fetchUrl.searchParams.set('db', 'pubmed');
  fetchUrl.searchParams.set('retmode', 'xml');
  fetchUrl.searchParams.set('id', idList.join(','));

  let xmlText: string;
  try {
    const fetchResp = await fetch(fetchUrl.toString());
    if (!fetchResp.ok) {
      throw new Error(`PubMed efetch returned ${fetchResp.status}`);
    }
    xmlText = await fetchResp.text();
  } catch (err) {
    console.error('[evidence-digest] PubMed efetch failed:', err instanceof Error ? err.message : err);
    return [];
  }

  // ── Step 3: Parse XML response ──────────────────────────────────────────────
  return parsePubMedXml(xmlText, idList);
}

/**
 * Parses PubMed efetch XML response into PubMedArticle array.
 * Uses simple regex-based parsing to avoid external XML library dependency.
 */
function parsePubMedXml(xml: string, idList: string[]): PubMedArticle[] {
  const articles: PubMedArticle[] = [];

  // Split into per-article sections
  const articleBlocks = xml.split(/<PubmedArticle[>\s]/).slice(1);

  for (const block of articleBlocks) {
    try {
      const pmidMatch = block.match(/<PMID[^>]*>([^<]+)<\/PMID>/);
      const pmid = pmidMatch?.[1]?.trim();
      if (!pmid || !idList.includes(pmid)) continue;

      const titleMatch = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/);
      const title = decodeXmlEntities(titleMatch?.[1]?.trim() ?? 'Untitled');

      // Extract authors
      const authorMatches = block.matchAll(/<Author[^>]*>[\s\S]*?<LastName>([^<]+)<\/LastName>[\s\S]*?<ForeName>([^<]*)<\/ForeName>[\s\S]*?<\/Author>/g);
      const authors: string[] = [];
      for (const authorMatch of authorMatches) {
        const lastName = authorMatch[1]?.trim() ?? '';
        const foreName = authorMatch[2]?.trim() ?? '';
        if (lastName) {
          authors.push(foreName ? `${foreName} ${lastName}` : lastName);
        }
      }

      const journalMatch = block.match(/<Title[^>]*>([^<]+)<\/Title>/);
      const journal = decodeXmlEntities(journalMatch?.[1]?.trim() ?? 'Unknown Journal');

      const pubDateMatch = block.match(/<PubDate>([\s\S]*?)<\/PubDate>/);
      const pubDate = extractPubDate(pubDateMatch?.[1] ?? '');

      const abstractMatch = block.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g);
      const abstracts: string[] = [];
      if (abstractMatch) {
        for (const ab of abstractMatch) {
          const textMatch = ab.match(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/);
          if (textMatch?.[1]) {
            abstracts.push(decodeXmlEntities(textMatch[1].trim()));
          }
        }
      }
      const abstract = abstracts.join(' ').trim() || 'No abstract available';

      const url = `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;

      articles.push({ pmid, title, authors, journal, pubDate, abstract, url });
    } catch (err) {
      console.warn('[evidence-digest] Failed to parse PubMed article block:', err instanceof Error ? err.message : err);
    }
  }

  return articles;
}

/**
 * Extracts a human-readable publication date from PubDate XML content.
 */
function extractPubDate(pubDateXml: string): string {
  const yearMatch = pubDateXml.match(/<Year>(\d+)<\/Year>/);
  const monthMatch = pubDateXml.match(/<Month>([^<]+)<\/Month>/);
  const dayMatch = pubDateXml.match(/<Day>(\d+)<\/Day>/);

  let result = yearMatch?.[1] ?? '';
  if (monthMatch?.[1]) {
    // Month could be numeric or abbreviated name
    const month = monthMatch[1];
    result = `${month} ${result}`;
  }
  if (dayMatch?.[1]) {
    result = `${result} ${dayMatch[1]}`;
  }
  return result.trim() || 'Unknown date';
}

/**
 * Decodes common XML entities like &amp;lt; &amp;gt; &amp;amp; etc.
 */
function decodeXmlEntities(text: string): string {
  return text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&\w+;/g, '')
    .trim();
}

// ── GPT-4o Summarization ─────────────────────────────────────────────────────

/**
 * Summarizes a PubMed article using GPT-4o, returning a structured DigestEntry.
 */
export async function summarizeArticle(article: PubMedArticle): Promise<DigestEntry> {
  const apiKey = await resolveOpenAiKey();

  if (!apiKey) {
    // Return a basic entry without AI summary when no key is configured
    return {
      pmid: article.pmid,
      title: article.title,
      journal: article.journal,
      pubDate: article.pubDate,
      keyFindings: 'AI summarization unavailable — OpenAI API key not configured.',
      clinicalImplications: 'N/A',
      evidenceStrength: 'N/A',
      takeaway: article.abstract.slice(0, 150),
      url: article.url,
    };
  }

  const userContent =
    `Title: ${article.title}\n` +
    `Journal: ${article.journal}\n` +
    `Date: ${article.pubDate}\n` +
    `Authors: ${article.authors.slice(0, 5).join(', ')}${article.authors.length > 5 ? ' et al.' : ''}\n\n` +
    `Abstract:\n${article.abstract}`;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DIGEST_MODEL,
      messages: [
        { role: 'system', content: SUMMARY_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    let detail = 'OpenAI API error';
    try {
      const errBody = (await response.json()) as { error?: { message?: string } };
      if (errBody.error?.message) detail = errBody.error.message;
    } catch {
      // ignore parse failure
    }
    throw new Error(`OpenAI API returned ${response.status}: ${detail}`);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('OpenAI returned an empty response for article summary');
  }

  const parsed = parseSummaryResponse(content, article);

  return {
    pmid: article.pmid,
    title: article.title,
    journal: article.journal,
    pubDate: article.pubDate,
    keyFindings: parsed.keyFindings,
    clinicalImplications: parsed.clinicalImplications,
    evidenceStrength: parsed.evidenceStrength,
    takeaway: parsed.takeaway,
    url: article.url,
  };
}

/**
 * Parses and validates the JSON response from GPT-4o.
 */
function parseSummaryResponse(
  raw: string,
  article: PubMedArticle,
): { keyFindings: string; clinicalImplications: string; evidenceStrength: string; takeaway: string } {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new Error(`Failed to parse OpenAI summary response as JSON: ${raw.slice(0, 200)}`);
  }

  const keyFindings = typeof parsed.keyFindings === 'string' ? parsed.keyFindings.trim() : '';
  const clinicalImplications = typeof parsed.clinicalImplications === 'string' ? parsed.clinicalImplications.trim() : '';
  const evidenceStrength = typeof parsed.evidenceStrength === 'string' ? parsed.evidenceStrength.trim() : 'N/A';
  const takeaway = typeof parsed.takeaway === 'string' ? parsed.takeaway.trim() : '';

  if (!keyFindings || !takeaway) {
    throw new Error(
      `OpenAI summary missing required fields for PMID ${article.pmid}. keyFindings: ${!!keyFindings}, takeaway: ${!!takeaway}`,
    );
  }

  return { keyFindings, clinicalImplications, evidenceStrength, takeaway };
}

// ── Weekly Digest Generator ───────────────────────────────────────────────────

/**
 * Generates a weekly evidence digest:
 * 1. Searches PubMed for recent menopause-related clinical research
 * 2. Summarizes each article using GPT-4o
 * 3. Saves summaries as MedicalReference records
 *
 * Returns the digest entries and count of saved records.
 */
export async function generateWeeklyDigest(
  db: DbClient,
): Promise<{ digest: DigestEntry[]; savedCount: number }> {
  const digestDate = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  console.log(`[evidence-digest] Searching PubMed for weekly digest (${digestDate})...`);

  // Step 1: Search PubMed
  const articles = await searchPubMed();
  console.log(`[evidence-digest] Found ${articles.length} articles`);

  if (articles.length === 0) {
    return { digest: [], savedCount: 0 };
  }

  // Step 2: Summarize articles
  const digestEntries: DigestEntry[] = [];
  console.log(`[evidence-digest] Summarizing ${articles.length} articles...`);

  for (const article of articles) {
    try {
      const entry = await summarizeArticle(article);
      digestEntries.push(entry);
      console.log(`[evidence-digest] Summarized PMID ${article.pmid}: ${article.title.slice(0, 80)}...`);
    } catch (err) {
      console.error(
        `[evidence-digest] Failed to summarize PMID ${article.pmid}:`,
        err instanceof Error ? err.message : err,
      );
      // Continue with other articles
    }
  }

  // Step 3: Save to medical_references table
  let savedCount = 0;
  for (const entry of digestEntries) {
    try {
      const contentJson = JSON.stringify(entry);

      // Check if already saved (by pmid + topic + subtopic uniqueness via findFirst)
      const existing = await db.medicalReference.findFirst({
        where: {
          topic: 'weekly_digest',
          subtopic: digestDate,
          content: contentJson,
        },
        select: { id: true },
      });

      if (existing) {
        console.log(`[evidence-digest] Skipping duplicate PMID ${entry.pmid} for ${digestDate}`);
        continue;
      }

      await db.medicalReference.create({
        data: {
          topic: 'weekly_digest',
          subtopic: digestDate,
          content: contentJson,
          source: 'PubMed',
          url: entry.url,
          keywords: extractKeywords(entry),
        },
      });
      savedCount++;
    } catch (err) {
      console.error(
        `[evidence-digest] Failed to save PMID ${entry.pmid}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log(`[evidence-digest] Saved ${savedCount} digest entries for ${digestDate}`);
  return { digest: digestEntries, savedCount };
}

/**
 * Extracts keyword tags from a digest entry for indexing.
 */
function extractKeywords(entry: DigestEntry): string[] {
  const keywords = new Set<string>();
  keywords.add('menopause');
  keywords.add('evidence_digest');

  const lowerTitle = entry.title.toLowerCase();
  if (lowerTitle.includes('mht') || lowerTitle.includes('hormone')) keywords.add('mht');
  if (lowerTitle.includes('vasomotor') || lowerTitle.includes('hot flush')) keywords.add('vasomotor');
  if (lowerTitle.includes('cardiovascular')) keywords.add('cardiovascular');
  if (lowerTitle.includes('bone') || lowerTitle.includes('osteoporosis')) keywords.add('bone_health');
  if (lowerTitle.includes('depression') || lowerTitle.includes('mood') || lowerTitle.includes('mental')) keywords.add('mental_health');
  if (lowerTitle.includes('sleep')) keywords.add('sleep');
  if (lowerTitle.includes('cancer') || lowerTitle.includes('breast')) keywords.add('cancer_risk');

  return [...keywords];
}
