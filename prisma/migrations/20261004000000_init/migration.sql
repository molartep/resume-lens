CREATE TABLE "Candidate" (
 "id" TEXT NOT NULL PRIMARY KEY, "name" TEXT, "email" TEXT, "phone" TEXT,
 "resumeFilename" TEXT NOT NULL, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL
);
CREATE TABLE "ResumeAnalysis" (
 "id" TEXT NOT NULL PRIMARY KEY, "candidateId" TEXT NOT NULL,
 "parsedResumeText" TEXT NOT NULL, "screeningResumeText" TEXT NOT NULL,
 "screeningResults" JSONB NOT NULL, "screeningConfigSnapshot" JSONB NOT NULL,
 "analyzedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "deciderLatencyMs" REAL, "parserMetadata" JSONB,
 CONSTRAINT "ResumeAnalysis_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "Candidate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ResumeAnalysis_candidateId_analyzedAt_idx" ON "ResumeAnalysis"("candidateId", "analyzedAt");
