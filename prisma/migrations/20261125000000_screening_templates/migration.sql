ALTER TABLE "ResumeAnalysis" ADD COLUMN "executionConfigurationSnapshot" JSONB;
CREATE TABLE "ScreeningTemplate" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "name" TEXT NOT NULL,
 "nameKey" TEXT NOT NULL,
 "description" TEXT NOT NULL DEFAULT '',
 "configuration" JSONB NOT NULL,
 "configurationSchemaVersion" INTEGER NOT NULL,
 "revision" INTEGER NOT NULL DEFAULT 1,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "ScreeningTemplate_nameKey_key" ON "ScreeningTemplate"("nameKey");
CREATE TABLE "ApplicationInitialization" (
 "key" TEXT NOT NULL PRIMARY KEY,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
