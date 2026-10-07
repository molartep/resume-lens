CREATE TABLE "ResumeDocument" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filename" TEXT NOT NULL,
    "pdfKey" TEXT NOT NULL,
    "parsedResumeText" TEXT NOT NULL,
    "parserMetadata" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ResumeDocument_pdfKey_key" ON "ResumeDocument"("pdfKey");
ALTER TABLE "ResumeAnalysis" ADD COLUMN "resumeDocumentId" TEXT REFERENCES "ResumeDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ResumeAnalysis_resumeDocumentId_idx" ON "ResumeAnalysis"("resumeDocumentId");
INSERT INTO "ResumeDocument" ("id", "filename", "pdfKey", "parsedResumeText", "parserMetadata", "createdAt")
SELECT a."id", COALESCE(a."resumeFilename", c."resumeFilename"), a."resumePdfKey", a."parsedResumeText", a."parserMetadata", a."analyzedAt"
FROM "ResumeAnalysis" a JOIN "Candidate" c ON c."id" = a."candidateId"
WHERE a."resumePdfKey" IS NOT NULL AND a."id" = (
    SELECT b."id" FROM "ResumeAnalysis" b WHERE b."resumePdfKey" = a."resumePdfKey" ORDER BY b."analyzedAt" DESC, b."id" DESC LIMIT 1
);
UPDATE "ResumeAnalysis" SET "resumeDocumentId" = (SELECT d."id" FROM "ResumeDocument" d WHERE d."pdfKey" = "ResumeAnalysis"."resumePdfKey") WHERE "resumePdfKey" IS NOT NULL;
