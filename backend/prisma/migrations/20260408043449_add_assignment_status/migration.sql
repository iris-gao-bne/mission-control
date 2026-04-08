-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MissionAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "missionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "missionRequirementId" TEXT,
    CONSTRAINT "MissionAssignment_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "Mission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MissionAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MissionAssignment_missionRequirementId_fkey" FOREIGN KEY ("missionRequirementId") REFERENCES "MissionRequirement" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MissionAssignment" ("assignedAt", "id", "missionId", "missionRequirementId", "userId") SELECT "assignedAt", "id", "missionId", "missionRequirementId", "userId" FROM "MissionAssignment";
DROP TABLE "MissionAssignment";
ALTER TABLE "new_MissionAssignment" RENAME TO "MissionAssignment";
CREATE UNIQUE INDEX "MissionAssignment_missionId_userId_key" ON "MissionAssignment"("missionId", "userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
