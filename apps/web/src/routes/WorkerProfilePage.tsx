import { Badge, Card, Flex, Grid, Heading, Separator, Table, Text } from '@radix-ui/themes';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom';

import {
  type AssignmentRecord,
  fetchWorkerProfile,
  listAssignments,
  type WorkerRecord,
} from '../lib/api';
import { readAuthState } from '../lib/auth';
import { getWorkerStatus, statusColor, statusLabel } from '../lib/workerSemantics';

const getAssignmentOverall = (assignment: AssignmentRecord): number | null => {
  if (assignment.customerRating?.overall && assignment.staffRating?.overall) {
    return Number(
      (assignment.customerRating.overall * 0.65 + assignment.staffRating.overall * 0.35).toFixed(2),
    );
  }

  return assignment.customerRating?.overall ?? assignment.staffRating?.overall ?? null;
};

const average = (values: number[]) => {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
};

export const WorkerProfilePage = () => {
  const params = useParams();
  const auth = readAuthState();

  const query = useQuery({
    queryKey: ['worker-profile-v2', params.id],
    queryFn: async () => {
      if (!auth || !params.id) {
        throw new Error('Missing auth or worker id');
      }

      const [profileResponse, assignments] = await Promise.all([
        fetchWorkerProfile(params.id, auth),
        listAssignments(auth),
      ]);

      if (!profileResponse.ok) {
        throw new Error(`Profile request failed with ${profileResponse.status}`);
      }

      const profile = (await profileResponse.json()) as WorkerRecord;

      return { profile, assignments };
    },
    retry: false,
  });

  const derived = useMemo(() => {
    if (!query.data) {
      return null;
    }

    const workerAssignments = query.data.assignments.filter(
      (assignment) => assignment.workerId === query.data.profile.id,
    );
    const now = Date.now();
    const thirtyDaysAgo = now - 1000 * 60 * 60 * 24 * 30;

    const last30Scores = workerAssignments
      .filter((assignment) => new Date(assignment.scheduledStart).getTime() >= thirtyDaysAgo)
      .map((assignment) => getAssignmentOverall(assignment))
      .filter((score): score is number => score !== null);

    const categoryMap = new Map<string, { jobs: number; scores: number[] }>();

    for (const assignment of workerAssignments) {
      const current = categoryMap.get(assignment.category) ?? { jobs: 0, scores: [] };
      current.jobs += 1;
      const score = getAssignmentOverall(assignment);
      if (score !== null) {
        current.scores.push(score);
      }
      categoryMap.set(assignment.category, current);
    }

    const categories = Array.from(categoryMap.entries())
      .filter(([, value]) => value.jobs >= 3)
      .map(([category, value]) => ({
        category,
        jobs: value.jobs,
        avgScore: average(value.scores),
      }))
      .sort((a, b) => b.jobs - a.jobs);

    const allEvents = workerAssignments.flatMap((assignment) => assignment.events);
    const totalJobs = workerAssignments.length;
    const completed = allEvents.filter((event) => event.eventType === 'completed').length;
    const late = allEvents.filter((event) => event.eventType === 'late').length;
    const sentHome = allEvents.filter((event) => event.eventType === 'sent_home').length;
    const ncns = allEvents.filter((event) => event.eventType === 'ncns').length;

    return {
      totalJobs,
      last30DayScore: average(last30Scores),
      categories,
      reliability: {
        totalJobs,
        completed,
        late,
        sentHome,
        ncns,
        completionRate: totalJobs > 0 ? Number((completed / totalJobs).toFixed(4)) : 0,
        lateRate: totalJobs > 0 ? Number((late / totalJobs).toFixed(4)) : 0,
        sentHomeRate: totalJobs > 0 ? Number((sentHome / totalJobs).toFixed(4)) : 0,
        ncnsRate: totalJobs > 0 ? Number((ncns / totalJobs).toFixed(4)) : 0,
      },
    };
  }, [query.data]);

  return (
    <Flex minHeight="100vh" justify="center" p="6">
      <Card size="3" style={{ width: '100%', maxWidth: 900 }}>
        <Heading size="6">Worker profile</Heading>
        {query.isPending && <Badge color="gray">Loading...</Badge>}
        {query.isError && <Badge color="red">Unable to load worker profile.</Badge>}

        {query.data && derived && (
          <Flex direction="column" gap="4" mt="3">
            <Flex justify="between" align="center" wrap="wrap" gap="2">
              <Flex direction="column" gap="1">
                <Heading size="5">{query.data.profile.name}</Heading>
                <Text color="gray">{query.data.profile.id}</Text>
              </Flex>

              <Flex align="center" gap="2" wrap="wrap">
                <Badge color={statusColor(getWorkerStatus(query.data.profile))}>
                  {statusLabel(getWorkerStatus(query.data.profile))}
                </Badge>
                <Badge color={statusColor(getWorkerStatus(query.data.profile))}>
                  Overall {query.data.profile.score.toFixed(2)}
                </Badge>
                <Badge color={statusColor(getWorkerStatus(query.data.profile))}>
                  Tier {query.data.profile.tier}
                </Badge>
              </Flex>
            </Flex>

            <Grid columns={{ initial: '1', sm: '2' }} gap="3">
              <Card>
                <Text color="gray" size="2">
                  Total jobs
                </Text>
                <Heading>{derived.totalJobs}</Heading>
              </Card>
              <Card>
                <Text color="gray" size="2">
                  Last 30-day score
                </Text>
                <Heading>{derived.last30DayScore.toFixed(2)}</Heading>
              </Card>
            </Grid>

            <Card>
              <Heading size="4" mb="2">
                Category breakdown (3+ jobs)
              </Heading>
              {derived.categories.length === 0 ? (
                <Text color="gray">No categories have 3+ jobs yet.</Text>
              ) : (
                <Table.Root>
                  <Table.Header>
                    <Table.Row>
                      <Table.ColumnHeaderCell>Category</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Jobs</Table.ColumnHeaderCell>
                      <Table.ColumnHeaderCell>Average score</Table.ColumnHeaderCell>
                    </Table.Row>
                  </Table.Header>
                  <Table.Body>
                    {derived.categories.map((category) => (
                      <Table.Row key={category.category}>
                        <Table.RowHeaderCell>{category.category}</Table.RowHeaderCell>
                        <Table.Cell>{category.jobs}</Table.Cell>
                        <Table.Cell>{category.avgScore.toFixed(2)}</Table.Cell>
                      </Table.Row>
                    ))}
                  </Table.Body>
                </Table.Root>
              )}
            </Card>

            <Separator size="4" />

            <Card>
              <Heading size="4" mb="2">
                Reliability panel
              </Heading>
              <Grid columns={{ initial: '1', sm: '2', lg: '3' }} gap="2">
                <Text>Total: {derived.reliability.totalJobs}</Text>
                <Text>
                  Completed: {derived.reliability.completed} (
                  {(derived.reliability.completionRate * 100).toFixed(1)}%)
                </Text>
                <Text>
                  Late: {derived.reliability.late} (
                  {(derived.reliability.lateRate * 100).toFixed(1)}%)
                </Text>
                <Text>
                  Sent home: {derived.reliability.sentHome} (
                  {(derived.reliability.sentHomeRate * 100).toFixed(1)}%)
                </Text>
                <Text>
                  NCNS: {derived.reliability.ncns} (
                  {(derived.reliability.ncnsRate * 100).toFixed(1)}%)
                </Text>
              </Grid>
            </Card>
          </Flex>
        )}
      </Card>
    </Flex>
  );
};
