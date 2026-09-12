import React, { createContext, useContext, useState, useEffect } from 'react';
import { Server, Channel, ServerMember, ChannelType } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { mockStore } from '../../lib/supabase/mockStore';
import { useAuth } from './AuthContext';

interface ServerContextType {
  servers: Server[];
  activeServer: Server | null;
  channels: Channel[];
  activeChannel: Channel | null;
  members: ServerMember[];
  isLoading: boolean;
  selectServer: (serverId: string) => void;
  selectChannel: (channelId: string) => void;
  createServer: (name: string, iconUrl?: string) => Promise<Server>;
  createChannel: (serverId: string, name: string, type: ChannelType, topic?: string, categoryId?: string) => Promise<Channel>;
  refreshServers: () => Promise<void>;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      if (isSupabaseConfigured && supabase && currentUser) {
        // Fetch servers user belongs to
        const { data: serverData } = await supabase
          .from('servers')
          .select('*, channels(*)')
          .order('created_at', { ascending: true });

        if (serverData && serverData.length > 0) {
          const loadedServers: Server[] = serverData.map((s: any) => ({
            id: s.id,
            name: s.name,
            iconUrl: s.icon_url,
            description: s.description,
            ownerId: s.owner_id,
            createdAt: s.created_at,
          }));
          setServers(loadedServers);
          const initialServer = loadedServers[0];
          setActiveServer(initialServer);

          // Channels for initial server
          const activeChannels = serverData[0].channels || [];
          setChannels(activeChannels);
          if (activeChannels.length > 0) {
            setActiveChannel(activeChannels[0]);
          }
        }
      } else {
        // Demo mode
        const allServers = mockStore.getServers();
        setServers(allServers);

        if (allServers.length > 0) {
          const initial = allServers[0];
          setActiveServer(initial);

          const allChannels = mockStore.getChannels();
          const serverChannels = allChannels.filter((c) => c.serverId === initial.id);
          setChannels(serverChannels);
          if (serverChannels.length > 0) {
            setActiveChannel(serverChannels[0]);
          }

          const serverMembers = mockStore.getServerMembers(initial.id);
          setMembers(serverMembers);
        }
      }
    } catch (err) {
      console.error('Error loading servers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listen for mock store updates
    const unsubs = [
      mockStore.subscribe('SERVER_CREATED', (newServer: Server) => {
        setServers((prev) => [...prev, newServer]);
      }),
      mockStore.subscribe('CHANNEL_CREATED', (newChannel: Channel) => {
        setChannels((prev) => [...prev, newChannel]);
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [currentUser?.id]);

  // When active server changes, update channels and members
  const selectServer = (serverId: string) => {
    const target = servers.find((s) => s.id === serverId);
    if (!target) return;
    setActiveServer(target);

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('channels')
        .select('*')
        .eq('server_id', serverId)
        .order('position', { ascending: true })
        .then(({ data }) => {
          if (data) {
            setChannels(data);
            if (data.length > 0) setActiveChannel(data[0]);
          }
        });
    } else {
      const allChannels = mockStore.getChannels();
      const serverChannels = allChannels.filter((c) => c.serverId === serverId);
      setChannels(serverChannels);
      if (serverChannels.length > 0) {
        setActiveChannel(serverChannels[0]);
      } else {
        setActiveChannel(null);
      }

      const serverMembers = mockStore.getServerMembers(serverId);
      setMembers(serverMembers);
    }
  };

  const selectChannel = (channelId: string) => {
    const target = channels.find((c) => c.id === channelId);
    if (target) {
      setActiveChannel(target);
    }
  };

  const createServer = async (name: string, iconUrl?: string): Promise<Server> => {
    if (isSupabaseConfigured && supabase && currentUser) {
      const { data: server, error } = await supabase
        .from('servers')
        .insert({
          name,
          icon_url: iconUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${name}`,
          owner_id: currentUser.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Add as owner member
      await supabase.from('server_members').insert({
        server_id: server.id,
        user_id: currentUser.id,
        role: 'owner',
      });

      // Add default text channel
      const { data: generalChan } = await supabase
        .from('channels')
        .insert({
          server_id: server.id,
          name: 'general',
          type: 'text',
          position: 0,
        })
        .select()
        .single();

      const newServerObj: Server = {
        id: server.id,
        name: server.name,
        iconUrl: server.icon_url,
        description: server.description,
        ownerId: server.owner_id,
        createdAt: server.created_at,
      };

      setServers((prev) => [...prev, newServerObj]);
      setActiveServer(newServerObj);
      if (generalChan) {
        setChannels([generalChan]);
        setActiveChannel(generalChan);
      }
      return newServerObj;
    } else {
      const newServer = mockStore.createServer(name, iconUrl);
      setServers((prev) => [...prev, newServer]);
      selectServer(newServer.id);
      return newServer;
    }
  };

  const createChannel = async (
    serverId: string,
    name: string,
    type: ChannelType,
    topic?: string,
    categoryId?: string
  ): Promise<Channel> => {
    if (isSupabaseConfigured && supabase) {
      const { data: channel, error } = await supabase
        .from('channels')
        .insert({
          server_id: serverId,
          category_id: categoryId || null,
          name: name.toLowerCase().replace(/\s+/g, '-'),
          type,
          topic: topic || '',
          position: channels.length,
        })
        .select()
        .single();
      if (error) throw error;

      setChannels((prev) => [...prev, channel]);
      setActiveChannel(channel);
      return channel;
    } else {
      const newChan = mockStore.createChannel(serverId, name, type, topic, categoryId);
      setChannels((prev) => [...prev, newChan]);
      setActiveChannel(newChan);
      return newChan;
    }
  };

  const refreshServers = async () => {
    await loadData();
  };

  return (
    <ServerContext.Provider
      value={{
        servers,
        activeServer,
        channels,
        activeChannel,
        members,
        isLoading,
        selectServer,
        selectChannel,
        createServer,
        createChannel,
        refreshServers,
      }}
    >
      {children}
    </ServerContext.Provider>
  );
};

export const useServer = () => {
  const context = useContext(ServerContext);
  if (!context) throw new Error('useServer must be used within a ServerProvider');
  return context;
};
