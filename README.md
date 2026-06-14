# QueueCure 🩺 — Real-Time Clinic Token Management System

**QueueCure** is an MVP real-time outpatient token management system designed for Indian outpatient clinics (OPDs). In standard Indian clinical environments, patients receive rigid paper token slips and wait in overcrowded, noisy waiting lobbies without any visibility into progression or true wait times. QueueCure solves this by introducing a high-performance, double-sync system bridging a frictionless **Receptionist Command Console** and an immersive, calm **Patient Waiting Room Display**.

---

## 🏗️ Architecture & Data Flow

QueueCure operates as a single-repository full-stack application. It leverages a server-authoritative state model powered by Express and Socket.io, with a fallback persistence layer that reads/writes mutations to a local JSON database on disc.

### Physical Synchronization Lifecycle
```
+------------------+                   +------------------+
|   Receptionist   |                   | Patient Display  |
|  Console (/rec)  |                   |  Board (/waiting)|
+--------+---------+                   +--------+---------+
         |                                      |
         | (Adds Patient / Calls Next)          | (Late-joins)
         | Emit socket event                    | Emit "queue:request-state"
         v                                      v
+--------+--------------------------------------+---------+
|                  QueueCure Express Server               |
|                                                         |
|  1. Atomic Counter Increment                            |
|  2. Trigger waitTimeCalculator (dynamic remaining offset)|
|  3. Commit state change to /server/data.json            |
|  4. Broadcast "queue:update" (Full State payload)       |
+------------------------+--------------------------------+
                         |
                         v (Instantly pushes payload)
         ========================================
         |                                      |
         v (Update React state)                 v (Update React state)
+--------+---------+                   +--------+---------+
|  Re-renders UI   |                   |  Re-renders UI   |
| (Input auto-focus|                   | (No room drift!  |
|  & Undo timer)   |                   |  Active clock)   |
+------------------+                   +------------------+
```

---

## 🚀 Live Run Instructions

Start the application using standard Node configurations.

### 1. Requirements
Ensure Node.js (v18+) is installed.

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Development Server
```bash
npm run dev
```
The server will boot on port `3000` (which is externally accessible in the container reverse proxy). You can navigate to:
- **Main Portal**: `http://localhost:3000/`
- **Receptionist Console**: `http://localhost:3000/reception`
- **Patient TV display**: `http://localhost:3000/waiting`

### 4. Compiling Production Builds
To compile static assets and bundle the Express server with `esbuild`, run:
```bash
npm run build
npm start
```

---

## 🧮 Wait-Time Calculation Formula
All calculations occur strictly server-side inside `server/waitTimeCalculator.ts` to prevent client clock drifts:

1. **Calculate Active consultation elapsed time**:  
   If a token is currently `in-progress`:
   $$\text{elapsedMinutes} = \frac{\text{Date.now()} - \text{calledAt}}{60,000}$$

2. **Compute Remaining Consultation buffer** of the active patient:  
   $$\text{estimatedRemaining} = \max(0, \text{avgConsultationTimeMinutes} - \text{elapsedMinutes})$$
   *(If no patient is currently in consultation, $\text{estimatedRemaining} = 0$)*.

3. **Determine waiting positions dynamic wait**:  
   For each waiting patient at $0$-indexed position $i$ in the waiting array:
   $$\text{estimatedWaitMinutes} = \text{estimatedRemaining} + (i \times \text{avgConsultationTimeMinutes})$$

---

## 🛡️ Clinical Boundaries & Edge Case Handling

1. **Empty queue "Call Next" triggers**: Guarded both client-side (button is disabled with an "idle queue" indicator) and server-side (returns validation payload instead of crashing).
2. **Rapid Double-Clicks on Call Next**: Protected via click-debouncing in React (preventing duplicate triggers) and idempotent transitions on the server.
3. **Mid-day Average Time Adjustments**: Instantly modifies subsequent estimates using the client-side slider control, without altering finished or aborted tokens in history.
4. **Mid-session Client Restarts**: Late-joining devices emit a `queue:request-state` socket request on mount to receive the full active queue payload instantly.
5. **Whitespace or Empty Patient Names**: Rejected with inline warning banners without incrementing the daily token counter.
6. **Concurrent receptionist collisions**: All counter increments and array mutations are handled server-side within atomic sequential block execution.
7. **Daily Cleanliness resets**: Includes a confirmation modal that archives current records into a `history` JSON node and resets indexes back to #1.
8. **Server Reboots**: Loaded from `server/data.json` during the bootstrap sequence so session state remains preserved.
9. **Invalid Service Times**: Slider ranges are constrained, and server enforces a strict minimum limit of `1` minute.
10. **Abnormal No-Show skips**: The button is conditionally rendered/disabled unless a patient is actively "in-progress" in the consultation chamber.

---

## 🔬 Tech Stack Justification
- **Vite React + TS**: Delivers ultra-responsive frontends with minimal compile cycles and type checking.
- **Express + Socket.io**: Replaces wasteful HTTP polling with push-based reactive state broadcasts, maintaining sub-millisecond sync latencies.
- **In-Memory + JSON Persistence**: Keeps data operations extremely performant and readable while making database swaps (to PostgreSQL/Prisma or Firebase) simple in later project phases.
- **Tailwind CSS**: Offers native responsive styling suited for both receptionist laptops/tablets and wide TV displays.
- **Motion**: Delivers elegant, fluid screen transitions and token progression cues to promote a calm atmosphere.
