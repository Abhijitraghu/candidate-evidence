export type Requirement = { id: string; text: string; mustHave: boolean };
export type EvidenceStatus = 'found' | 'partial' | 'conflicting' | 'not_found' | 'needs_checking';
export type RawEvidence = {
  requirementId: string; status: EvidenceStatus; quotes: string[]; explanation: string; question: string;
};
export type VerifiedEvidence = Omit<RawEvidence, 'quotes'> & {
  quotes: { text: string; start: number; end: number }[];
};

// Quotes are matched case-sensitively to the exact extracted document; no fuzzy matching.
export function verifyEvidence(requirements: Requirement[], cv: string, raw: RawEvidence[]): VerifiedEvidence[] {
  const ids = new Set(requirements.map(r => r.id));
  const seen = new Set<string>();
  for (const row of raw) {
    if (!ids.has(row.requirementId) || seen.has(row.requirementId)) throw new Error('Invalid assessment requirements.');
    seen.add(row.requirementId);
  }
  return requirements.map(requirement => {
    const row = raw.find(item => item.requirementId === requirement.id);
    const fallback: VerifiedEvidence = {
      requirementId: requirement.id, status: 'needs_checking', quotes: [],
      explanation: 'The assessment could not provide verified CV evidence for this requirement. Check it in a recruiter call.',
      question: `What experience can you share that demonstrates: ${requirement.text}?`,
    };
    if (!row) return fallback;
    const quotes = row.quotes.map(text => {
      const start = text.trim() ? cv.indexOf(text) : -1;
      return { text, start, end: start + text.length };
    });
    if (quotes.some(quote => quote.start < 0)) return fallback;
    if (['found', 'partial', 'conflicting'].includes(row.status) && quotes.length === 0) return fallback;
    return {
      ...row, quotes,
      explanation: row.status === 'not_found'
        ? 'No supporting evidence was found in this CV. This does not establish that the candidate lacks the requirement.'
        : row.explanation,
      question: row.question.trim() || fallback.question,
    };
  });
}
