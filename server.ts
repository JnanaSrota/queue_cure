import express from "express";
import { createServer as createHttpServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";
import { QueueRepository } from "./server/persistence.js";
import { calculateWaitTime, getWaitingTokensSorted } from "./src/lib/waitTimeCalculator.js";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function start() {
  const app = express();
  const PORT = 3000;

  // Track undo backup state
  let undoBackup: any = null;
  let undoBackupTimestamp = 0;

  function backupQueueForUndo(queue: any) {
    // Deep clone queue so it is not modified
    undoBackup = JSON.parse(JSON.stringify(queue));
    undoBackupTimestamp = Date.now();
  }

  function clearUndoBackup() {
    undoBackup = null;
    undoBackupTimestamp = 0;
  }

  // API endpoints or healthcheck
  app.get("/api/health", (req, res) => {
    res.json({ status: "healthy", timestamp: new Date().toISOString() });
  });

  const httpServer = createHttpServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket client connected [id=${socket.id}]`);

    // Emit initial state immediately on connect so late joinees visual update correctly
    const currentQueue = QueueRepository.getQueue();
    socket.emit("queue:update", currentQueue);

    // Explicit request state handler
    socket.on("queue:request-state", () => {
      const current = QueueRepository.getQueue();
      socket.emit("queue:update", current);
    });

    // Add Patient
    socket.on("queue:add-patient", (data: { name: string; phone?: string }) => {
      const currentQueue = QueueRepository.getQueue();
      const patientName = data.name ? data.name.trim() : "";
      
      if (!patientName) {
        socket.emit("queue:error", { message: "Patient name is required and cannot be empty." });
        return;
      }

      // Atomic token details assignment
      const tokenNumber = currentQueue.nextTokenNumber;
      const sanitizedPhone = data.phone
        ? data.phone.replace(/\D/g, "").slice(0, 12)
        : undefined;

      const newToken = {
        tokenNumber,
        patientName,
        phoneNumber: sanitizedPhone || undefined,
        status: "waiting" as const,
        createdAt: new Date().toISOString()
      };

      currentQueue.tokens.push(newToken);
      currentQueue.nextTokenNumber += 1;

      // Calculate dynamic times
      currentQueue.tokens = calculateWaitTime(currentQueue);
      QueueRepository.saveQueue(currentQueue);

      // Erase undo cache on patient add since it's a new forward event
      clearUndoBackup();

      // Broadcast update to all clients
      io.emit("queue:update", currentQueue);
    });

    // Call Next
    socket.on("queue:call-next", () => {
      const currentQueue = QueueRepository.getQueue();
      const inProgress = currentQueue.tokens.find(t => t.status === "in-progress");
      const waiting = getWaitingTokensSorted(currentQueue.tokens);

      if (waiting.length === 0 && !inProgress) {
        socket.emit("queue:error", { message: "No patients are currently waiting." });
        return;
      }

      backupQueueForUndo(currentQueue);

      if (inProgress) {
        const activeIdx = currentQueue.tokens.findIndex(t => t.tokenNumber === inProgress.tokenNumber);
        if (activeIdx !== -1) {
          currentQueue.tokens[activeIdx].status = "done";
          currentQueue.tokens[activeIdx].completedAt = new Date().toISOString();
        }
      }

      if (waiting.length > 0) {
        const nextWaiting = waiting[0];
        const nextIdx = currentQueue.tokens.findIndex(t => t.tokenNumber === nextWaiting.tokenNumber);
        if (nextIdx !== -1) {
          currentQueue.tokens[nextIdx].status = "in-progress";
          currentQueue.tokens[nextIdx].calledAt = new Date().toISOString();
          currentQueue.currentTokenNumber = currentQueue.tokens[nextIdx].tokenNumber;
        }
      } else {
        currentQueue.currentTokenNumber = null;
      }

      currentQueue.tokens = calculateWaitTime(currentQueue);
      QueueRepository.saveQueue(currentQueue);

      io.emit("queue:update", currentQueue);
    });

    // Mark No-Show
    socket.on("queue:mark-no-show", () => {
      const currentQueue = QueueRepository.getQueue();
      const inProgress = currentQueue.tokens.find(t => t.status === "in-progress");

      if (!inProgress) {
        socket.emit("queue:error", { message: "No active patient in consultation to mark as no-show." });
        return;
      }

      // Save backup state for Undo
      backupQueueForUndo(currentQueue);

      // 1. Mark active token as no-show
      const activeIdx = currentQueue.tokens.findIndex(t => t.tokenNumber === inProgress.tokenNumber);
      if (activeIdx !== -1) {
        currentQueue.tokens[activeIdx].status = "no-show";
        currentQueue.tokens[activeIdx].completedAt = new Date().toISOString();
      }

      // 2. Immediately call next patient
      const waiting = getWaitingTokensSorted(currentQueue.tokens);
      if (waiting.length > 0) {
        const nextWaiting = waiting[0];
        const nextIdx = currentQueue.tokens.findIndex(t => t.tokenNumber === nextWaiting.tokenNumber);
        if (nextIdx !== -1) {
          currentQueue.tokens[nextIdx].status = "in-progress";
          currentQueue.tokens[nextIdx].calledAt = new Date().toISOString();
          currentQueue.currentTokenNumber = currentQueue.tokens[nextIdx].tokenNumber;
        }
      } else {
        currentQueue.currentTokenNumber = null;
      }

      currentQueue.tokens = calculateWaitTime(currentQueue);
      QueueRepository.saveQueue(currentQueue);

      io.emit("queue:update", currentQueue);
    });

    // Undo action (available within 10 seconds)
    socket.on("queue:undo", () => {
      if (undoBackup && (Date.now() - undoBackupTimestamp < 10000)) {
        const restored = JSON.parse(JSON.stringify(undoBackup));
        clearUndoBackup();
        QueueRepository.saveQueue(restored);
        io.emit("queue:update", restored);
        socket.emit("queue:undo-success", { message: "Action successfully undone!" });
      } else {
        socket.emit("queue:error", { message: "Undo window passed or no actions recorded to undo." });
      }
    });

    // Update Average Consultation Time
    socket.on("queue:update-avg-time", (data: { avgTimeMinutes: number }) => {
      const avg = Number(data.avgTimeMinutes);
      if (isNaN(avg) || avg < 1 || avg > 60) {
        socket.emit("queue:error", { message: "Average consultation time must be between 1 and 60 minutes." });
        return;
      }

      const currentQueue = QueueRepository.getQueue();
      currentQueue.avgConsultationTimeMinutes = avg;
      
      // Immediately recalculate times and broadcast
      currentQueue.tokens = calculateWaitTime(currentQueue);
      QueueRepository.saveQueue(currentQueue);

      clearUndoBackup(); // Update clears undo cache to maintain consistency
      io.emit("queue:update", currentQueue);
    });

    // Reset for New Day
    socket.on("queue:reset", () => {
      const resetState = QueueRepository.resetQueueForNewDay();
      clearUndoBackup();
      io.emit("queue:update", resetState);
    });

    socket.on("disconnect", () => {
      console.log(`Socket client disconnected [id=${socket.id}]`);
    });
  });

  // Wait times are computed on each client — no background ticker needed.
  // (The old 30s ticker wrote data.json and triggered Vite full-page reloads in dev.)

  // Serve Vite or static index.html depending on environment
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite Middleware.");
    const vite = await createViteServer({
      configLoader: "runner",
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode serving built static files.");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`QueueCure webserver and socket.io service listening on http://0.0.0.0:${PORT}`);
  });
}

start().catch((err) => {
  console.error("Critical server bootstrap failure:", err);
});
