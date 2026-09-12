import React from 'react';
import { AuthProvider } from './providers/AuthContext';
import { ServerProvider } from './providers/ServerContext';
import { PresenceProvider } from './providers/PresenceContext';
import { ChatProvider } from './providers/ChatContext';
import { MediaProvider } from './providers/MediaContext';
import { NavigationProvider } from './providers/NavigationContext';
import { DMProvider } from './providers/DMContext';
import { InboxProvider } from './providers/InboxContext';
import { AppLayout } from '../components/layout/AppLayout';

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <NavigationProvider>
        <DMProvider>
          <InboxProvider>
            <ServerProvider>
              <PresenceProvider>
                <ChatProvider>
                  <MediaProvider>
                    <AppLayout />
                  </MediaProvider>
                </ChatProvider>
              </PresenceProvider>
            </ServerProvider>
          </InboxProvider>
        </DMProvider>
      </NavigationProvider>
    </AuthProvider>
  );
};

export default App;
