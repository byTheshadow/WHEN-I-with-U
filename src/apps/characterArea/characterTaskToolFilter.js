// src/apps/characterArea/characterTaskToolFilter.js
//
// 角色自我任务——无人值守时能用哪些 MCP 工具（切片 D1）。
//
// 任务到点时用户通常不在场，没法弹授权窗口，所以只放行"确定是只读"的工具：
//   1. 服务器自己声明了 destructiveHint: true 或 readOnlyHint: false：一律不用。
//   2. 服务器声明了 readOnlyHint: true：算只读。
//   3. 服务器什么都没声明：退回项目已有的 riskLevel 判断，必须判成 'read'
//      （注意 riskLevel 只是 mcpConnectionService.js 里按工具名/描述关键词猜的，
//      所以第 1、2 条的服务器声明优先于它）。
//   4. 用户在聊天里对这个工具设过持久化"拒绝"的，不管上面怎么判，都不用。
//
// 用户没批准过、但满足以上条件的只读工具可以直接用（已和用户确认）。
import { getEffectiveMcpPermission, MCP_PERMISSION_DECISIONS } from '../../services/mcp/mcpPermissionService';

const READ_RISK_LEVEL = 'read';

export const isToolSafeForUnattendedTask = (tool) => {
  const annotations =
    tool?.annotations && typeof tool.annotations === 'object' ? tool.annotations : {};

  if (annotations.destructiveHint === true) return false;
  if (annotations.readOnlyHint === false) return false;
  if (annotations.readOnlyHint === true) return true;

  return tool?.riskLevel === READ_RISK_LEVEL;
};

// 给 scheduledMcpToolBridge.js 的 filterTools 用：传入已启用的工具列表，返回任务可以用的那部分。
export const filterToolsForTask = async (tools, { chatId, characterId }) => {
  const allowed = [];

  for (const tool of tools) {
    if (!isToolSafeForUnattendedTask(tool)) continue;

    try {
      // eslint-disable-next-line no-await-in-loop
      const permission = await getEffectiveMcpPermission({
        connectionId: tool.connectionId,
        toolName: tool.toolName,
        chatId,
        characterId,
      });

      if (permission?.decision === MCP_PERMISSION_DECISIONS.DENY) continue;
    } catch (error) {
      // 查不到权限记录时宁可不用，也不冒险放行。
      console.warn('[characterTask] 查询工具权限失败，这个工具本次不用：', error);
      continue;
    }

    allowed.push(tool);
  }

  return allowed;
};