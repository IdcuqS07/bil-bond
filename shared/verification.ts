export interface WorkSubmission {
  summary: string;
  sources: string[];
  claims: string[];
  fabricated?: boolean;
}

export interface CriterionResult {
  id: string;
  label: string;
  passed: boolean;
  evidence: string;
}

export interface VerificationResult {
  passed: boolean;
  confidence: number;
  reasons: string[];
  evidence: string[];
  checks: CriterionResult[];
}

const URL_PATTERN = /^https?:\/\//i;
const FRAUD_MARKERS = /\b(fabricated|invented source|fake citation|no source|forged)\b/i;

export function evaluateSubmission(submission: WorkSubmission): VerificationResult {
  const sources = Array.isArray(submission.sources) ? submission.sources : [];
  const claims = Array.isArray(submission.claims) ? submission.claims : [];
  const validSources = sources.filter((source) => URL_PATTERN.test(source.trim()));
  const summaryLength = submission.summary.trim().length;
  const fraudMarker = FRAUD_MARKERS.test(
    `${submission.summary} ${claims.join(" ")} ${sources.join(" ")}`,
  );
  const claimCoverage = claims.length > 0 && validSources.length >= claims.length;
  const checks: CriterionResult[] = [
    {
      id: "summary-length",
      label: "Summary meets the minimum evidence length",
      passed: summaryLength >= 80,
      evidence: `${summaryLength} characters supplied; at least 80 required.`,
    },
    {
      id: "source-count",
      label: "At least three verifiable source URLs are included",
      passed: validSources.length >= 3,
      evidence: `${validSources.length} URL-formatted source(s) supplied; at least 3 required.`,
    },
    {
      id: "claim-coverage",
      label: "Every listed claim has source coverage",
      passed: claimCoverage,
      evidence: `${claims.length} claim(s) and ${validSources.length} URL-formatted source(s) supplied.`,
    },
    {
      id: "integrity-marker",
      label: "No explicit fabrication marker is present",
      passed: !submission.fabricated && !fraudMarker,
      evidence: fraudMarker || submission.fabricated
        ? "A known demo fabrication marker was found."
        : "No known demo fabrication marker was found.",
    },
  ];

  const passedChecks = checks.filter((check) => check.passed).length;
  const passed = passedChecks === checks.length;
  const reasons = checks.filter((check) => !check.passed).map((check) => check.label);
  const evidence = checks.map((check) => `${check.label}: ${check.evidence}`);
  const confidence = fraudMarker || submission.fabricated
    ? 96
    : passed
      ? 92
      : 72 + passedChecks * 4;

  return { passed, confidence, reasons, evidence, checks };
}
