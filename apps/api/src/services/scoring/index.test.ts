import assert from 'node:assert/strict';
import test from 'node:test';

import {
  calculateLateRate,
  calculateNcnsRate,
  calculatePerformanceScore,
  calculateReliabilityScore,
  mapTier,
  shouldFlagNeedsReview,
  shouldFlagTerminateRecommended,
} from './index.js';

test('handles low total job counts without division issues', () => {
  assert.equal(calculatePerformanceScore([]), 0);
  assert.equal(calculateReliabilityScore({ totalJobs: 0, late: 0, sentHome: 0, ncns: 0 }), 5);
  assert.equal(calculateLateRate({ totalJobs: 0, late: 0 }), 0);
  assert.equal(calculateNcnsRate({ totalJobs: 0, ncns: 0 }), 0);
});

test('flags terminate recommended for 2 NCNS in last 5 jobs', () => {
  const flagged = shouldFlagTerminateRecommended({
    overallScore: 4,
    totalJobs: 5,
    ncnsRate: 0.2,
    ncnsInLastFiveJobs: 2,
    severeIncidentFlag: false,
  });

  assert.equal(flagged, true);
});

test('tier/flag threshold boundaries are respected', () => {
  assert.equal(mapTier(3.49), 'At Risk');
  assert.equal(mapTier(3.5), 'Solid');
  assert.equal(mapTier(2.99), 'Critical');
  assert.equal(mapTier(3), 'At Risk');

  assert.equal(
    shouldFlagNeedsReview({
      overallScore: 3.49,
      ncnsRate: 0.05,
      incidentsLast30Days: 0,
      lastFivePerformanceScores: [],
    }),
    true,
  );

  assert.equal(
    shouldFlagNeedsReview({
      overallScore: 3.5,
      ncnsRate: 0.05,
      incidentsLast30Days: 0,
      lastFivePerformanceScores: [],
    }),
    false,
  );

  assert.equal(
    shouldFlagTerminateRecommended({
      overallScore: 2.99,
      totalJobs: 10,
      ncnsRate: 0,
      ncnsInLastFiveJobs: 0,
      severeIncidentFlag: false,
    }),
    true,
  );

  assert.equal(
    shouldFlagTerminateRecommended({
      overallScore: 3,
      totalJobs: 10,
      ncnsRate: 0,
      ncnsInLastFiveJobs: 0,
      severeIncidentFlag: false,
    }),
    false,
  );
});
