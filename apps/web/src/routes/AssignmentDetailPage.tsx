import {
  Badge,
  Button,
  Card,
  Checkbox,
  Flex,
  Heading,
  Select,
  Separator,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';

import { readAuthState } from '../lib/auth';
import {
  createAssignmentEvent,
  fetchAssignmentDetail,
  submitCustomerRating,
  submitStaffRating,
  type AssignmentEventType,
} from '../lib/api';

export const AssignmentDetailPage = () => {
  const auth = readAuthState();
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [eventType, setEventType] = useState<AssignmentEventType>('completed');
  const [eventNotes, setEventNotes] = useState('');
  const [staffOverall, setStaffOverall] = useState('5');
  const [staffTags, setStaffTags] = useState('reliable,teamwork');
  const [staffNotes, setStaffNotes] = useState('');
  const [customerOverall, setCustomerOverall] = useState('5');
  const [punctuality, setPunctuality] = useState('');
  const [quality, setQuality] = useState('');
  const [wouldRehire, setWouldRehire] = useState(false);
  const [customerComments, setCustomerComments] = useState('');

  const assignmentQuery = useQuery({
    queryKey: ['assignment', id],
    queryFn: async () => {
      if (!auth || !id) {
        throw new Error('Missing auth or id');
      }

      return fetchAssignmentDetail(id, auth);
    },
    enabled: Boolean(auth && id),
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['assignment', id] });
    await queryClient.invalidateQueries({ queryKey: ['assignments'] });
  };

  const eventMutation = useMutation({
    mutationFn: async () => {
      if (!auth || !id) {
        throw new Error('Missing auth or id');
      }

      const response = await createAssignmentEvent(id, auth, {
        eventType,
        notes: eventNotes || undefined,
      });

      if (!response.ok) {
        throw new Error(`Failed (${response.status})`);
      }

      return response.json();
    },
    onSuccess: () => refresh(),
  });

  const staffRatingMutation = useMutation({
    mutationFn: async () => {
      if (!auth || !id) {
        throw new Error('Missing auth or id');
      }

      const response = await submitStaffRating(id, auth, {
        overall: Number(staffOverall),
        tags: staffTags
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
        internalNotes: staffNotes || undefined,
      });

      if (!response.ok) {
        throw new Error(`Failed (${response.status})`);
      }

      return response.json();
    },
    onSuccess: () => refresh(),
  });

  const customerRatingMutation = useMutation({
    mutationFn: async () => {
      if (!auth || !id) {
        throw new Error('Missing auth or id');
      }

      const response = await submitCustomerRating(id, auth, {
        overall: Number(customerOverall),
        punctuality: punctuality ? Number(punctuality) : undefined,
        quality: quality ? Number(quality) : undefined,
        wouldRehire,
        comments: customerComments || undefined,
      });

      if (!response.ok) {
        throw new Error(`Failed (${response.status})`);
      }

      return response.json();
    },
    onSuccess: () => refresh(),
  });

  return (
    <Flex minHeight="100vh" justify="center" p="6">
      <Card size="3" style={{ width: '100%', maxWidth: 980 }}>
        <Flex direction="column" gap="4">
          <Heading size="6">Assignment detail {id}</Heading>
          {assignmentQuery.isError && <Badge color="red">Unable to load assignment.</Badge>}
          {assignmentQuery.isPending && <Badge color="gray">Loading assignment...</Badge>}
          {assignmentQuery.data && (
            <>
              <Text size="2" color="gray">
                Worker: {assignmentQuery.data.workerId} • Category: {assignmentQuery.data.category}
              </Text>

              <Card variant="surface">
                <Flex direction="column" gap="2">
                  <Heading size="4">Record staffing outcome</Heading>
                  <Select.Root value={eventType} onValueChange={(value) => setEventType(value as AssignmentEventType)}>
                    <Select.Trigger />
                    <Select.Content>
                      <Select.Item value="completed">completed</Select.Item>
                      <Select.Item value="late">late</Select.Item>
                      <Select.Item value="sent_home">sent_home</Select.Item>
                      <Select.Item value="ncns">ncns</Select.Item>
                    </Select.Content>
                  </Select.Root>
                  <TextArea
                    placeholder="Event notes"
                    value={eventNotes}
                    onChange={(event) => setEventNotes(event.target.value)}
                  />
                  <Flex gap="2" align="center">
                    <Button onClick={() => eventMutation.mutate()}>Add event</Button>
                    {eventMutation.isSuccess && <Badge color="green">Saved</Badge>}
                    {eventMutation.isError && <Badge color="red">Failed</Badge>}
                  </Flex>
                </Flex>
              </Card>

              <Card variant="surface">
                <Flex direction="column" gap="2">
                  <Heading size="4">Submit staff rating</Heading>
                  <TextField.Root
                    placeholder="Overall (1-5)"
                    value={staffOverall}
                    onChange={(event) => setStaffOverall(event.target.value)}
                  />
                  <TextField.Root
                    placeholder="Tags comma separated"
                    value={staffTags}
                    onChange={(event) => setStaffTags(event.target.value)}
                  />
                  <TextArea
                    placeholder="Internal notes"
                    value={staffNotes}
                    onChange={(event) => setStaffNotes(event.target.value)}
                  />
                  <Flex gap="2" align="center">
                    <Button onClick={() => staffRatingMutation.mutate()}>Save staff rating</Button>
                    {staffRatingMutation.isSuccess && <Badge color="green">Submitted</Badge>}
                    {staffRatingMutation.isError && <Badge color="red">Failed</Badge>}
                  </Flex>
                </Flex>
              </Card>

              <Card variant="surface">
                <Flex direction="column" gap="2">
                  <Heading size="4">Submit customer rating</Heading>
                  <TextField.Root
                    placeholder="Overall (1-5)"
                    value={customerOverall}
                    onChange={(event) => setCustomerOverall(event.target.value)}
                  />
                  <TextField.Root
                    placeholder="Punctuality (optional 1-5)"
                    value={punctuality}
                    onChange={(event) => setPunctuality(event.target.value)}
                  />
                  <TextField.Root
                    placeholder="Quality (optional 1-5)"
                    value={quality}
                    onChange={(event) => setQuality(event.target.value)}
                  />
                  <TextArea
                    placeholder="Comments"
                    value={customerComments}
                    onChange={(event) => setCustomerComments(event.target.value)}
                  />
                  <Flex gap="2" align="center">
                    <Checkbox checked={wouldRehire} onCheckedChange={(checked) => setWouldRehire(Boolean(checked))} />
                    <Text size="2">Would rehire</Text>
                  </Flex>
                  <Flex gap="2" align="center">
                    <Button onClick={() => customerRatingMutation.mutate()}>Save customer rating</Button>
                    {customerRatingMutation.isSuccess && <Badge color="green">Submitted</Badge>}
                    {customerRatingMutation.isError && <Badge color="red">Failed</Badge>}
                  </Flex>
                </Flex>
              </Card>

              <Separator size="4" />

              <Heading size="4">Audit trail</Heading>
              <Text size="2">Events: {assignmentQuery.data.events.length}</Text>
              {assignmentQuery.data.events.map((event) => (
                <Text key={event.id} size="2" color="gray">
                  {event.occurredAt} — {event.eventType} ({event.recordedBy}) {event.notes ? `• ${event.notes}` : ''}
                </Text>
              ))}

              <Text size="2">Staff rating timestamp: {assignmentQuery.data.staffRating?.submittedAt ?? 'not submitted'}</Text>
              <Text size="2">
                Customer rating timestamp: {assignmentQuery.data.customerRating?.submittedAt ?? 'not submitted'}
              </Text>
            </>
          )}
        </Flex>
      </Card>
    </Flex>
  );
};
