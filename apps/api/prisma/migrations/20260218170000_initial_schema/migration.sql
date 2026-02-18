-- CreateEnum
CREATE TYPE "WorkerStatus" AS ENUM ('ACTIVE', 'NEEDS_REVIEW', 'HOLD', 'TERMINATE');

-- CreateEnum
CREATE TYPE "AssignmentCategory" AS ENUM ('WAREHOUSE', 'CLEANUP', 'JANITORIAL', 'EVENTS');

-- CreateEnum
CREATE TYPE "AssignmentEventType" AS ENUM ('COMPLETED', 'LATE', 'SENT_HOME', 'NCNS');

-- CreateEnum
CREATE TYPE "WorkerCategoryTrend" AS ENUM ('UP', 'FLAT', 'DOWN');

-- CreateEnum
CREATE TYPE "FlagType" AS ENUM ('NEEDS_REVIEW', 'TERMINATE_RECOMMENDED');

-- CreateTable
CREATE TABLE "HealthCheck" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "status" "WorkerStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "category" "AssignmentCategory" NOT NULL,
    "scheduledStart" TIMESTAMP(3) NOT NULL,
    "scheduledEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentEvent" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "eventType" "AssignmentEventType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "AssignmentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffRating" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "overall" INTEGER NOT NULL,
    "tags" TEXT[],
    "notes" TEXT,
    "ratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerRating" (
    "id" TEXT NOT NULL,
    "assignmentId" TEXT NOT NULL,
    "overall" INTEGER NOT NULL,
    "punctuality" INTEGER,
    "workEthic" INTEGER,
    "attitude" INTEGER,
    "quality" INTEGER,
    "safety" INTEGER,
    "wouldRehire" BOOLEAN,
    "comments" TEXT,
    "ratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkerCategoryMetric" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "category" "AssignmentCategory" NOT NULL,
    "jobsCompleted" INTEGER NOT NULL,
    "averageScore" DECIMAL(4,2) NOT NULL,
    "lateRate" DECIMAL(5,4) NOT NULL,
    "ncnsRate" DECIMAL(5,4) NOT NULL,
    "trend" "WorkerCategoryTrend" NOT NULL DEFAULT 'FLAT',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkerCategoryMetric_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flag" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "flagType" "FlagType" NOT NULL,
    "reason" TEXT NOT NULL,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "Flag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Worker_employeeCode_key" ON "Worker"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_email_key" ON "Worker"("email");

-- CreateIndex
CREATE INDEX "Assignment_workerId_scheduledStart_idx" ON "Assignment"("workerId", "scheduledStart");

-- CreateIndex
CREATE INDEX "Assignment_category_idx" ON "Assignment"("category");

-- CreateIndex
CREATE INDEX "AssignmentEvent_assignmentId_eventType_idx" ON "AssignmentEvent"("assignmentId", "eventType");

-- CreateIndex
CREATE INDEX "AssignmentEvent_eventType_occurredAt_idx" ON "AssignmentEvent"("eventType", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffRating_assignmentId_key" ON "StaffRating"("assignmentId");

-- CreateIndex
CREATE INDEX "StaffRating_overall_idx" ON "StaffRating"("overall");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerRating_assignmentId_key" ON "CustomerRating"("assignmentId");

-- CreateIndex
CREATE INDEX "CustomerRating_overall_idx" ON "CustomerRating"("overall");

-- CreateIndex
CREATE INDEX "CustomerRating_wouldRehire_idx" ON "CustomerRating"("wouldRehire");

-- CreateIndex
CREATE UNIQUE INDEX "WorkerCategoryMetric_workerId_category_key" ON "WorkerCategoryMetric"("workerId", "category");

-- CreateIndex
CREATE INDEX "WorkerCategoryMetric_category_averageScore_idx" ON "WorkerCategoryMetric"("category", "averageScore");

-- CreateIndex
CREATE INDEX "Flag_workerId_triggeredAt_idx" ON "Flag"("workerId", "triggeredAt");

-- CreateIndex
CREATE INDEX "Flag_flagType_triggeredAt_idx" ON "Flag"("flagType", "triggeredAt");

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignmentEvent" ADD CONSTRAINT "AssignmentEvent_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffRating" ADD CONSTRAINT "StaffRating_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerRating" ADD CONSTRAINT "CustomerRating_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkerCategoryMetric" ADD CONSTRAINT "WorkerCategoryMetric_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flag" ADD CONSTRAINT "Flag_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;
