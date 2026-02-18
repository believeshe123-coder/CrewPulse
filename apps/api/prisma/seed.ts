import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const highPerformer = await prisma.worker.upsert({
    where: { employeeCode: 'W-1001' },
    update: {
      firstName: 'Avery',
      lastName: 'Coleman',
      status: 'ACTIVE',
      tier: 'STRONG',
      overallScore: '4.85',
      performanceScore: '4.90',
      reliabilityScore: '4.80',
      lateRate: '0.0000',
      ncnsRate: '0.0000'
    },
    create: {
      employeeCode: 'W-1001',
      firstName: 'Avery',
      lastName: 'Coleman',
      phone: '555-0101',
      email: 'avery.coleman@crewpulse.local',
      status: 'ACTIVE',
      tier: 'STRONG',
      overallScore: '4.85',
      performanceScore: '4.90',
      reliabilityScore: '4.80',
      lateRate: '0.0000',
      ncnsRate: '0.0000'
    }
  });

  const chronicLate = await prisma.worker.upsert({
    where: { employeeCode: 'W-1002' },
    update: {
      firstName: 'Jordan',
      lastName: 'Mills',
      status: 'NEEDS_REVIEW',
      tier: 'WATCHLIST',
      overallScore: '3.05',
      performanceScore: '3.10',
      reliabilityScore: '3.00',
      lateRate: '0.4000',
      ncnsRate: '0.0000'
    },
    create: {
      employeeCode: 'W-1002',
      firstName: 'Jordan',
      lastName: 'Mills',
      phone: '555-0102',
      email: 'jordan.mills@crewpulse.local',
      status: 'NEEDS_REVIEW',
      tier: 'WATCHLIST',
      overallScore: '3.05',
      performanceScore: '3.10',
      reliabilityScore: '3.00',
      lateRate: '0.4000',
      ncnsRate: '0.0000'
    }
  });

  const ncnsRisk = await prisma.worker.upsert({
    where: { employeeCode: 'W-1003' },
    update: {
      firstName: 'Taylor',
      lastName: 'Reed',
      status: 'HOLD',
      tier: 'CRITICAL',
      overallScore: '1.90',
      performanceScore: '2.00',
      reliabilityScore: '1.80',
      lateRate: '0.0000',
      ncnsRate: '0.5000'
    },
    create: {
      employeeCode: 'W-1003',
      firstName: 'Taylor',
      lastName: 'Reed',
      phone: '555-0103',
      email: 'taylor.reed@crewpulse.local',
      status: 'HOLD',
      tier: 'CRITICAL',
      overallScore: '1.90',
      performanceScore: '2.00',
      reliabilityScore: '1.80',
      lateRate: '0.0000',
      ncnsRate: '0.5000'
    }
  });

  const assignmentData = [
    {
      assignmentId: 'high-performer-assignment-1',
      workerId: highPerformer.id,
      category: 'WAREHOUSE' as const,
      statusEvent: 'COMPLETED' as const,
      startedDaysAgo: 8,
      staffOverall: 5,
      customerOverall: 5,
      punctuality: 5,
      workEthic: 5,
      attitude: 5,
      quality: 5,
      safety: 5,
      wouldRehire: true,
      staffTags: ['fast', 'accurate']
    },
    {
      assignmentId: 'chronic-late-assignment-1',
      workerId: chronicLate.id,
      category: 'CLEANUP' as const,
      statusEvent: 'LATE' as const,
      startedDaysAgo: 7,
      staffOverall: 3,
      customerOverall: 3,
      punctuality: 2,
      workEthic: 4,
      attitude: 3,
      quality: 3,
      safety: 4,
      wouldRehire: false,
      staffTags: ['late_arrival', 'improved_mid_shift']
    },
    {
      assignmentId: 'chronic-late-assignment-2',
      workerId: chronicLate.id,
      category: 'JANITORIAL' as const,
      statusEvent: 'LATE' as const,
      startedDaysAgo: 3,
      staffOverall: 3,
      customerOverall: 2,
      punctuality: 1,
      workEthic: 3,
      attitude: 3,
      quality: 3,
      safety: 3,
      wouldRehire: false,
      staffTags: ['late_arrival']
    },
    {
      assignmentId: 'ncns-risk-assignment-1',
      workerId: ncnsRisk.id,
      category: 'EVENTS' as const,
      statusEvent: 'NCNS' as const,
      startedDaysAgo: 5,
      staffOverall: 1,
      customerOverall: 1,
      punctuality: null,
      workEthic: null,
      attitude: null,
      quality: null,
      safety: null,
      wouldRehire: false,
      staffTags: ['no_show']
    },
    {
      assignmentId: 'ncns-risk-assignment-2',
      workerId: ncnsRisk.id,
      category: 'WAREHOUSE' as const,
      statusEvent: 'NCNS' as const,
      startedDaysAgo: 1,
      staffOverall: 1,
      customerOverall: 1,
      punctuality: null,
      workEthic: null,
      attitude: null,
      quality: null,
      safety: null,
      wouldRehire: false,
      staffTags: ['no_show', 'unreachable']
    }
  ];

  for (const record of assignmentData) {
    const scheduledStart = new Date(Date.now() - record.startedDaysAgo * 24 * 60 * 60 * 1000);

    await prisma.assignment.upsert({
      where: { id: record.assignmentId },
      update: {
        workerId: record.workerId,
        category: record.category,
        scheduledStart
      },
      create: {
        id: record.assignmentId,
        workerId: record.workerId,
        category: record.category,
        scheduledStart
      }
    });

    await prisma.assignmentEvent.upsert({
      where: { id: `${record.assignmentId}-event` },
      update: {
        eventType: record.statusEvent,
        occurredAt: scheduledStart
      },
      create: {
        id: `${record.assignmentId}-event`,
        assignmentId: record.assignmentId,
        eventType: record.statusEvent,
        occurredAt: scheduledStart
      }
    });

    await prisma.staffRating.upsert({
      where: { assignmentId: record.assignmentId },
      update: {
        overall: record.staffOverall,
        tags: record.staffTags,
        notes: `Seeded scenario for ${record.statusEvent.toLowerCase()}`
      },
      create: {
        assignmentId: record.assignmentId,
        overall: record.staffOverall,
        tags: record.staffTags,
        notes: `Seeded scenario for ${record.statusEvent.toLowerCase()}`,
        ratedAt: scheduledStart
      }
    });

    await prisma.customerRating.upsert({
      where: { assignmentId: record.assignmentId },
      update: {
        overall: record.customerOverall,
        punctuality: record.punctuality,
        workEthic: record.workEthic,
        attitude: record.attitude,
        quality: record.quality,
        safety: record.safety,
        wouldRehire: record.wouldRehire,
        comments: 'Seeded baseline customer feedback'
      },
      create: {
        assignmentId: record.assignmentId,
        overall: record.customerOverall,
        punctuality: record.punctuality,
        workEthic: record.workEthic,
        attitude: record.attitude,
        quality: record.quality,
        safety: record.safety,
        wouldRehire: record.wouldRehire,
        comments: 'Seeded baseline customer feedback',
        ratedAt: scheduledStart
      }
    });
  }

  await prisma.workerCategoryMetric.upsert({
    where: {
      workerId_category: {
        workerId: highPerformer.id,
        category: 'WAREHOUSE'
      }
    },
    update: {
      jobsCompleted: 6,
      averageScore: '4.90',
      lateRate: '0.0000',
      ncnsRate: '0.0000',
      trend: 'UP'
    },
    create: {
      workerId: highPerformer.id,
      category: 'WAREHOUSE',
      jobsCompleted: 6,
      averageScore: '4.90',
      lateRate: '0.0000',
      ncnsRate: '0.0000',
      trend: 'UP'
    }
  });

  await prisma.workerCategoryMetric.upsert({
    where: {
      workerId_category: {
        workerId: chronicLate.id,
        category: 'CLEANUP'
      }
    },
    update: {
      jobsCompleted: 5,
      averageScore: '3.10',
      lateRate: '0.4000',
      ncnsRate: '0.0000',
      trend: 'DOWN'
    },
    create: {
      workerId: chronicLate.id,
      category: 'CLEANUP',
      jobsCompleted: 5,
      averageScore: '3.10',
      lateRate: '0.4000',
      ncnsRate: '0.0000',
      trend: 'DOWN'
    }
  });

  await prisma.workerCategoryMetric.upsert({
    where: {
      workerId_category: {
        workerId: ncnsRisk.id,
        category: 'EVENTS'
      }
    },
    update: {
      jobsCompleted: 4,
      averageScore: '2.00',
      lateRate: '0.0000',
      ncnsRate: '0.5000',
      trend: 'DOWN'
    },
    create: {
      workerId: ncnsRisk.id,
      category: 'EVENTS',
      jobsCompleted: 4,
      averageScore: '2.00',
      lateRate: '0.0000',
      ncnsRate: '0.5000',
      trend: 'DOWN'
    }
  });

  await prisma.flag.upsert({
    where: { id: 'flag-chronic-late-needs-review' },
    update: {
      workerId: chronicLate.id,
      flagType: 'NEEDS_REVIEW',
      reason: 'Repeated late arrivals in the past 30 days.'
    },
    create: {
      id: 'flag-chronic-late-needs-review',
      workerId: chronicLate.id,
      flagType: 'NEEDS_REVIEW',
      reason: 'Repeated late arrivals in the past 30 days.'
    }
  });

  await prisma.flag.upsert({
    where: { id: 'flag-ncns-terminate-recommended' },
    update: {
      workerId: ncnsRisk.id,
      flagType: 'TERMINATE_RECOMMENDED',
      reason: 'Two NCNS incidents in the most recent five assignments.'
    },
    create: {
      id: 'flag-ncns-terminate-recommended',
      workerId: ncnsRisk.id,
      flagType: 'TERMINATE_RECOMMENDED',
      reason: 'Two NCNS incidents in the most recent five assignments.'
    }
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
