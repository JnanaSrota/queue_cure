import { Queue, Token } from "../types.js";

/** Returns waiting tokens in FIFO order by token number. */
export function getWaitingTokensSorted(tokens: Token[]): Token[] {
  return tokens
    .filter(t => t.status === "waiting")
    .sort((a, b) => a.tokenNumber - b.tokenNumber);
}

export function minutesSince(timestampStr?: string): number {
  if (!timestampStr) return 0;
  const diffMs = Date.now() - new Date(timestampStr).getTime();
  return Math.max(0, diffMs / (1000 * 60));
}

export function calculateWaitTime(queue: Queue): Token[] {
  const avg = queue.avgConsultationTimeMinutes || 10;
  const inProgressToken = queue.tokens.find(t => t.status === "in-progress");

  let estimatedRemaining = 0;
  if (inProgressToken?.calledAt) {
    const elapsed = minutesSince(inProgressToken.calledAt);
    estimatedRemaining = Math.max(0, avg - elapsed);
  }

  const waitingTokens = getWaitingTokensSorted(queue.tokens);

  return queue.tokens.map(token => {
    if (token.status === "waiting") {
      const i = waitingTokens.findIndex(t => t.tokenNumber === token.tokenNumber);
      if (i !== -1) {
        const estimatedWait = estimatedRemaining + i * avg;
        const roundedWait = Math.round(estimatedWait * 10) / 10;
        return { ...token, estimatedWaitMinutes: roundedWait };
      }
    } else if (token.status === "in-progress") {
      return { ...token, estimatedWaitMinutes: 0 };
    }
    return token;
  });
}

export function withLiveWaitTimes(queue: Queue): Queue {
  return { ...queue, tokens: calculateWaitTime(queue) };
}
