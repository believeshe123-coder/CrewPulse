export const CUSTOMER_RATING_WEIGHT = 0.65;
export const STAFF_RATING_WEIGHT = 0.35;

export const INCIDENT_PENALTIES = {
  late: -0.3,
  sent_home: -0.7,
  ncns: -1.5,
} as const;

export type Tier = 'Elite' | 'Strong' | 'Solid' | 'At Risk' | 'Critical';

export type RatedJob = {
  staffRating?: number;
  customerRating?: number;
  occurredAt: string;
};

export type ReliabilitySnapshot = {
  totalJobs: number;
  late: number;
  sentHome: number;
  ncns: number;
};

export type NeedsReviewInput = {
  overallScore: number;
  ncnsRate: number;
  incidentsLast30Days: number;
  lastFivePerformanceScores: number[];
};

export type TerminateRecommendedInput = {
  overallScore: number;
  totalJobs: number;
  ncnsRate: number;
  ncnsInLastFiveJobs: number;
  severeIncidentFlag?: boolean;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const getCombinedRating = (job: RatedJob): number | null => {
  const hasStaff = typeof job.staffRating === 'number';
  const hasCustomer = typeof job.customerRating === 'number';

  if (!hasStaff && !hasCustomer) {
    return null;
  }

  if (hasStaff && hasCustomer) {
    return (job.customerRating as number) * CUSTOMER_RATING_WEIGHT + (job.staffRating as number) * STAFF_RATING_WEIGHT;
  }

  return (job.customerRating ?? job.staffRating) as number;
};

export const calculatePerformanceScore = (jobs: RatedJob[]): number => {
  const sortedJobs = [...jobs].sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());
  const ratedJobs = sortedJobs
    .map((job) => ({
      score: getCombinedRating(job),
    }))
    .filter((job): job is { score: number } => job.score !== null);

  if (ratedJobs.length === 0) {
    return 0;
  }

  const totalWeight = ratedJobs.reduce((sum, _job, index) => sum + (index + 1), 0);
  const weightedTotal = ratedJobs.reduce((sum, job, index) => sum + job.score * (index + 1), 0);

  return Number((weightedTotal / totalWeight).toFixed(2));
};

export const calculateLateRate = ({ late, totalJobs }: Pick<ReliabilitySnapshot, 'late' | 'totalJobs'>): number => {
  if (totalJobs === 0) {
    return 0;
  }

  return Number((late / totalJobs).toFixed(4));
};

export const calculateNcnsRate = ({ ncns, totalJobs }: Pick<ReliabilitySnapshot, 'ncns' | 'totalJobs'>): number => {
  if (totalJobs === 0) {
    return 0;
  }

  return Number((ncns / totalJobs).toFixed(4));
};

export const calculateReliabilityScore = ({ totalJobs, late, sentHome, ncns }: ReliabilitySnapshot): number => {
  if (totalJobs === 0) {
    return 5;
  }

  const penaltyTotal =
    late * INCIDENT_PENALTIES.late + sentHome * INCIDENT_PENALTIES.sent_home + ncns * INCIDENT_PENALTIES.ncns;
  const normalizedPenalty = penaltyTotal / totalJobs;

  return Number(clamp(5 + normalizedPenalty, 0, 5).toFixed(2));
};

export const mapTier = (score: number): Tier => {
  if (score >= 4.5) {
    return 'Elite';
  }

  if (score >= 4) {
    return 'Strong';
  }

  if (score >= 3.5) {
    return 'Solid';
  }

  if (score >= 3) {
    return 'At Risk';
  }

  return 'Critical';
};

export const hasDownwardTrendAcrossFiveJobs = (lastFivePerformanceScores: number[]): boolean => {
  if (lastFivePerformanceScores.length < 5) {
    return false;
  }

  return lastFivePerformanceScores.slice(0, 5).every((score, index, scores) => {
    if (index === 0) {
      return true;
    }

    return score < scores[index - 1];
  });
};

export const shouldFlagNeedsReview = (input: NeedsReviewInput): boolean => {
  return (
    input.overallScore < 3.5 ||
    input.ncnsRate > 0.15 ||
    input.incidentsLast30Days >= 3 ||
    hasDownwardTrendAcrossFiveJobs(input.lastFivePerformanceScores)
  );
};

export const shouldFlagTerminateRecommended = (input: TerminateRecommendedInput): boolean => {
  return (
    input.ncnsRate > 0.25 ||
    input.ncnsInLastFiveJobs >= 2 ||
    (input.overallScore < 3 && input.totalJobs >= 10) ||
    Boolean(input.severeIncidentFlag)
  );
};
