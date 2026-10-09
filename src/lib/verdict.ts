import type {CandidateResult} from '../../shared/recommendation';
import type {DraftRequirement} from '../../shared/assessment';
export function verdict(result: CandidateResult, requirements: DraftRequirement[]) {
 const names = (statuses: string[]) => requirements.filter(r => r.mustHave && result.evidence.some(e => e.requirementId === r.id && statuses.includes(e.status))).map(r => r.text).join('; ');
 if (result.recommendation === 'Move to next round') return 'I recommend this candidate';
 if (result.recommendation === 'Maybe') return `Recommend only if the call confirms: ${names(['partial']) || requirements.filter(r => result.evidence.some(e => e.requirementId === r.id && e.status === 'partial')).slice(0,1).map(r => r.text).join('; ') || 'coverage below 80%: verify the remaining requirements'}`;
 if (result.recommendation === 'Not now') return `I do not recommend this candidate: missing ${names(['not_found','conflicting']) || result.missingMustHaves.join('; ') || 'required CV evidence'}`;
 return 'Unable to assess this candidate';
}
export const verdictRank = (result: CandidateResult | null) => result?.recommendation === 'Move to next round' ? 3 : result?.recommendation === 'Maybe' ? 2 : result?.recommendation === 'Not now' ? 1 : 0;
