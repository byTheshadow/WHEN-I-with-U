import db from '../../db';
import {
  createMemory,
  createPendingMemoryCandidate,
  ensureMemoryJob,
  getMemoryJob
} from './memoryService';
import {
  MEMORY_JOB_STATUSES,
  MEMORY_STATUSES
} from './memoryConstants';
import { extractMemoryFromConversation } from './memoryAiService';
import {
  getUsableMessages,
  inspectMemorySignals
} from './memorySignals';

const activeMemoryJobs = new Set();
const pendingTimers = new Map();

const NORMAL_CHECKPOINT = 30;
const HIGH_PRIORITY_DELAY = 15000;
const NORMAL_DELAY = 90000;
const RETRY_DELAY = 10 * 60 * 1000;

const nowIso = () => new Date().toISOString();

const isDocumentVisible = () => (
  typeof document !== 'undefined' &&
  document.visibilityState === 'visible'
);

const getChatMessagesById = async (chatId) => {
  const messages = await db.messages
    .where('chatId')
    .equals(chatId)
    .toArray();

  return messages.sort((a, b) => Number(a.id || 0) - Number(b.id || 0));
};

const getMessagesSinceCursor = (messages, lastProcessedMessageId) => {
  if (!lastProcessedMessageId) return messages;

  return messages.filter(
    (message) => Number(message.id) > Number(lastProcessedMessageId)
  );
};

const updateMemoryJob = async (chatId, updates) => {
  const currentJob = await getMemoryJob(chatId);

  if (!currentJob) {
    return null;
  }

  const nextJob = {
    ...currentJob,
    ...updates,
    updatedAt: nowIso()
  };

  await db.memoryJobs.update(currentJob.id, nextJob);

  return nextJob;
};

const persistExtractionResult = async ({
  chatId,
  extraction,
  lastProcessedMessageId
}) => {
  for (const memory of extraction.memories) {
    await createMemory({
      chatId,
      title: memory.title,
      content: memory.content,
      type: memory.type,
      status: MEMORY_STATUSES.ACTIVE,
      importance: memory.importance,
      confidence: memory.confidence,
      sourceMessageIds: memory.sourceMessageIds,
      sourceMessageTimestamps: memory.sourceMessageTimestamps,
      sourceState: memory.sourceState,
      sourceKind: memory.sourceKind,
      note: '由对话整理形成。'
    });
  }

  for (const candidate of extraction.candidates) {
    await createPendingMemoryCandidate({
      chatId,
      title: candidate.title,
      content: candidate.content,
      type: candidate.type,
      priority: candidate.priority,
      sourceMessageIds: candidate.sourceMessageIds,
      sourceMessageTimestamps: candidate.sourceMessageTimestamps,
      sourceKind: candidate.sourceKind
    });
  }

  await updateMemoryJob(chatId, {
    status: MEMORY_JOB_STATUSES.IDLE,
    lastProcessedMessageId,
    nextRunAt: null,
    retryCount: 0,
    lastError: '',
    lastCompletedAt: nowIso()
  });
};

export const runMemoryProcessing = async (
  chatId,
  { force = false } = {}
) => {
  if (!chatId || activeMemoryJobs.has(chatId)) {
    return { skipped: true, reason: 'already_running_or_invalid' };
  }

  if (!force && !isDocumentVisible()) {
    return { skipped: true, reason: 'document_hidden' };
  }

  activeMemoryJobs.add(chatId);

  try {
    const job = await ensureMemoryJob(chatId);
    const allMessages = await getChatMessagesById(chatId);
    const pendingMessages = getMessagesSinceCursor(
      allMessages,
      job.lastProcessedMessageId
    );

    const usableMessages = getUsableMessages(pendingMessages);
    const signals = inspectMemorySignals(pendingMessages);

    if (usableMessages.length === 0) {
      return { skipped: true, reason: 'no_usable_messages' };
    }

    const shouldProcess = force ||
      usableMessages.length >= NORMAL_CHECKPOINT ||
      signals.hasHighPrioritySignal;

    if (!shouldProcess) {
      await updateMemoryJob(chatId, {
        status: MEMORY_JOB_STATUSES.IDLE,
        nextRunAt: null
      });

      return {
        skipped: true,
        reason: 'checkpoint_not_reached',
        usableMessageCount: usableMessages.length
      };
    }

    await updateMemoryJob(chatId, {
      status: MEMORY_JOB_STATUSES.RUNNING,
      nextRunAt: null,
      lastError: ''
    });

    const extraction = await extractMemoryFromConversation({
      chatId,
      messages: pendingMessages
    });

    const lastProcessedMessageId = pendingMessages
      .map((message) => Number(message.id))
      .filter(Number.isFinite)
      .sort((a, b) => b - a)[0] || job.lastProcessedMessageId;

    await persistExtractionResult({
      chatId,
      extraction,
      lastProcessedMessageId
    });

    return {
      skipped: false,
      createdMemories: extraction.memories.length,
      createdCandidates: extraction.candidates.length
    };
  } catch (error) {
    console.warn('[Memory] Processing failed safely:', error);

    await updateMemoryJob(chatId, {
      status: MEMORY_JOB_STATUSES.FAILED,
      nextRunAt: new Date(Date.now() + RETRY_DELAY).toISOString(),
      retryCount: ((await getMemoryJob(chatId))?.retryCount || 0) + 1,
      lastError: error?.message || '未知错误'
    });

    return {
      skipped: false,
      error: error?.message || '未知错误'
    };
  } finally {
    activeMemoryJobs.delete(chatId);
  }
};

export const scheduleMemoryProcessing = async (chatId) => {
  if (!chatId) return;

  const job = await ensureMemoryJob(chatId);
  const allMessages = await getChatMessagesById(chatId);
  const pendingMessages = getMessagesSinceCursor(
    allMessages,
    job.lastProcessedMessageId
  );

  const usableMessages = getUsableMessages(pendingMessages);

  if (usableMessages.length === 0) {
    return;
  }

  const signals = inspectMemorySignals(pendingMessages);
  const shouldPrepare = (
    usableMessages.length >= NORMAL_CHECKPOINT ||
    signals.hasHighPrioritySignal
  );

  if (!shouldPrepare) {
    return;
  }

  const delay = signals.hasHighPrioritySignal
    ? HIGH_PRIORITY_DELAY
    : NORMAL_DELAY;

  const existingTimer = pendingTimers.get(chatId);

  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  const nextRunAt = new Date(Date.now() + delay).toISOString();

  await updateMemoryJob(chatId, {
    status: MEMORY_JOB_STATUSES.PENDING,
    nextRunAt
  });

  const timer = setTimeout(() => {
    pendingTimers.delete(chatId);
    void runMemoryProcessing(chatId);
  }, delay);

  pendingTimers.set(chatId, timer);
};

export const cancelScheduledMemoryProcessing = (chatId) => {
  const timer = pendingTimers.get(chatId);

  if (timer) {
    clearTimeout(timer);
    pendingTimers.delete(chatId);
  }
};
export const runMemoryProcessingNow = async (chatId) => {
  cancelScheduledMemoryProcessing(chatId);

  return runMemoryProcessing(chatId, { force: true });
};
