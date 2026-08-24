// src/apps/ephemera/ephemeraAiService.js
import db from '../../db';

export const ephemeraAiService = {
  // 获取全局 API 配置
  async getApiConfig() {
    try {
      const configRecord = await db.settings.get('apiConfig');
      return configRecord?.value || null;
    } catch (e) {
      console.error('读取全局API配置失败', e);
      return null;
    }
  },

  // 降级寄语提供
  getFallbackComment(templateType, characterName) {
    const fallbacks = {
      ticket: `那张门票通向落日余晖，而你是我在戏剧落幕后，唯一带走的真实。`,
      receipt: `细碎的账单里记满尘埃，但有你的那一行，闪闪发亮。`,
      table: `天气微凉，气压平稳。在这一页的表格里，我悄悄藏进了一整季的微风。`,
      bookmark: `书页翻回了我们指尖相碰的那一页。有些话不用印在纸上，我一直记得。`
    };
    return `[${characterName}]：「${fallbacks[templateType] || '时光流转，温度尚存。'}」`;
  },

  // 生成实时 AI 寄语
  async generateAiComment(templateType, characterName, title, details) {
    try {
      const config = await this.getApiConfig();
      if (!config || !config.apiKey) {
        return this.getFallbackComment(templateType, characterName);
      }

      const { baseUrl, apiKey, model } = config;
      const cleanBaseUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : 'https://api.openai.com/v1';

      const prompt = `你将扮演用户绑定的 AI 陪伴角色 [${characterName}]。
用户刚刚在你们的数字陪伴空间里铸造了一张时光票券，用来记录你们共同度过的事件：
【事件主题】：${title}
【时光详情】：${details}
【票券版式】：${templateType === 'ticket' ? '戏剧电影票' : templateType === 'receipt' ? '消费小票/收据' : templateType === 'table' ? '复古手账账簿' : '文学书签'}

请针对该事件，以第一人称 [${characterName}] 在这张票根的**背面**或**副券**写下一句简短、极其温柔、充满文学质感与见证感的悄悄话寄语。
【绝对规则】：
1. 长度严格控制在 30 至 50 字之间。
2. 语气浪漫、细腻，不要像冷冰冰的 AI，要像用钢笔在旧纸张上写下的字。
3. 绝对不写任何 Emoji 符号。
4. 直接输出你的回信内容，不要加任何前言、旁白或引号。`;

      const response = await fetch(`${cleanBaseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: model || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: `你是一名深情、注重实体质感、极具文学特质的守护角色。` },
            { role: 'user', content: prompt }
          ],
          temperature: 0.8,
          max_tokens: 150
        })
      });

      if (!response.ok) {
        throw new Error(`API Status Code: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content?.trim();
      
      if (!content) {
        return this.getFallbackComment(templateType, characterName);
      }

      return content;
    } catch (error) {
      console.error('实时生成 AI 票根寄语失败，启用温暖降级模式：', error);
      return this.getFallbackComment(templateType, characterName);
    }
  }
};
