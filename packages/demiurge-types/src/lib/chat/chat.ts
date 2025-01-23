export type TChatMessage = {
  user_id: string;
  content: string;
  date: string;
  replyIndex?: number;
};

export type TChat = {
  id: string;
  spaceId: string;
  messages: TChatMessage[];
  lastRead: {
    [key: string]: number; // user_id: message_index
  };
  isWriting: {
    [key: string]: boolean; // user_id: boolean
  };
  resolved: boolean;
};
