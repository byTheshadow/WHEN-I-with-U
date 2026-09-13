import { getDueWorkflows, markWorkflowRun } from './workflowService';
import { generateAndDeliverProactiveMessage } from '../../apps/messages/scheduledMessageService';

const CHECK_INTERVAL_MS = 60 * 1000;

let workflowTimer = null;
let isCheckingWorkflows = false;

const runDueWorkflows = async () => {
  if (isCheckingWorkflows) return;
  isCheckingWorkflows = true;

  try {
    const dueWorkflows = await getDueWorkflows();

    for (const workflow of dueWorkflows) {
      try {
        const result = await generateAndDeliverProactiveMessage({
          chatId: workflow.chatId,
          characterId: workflow.characterId,
          intent: workflow.goal,
          metadataExtra: { workflowId: workflow.id }
        });

                await markWorkflowRun(workflow.id, {
          success: !result.error,
          errorMessage: result.error ? result.message : ''
        });

        if (result.error) {
          console.warn('[Workflow] 执行失败：', workflow.id, result.message);
        }
      } catch (error) {
        console.error('[Workflow] 执行出现异常：', workflow.id, error);
        await markWorkflowRun(workflow.id, { success: false });
      }
    }
  } catch (error) {
    console.error('[Workflow] 检查到期工作流失败：', error);
  } finally {
    isCheckingWorkflows = false;
  }
};

export const startWorkflowScheduler = () => {
  if (workflowTimer) return;

  void runDueWorkflows();

  workflowTimer = window.setInterval(() => {
    void runDueWorkflows();
  }, CHECK_INTERVAL_MS);

  console.log('[Workflow] 定时工作流调度器已启动。');
};

export const stopWorkflowScheduler = () => {
  if (!workflowTimer) return;
  window.clearInterval(workflowTimer);
  workflowTimer = null;
  console.log('[Workflow] 定时工作流调度器已停止。');
};