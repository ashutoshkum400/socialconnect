export const SINGLE_TABLE_DESIGN = {
  tableName: 'Sathi',
  primaryKey: {
    pk: 'PK',
    sk: 'SK',
  },
  patterns: {
    userProfile: 'USER#{userId} / PROFILE',
    userEmailIndex: 'USER / EMAIL#{email}',
    followRelation: 'REL#{userId} / FOLLOW#{targetId}',
    blockRelation: 'REL#{userId} / BLOCK#{targetId}',
    post: 'POST#{postId} / POST',
    postLike: 'POST#{postId} / LIKE#{userId}',
    postComment: 'POST#{postId} / COMMENT#{commentId}',
    notification: 'USER#{userId} / NOTIF#{notificationId}',
    reel: 'REEL#{reelId} / REEL',
    chatThread: 'CHAT#{threadId} / MSG#{messageId}',
  },
  gsis: [
    { name: 'GSI1', pk: 'GSI1PK', sk: 'GSI1SK' },
    { name: 'GSI2', pk: 'GSI2PK', sk: 'GSI2SK' },
    { name: 'GSI3', pk: 'GSI3PK' },
    { name: 'GSI4', pk: 'GSI4PK' },
  ],
};
