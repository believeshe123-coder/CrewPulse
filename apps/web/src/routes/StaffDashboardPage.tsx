import {
  Badge,
  Box,
  Card,
  Checkbox,
  Flex,
  Grid,
  Heading,
  Link,
  Separator,
  Text,
  TextField,
} from '@radix-ui/themes';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

import { type AssignmentRecord, listAssignments, type WorkerRecord } from '../lib/api';
import { readAuthState } from '../lib/auth';
import { getWorkerStatus, statusColor, statusLabel } from '../lib/workerSemantics';

type WorkerDashboardSummary = WorkerRecord & {
  warehouseJobs: number;
  cleanupAverage: number | null;
};

const avg = (values: number[]): number => {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
};

const getAssignmentOverall = (assignment: AssignmentRecord): number | null => {
  if (assignment.customerRating?.overall && assignment.staffRating?.overall) {
    return Number(
      (assignment.customerRating.overall * 0.65 + assignment.staffRating.overall * 0.35).toFixed(2),
    );
  }

  return assignment.customerRating?.overall ?? assignment.staffRating?.overall ?? null;
};

export const StaffDashboardPage = () => {
  const auth = readAuthState();
  const [searchParams, setSearchParams] = useSearchParams();

  const query = useQuery({
    queryKey: ['staff-dashboard-assignments'],
    queryFn: async () => {
      if (!auth) {
        throw new Error('Missing auth');
      }

      return listAssignments(auth);
    },
    retry: false,
  });

  const workers = useMemo<WorkerDashboardSummary[]>(() => {
    if (!query.data) {
      return [];
    }

    const withWorkers = query.data.filter((assignment) => assignment.worker) as Array<
      AssignmentRecord & { worker: WorkerRecord }
    >;
    const workerById = new Map<string, WorkerDashboardSummary>();

    for (const assignment of withWorkers) {
      const existing = workerById.get(assignment.worker.id);
      if (!existing) {
        workerById.set(assignment.worker.id, {
          ...assignment.worker,
          warehouseJobs: 0,
          cleanupAverage: null,
        });
      }

      if (assignment.category.toLowerCase() === 'warehouse') {
        workerById.get(assignment.worker.id)!.warehouseJobs += 1;
      }
    }

    for (const [workerId, worker] of workerById) {
      const cleanupScores = withWorkers
        .filter(
          (assignment) =>
            assignment.workerId === workerId && assignment.category.toLowerCase() === 'cleanup',
        )
        .map((assignment) => getAssignmentOverall(assignment))
        .filter((score): score is number => score !== null);

      worker.cleanupAverage = cleanupScores.length > 0 ? avg(cleanupScores) : null;
    }

    return Array.from(workerById.values());
  }, [query.data]);

  const filteredWorkers = useMemo(() => {
    const q = (searchParams.get('q') ?? '').toLowerCase().trim();
    const topWarehouse = searchParams.get('topWarehouse') === '1';
    const highReliability = searchParams.get('highReliability') === '1';
    const needsReview = searchParams.get('needsReview') === '1';
    const terminateFlagged = searchParams.get('terminateFlagged') === '1';
    const lowCleanupRating = searchParams.get('lowCleanupRating') === '1';
    const ncnsRisk = searchParams.get('ncnsRisk') === '1';

    return workers
      .filter((worker) => {
        const matchesText =
          q.length === 0 ||
          worker.name.toLowerCase().includes(q) ||
          worker.id.toLowerCase().includes(q) ||
          (worker.phone ?? '').toLowerCase().includes(q);

        if (!matchesText) {
          return false;
        }

        if (topWarehouse && worker.warehouseJobs < 3) {
          return false;
        }

        if (highReliability && worker.reliabilityScore < 4.5) {
          return false;
        }

        if (needsReview && !worker.flags.includes('needs-review')) {
          return false;
        }

        if (terminateFlagged && !worker.flags.includes('terminate-recommended')) {
          return false;
        }

        if (lowCleanupRating && (worker.cleanupAverage === null || worker.cleanupAverage >= 3.5)) {
          return false;
        }

        if (ncnsRisk && worker.ncnsRate < 0.15) {
          return false;
        }

        return true;
      })
      .sort((a, b) => b.score - a.score);
  }, [searchParams, workers]);

  const metrics = useMemo(() => {
    const workforceAverage = avg(filteredWorkers.map((worker) => worker.score));
    const activeCount = filteredWorkers.length;
    const needsReviewCount = filteredWorkers.filter((worker) =>
      worker.flags.includes('needs-review'),
    ).length;
    const terminateCount = filteredWorkers.filter((worker) =>
      worker.flags.includes('terminate-recommended'),
    ).length;

    return { workforceAverage, activeCount, needsReviewCount, terminateCount };
  }, [filteredWorkers]);

  const topPerformers = filteredWorkers.slice(0, 5);
  const needsReviewWorkers = filteredWorkers.filter((worker) =>
    worker.flags.includes('needs-review'),
  );
  const ncnsRiskWorkers = filteredWorkers
    .filter((worker) => worker.ncnsRate >= 0.15)
    .sort((a, b) => b.ncnsRate - a.ncnsRate);
  const chronicLateWorkers = filteredWorkers
    .filter((worker) => worker.lateRate >= 0.15)
    .sort((a, b) => b.lateRate - a.lateRate);

  const setParam = (key: string, enabled: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (enabled) {
      next.set(key, '1');
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  };

  return (
    <Flex direction="column" p="6" gap="4">
      <Flex justify="between" align="center" wrap="wrap" gap="2">
        <Heading size="7">Staff Dashboard</Heading>
        <Text color="gray">Operational workforce health snapshot</Text>
      </Flex>

      <Grid columns={{ initial: '1', sm: '2', lg: '4' }} gap="3">
        <Card>
          <Text size="2" color="gray">
            Workforce Avg
          </Text>
          <Heading>{metrics.workforceAverage.toFixed(2)}</Heading>
        </Card>
        <Card>
          <Text size="2" color="gray">
            Active Count
          </Text>
          <Heading>{metrics.activeCount}</Heading>
        </Card>
        <Card>
          <Text size="2" color="gray">
            Needs Review
          </Text>
          <Heading>{metrics.needsReviewCount}</Heading>
        </Card>
        <Card>
          <Text size="2" color="gray">
            Terminate Count
          </Text>
          <Heading>{metrics.terminateCount}</Heading>
        </Card>
      </Grid>

      <Card>
        <Flex direction="column" gap="3">
          <Heading size="4">Search + filters</Heading>
          <TextField.Root
            value={searchParams.get('q') ?? ''}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              if (event.target.value.trim().length > 0) {
                next.set('q', event.target.value);
              } else {
                next.delete('q');
              }
              setSearchParams(next);
            }}
            placeholder="Search by name / id / phone"
          />

          <Grid columns={{ initial: '1', sm: '2', md: '3' }} gap="2">
            {[
              ['topWarehouse', 'Top warehouse workers'],
              ['highReliability', 'High reliability'],
              ['needsReview', 'Needs review'],
              ['terminateFlagged', 'Terminate flagged'],
              ['lowCleanupRating', 'Low cleanup rating'],
              ['ncnsRisk', 'NCNS risk'],
            ].map(([key, label]) => (
              <Flex key={key} align="center" gap="2">
                <Checkbox
                  checked={searchParams.get(key) === '1'}
                  onCheckedChange={(checked) => setParam(key, Boolean(checked))}
                />
                <Text size="2">{label}</Text>
              </Flex>
            ))}
          </Grid>
        </Flex>
      </Card>

      {query.isPending && <Badge color="gray">Loading staff dashboard...</Badge>}
      {query.isError && <Badge color="red">Unable to load staff dashboard data.</Badge>}

      <Grid columns={{ initial: '1', lg: '2' }} gap="3">
        <Card>
          <Heading size="4" mb="2">
            Top Performers
          </Heading>
          <Flex direction="column" gap="2">
            {topPerformers.map((worker) => {
              const status = getWorkerStatus(worker);
              return (
                <Box key={worker.id}>
                  <Flex align="center" justify="between" gap="2">
                    <Link href={`/workers/${worker.id}`}>{worker.name}</Link>
                    <Badge color={statusColor(status)}>{statusLabel(status)}</Badge>
                  </Flex>
                  <Text size="2" color="gray">
                    Score {worker.score} • Tier {worker.tier}
                  </Text>
                </Box>
              );
            })}
            {topPerformers.length === 0 && (
              <Text color="gray">No workers match current filters.</Text>
            )}
          </Flex>
        </Card>

        <Card>
          <Heading size="4" mb="2">
            Needs Review
          </Heading>
          <Flex direction="column" gap="2">
            {needsReviewWorkers.map((worker) => (
              <Box key={worker.id}>
                <Flex align="center" justify="between">
                  <Link href={`/workers/${worker.id}`}>{worker.name}</Link>
                  <Badge color="yellow">Needs review</Badge>
                </Flex>
                <Text size="2" color="gray">
                  Score {worker.score} • Reliability {worker.reliabilityScore.toFixed(2)}
                </Text>
              </Box>
            ))}
            {needsReviewWorkers.length === 0 && (
              <Text color="gray">No workers currently flagged for review.</Text>
            )}
          </Flex>
        </Card>

        <Card>
          <Heading size="4" mb="2">
            NCNS Risk
          </Heading>
          <Flex direction="column" gap="2">
            {ncnsRiskWorkers.map((worker) => {
              const status = getWorkerStatus(worker);
              return (
                <Box key={worker.id}>
                  <Flex align="center" justify="between">
                    <Link href={`/workers/${worker.id}`}>{worker.name}</Link>
                    <Badge color={statusColor(status)}>{statusLabel(status)}</Badge>
                  </Flex>
                  <Text size="2" color="gray">
                    NCNS rate {(worker.ncnsRate * 100).toFixed(1)}%
                  </Text>
                </Box>
              );
            })}
            {ncnsRiskWorkers.length === 0 && (
              <Text color="gray">No workers in NCNS risk range.</Text>
            )}
          </Flex>
        </Card>

        <Card>
          <Heading size="4" mb="2">
            Chronic Late
          </Heading>
          <Flex direction="column" gap="2">
            {chronicLateWorkers.map((worker) => {
              const status = getWorkerStatus(worker);
              return (
                <Box key={worker.id}>
                  <Flex align="center" justify="between">
                    <Link href={`/workers/${worker.id}`}>{worker.name}</Link>
                    <Badge color={statusColor(status)}>{statusLabel(status)}</Badge>
                  </Flex>
                  <Text size="2" color="gray">
                    Late rate {(worker.lateRate * 100).toFixed(1)}%
                  </Text>
                </Box>
              );
            })}
            {chronicLateWorkers.length === 0 && <Text color="gray">No chronic late workers.</Text>}
          </Flex>
        </Card>
      </Grid>

      <Separator size="4" />

      <Card>
        <Heading size="4" mb="2">
          Filtered worker roster
        </Heading>
        <Flex direction="column" gap="2">
          {filteredWorkers.map((worker) => {
            const status = getWorkerStatus(worker);
            return (
              <Flex key={worker.id} align="center" justify="between" wrap="wrap" gap="2">
                <Box>
                  <Link href={`/workers/${worker.id}`}>{worker.name}</Link>
                  <Text size="2" color="gray">
                    {worker.id} • phone {worker.phone ?? 'n/a'}
                  </Text>
                </Box>
                <Flex align="center" gap="2">
                  <Badge color={statusColor(status)}>{statusLabel(status)}</Badge>
                  <Text>Score {worker.score}</Text>
                </Flex>
              </Flex>
            );
          })}
          {filteredWorkers.length === 0 && (
            <Text color="gray">No workers match the selected filters.</Text>
          )}
        </Flex>
      </Card>
    </Flex>
  );
};
