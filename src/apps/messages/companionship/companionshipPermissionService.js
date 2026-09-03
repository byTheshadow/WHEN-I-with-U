import db from '../../../db';

const sameId = (left, right) => (
  String(left) === String(right)
);

export const createCompanionshipMcpAuthorization = ({
  sessionId,
}) => ({
  granted: true,

  validate: async ({
    chatId,
    characterId,
  }) => {
    const session = await db.companionshipSessions.get(sessionId);

    if (!session) return false;

    return (
      session.status === 'running'
      && session.mcpAuthorizationGranted === true
      && sameId(session.chatId, chatId)
      && sameId(session.characterId, characterId)
      && Number.isFinite(new Date(session.endsAt).getTime())
      && Date.now() < new Date(session.endsAt).getTime()
    );
  },
});
