import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Queue } from "../src/types.js";

// Derive current directory since we're in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_FILE_PATH = path.join(__dirname, "data.json");

interface PersistedData {
  queue: Queue;
  history: Array<{
    date: string;
    doctorId: string;
    doctorName: string;
    tokens: any[];
  }>;
}

const DEFAULT_QUEUE: Queue = {
  doctorId: "doc-1",
  doctorName: "Dr. Rahul Sharma (General OPD)",
  avgConsultationTimeMinutes: 10,
  currentTokenNumber: null,
  tokens: [],
  nextTokenNumber: 1
};

const DEFAULT_DATA: PersistedData = {
  queue: DEFAULT_QUEUE,
  history: []
};

/**
 * Clean repository interface for QueueCure state persistence.
 * Can be easily swapped with PostgreSQL or MongoDB in professional/Phase 2 environments.
 */
export const QueueRepository = {
  /**
   * Loads the data structure from the local JSON file.
   * If the file doesn't exist, it seeds it with defaults.
   */
  loadData(): PersistedData {
    try {
      if (fs.existsSync(DATA_FILE_PATH)) {
        const fileContent = fs.readFileSync(DATA_FILE_PATH, "utf-8");
        const parsed = JSON.parse(fileContent);
        
        // Ensure structure is correct
        if (parsed && parsed.queue) {
          return {
            history: Array.isArray(parsed.history) ? parsed.history : [],
            queue: {
              ...DEFAULT_QUEUE,
              ...parsed.queue,
              tokens: Array.isArray(parsed.queue.tokens) ? parsed.queue.tokens : []
            }
          };
        }
      }
    } catch (err) {
      console.error("Failed to load queue database from JSON file, initializing default in-memory state.", err);
    }
    
    // Default safe fallback and persistence
    this.saveData(DEFAULT_DATA);
    return DEFAULT_DATA;
  },

  /**
   * Saves the entire structure back to the JSON file.
   */
  saveData(data: PersistedData): void {
    try {
      // Ensure directory exists
      const dir = path.dirname(DATA_FILE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("Persistence write error in QueueRepository.saveData:", err);
    }
  },

  /**
   * Retrieves the current active Queue.
   */
  getQueue(): Queue {
    const data = this.loadData();
    return data.queue;
  },

  /**
   * Replaces/Saves the active Queue state and persists it.
   */
  saveQueue(updatedQueue: Queue): void {
    const data = this.loadData();
    data.queue = updatedQueue;
    this.saveData(data);
  },

  /**
   * Archives the day's tokens, resets the active queue to empty,
   * resets currentTokenNumber to null, and restarts nextTokenNumber from 1.
   */
  resetQueueForNewDay(): Queue {
    const data = this.loadData();
    const currentQueue = data.queue;

    // Archive current patient tokens to historical archives
    if (currentQueue.tokens.length > 0) {
      data.history.push({
        date: new Date().toISOString(),
        doctorId: currentQueue.doctorId,
        doctorName: currentQueue.doctorName,
        tokens: currentQueue.tokens
      });
    }

    // Reset fields for the new day
    const resetQueue: Queue = {
      ...currentQueue,
      currentTokenNumber: null,
      tokens: [],
      nextTokenNumber: 1
    };

    data.queue = resetQueue;
    this.saveData(data);
    return resetQueue;
  }
};
