import React from 'react';
import { AuthProvider } from './providers/AuthContext';
import { ServerProvider } from './providers/ServerContext';
import { PresenceProvider } from './providers/PresenceContext';
import { ChatProvider } from './providers/ChatContext';
import { MediaProvider } from './providers/MediaContext';
import { AppLayout } from '../components/layout/AppLayout';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ServerProvider>
        <PresenceProvider>
          <ChatProvider>
            <MediaProvider>
              <AppLayout />
            </MediaProvider>
          </ChatProvider>
        </PresenceProvider>
      </ServerProvider>
    </AuthProvider>
  );
};

export default App;
