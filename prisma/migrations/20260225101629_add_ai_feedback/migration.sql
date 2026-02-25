-- CreateTable
CREATE TABLE "AIResponseFeedback" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "customerEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "originalMessage" TEXT NOT NULL,
    "aiResponse" TEXT NOT NULL,
    "finalResponse" TEXT,
    "wasEdited" BOOLEAN NOT NULL DEFAULT false,
    "rating" TEXT,
    "editedBy" TEXT,
    "contextUsed" JSONB,
    "knowledgeUsed" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIResponseFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AIResponseFeedback_tenantId_createdAt_idx" ON "AIResponseFeedback"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "AIResponseFeedback_tenantId_rating_idx" ON "AIResponseFeedback"("tenantId", "rating");

-- CreateIndex
CREATE INDEX "AIResponseFeedback_customerEmail_idx" ON "AIResponseFeedback"("customerEmail");
