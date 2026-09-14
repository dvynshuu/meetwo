import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Server, Channel, ServerMember, ChannelType, ChannelCategory, Invite } from '../../types';
import { serverRepository, channelRepository, ResolvedInvite } from '../../lib/repositories';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { useAuth } from './AuthContext';

export type { ResolvedInvite };

interface ServerContextType {
  servers: Server[];
  activeServer: Server | null;
  channels: Channel[];
  allChannels: Channel[];
  categories: ChannelCategory[];
  activeChannel: Channel | null;
  members: ServerMember[];
  isLoading: boolean;
  error: string | null;
  selectServer: (serverId: string, fallbackServer?: Server) => void;
  selectChannel: (channelId: string) => void;
  createServer: (name: string, iconUrl?: string) => Promise<Server>;
  createChannel: (serverId: string, name: string, type: ChannelType, topic?: string, categoryId?: string) => Promise<Channel>;
  createCategory: (serverId: string, name: string) => Promise<ChannelCategory>;
  createInvite: (serverId: string, options?: { maxUses?: number; expiresInHours?: number }) => Promise<Invite>;
  resolveInvite: (code: string, encodedData?: string | null) => Promise<ResolvedInvite | null>;
  acceptInvite: (code: string, encodedData?: string | null) => Promise<{ server: Server; channelId?: string }>;
  joinServer: (serverId: string) => Promise<Server>;
  refreshServers: () => Promise<void>;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

export const ServerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [servers, setServers] = useState<Server[]>([]);
  const [activeServer, setActiveServer] = useState<Server | null>(null);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [allChannels, setAllChannels] = useState<Channel[]>([]);
  const [categories, setCategories] = useState<ChannelCategory[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [members, setMembers] = useState<ServerMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedServers = await serverRepository.getServers();
      setServers(loadedServers);

      if (loadedServers.length > 0) {
        const initial = loadedServers[0];
        setActiveServer(initial);

        const globalChannels = await channelRepository.getAllChannels();
        setAllChannels(globalChannels);

        const serverChans = globalChannels.filter((c) => c.serverId === initial.id);
        setChannels(serverChans);
        if (serverChans.length > 0) {
          setActiveChannel(serverChans[0]);
        }

        const serverCats = await channelRepository.getCategories(initial.id);
        setCategories(serverCats);

        const serverMembers = await serverRepository.getServerMembers(initial.id);
        setMembers(serverMembers);
      } else {
        setActiveServer(null);
        setChannels([]);
        setAllChannels([]);
        setCategories([]);
        setActiveChannel(null);
        setMembers([]);
      }
    } catch (err: any) {
      console.error('[ServerContext] Error loading servers:', err);
      setError(err.message || 'Failed to load workspace data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData, currentUser?.id]);

  // When active server changes, fetch its channels, categories, and members
  const selectServer = useCallback(
    async (serverId: string, fallbackServer?: Server) => {
      let target = servers.find((s) => s.id === serverId) || fallbackServer;
      if (!target) {
        try {
          const fresh = await serverRepository.getServers();
          target = fresh.find((s) => s.id === serverId);
        } catch {}
      }
      if (!target) return;

      setServers((prev) => (prev.some((s) => s.id === target!.id) ? prev : [...prev, target!]));
      setActiveServer(target);

      try {
        const [chans, cats, mems] = await Promise.all([
          channelRepository.getChannels(target.id),
          channelRepository.getCategories(target.id),
          serverRepository.getServerMembers(target.id),
        ]);

        setChannels(chans);
        setCategories(cats);
        setMembers(mems);

        if (chans.length > 0) {
          setActiveChannel(chans[0]);
        } else {
          setActiveChannel(null);
        }
      } catch (err) {
        console.error('[ServerContext] Failed to load server details:', err);
      }
    },
    [servers]
  );

  const selectChannel = useCallback(
    (channelId: string) => {
      const target = channels.find((c) => c.id === channelId) || allChannels.find((c) => c.id === channelId);
      if (target) {
        setActiveChannel(target);
      }
    },
    [channels, allChannels]
  );

  const createServer = useCallback(
    async (name: string, iconUrl?: string): Promise<Server> => {
      if (!currentUser) throw new Error('Sign in required to create a workspace.');
      const newServer = await serverRepository.createServer(name, currentUser.id, iconUrl);
      setServers((prev) => [...prev, newServer]);
      setActiveServer(newServer);
      if (newServer.channels && newServer.channels.length > 0) {
        setChannels(newServer.channels);
        setActiveChannel(newServer.channels[0]);
        setAllChannels((prev) => [...prev, ...newServer.channels!]);
      }
      return newServer;
    },
    [currentUser]
  );

  const createChannel = useCallback(
    async (
      serverId: string,
      name: string,
      type: ChannelType,
      topic?: string,
      categoryId?: string
    ): Promise<Channel> => {
      const chan = await channelRepository.createChannel(serverId, name, type, topic, categoryId);
      setChannels((prev) => [...prev, chan]);
      setAllChannels((prev) => (prev.some((c) => c.id === chan.id) ? prev : [...prev, chan]));
      setActiveChannel(chan);
      return chan;
    },
    []
  );

  const createCategory = useCallback(
    async (serverId: string, name: string): Promise<ChannelCategory> => {
      const cat = await channelRepository.createCategory(serverId, name);
      setCategories((prev) => [...prev, cat]);
      return cat;
    },
    []
  );

  const createInvite = useCallback(
    async (
      serverId: string,
      options?: { maxUses?: number; expiresInHours?: number }
    ): Promise<Invite> => {
      if (!currentUser) throw new Error('Sign in required to create an invite.');
      return serverRepository.createInvite(serverId, currentUser.id, options);
    },
    [currentUser]
  );

  const resolveInvite = useCallback(
    async (code: string, _encodedData?: string | null): Promise<ResolvedInvite | null> => {
      return serverRepository.resolveInvite(code);
    },
    []
  );

  const acceptInvite = useCallback(
    async (code: string, _encodedData?: string | null): Promise<{ server: Server; channelId?: string }> => {
      const res = await serverRepository.acceptInvite(code);
      setServers((prev) => (prev.some((s) => s.id === res.server.id) ? prev : [...prev, res.server]));
      await selectServer(res.server.id, res.server);
      if (res.channelId) {
        selectChannel(res.channelId);
      }
      return res;
    },
    [selectServer, selectChannel]
  );

  const joinServer = useCallback(
    async (serverId: string): Promise<Server> => {
      let target = servers.find((s) => s.id === serverId);
      if (!target) {
        const fresh = await serverRepository.getServers();
        target = fresh.find((s) => s.id === serverId);
      }
      if (!target) {
        throw new Error('Workspace not found or invite required to join.');
      }
      await selectServer(target.id, target);
      return target;
    },
    [servers, selectServer]
  );

  const refreshServers = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Realtime updates for servers, channels, and memberships
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || !currentUser) return;

    const sub = supabase
      .channel('workspace_realtime_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'channels' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const raw = payload.new as any;
            const chan: Channel = {
              id: raw.id,
              serverId: raw.server_id,
              name: raw.name,
              type: raw.type,
              topic: raw.topic || '',
              categoryId: raw.category_id || undefined,
              position: raw.position || 0,
              createdAt: raw.created_at,
            };
            setAllChannels((prev) => (prev.some((c) => c.id === chan.id) ? prev : [...prev, chan]));
            if (activeServer && chan.serverId === activeServer.id) {
              setChannels((prev) => (prev.some((c) => c.id === chan.id) ? prev : [...prev, chan]));
            }
          } else if (payload.eventType === 'DELETE') {
            const delId = (payload.old as any)?.id;
            if (delId) {
              setAllChannels((prev) => prev.filter((c) => c.id !== delId));
              setChannels((prev) => prev.filter((c) => c.id !== delId));
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (supabase) supabase.removeChannel(sub);
    };
  }, [currentUser?.id, activeServer?.id]);

  return (
    <ServerContext.Provider
      value={{
        servers,
        activeServer,
        channels,
        allChannels,
        categories,
        activeChannel,
        members,
        isLoading,
        error,
        selectServer,
        selectChannel,
        createServer,
        createChannel,
        createCategory,
        createInvite,
        resolveInvite,
        acceptInvite,
        joinServer,
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
