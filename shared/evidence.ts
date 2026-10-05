export type Requirement = { id: string; text: string; mustHave: boolean };
export type EvidenceStatus = 'found' | 'partial' | 'conflicting' | 'not_found' | 'needs_checking';
export type VerificationIssue = 'missing_row' | 'quote_mismatch' | 'missing_quotes';
export const verificationMessages: Record<VerificationIssue, string> = {
  missing_row: 'The AI did not return an answer for this requirement. The assessment is incomplete.',
  quote_mismatch: 'The AI supplied a quote that did not match the CV exactly. This claim remains unverified.',
  missing_quotes: 'The AI made an evidence claim without a supporting quote. This claim remains unverified.',
};
export type RawEvidence = {
  requirementId: string; status: EvidenceStatus; quotes: string[]; explanation: string; question: string;
};
export type VerifiedEvidence = Omit<RawEvidence, 'quotes'> & {
  quotes: { text: string; start: number; end: number }[];
  verificationIssue?: VerificationIssue;
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
    const fallback = (verificationIssue: VerificationIssue): VerifiedEvidence => ({
      requirementId: requirement.id, status: 'needs_checking', quotes: [],
      verificationIssue, explanation: verificationMessages[verificationIssue],
      question: `What experience can you share that demonstrates: ${requirement.text}?`,
    });
    if (!row) return fallback('missing_row');
    const quotes = row.quotes.map(text => {
      const start = text.trim() ? cv.indexOf(text) : -1;
      return { text, start, end: start + text.length };
    });
    if (quotes.some(quote => quote.start < 0)) return fallback('quote_mismatch');
    if (['found', 'partial', 'conflicting'].includes(row.status) && quotes.length === 0) return fallback('missing_quotes');
    return {
      ...row, quotes,
      explanation: row.status === 'not_found'
        ? 'No supporting evidence was found in this CV. This does not establish that the candidate lacks the requirement.'
        : row.explanation,
      question: row.question.trim() || `What experience can you share that demonstrates: ${requirement.text}?`,
    };
  });
}
