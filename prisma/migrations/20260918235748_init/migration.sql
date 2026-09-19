-- CreateEnum
CREATE TYPE "Role" AS ENUM ('STUDENT', 'INSTRUCTOR', 'AUTHOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'DISABLED');

-- CreateEnum
CREATE TYPE "DependencyType" AS ENUM ('REQUIRES', 'UNLOCKS', 'OPTIONAL', 'CONVERGES_WITH');

-- CreateEnum
CREATE TYPE "CompletionType" AS ENUM ('VALUE', 'CODE', 'FINDING', 'ENVIRONMENT_STATE', 'FILE');

-- CreateEnum
CREATE TYPE "InstanceStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED', 'ABANDONED');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('LOCKED', 'AVAILABLE', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "EnvStatus" AS ENUM ('PENDING', 'PROVISIONING', 'RUNNING', 'STOPPED', 'FAILED', 'DESTROYING', 'DESTROYED');

-- CreateEnum
CREATE TYPE "ArtifactKind" AS ENUM ('FILE', 'PCAP', 'BINARY', 'SOURCE', 'MEMORY_DUMP', 'DISK_IMAGE', 'DATABASE', 'GIT_REPOSITORY', 'LOG_ARCHIVE', 'CONFIGURATION', 'OTHER');

-- CreateEnum
CREATE TYPE "SubmissionType" AS ENUM ('VALUE', 'CODE', 'FINDING', 'EVIDENCE', 'ENVIRONMENT_STATE', 'FILE');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('PENDING', 'GRADING', 'PASSED', 'FAILED', 'ERROR');

-- CreateEnum
CREATE TYPE "EvidenceKind" AS ENUM ('TERMINAL_TRANSCRIPT', 'SCREENSHOT', 'PCAP_FILTER', 'DEBUGGER_OUTPUT', 'SOURCE_CODE', 'LOG_EXCERPT', 'COMMAND_HISTORY', 'FILE', 'OTHER');

-- CreateEnum
CREATE TYPE "NotebookType" AS ENUM ('OBSERVATION', 'HYPOTHESIS', 'EXPERIMENT', 'RESULT', 'CONCLUSION', 'NOTE');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED', 'DEAD');

-- CreateTable
CREATE TABLE "Profile" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STUDENT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Course" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cohort" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Cohort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CohortMember" (
    "id" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "studentId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CohortMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "estimatedHours" INTEGER NOT NULL DEFAULT 8,
    "difficulty" TEXT NOT NULL DEFAULT 'advanced',
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignVersion" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "manifestHash" TEXT NOT NULL,
    "manifestJson" JSONB NOT NULL,
    "artifactBundleUri" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeStage" (
    "id" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "estimatedMinutes" INTEGER NOT NULL DEFAULT 60,
    "difficulty" TEXT NOT NULL DEFAULT 'advanced',
    "points" INTEGER NOT NULL DEFAULT 100,
    "completionType" "CompletionType" NOT NULL,
    "graderName" TEXT,
    "visibleByDefault" BOOLEAN NOT NULL DEFAULT false,
    "configJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ChallengeStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeDependency" (
    "id" TEXT NOT NULL,
    "sourceStageId" TEXT NOT NULL,
    "targetStageId" TEXT NOT NULL,
    "dependencyType" "DependencyType" NOT NULL,
    "conditionJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ChallengeDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assignment" (
    "id" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "cohortId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampaignInstance" (
    "id" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "studentId" UUID NOT NULL,
    "status" "InstanceStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampaignInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Seed" (
    "id" TEXT NOT NULL,
    "campaignInstanceId" TEXT NOT NULL,
    "encryptedSeed" TEXT NOT NULL,
    "seedVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Seed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentTemplate" (
    "id" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "definitionJson" JSONB NOT NULL,

    CONSTRAINT "EnvironmentTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnvironmentInstance" (
    "id" TEXT NOT NULL,
    "campaignInstanceId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'vercel-sandbox',
    "externalRef" TEXT,
    "status" "EnvStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "metadataJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "EnvironmentInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChallengeInstance" (
    "id" TEXT NOT NULL,
    "campaignInstanceId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "status" "ChallengeStatus" NOT NULL DEFAULT 'LOCKED',
    "unlockedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "scoreAwarded" INTEGER NOT NULL DEFAULT 0,
    "instanceStateJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ChallengeInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artifact" (
    "id" TEXT NOT NULL,
    "campaignVersionId" TEXT NOT NULL,
    "stageId" TEXT,
    "slug" TEXT NOT NULL,
    "kind" "ArtifactKind" NOT NULL,
    "sourceUri" TEXT,
    "generatorName" TEXT,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Artifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtifactInstance" (
    "id" TEXT NOT NULL,
    "artifactId" TEXT NOT NULL,
    "campaignInstanceId" TEXT NOT NULL,
    "challengeInstanceId" TEXT,
    "storageUri" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL DEFAULT 0,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadataJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "ArtifactInstance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "challengeInstanceId" TEXT NOT NULL,
    "studentId" UUID NOT NULL,
    "type" "SubmissionType" NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'PENDING',
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gradedAt" TIMESTAMP(3),
    "scoreAwarded" INTEGER NOT NULL DEFAULT 0,
    "graderFeedbackJson" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeSubmission" (
    "id" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "sourceUri" TEXT,
    "sourceText" TEXT,
    "entrypoint" TEXT,
    "compileLogUri" TEXT,
    "runtimeLogUri" TEXT,

    CONSTRAINT "CodeSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Finding" (
    "id" TEXT NOT NULL,
    "challengeInstanceId" TEXT NOT NULL,
    "campaignInstanceId" TEXT NOT NULL,
    "studentId" UUID NOT NULL,
    "findingType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "structuredDataJson" JSONB NOT NULL DEFAULT '{}',
    "explanation" TEXT NOT NULL DEFAULT '',
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Finding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "studentId" UUID NOT NULL,
    "campaignInstanceId" TEXT NOT NULL,
    "challengeInstanceId" TEXT,
    "kind" "EvidenceKind" NOT NULL,
    "storageUri" TEXT,
    "textContent" TEXT,
    "sha256" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotebookEntry" (
    "id" TEXT NOT NULL,
    "campaignInstanceId" TEXT NOT NULL,
    "studentId" UUID NOT NULL,
    "type" "NotebookType" NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "confidence" TEXT NOT NULL DEFAULT 'MEDIUM',
    "linksJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotebookEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Hint" (
    "id" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "pointPenalty" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Hint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HintUsage" (
    "id" TEXT NOT NULL,
    "hintId" TEXT NOT NULL,
    "studentId" UUID NOT NULL,
    "challengeInstanceId" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "penaltyApplied" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "HintUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainEvent" (
    "id" TEXT NOT NULL,
    "campaignInstanceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DomainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedEvent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "handlerName" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL DEFAULT '{}',
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "lockedAt" TIMESTAMP(3),
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoreEvent" (
    "id" TEXT NOT NULL,
    "campaignInstanceId" TEXT NOT NULL,
    "stageSlug" TEXT,
    "category" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScoreEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" UUID,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "metaJson" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Profile_email_key" ON "Profile"("email");

-- CreateIndex
CREATE UNIQUE INDEX "CohortMember_cohortId_studentId_key" ON "CohortMember"("cohortId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Campaign_slug_key" ON "Campaign"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignVersion_campaignId_version_key" ON "CampaignVersion"("campaignId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeStage_campaignVersionId_slug_key" ON "ChallengeStage"("campaignVersionId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Assignment_campaignVersionId_cohortId_key" ON "Assignment"("campaignVersionId", "cohortId");

-- CreateIndex
CREATE UNIQUE INDEX "CampaignInstance_campaignVersionId_studentId_key" ON "CampaignInstance"("campaignVersionId", "studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Seed_campaignInstanceId_key" ON "Seed"("campaignInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "EnvironmentInstance_campaignInstanceId_key" ON "EnvironmentInstance"("campaignInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ChallengeInstance_campaignInstanceId_stageId_key" ON "ChallengeInstance"("campaignInstanceId", "stageId");

-- CreateIndex
CREATE UNIQUE INDEX "Artifact_campaignVersionId_slug_key" ON "Artifact"("campaignVersionId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "ArtifactInstance_artifactId_campaignInstanceId_key" ON "ArtifactInstance"("artifactId", "campaignInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "CodeSubmission_submissionId_key" ON "CodeSubmission"("submissionId");

-- CreateIndex
CREATE UNIQUE INDEX "Hint_stageId_level_key" ON "Hint"("stageId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "HintUsage_hintId_challengeInstanceId_key" ON "HintUsage"("hintId", "challengeInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "DomainEvent_idempotencyKey_key" ON "DomainEvent"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "ProcessedEvent_eventId_handlerName_key" ON "ProcessedEvent"("eventId", "handlerName");

-- CreateIndex
CREATE UNIQUE INDEX "Job_idempotencyKey_key" ON "Job"("idempotencyKey");

-- CreateIndex
CREATE INDEX "Job_status_runAfter_idx" ON "Job"("status", "runAfter");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cohort" ADD CONSTRAINT "Cohort_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMember" ADD CONSTRAINT "CohortMember_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CohortMember" ADD CONSTRAINT "CohortMember_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignVersion" ADD CONSTRAINT "CampaignVersion_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeStage" ADD CONSTRAINT "ChallengeStage_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "CampaignVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeDependency" ADD CONSTRAINT "ChallengeDependency_sourceStageId_fkey" FOREIGN KEY ("sourceStageId") REFERENCES "ChallengeStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeDependency" ADD CONSTRAINT "ChallengeDependency_targetStageId_fkey" FOREIGN KEY ("targetStageId") REFERENCES "ChallengeStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "CampaignVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_cohortId_fkey" FOREIGN KEY ("cohortId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignInstance" ADD CONSTRAINT "CampaignInstance_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "CampaignVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampaignInstance" ADD CONSTRAINT "CampaignInstance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Seed" ADD CONSTRAINT "Seed_campaignInstanceId_fkey" FOREIGN KEY ("campaignInstanceId") REFERENCES "CampaignInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentTemplate" ADD CONSTRAINT "EnvironmentTemplate_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "CampaignVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnvironmentInstance" ADD CONSTRAINT "EnvironmentInstance_campaignInstanceId_fkey" FOREIGN KEY ("campaignInstanceId") REFERENCES "CampaignInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeInstance" ADD CONSTRAINT "ChallengeInstance_campaignInstanceId_fkey" FOREIGN KEY ("campaignInstanceId") REFERENCES "CampaignInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChallengeInstance" ADD CONSTRAINT "ChallengeInstance_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ChallengeStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_campaignVersionId_fkey" FOREIGN KEY ("campaignVersionId") REFERENCES "CampaignVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artifact" ADD CONSTRAINT "Artifact_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ChallengeStage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtifactInstance" ADD CONSTRAINT "ArtifactInstance_artifactId_fkey" FOREIGN KEY ("artifactId") REFERENCES "Artifact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtifactInstance" ADD CONSTRAINT "ArtifactInstance_campaignInstanceId_fkey" FOREIGN KEY ("campaignInstanceId") REFERENCES "CampaignInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtifactInstance" ADD CONSTRAINT "ArtifactInstance_challengeInstanceId_fkey" FOREIGN KEY ("challengeInstanceId") REFERENCES "ChallengeInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_challengeInstanceId_fkey" FOREIGN KEY ("challengeInstanceId") REFERENCES "ChallengeInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeSubmission" ADD CONSTRAINT "CodeSubmission_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_challengeInstanceId_fkey" FOREIGN KEY ("challengeInstanceId") REFERENCES "ChallengeInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_campaignInstanceId_fkey" FOREIGN KEY ("campaignInstanceId") REFERENCES "CampaignInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Finding" ADD CONSTRAINT "Finding_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_campaignInstanceId_fkey" FOREIGN KEY ("campaignInstanceId") REFERENCES "CampaignInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evidence" ADD CONSTRAINT "Evidence_challengeInstanceId_fkey" FOREIGN KEY ("challengeInstanceId") REFERENCES "ChallengeInstance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookEntry" ADD CONSTRAINT "NotebookEntry_campaignInstanceId_fkey" FOREIGN KEY ("campaignInstanceId") REFERENCES "CampaignInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotebookEntry" ADD CONSTRAINT "NotebookEntry_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Hint" ADD CONSTRAINT "Hint_stageId_fkey" FOREIGN KEY ("stageId") REFERENCES "ChallengeStage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HintUsage" ADD CONSTRAINT "HintUsage_hintId_fkey" FOREIGN KEY ("hintId") REFERENCES "Hint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HintUsage" ADD CONSTRAINT "HintUsage_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HintUsage" ADD CONSTRAINT "HintUsage_challengeInstanceId_fkey" FOREIGN KEY ("challengeInstanceId") REFERENCES "ChallengeInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainEvent" ADD CONSTRAINT "DomainEvent_campaignInstanceId_fkey" FOREIGN KEY ("campaignInstanceId") REFERENCES "CampaignInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedEvent" ADD CONSTRAINT "ProcessedEvent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "DomainEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoreEvent" ADD CONSTRAINT "ScoreEvent_campaignInstanceId_fkey" FOREIGN KEY ("campaignInstanceId") REFERENCES "CampaignInstance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Profile"("id") ON DELETE SET NULL ON UPDATE CASCADE;
