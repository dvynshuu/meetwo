import React, { createContext, useContext, useState, useEffect } from 'react';
import { Server, Channel, ServerMember, ChannelType, Invite } from '../../types';
import { supabase, isSupabaseConfigured } from '../../lib/supabase/client';
import { mockStore } from '../../lib/supabase/mockStore';
import { useAuth } from './AuthContext';

export interface ResolvedInvite {
  invite: Invite;
  server: Server;
  inviter?: { displayName: string; avatarUrl?: string };
  isMember?: boolean;
  memberCount?: number;
}

interface ServerContextType {
  servers: Server[];
  activeServer: Server | null;
  channels: Channel[];
  activeChannel: Channel | null;
  members: ServerMember[];
  isLoading: boolean;
  selectServer: (serverId: string, fallbackServer?: Server) => void;
  selectChannel: (channelId: string) => void;
  createServer: (name: string, iconUrl?: string) => Promise<Server>;
  createChannel: (serverId: string, name: string, type: ChannelType, topic?: string, categoryId?: string) => Promise<Channel>;
  createInvite: (serverId: string, options?: { maxUses?: number; expiresInHours?: number }) => Promise<Invite>;
  resolveInvite: (code: string, encodedData?: string | null) => Promise<ResolvedInvite | null>;
  acceptInvite: (code: string, encodedData?: string | null) => Promise<{ server: Server; channelId?: string }>;
  joinServer: (serverId: string) => Promise<Server>;
  refreshServers: () => Promise<void>;
}

const ServerContext = createContext<ServerContextType | undefined>(undefined);

const mapChannel = (c: any): Channel => ({
  ...c,
  id: c.id,
  serverId: c.serverId || c.server_id,
  name: c.name,
  type: c.type,
  topic: c.topic || '',
  categoryId: c.categoryId || c.category_id || undefined,
  position: c.position ?? 0,
  unreadCount: c.unreadCount || 0,
  createdAt: c.createdAt || c.created_at,
});

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
          const activeChannels = (serverData[0].channels || []).map(mapChannel);
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
        setServers((prev) => (prev.some((s) => s.id === newServer.id) ? prev : [...prev, newServer]));
      }),
      mockStore.subscribe('CHANNEL_CREATED', (newChannel: Channel) => {
        setChannels((prev) => (prev.some((c) => c.id === newChannel.id) ? prev : [...prev, newChannel]));
      }),
      mockStore.subscribe('MEMBER_JOINED', (newMember: ServerMember) => {
        setMembers((prev) => {
          if (prev.some((m) => m.serverId === newMember.serverId && m.userId === newMember.userId)) {
            return prev;
          }
          const users = mockStore.getAllUsers();
          const enriched = { ...newMember, user: users.find((u) => u.id === newMember.userId) };
          return [...prev, enriched];
        });
      }),
    ];

    return () => unsubs.forEach((u) => u());
  }, [currentUser?.id]);

  // When active server changes, update channels and members
  const selectServer = (serverId: string, fallbackServer?: Server) => {
    let target = servers.find((s) => s.id === serverId) || fallbackServer;
    if (!target) {
      target = mockStore.getServers().find((s) => s.id === serverId);
    }
    if (!target) return;

    setServers((prev) => (prev.some((s) => s.id === target!.id) ? prev : [...prev, target!]));
    setActiveServer(target);

    if (isSupabaseConfigured && supabase) {
      supabase
        .from('channels')
        .select('*')
        .eq('server_id', serverId)
        .order('position', { ascending: true })
        .then(({ data, error }) => {
          if (!error && data && data.length > 0) {
            const mapped = data.map(mapChannel);
            setChannels(mapped);
            if (mapped.length > 0) setActiveChannel(mapped[0]);
          } else {
            // Fallback to local channels if Supabase channels table is empty or loading
            const localChans = mockStore.getChannels().filter((c) => c.serverId === serverId);
            if (localChans.length > 0) {
              setChannels(localChans);
              setActiveChannel(localChans[0]);
            } else {
              // Guarantee default general channel exists
              const genChan = mockStore.createChannel(serverId, 'general', 'text', 'Welcome!');
              setChannels([genChan]);
              setActiveChannel(genChan);
            }
          }
        });

      // Fetch server members in Supabase
      supabase
        .from('server_members')
        .select('*, profiles:user_id(*)')
        .eq('server_id', serverId)
        .then(({ data }) => {
          if (data && data.length > 0) {
            const mappedMembers: ServerMember[] = data.map((m: any) => ({
              serverId: m.server_id,
              userId: m.user_id,
              role: m.role || 'member',
              joinedAt: m.joined_at,
              user: m.profiles
                ? {
                    id: m.profiles.id,
                    username: m.profiles.username,
                    displayName: m.profiles.display_name || m.profiles.username,
                    avatarUrl: m.profiles.avatar_url,
                    status: m.profiles.status || 'online',
                    createdAt: m.profiles.created_at,
                  }
                : undefined,
            }));
            setMembers(mappedMembers);
          } else {
            const localMembers = mockStore.getServerMembers(serverId);
            setMembers(localMembers);
          }
        });
    } else {
      const allChannels = mockStore.getChannels();
      const serverChannels = allChannels.filter((c) => c.serverId === serverId);
      setChannels(serverChannels);
      if (serverChannels.length > 0) {
        setActiveChannel(serverChannels[0]);
      } else {
        const genChan = mockStore.createChannel(serverId, 'general', 'text', 'Welcome!');
        setChannels([genChan]);
        setActiveChannel(genChan);
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
        const mappedChan = mapChannel(generalChan);
        setChannels([mappedChan]);
        setActiveChannel(mappedChan);
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
      const insertPayload: Record<string, any> = {
        server_id: serverId,
        name: name.toLowerCase().replace(/\s+/g, '-'),
        type,
        topic: topic || '',
        position: channels.length,
      };

      // Only include category_id if provided
      if (categoryId) {
        insertPayload.category_id = categoryId;
      }

      let { data: channel, error } = await supabase
        .from('channels')
        .insert(insertPayload)
        .select()
        .single();

      // If category_id column does not exist in schema cache, retry without it
      if (error && (error.message?.includes('category_id') || error.code === 'PGRST204')) {
        delete insertPayload.category_id;
        const retryResult = await supabase
          .from('channels')
          .insert(insertPayload)
          .select()
          .single();
        channel = retryResult.data;
        error = retryResult.error;
      }

      if (error) throw error;

      const mappedChan = mapChannel(channel);
      setChannels((prev) => [...prev, mappedChan]);
      setActiveChannel(mappedChan);
      return mappedChan;
    } else {
      const newChan = mockStore.createChannel(serverId, name, type, topic, categoryId);
      setChannels((prev) => [...prev, newChan]);
      setActiveChannel(newChan);
      return newChan;
    }
  };

  const createInvite = async (
    serverId: string,
    options?: { maxUses?: number; expiresInHours?: number }
  ): Promise<Invite> => {
    const creatorId = currentUser?.id || 'demo-user';
    if (isSupabaseConfigured && supabase && currentUser) {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = options?.expiresInHours
        ? new Date(Date.now() + options.expiresInHours * 3600000).toISOString()
        : null;

      const { data, error } = await supabase
        .from('invites')
        .insert({
          server_id: serverId,
          code,
          creator_id: currentUser.id,
          max_uses: options?.maxUses || null,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (error) {
        console.warn('Supabase invite creation error, falling back to local:', error);
        return mockStore.createInvite(serverId, creatorId, options?.maxUses, options?.expiresInHours);
      }

      return {
        id: data.id,
        serverId: data.server_id,
        code: data.code,
        creatorId: data.creator_id,
        maxUses: data.max_uses,
        expiresAt: data.expires_at,
        usesCount: data.uses_count || 0,
        createdAt: data.created_at,
      };
    } else {
      return mockStore.createInvite(serverId, creatorId, options?.maxUses, options?.expiresInHours);
    }
  };

  const resolveInvite = async (
    code: string,
    encodedData?: string | null
  ): Promise<ResolvedInvite | null> => {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) return null;

    // 1. If Supabase configured, query database
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: invData, error: invErr } = await supabase
          .from('invites')
          .select('*')
          .eq('code', cleanCode)
          .maybeSingle();

        if (invData) {
          const inviteObj: Invite = {
            id: invData.id,
            serverId: invData.server_id,
            code: invData.code,
            creatorId: invData.creator_id,
            expiresAt: invData.expires_at,
            usesCount: invData.uses_count || 0,
            maxUses: invData.max_uses,
            createdAt: invData.created_at,
          };

          // Try to fetch server from Supabase
          let serverObj: Server | null = null;
          const { data: sData } = await supabase
            .from('servers')
            .select('*')
            .eq('id', invData.server_id)
            .maybeSingle();

          if (sData) {
            serverObj = {
              id: sData.id,
              name: sData.name,
              iconUrl: sData.icon_url,
              description: sData.description,
              ownerId: sData.owner_id,
              createdAt: sData.created_at,
            };
          } else if (encodedData) {
            try {
              const decoded = JSON.parse(decodeURIComponent(escape(atob(encodedData))));
              if (decoded && decoded.name) {
                serverObj = {
                  id: decoded.id || invData.server_id,
                  name: decoded.name,
                  iconUrl: decoded.iconUrl,
                  description: decoded.description,
                  ownerId: decoded.ownerId,
                  createdAt: decoded.createdAt || new Date().toISOString(),
                };
              }
            } catch {}
          } else {
            // Check local store/state if already cached
            serverObj = servers.find((s) => s.id === invData.server_id) || mockStore.getServers().find((s) => s.id === invData.server_id) || null;
          }

          if (serverObj) {
            let isMember = false;
            if (currentUser) {
              const { data: memData } = await supabase
                .from('server_members')
                .select('user_id')
                .eq('server_id', serverObj.id)
                .eq('user_id', currentUser.id)
                .maybeSingle();
              isMember = Boolean(memData);
            }

            const { count: memberCount } = await supabase
              .from('server_members')
              .select('*', { count: 'exact', head: true })
              .eq('server_id', serverObj.id);

            return {
              invite: inviteObj,
              server: serverObj,
              isMember,
              memberCount: memberCount || 1,
            };
          }
        }
      } catch (e) {
        console.warn('Supabase invite resolve error:', e);
      }
    }

    // 2. Demo / mock store resolution
    const invite = mockStore.getInviteByCode(cleanCode);
    let server = invite ? mockStore.getServers().find((s) => s.id === invite.serverId) : null;

    // Fallback: If server is not in local store, try decoding encodedData (cross-browser demo support)
    if ((!invite || !server) && encodedData) {
      try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(encodedData))));
        if (decoded && decoded.id && decoded.name) {
          server = {
            id: decoded.id,
            name: decoded.name,
            iconUrl: decoded.iconUrl || `https://api.dicebear.com/7.x/identicon/svg?seed=${decoded.name}`,
            description: decoded.description || `${decoded.name} community`,
            ownerId: decoded.ownerId || 'owner',
            createdAt: decoded.createdAt || new Date().toISOString(),
          };
          mockStore.addServer(server);

          // Ensure default channels exist
          const existingChans = mockStore.getChannels().filter((c) => c.serverId === server!.id);
          if (existingChans.length === 0) {
            mockStore.createChannel(server.id, 'general', 'text', `Welcome to ${server.name}!`);
            mockStore.createChannel(server.id, 'General Voice', 'voice');
          }

          mockStore.createInvite(server.id, server.ownerId);
        }
      } catch (e) {
        console.warn('Failed to parse encoded invite payload:', e);
      }
    }

    if (server) {
      const syntheticInvite = invite || {
        id: `inv-${Date.now()}`,
        serverId: server.id,
        code: cleanCode,
        creatorId: server.ownerId,
        usesCount: 0,
        createdAt: new Date().toISOString(),
      };

      const users = mockStore.getAllUsers();
      const inviterUser = users.find((u) => u.id === syntheticInvite.creatorId);
      const members = mockStore.getServerMembers(server.id);
      const effectiveUserId = currentUser?.id || mockStore.getCurrentUser()?.id;
      const isMember = effectiveUserId ? members.some((m) => m.userId === effectiveUserId) : false;

      return {
        invite: syntheticInvite,
        server,
        inviter: inviterUser
          ? { displayName: inviterUser.displayName, avatarUrl: inviterUser.avatarUrl }
          : undefined,
        isMember,
        memberCount: Math.max(members.length, 1),
      };
    }

    return null;
  };

  const acceptInvite = async (
    code: string,
    encodedData?: string | null
  ): Promise<{ server: Server; channelId?: string }> => {
    const resolved = await resolveInvite(code, encodedData);
    if (!resolved) {
      throw new Error('This invite is invalid or has expired.');
    }

    const { invite, server } = resolved;

    // Check expiration
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() < Date.now()) {
      throw new Error('This invite has expired.');
    }
    // Check max uses
    if (invite.maxUses && invite.usesCount >= invite.maxUses) {
      throw new Error('This invite has reached its maximum number of uses.');
    }

    let user = currentUser;
    if (!user) {
      user = mockStore.getCurrentUser();
    }
    if (!user) {
      throw new Error('Please log in or enter your name to accept this invite.');
    }

    if (isSupabaseConfigured && supabase) {
      if (user) {
        try {
          await supabase.from('server_members').upsert({
            server_id: server.id,
            user_id: user.id,
            role: 'member',
            joined_at: new Date().toISOString(),
          });
        } catch (err) {
          console.warn('Supabase join server_members error:', err);
        }

        try {
          await supabase
            .from('invites')
            .update({ uses_count: (invite.usesCount || 0) + 1 })
            .eq('id', invite.id);
        } catch {}
      }
    }

    // Also persist in local store for seamless multi-tab or demo sync
    mockStore.addServerMember(server.id, user.id, 'member');
    mockStore.incrementInviteUses(invite.code);

    // Ensure server is in local servers state
    setServers((prev) => {
      if (prev.some((s) => s.id === server.id)) return prev;
      return [...prev, server];
    });

    selectServer(server.id, server);

    // Find general channel or first channel
    let firstChannelId: string | undefined;
    if (isSupabaseConfigured && supabase) {
      const { data: chanData } = await supabase
        .from('channels')
        .select('id, name')
        .eq('server_id', server.id)
        .order('position', { ascending: true });
      if (chanData && chanData.length > 0 && chanData[0]?.id) {
        const cId = String(chanData[0].id);
        firstChannelId = cId;
        selectChannel(cId);
      }
    } else {
      const serverChannels = mockStore.getChannels().filter((c) => c.serverId === server.id);
      if (serverChannels.length > 0 && serverChannels[0]?.id) {
        const cId = String(serverChannels[0].id);
        firstChannelId = cId;
        selectChannel(cId);
      }
    }

    return { server, channelId: firstChannelId };
  };

  const joinServer = async (serverId: string): Promise<Server> => {
    let target =
      servers.find((s) => s.id === serverId) ||
      mockStore.getServers().find((s) => s.id === serverId);

    if (isSupabaseConfigured && supabase && currentUser) {
      if (!target) {
        const { data: sData } = await supabase
          .from('servers')
          .select('*')
          .eq('id', serverId)
          .single();
        if (sData) {
          target = {
            id: sData.id,
            name: sData.name,
            iconUrl: sData.icon_url,
            description: sData.description,
            ownerId: sData.owner_id,
            createdAt: sData.created_at,
          };
        }
      }

      await supabase.from('server_members').upsert({
        server_id: serverId,
        user_id: currentUser.id,
        role: 'member',
        joined_at: new Date().toISOString(),
      });
    } else {
      const uId = currentUser?.id || mockStore.getCurrentUser()?.id || 'demo-user';
      mockStore.addServerMember(serverId, uId, 'member');
    }

    if (target) {
      setServers((prev) => (prev.some((s) => s.id === target!.id) ? prev : [...prev, target!]));
      selectServer(target.id, target);
      return target;
    }
    throw new Error('Server not found');
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
