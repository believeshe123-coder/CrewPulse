import { Badge, Button, Card, Flex, Heading, Link, Table, Text, TextField } from '@radix-ui/themes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { readAuthState } from '../lib/auth';
import { createAssignment, listAssignments } from '../lib/api';

export const AssignmentsPage = () => {
  const auth = readAuthState();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [workerId, setWorkerId] = useState('worker-1');
  const [category, setCategory] = useState('warehouse');
  const [scheduledStart, setScheduledStart] = useState('2026-02-15T09:00:00.000Z');
  const [scheduledEnd, setScheduledEnd] = useState('2026-02-15T17:00:00.000Z');

  const assignmentsQuery = useQuery({
    queryKey: ['assignments'],
    queryFn: async () => {
      if (!auth) {
        throw new Error('Missing auth');
      }

      return listAssignments(auth);
    },
    enabled: Boolean(auth),
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!auth) {
        throw new Error('Missing auth');
      }

      const response = await createAssignment(auth, {
        workerId,
        category,
        scheduledStart,
        scheduledEnd,
      });

      if (!response.ok) {
        throw new Error(`Create failed (${response.status})`);
      }

      return response.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['assignments'] });
    },
  });

  return (
    <Flex minHeight="100vh" justify="center" p="6">
      <Card size="3" style={{ width: '100%', maxWidth: 980 }}>
        <Flex direction="column" gap="4">
          <Heading size="6">Assignments</Heading>
          <Text color="gray" size="2">
            Create assignments, then open details to record staffing outcomes and ratings.
          </Text>

          <Card variant="surface">
            <Flex direction="column" gap="2">
              <Heading size="4">Create assignment</Heading>
              <TextField.Root value={workerId} onChange={(event) => setWorkerId(event.target.value)} placeholder="worker-1" />
              <TextField.Root value={category} onChange={(event) => setCategory(event.target.value)} placeholder="warehouse" />
              <TextField.Root
                value={scheduledStart}
                onChange={(event) => setScheduledStart(event.target.value)}
                placeholder="2026-02-15T09:00:00.000Z"
              />
              <TextField.Root
                value={scheduledEnd}
                onChange={(event) => setScheduledEnd(event.target.value)}
                placeholder="2026-02-15T17:00:00.000Z"
              />
              <Flex gap="2" align="center">
                <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
                  Save assignment
                </Button>
                {createMutation.isSuccess && <Badge color="green">Created</Badge>}
                {createMutation.isError && <Badge color="red">Failed to create assignment</Badge>}
              </Flex>
            </Flex>
          </Card>

          {assignmentsQuery.isError && <Badge color="red">Failed to load assignments.</Badge>}
          {assignmentsQuery.isPending && <Badge color="gray">Loading assignments...</Badge>}

          {assignmentsQuery.data && (
            <Table.Root variant="surface">
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeaderCell>ID</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Worker</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Category</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Events</Table.ColumnHeaderCell>
                  <Table.ColumnHeaderCell>Ratings</Table.ColumnHeaderCell>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {assignmentsQuery.data.map((assignment) => (
                  <Table.Row key={assignment.id}>
                    <Table.Cell>
                      <Link onClick={() => navigate(`/assignments/${assignment.id}`)}>{assignment.id}</Link>
                    </Table.Cell>
                    <Table.Cell>{assignment.workerId}</Table.Cell>
                    <Table.Cell>{assignment.category}</Table.Cell>
                    <Table.Cell>{assignment.events.length}</Table.Cell>
                    <Table.Cell>
                      {assignment.staffRating ? 'staff ✓ ' : 'staff - '} / {assignment.customerRating ? 'customer ✓' : 'customer -'}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          )}
        </Flex>
      </Card>
    </Flex>
  );
};
