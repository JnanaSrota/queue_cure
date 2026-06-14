# QueueCure 🧠 Thought Process & Engineering Log

When I sat down to design the core infrastructure of **QueueCure**, my visual and technical choices were centered entirely in the real-world operational challenges of Indian outpatient clinics (OPDs). As a hackathon submission, this system had to be bulletproof in latency, completely mistake-proof for hyper-busy receptionists, and architecturally resilient. 

Here is a look behind the scenes of my design decisions, engineering trade-offs, and clinical boundary implementations:

---

## 📡 1. Why Socket.io over HTTP Polling?

When analyzing queue management screens, standard REST API polling is a primitive solution. If a clinic with 5 screens (receptionist, doctor desk, and 3 waiting room TVs) polls the server every 2 seconds, it creates severe waste:
* **The "Shouting" Problem**: Polling is like a patient constantly walking up to the receptionist asking, *"Is it my turn yet?"* 50 times a minute. It creates massive visual overhead, unnecessary DB reads, and degrades performance.
* **Latency lag**: If a patient is called, a TV polling on a 5-second offset will delay rendering the change. In a crowded outpatient facility, those 5 seconds of silence cause confusion, with patients questioning if the display is frozen or if they missed their slot.
* **WebSockets/Socket.io**: This approach behaves like an elegant television broadcast. When the receptionist presses "Call Next", the server updates the disc index once and immediately shouts the updated state to all clients in a fraction of a millisecond. It reduces server load to virtually zero when the queue is static and ensures the waiting room displays transition *at the exact physical moment* the receptionist clicks the button.

---

## 🧮 2. Why Server-Side Wait-Time Estimation over Client-Side?

It is tempting to throw the wait-time logic onto the React client because it's "easier." However, I deliberately isolated `calculateWaitTime()` inside `server/waitTimeCalculator.ts` for two reasons:

1. **The Single Source of Truth**: Different client devices (especially older clinic displays or tablets) have varying internal hardware clocks and timezone configurations. Calculating estimates client-side introduces **room drift**, where the receptionist’s dashboard reads "Wait: 20m" while a patient's phone reads "Wait: 18m." This discrepancies destroy trust.
2. **Dynamic Elapsed Buffering**: Most simple queue calculators just multiply `waiting_patients * avg_time`. That is flawed. If average service is 10 minutes, and the current patient has already been inside the doctor's room for **14 minutes**, a dumb calculator still tells the next patient, *"Your wait is 10 min."* 
   * QueueCure tracks the exact time the current token was called. If the consultation runs *longer* than the average, the extra elapsed time deducts from the first waiting patient's slot, dynamically ticking down. Placing this calculations in a server interval running every 30 seconds ensures waiting lists adjust automatically even when no new patients are manually called.

---

## 🛡️ 3. Handling the 10 Clinical Edge Cases (My Logic)

I identified and handled each of the 10 key boundary edge cases:

1. **Empty Queue Click**: Prevented server-side array bounds crashes by asserting `waiting.length > 0` before mutating array positions, and disabled the button client-side with a warning.
2. **Call-Next Rapid Double-Clicks**: Prevented multiple fast clicks (from a nervous or double-tapping receptionist) from throwing the entire index forward by locking clicks behind an 800ms React state debounce.
3. **Mid-day Average Time Modifications**: By linking average consultation times to an active, real-time numeric value, changes propogate immediately through the array mapping functions, dynamically resizing downstream slots without retroactively altering timestamps of historical completed entries.
4. **Mid-session Disconnects & TV Restarts**: Handled by setting the Socket.io client to fire `queue:request-state` immediately on the `connect` event loop, ensuring late-joining or rebooted devices synchronize instantly with active states.
5. **Whitespace or Null Patient Entries**: Validated name string inputs by running `.trim()` and asserting truthiness before allocating a token block, preventing blank tokens from occupying slots.
6. **Concurrent Receptionist Collisions**: Since all data mutations, counters, and array insertions take place inside a single Express process on the server back-end, they are processed procedurally, removing race condition risks.
7. **End-of-day Counter Resets**: Designed a clear, high-contrast modal requesting confirmation before executing `resetQueueForNewDay()`. The old session tokens are cleanly archived under a `"history"` node inside `data.json`, and active counters start clean at #1.
8. **Power Outages & Server Restarts**: Protected against sudden power outages (highly common in semi-urban clinic districts) by saving the exact JSON payload to disc on every single mutation. On server boot, the repository automatically reads `data.json` to safely resume status state.
9. **Invalid/Negative Service Times**: Guarded the UI slider constraints and validated inputs on the backend, enforcing a minimum threshold of `1` minute.
10. **Empty Consultation No-Show Skips**: The block is conditionally disabled and guarded unless an active patient is marked `in-progress`.

---

## 🚀 4. Left Out of Scope for MVP (Phase 2 Roadmap)

To maintain focus and avoid "AI slop" or feature over-engineering, I deliberately left several items for Phase 2:
* **Multi-Doctor Support**: Multiple independent clinics in a hospital multiplex would require database modifications, splitting tokens into doctor-specific prefix channels (e.g., ENT-01, PEDS-05). For an MVP, a single highly-focused doctor OPD is mathematically cleaner.
* **SMS Integration (Twilio/Wassenger)**: Patients would love to receive SMS alerts when they are "3 tokens away" so they can grab coffee/tea nearby. This is a Phase 2 item requiring expensive API integrations and secrets.
* **Active Authentication (RBAC)**: Receptionists are assumed to operate in trusted private local area networks. Adding user logins, passwords, and sessions adds friction to an MVP hackathon timeline.

---

## ⚖️ 5. Trade-Offs Made for Hackathon Constraints

* **JSON File Storage over PostgreSQL/Spanner**: I opted for a highly optimized, asynchronous, file-persisted JSON repository. It provides 100% of the persistence guarantee needed for a single-server setup while bypassing setup overhead. It is wrapped behind a clean interface, so changing it to PostgreSQL with Prisma requires changing only one file.
* **Local Clock Assumption**: I assume the server clock is set to standard local time (e.g. IST), which matches container defaults on Cloud Run.
