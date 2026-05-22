import { dummyKnowledgeBase, type KnowledgeBaseEntry } from "./dummyKnowledgeBase.js";

export type RetrievedSource = {
  id: string;
  category: KnowledgeBaseEntry["category"];
  title: string;
  snippet: string;
  score: number;
};

const stopWords = new Set([
  "a",
  "an",
  "and",
  "are",
  "can",
  "do",
  "for",
  "how",
  "i",
  "is",
  "me",
  "my",
  "of",
  "please",
  "should",
  "the",
  "to",
  "what",
  "with",
  "you",
]);

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

function entryTokens(entry: KnowledgeBaseEntry): Set<string> {
  return new Set(tokenize([entry.id, entry.category, entry.title, entry.answer, ...entry.keywords].join(" ")));
}

function snippet(answer: string): string {
  const [firstSentence] = answer.split(". ");
  return `${firstSentence?.replace(/\.$/, "") ?? answer}.`;
}

export function retrieveContext(query: string, topK = 3): RetrievedSource[] {
  const boundedTopK = Math.max(1, Math.min(topK, 5));
  const queryTokens = new Set(tokenize(query));

  const scored = dummyKnowledgeBase.map((entry, index) => {
    const tokens = entryTokens(entry);
    let overlap = 0;
    for (const token of queryTokens) {
      if (tokens.has(token)) {
        overlap += 1;
      }
    }

    return {
      entry,
      index,
      score: overlap,
    };
  });

  return scored
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, boundedTopK)
    .map(({ entry, score }) => ({
      id: entry.id,
      category: entry.category,
      title: entry.title,
      snippet: snippet(entry.answer),
      score,
    }));
}

export function answerFromSources(query: string, sources: RetrievedSource[], caseStatus?: CaseStatusResult): string {
  const lowerQuery = query.toLowerCase();

  if (caseStatus) {
    return `${caseStatus.summary} This is synthetic case data for the demo only.`;
  }

  if (lowerQuery.includes("balance") || lowerQuery.includes("customer")) {
    return "I cannot reveal, invent, or infer customer balances or private records. In this synthetic demo, I can only explain how a customer can securely view their own information through verified banking channels.";
  }

  if (lowerQuery.includes("guarantee") || lowerQuery.includes("approval")) {
    return "I cannot guarantee a personal-loan approval, rate, limit, or outcome. I can explain the general synthetic eligibility workflow, but formal loan decisions require approved assessment channels.";
  }

  if (sources.length === 0) {
    return "I do not have enough grounded synthetic context to answer that. Ask about cards, transfers, loan support, fraud, complaints, digital support, or privacy boundaries.";
  }

  return sources.map((source) => source.snippet).join(" ");
}

export type CaseStatusResult = {
  caseId: string;
  status: "open" | "in_review" | "waiting" | "error";
  summary: string;
  updatedAt: string;
};

