import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

interface Conversation {
  role: string;
  content: string;
}

interface KnowledgeBaseContextType {
  knowledgeBase: string[];
  addToKnowledgeBase: (content: string) => void;
  setKnowledgeBase: (knowledgeBase: string[]) => void;
  conversations: Conversation[];
  addConversation: (conversation: Conversation) => void;
  clearConversations: () => void;
}

const KnowledgeBaseContext = createContext<KnowledgeBaseContextType | undefined>(undefined);

export const KnowledgeBaseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [knowledgeBase, setKnowledgeBase] = useState<string[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  useEffect(() => {
    const savedKnowledgeBase = localStorage.getItem('knowledgeBase');
    const savedConversations = localStorage.getItem('conversations');
    if (savedKnowledgeBase) {
      setKnowledgeBase(JSON.parse(savedKnowledgeBase));
    }
    if (savedConversations) {
      setConversations(JSON.parse(savedConversations));
    }
  }, []);

  useEffect(() => {
    try {
      // Attached images (clipboard/file upload) are data: URLs large enough
      // to blow localStorage's quota - persisting them crashed every
      // subsequent update with an uncaught QuotaExceededError, which is what
      // made the attach button itself look broken. Keep images for the
      // current session only; persist text so restarts don't lose the
      // resume/notes.
      const persistable = knowledgeBase.filter((item) => !item.startsWith('data:image'));
      localStorage.setItem('knowledgeBase', JSON.stringify(persistable));
    } catch {
      // Still over quota even after filtering - not fatal, skip this write.
    }
  }, [knowledgeBase]);

  useEffect(() => {
    try {
      localStorage.setItem('conversations', JSON.stringify(conversations));
    } catch {
      // best-effort - conversation history persistence isn't critical
    }
  }, [conversations]);

  const addToKnowledgeBase = (content: string) => {
    setKnowledgeBase(prev => [...prev, content]);
  };

  const addConversation = (conversation: Conversation) => {
    setConversations(prev => [...prev, conversation]);
  };

  const clearConversations = () => {
    setConversations([]);
  };

  return (
    <KnowledgeBaseContext.Provider
      value={{
        knowledgeBase,
        addToKnowledgeBase,
        setKnowledgeBase,
        conversations,
        addConversation,
        clearConversations,
      }}
    >
      {children}
    </KnowledgeBaseContext.Provider>
  );
};

export const useKnowledgeBase = () => {
  const context = useContext(KnowledgeBaseContext);
  if (context === undefined) {
    throw new Error('useKnowledgeBase must be used within a KnowledgeBaseProvider');
  }
  return context;
};
