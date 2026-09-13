import React, { useState, useEffect } from 'react';
import { useServer } from '../../app/providers/ServerContext';
import { useAuth } from '../../app/providers/AuthContext';
import { ForumService, ForumReply } from '../../lib/services/forumService';
import { mockStore } from '../../lib/supabase/mockStore';
import { ForumPost } from '../../types';
import { Avatar } from '../ui/Avatar';
import { Modal } from '../ui/Modal';
import {
  MessagesSquare,
  Plus,
  Search,
  CheckCircle2,
  MessageCircle,
  Tag,
  ThumbsUp,
  Share2,
  Clock,
  ArrowLeft,
  Send,
} from 'lucide-react';

export const ForumContainer: React.FC = () => {
  const { activeChannel } = useServer();
  const { currentUser } = useAuth();

  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [selectedPost, setSelectedPost] = useState<ForumPost | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [isCreatingPost, setIsCreatingPost] = useState(false);

  // New post form state
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newTagsInput, setNewTagsInput] = useState('');

  // Simulated replies for the active post
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [newReplyText, setNewReplyText] = useState('');

  const loadPosts = async () => {
    if (!activeChannel) return;
    try {
      const forumPosts = await ForumService.getPosts(activeChannel.id);
      setPosts(forumPosts);
    } catch (err) {
      console.error('[ForumContainer] Error loading forum posts:', err);
    }
  };

  useEffect(() => {
    loadPosts();
    setSelectedPost(null);

    const unsub = mockStore.subscribe('FORUM_POST_CREATED', () => {
      loadPosts();
    });
    return () => unsub();
  }, [activeChannel?.id]);

  // When opening a post, fetch real replies
  useEffect(() => {
    if (selectedPost) {
      ForumService.getReplies(selectedPost.id).then((fetched) => {
        setReplies(fetched);
      });
    }
  }, [selectedPost?.id]);

  const allTags = Array.from(
    new Set(posts.flatMap((p) => p.tags || []))
  );

  const filteredPosts = posts.filter((post) => {
    const title = post.title || '';
    const content = post.content || '';
    const matchesQuery =
      title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesTag =
      selectedTag === 'all' || (Array.isArray(post.tags) && post.tags.includes(selectedTag));
    return matchesQuery && matchesTag;
  });

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannel || !newTitle.trim() || !newContent.trim() || !currentUser) return;

    const tags = newTagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    try {
      const created = await ForumService.createPost(
        activeChannel.id,
        currentUser,
        newTitle.trim(),
        newContent.trim(),
        tags
      );
      setPosts((prev) => [created, ...prev]);
    } catch (err) {
      console.error('[ForumContainer] Create post error:', err);
    }

    setNewTitle('');
    setNewContent('');
    setNewTagsInput('');
    setIsCreatingPost(false);
  };

  const handleSendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReplyText.trim() || !currentUser || !selectedPost) return;

    const replyText = newReplyText.trim();
    setNewReplyText('');

    try {
      const savedReply = await ForumService.addReply(selectedPost.id, currentUser, replyText);
      setReplies((prev) => [...prev, savedReply]);

      // Update reply count in local post
      setPosts((prev) =>
        prev.map((p) =>
          p.id === selectedPost.id ? { ...p, repliesCount: p.repliesCount + 1 } : p
        )
      );
    } catch (err) {
      console.error('[ForumContainer] Send reply error:', err);
    }
  };

  const handleToggleSolved = async (postId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const nextSolved = !selectedPost?.isSolved;
    await ForumService.markSolved(postId, nextSolved);
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, isSolved: nextSolved } : p))
    );
    if (selectedPost && selectedPost.id === postId) {
      setSelectedPost((prev) => prev ? { ...prev, isSolved: nextSolved } : null);
    }
  };

  // If a post is selected, show discussion thread view
  if (selectedPost) {
    return (
      <div className="forum-container">
        {/* Back to Topics Header */}
        <div className="forum-thread-header">
          <button
            className="btn btn-ghost"
            onClick={() => setSelectedPost(null)}
            style={{ padding: '6px 12px', gap: 6 }}
          >
            <ArrowLeft size={16} />
            <span>Back to all topics</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              className={`btn ${selectedPost.isSolved ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={(e) => handleToggleSolved(selectedPost.id, e)}
            >
              <CheckCircle2 size={14} />
              <span>{selectedPost.isSolved ? 'Marked as Solved' : 'Mark as Solved'}</span>
            </button>
          </div>
        </div>

        {/* Selected Post Body */}
        <div className="forum-thread-content">
          <div className="forum-main-post-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <Avatar
                src={selectedPost.author?.avatarUrl}
                name={selectedPost.author?.displayName || 'User'}
                size={40}
              />
              <div>
                <h3 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>
                  {selectedPost.author?.displayName || 'Community Member'}
                </h3>
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Posted {new Date(selectedPost.createdAt).toLocaleDateString()}
                </span>
              </div>
              {selectedPost.isSolved && (
                <span className="forum-solved-badge" style={{ marginLeft: 'auto' }}>
                  <CheckCircle2 size={13} />
                  <span>SOLVED</span>
                </span>
              )}
            </div>

            <h1 style={{ fontSize: 20, fontWeight: 700, margin: '8px 0 12px 0' }}>
              {selectedPost.title}
            </h1>

            <p style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
              {selectedPost.content}
            </p>

            <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
              {selectedPost.tags?.map((t) => (
                <span key={t} className="forum-tag-pill">
                  #{t}
                </span>
              ))}
            </div>
          </div>

          {/* Discussion Replies */}
          <div style={{ marginTop: 24 }}>
            <h4 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 14 }}>
              Replies ({replies.length})
            </h4>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {replies.map((rep) => (
                <div key={rep.id} className="forum-reply-card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar src={rep.avatarUrl} name={rep.authorName} size={32} />
                    <div>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{rep.authorName}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 8 }}>
                        {rep.createdAt}
                      </span>
                    </div>
                  </div>
                  <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-secondary)', margin: '8px 0 4px 42px' }}>
                    {rep.content}
                  </p>
                </div>
              ))}
            </div>

            {/* Reply Input Box */}
            <form onSubmit={handleSendReply} className="forum-reply-form">
              <input
                type="text"
                className="input-field"
                placeholder="Write a constructive reply..."
                value={newReplyText}
                onChange={(e) => setNewReplyText(e.target.value)}
              />
              <button type="submit" className="btn btn-primary" disabled={!newReplyText.trim()}>
                <Send size={14} />
                <span>Reply</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Topic List View
  return (
    <div className="forum-container">
      {/* Forum Header */}
      <header className="forum-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 'var(--radius-sm)',
                background: 'var(--sky-soft)',
                color: 'var(--sky)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <MessagesSquare size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                {activeChannel?.name || 'Forum Discussions'}
              </h2>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {activeChannel?.topic || 'Browse community topics, ask questions, and share ideas'}
              </span>
            </div>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => setIsCreatingPost(true)}
            style={{ borderRadius: 'var(--radius-sm)', padding: '8px 16px', gap: 8 }}
          >
            <Plus size={16} />
            <span>New Post</span>
          </button>
        </div>

        {/* Search & Tag Filter Bar */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="forum-search-box" style={{ flex: 1, minWidth: 220 }}>
            <Search size={15} style={{ color: 'var(--text-muted)' }} />
            <input
              type="text"
              placeholder="Search forum topics..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="forum-search-input"
            />
          </div>

          {/* Tag filters */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            <button
              className={`forum-filter-chip ${selectedTag === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedTag('all')}
            >
              All Topics
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                className={`forum-filter-chip ${selectedTag === tag ? 'active' : ''}`}
                onClick={() => setSelectedTag(tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Topics Grid */}
      <div className="forum-posts-grid">
        {filteredPosts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <MessagesSquare size={48} style={{ opacity: 0.3, marginBottom: 12 }} />
            <h3>No topics found</h3>
            <p style={{ fontSize: 13 }}>Be the first to start a conversation in this channel!</p>
          </div>
        ) : (
          filteredPosts.map((post) => (
            <div
              key={post.id}
              className="forum-post-card"
              onClick={() => setSelectedPost(post)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar
                    src={post.author?.avatarUrl}
                    name={post.author?.displayName || 'User'}
                    size={24}
                  />
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {post.author?.displayName || 'Member'}
                  </span>
                </div>

                {post.isSolved && (
                  <span className="forum-solved-badge">
                    <CheckCircle2 size={12} />
                    <span>SOLVED</span>
                  </span>
                )}
              </div>

              <h3 className="forum-post-title">{post.title}</h3>
              <p className="forum-post-snippet">{post.content}</p>

              <div className="forum-post-footer">
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {post.tags?.map((t) => (
                    <span key={t} className="forum-tag-pill">
                      #{t}
                    </span>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: 12 }}>
                  <MessageCircle size={14} />
                  <span>{post.repliesCount}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* New Post Modal */}
      <Modal
        isOpen={isCreatingPost}
        onClose={() => setIsCreatingPost(false)}
        title="Create a Discussion Topic"
        maxWidth="540px"
      >
        <form onSubmit={handleCreatePost} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="input-group">
            <label className="input-label">Topic Title</label>
            <input
              type="text"
              className="input-field"
              placeholder="e.g. Best practices for WebRTC audio quality"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className="input-group">
            <label className="input-label">Details / Question</label>
            <textarea
              className="textarea-field"
              rows={4}
              placeholder="Elaborate on your idea, issue, or question..."
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              required
            />
          </div>

          <div className="input-group">
            <label className="input-label">Tags (comma-separated)</label>
            <input
              type="text"
              className="input-field"
              placeholder="webrtc, audio, performance"
              value={newTagsInput}
              onChange={(e) => setNewTagsInput(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <button type="button" className="btn btn-ghost" onClick={() => setIsCreatingPost(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Post Topic
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
