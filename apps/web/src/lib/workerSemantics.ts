export type WorkerStatus = 'strong' | 'needs_review' | 'high_risk' | 'terminate';

export const getWorkerStatus = (input: {
  flags: string[];
  ncnsRate: number;
  lateRate: number;
  reliabilityScore: number;
  score: number;
}): WorkerStatus => {
  if (input.flags.includes('terminate-recommended')) {
    return 'terminate';
  }

  if (
    input.ncnsRate >= 0.15 ||
    input.lateRate >= 0.2 ||
    input.reliabilityScore < 3.8 ||
    input.score < 3.5
  ) {
    return 'high_risk';
  }

  if (input.flags.includes('needs-review') || input.score < 4.2) {
    return 'needs_review';
  }

  return 'strong';
};

export const statusColor = (status: WorkerStatus): 'green' | 'yellow' | 'orange' | 'red' => {
  if (status === 'terminate') {
    return 'red';
  }

  if (status === 'high_risk') {
    return 'orange';
  }

  if (status === 'needs_review') {
    return 'yellow';
  }

  return 'green';
};

export const statusLabel = (status: WorkerStatus): string => {
  if (status === 'terminate') {
    return 'Terminate recommended';
  }

  if (status === 'high_risk') {
    return 'High risk / hold';
  }

  if (status === 'needs_review') {
    return 'Needs review';
  }

  return 'Strong';
};
