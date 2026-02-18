import { Badge, Button, Card, Flex, Heading, Link, Text, TextField } from '@radix-ui/themes';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { createWorker } from '../lib/api';
import { readAuthState } from '../lib/auth';

export const AddEmployeePage = () => {
  const auth = readAuthState();
  const navigate = useNavigate();

  const [employeeCode, setEmployeeCode] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!auth) {
        throw new Error('Missing auth');
      }

      const response = await createWorker(auth, {
        employeeCode: employeeCode.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
      });

      if (!response.ok) {
        throw new Error(`Create failed (${response.status})`);
      }

      return response.json() as Promise<{ id: string }>;
    },
    onSuccess: (worker) => {
      navigate(`/workers/${worker.id}`, {
        state: {
          success: 'Employee created successfully.',
        },
      });
    },
  });

  const isSubmitDisabled =
    createMutation.isPending ||
    employeeCode.trim().length === 0 ||
    firstName.trim().length === 0 ||
    lastName.trim().length === 0;

  return (
    <Flex minHeight="100vh" justify="center" p="6">
      <Card size="3" style={{ width: '100%', maxWidth: 720 }}>
        <Flex direction="column" gap="4">
          <Heading size="6">Add employee</Heading>
          <Text color="gray" size="2">
            Create a new worker profile with required employee identity details.
          </Text>

          <Card variant="surface">
            <Flex direction="column" gap="3">
              <TextField.Root
                value={employeeCode}
                onChange={(event) => setEmployeeCode(event.target.value)}
                placeholder="Employee code"
              />
              <TextField.Root
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                placeholder="First name"
              />
              <TextField.Root
                value={lastName}
                onChange={(event) => setLastName(event.target.value)}
                placeholder="Last name"
              />
              <TextField.Root
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Phone (optional)"
              />
              <TextField.Root
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Email (optional)"
              />

              <Flex gap="2" align="center" wrap="wrap">
                <Button onClick={() => createMutation.mutate()} disabled={isSubmitDisabled}>
                  Save employee
                </Button>
                <Link href="/staff/dashboard">Cancel</Link>
                {createMutation.isSuccess && <Badge color="green">Created</Badge>}
                {createMutation.isError && <Badge color="red">Failed to create employee</Badge>}
              </Flex>
            </Flex>
          </Card>
        </Flex>
      </Card>
    </Flex>
  );
};
