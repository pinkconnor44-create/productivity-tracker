-- CreateTable
CREATE TABLE "Task" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TEXT,
    "time" TEXT,
    "endTime" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TEXT,
    "recurringType" TEXT,
    "recurringDays" TEXT,
    "recurringEnd" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "kind" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TaskCompletion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taskId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    CONSTRAINT "TaskCompletion_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TaskSkip" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "taskId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    CONSTRAINT "TaskSkip_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Habit" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "recurringDays" TEXT,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "startDate" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Scratchpad" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "notes" TEXT NOT NULL DEFAULT '',
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "DayNote" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "HabitCompletion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "habitId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    CONSTRAINT "HabitCompletion_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HabitSkip" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "habitId" INTEGER NOT NULL,
    "date" TEXT NOT NULL,
    CONSTRAINT "HabitSkip_habitId_fkey" FOREIGN KEY ("habitId") REFERENCES "Habit" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LiftEntry" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weight" REAL NOT NULL,
    "sets" TEXT NOT NULL,
    "totalReps" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "LiftGroup" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "exercises" TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Project" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "checklist" TEXT NOT NULL DEFAULT '[]',
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "TaskCompletion_taskId_date_key" ON "TaskCompletion"("taskId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "TaskSkip_taskId_date_key" ON "TaskSkip"("taskId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DayNote_date_key" ON "DayNote"("date");

-- CreateIndex
CREATE UNIQUE INDEX "HabitCompletion_habitId_date_key" ON "HabitCompletion"("habitId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "HabitSkip_habitId_date_key" ON "HabitSkip"("habitId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "LiftGroup_name_key" ON "LiftGroup"("name");

