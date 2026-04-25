import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { can } from "../lib/permissions";
import { supabase } from "../lib/supabase";

type Post = {
  id: number;
  title: string;
  content: string;
  asked_by: string;
  is_anonymous: boolean;
  is_closed: boolean;
  created_at: string;
  reply_count?: number;
};

type Reply = {
  id: number;
  post_id: number;
  content: string;
  replied_by: string;
  is_anonymous: boolean;
  created_at: string;
};

export default function QA({ onBack, userRole }: { onBack: () => void; userRole: string }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [activeTab, setActiveTab] = useState<"list" | "new">("list");
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  // 新建帖子
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newAnonymous, setNewAnonymous] = useState(false);
  const [saving, setSaving] = useState(false);

  // 新建回复
  const [replyContent, setReplyContent] = useState("");
  const [replyAnonymous, setReplyAnonymous] = useState(false);
  const [savingReply, setSavingReply] = useState(false);

  const canClosePost = can(userRole, "close_post");
  const canDeletePost = can(userRole, "delete_post");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .single();
      if (profile) setUsername(profile.username);
    }

    // 三个月内的帖子
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data } = await supabase
      .from("qa_posts")
      .select("*")
      .gte("created_at", threeMonthsAgo.toISOString())
      .order("created_at", { ascending: false });

    if (data) setPosts(data);
    setLoading(false);
  }

  async function fetchReplies(postId: number) {
    setLoadingReplies(true);
    const { data } = await supabase
      .from("qa_replies")
      .select("*")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });

    if (data) setReplies(data);
    setLoadingReplies(false);
  }

  async function handleCreatePost() {
    if (!newTitle) {
      alert("请填写标题");
      return;
    }
    if (!newContent) {
      alert("请填写内容");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("qa_posts")
      .insert({
        title: newTitle,
        content: newContent,
        asked_by: newAnonymous ? "匿名" : username,
        is_anonymous: newAnonymous,
      })
      .select()
      .single();

    if (!error && data) {
      setPosts([data, ...posts]);
      setNewTitle("");
      setNewContent("");
      setNewAnonymous(false);
      setActiveTab("list");
      alert("帖子发布成功！");
    } else {
      alert("发布失败：" + error?.message);
    }

    setSaving(false);
  }

  async function handleReply() {
    if (!replyContent) {
      alert("请填写回复内容");
      return;
    }
    if (!selectedPost) return;

    setSavingReply(true);

    const { data, error } = await supabase
      .from("qa_replies")
      .insert({
        post_id: selectedPost.id,
        content: replyContent,
        replied_by: replyAnonymous ? "匿名" : username,
        is_anonymous: replyAnonymous,
      })
      .select()
      .single();

    if (!error && data) {
      setReplies([...replies, data]);
      setReplyContent("");
      setReplyAnonymous(false);
    } else {
      alert("回复失败：" + error?.message);
    }

    setSavingReply(false);
  }

  async function handleClosePost(postId: number) {
    if (!confirm("确定关闭这个帖子吗？关闭后不能再回复。")) return;

    const { error } = await supabase
      .from("qa_posts")
      .update({ is_closed: true })
      .eq("id", postId);

    if (!error) {
      setPosts(posts.map((p) => p.id === postId ? { ...p, is_closed: true } : p));
      if (selectedPost?.id === postId) {
        setSelectedPost({ ...selectedPost, is_closed: true });
      }
    }
  }

  async function handleDeletePost(postId: number) {
    if (!confirm("确定删除这个帖子吗？")) return;

    const { error } = await supabase
      .from("qa_posts")
      .delete()
      .eq("id", postId);

    if (!error) {
      setPosts(posts.filter((p) => p.id !== postId));
      setSelectedPost(null);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-TW", {
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  // 帖子详情页
  if (selectedPost) {
    return (
      <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
        <View style={{ backgroundColor: "#2563eb", padding: 24, paddingTop: 48 }}>
          <TouchableOpacity
            onPress={() => { setSelectedPost(null); setReplies([]); }}
            style={{ marginBottom: 12 }}
          >
            <Text style={{ color: "#bfdbfe", fontSize: 18, fontWeight: "bold" }}>← 返回列表</Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 20, fontWeight: "bold", color: "white" }}>
            {selectedPost.title}
          </Text>
          {selectedPost.is_closed && (
            <View style={{ backgroundColor: "#ef4444", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12, alignSelf: "flex-start", marginTop: 8 }}>
              <Text style={{ fontSize: 12, color: "white", fontWeight: "bold" }}>已关闭</Text>
            </View>
          )}
        </View>

        <View style={{ padding: 16 }}>
          {/* 原帖 */}
          <View style={{ backgroundColor: "white", borderRadius: 12, padding: 16, marginBottom: 16, borderLeftWidth: 4, borderLeftColor: "#2563eb" }}>
            <Text style={{ fontSize: 14, color: "#374151", lineHeight: 24 }}>
              {selectedPost.content}
            </Text>
            <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
              {selectedPost.asked_by} · {formatDate(selectedPost.created_at)}
            </Text>

            {/* 管理员操作 */}
            {(canClosePost || canDeletePost) && (
                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    {canClosePost && !selectedPost.is_closed && (
                      <TouchableOpacity
                        style={{ backgroundColor: "#f3f4f6", padding: 8, borderRadius: 6 }}
                        onPress={() => handleClosePost(selectedPost.id)}
                      >
                        <Text style={{ fontSize: 12, color: "#374151" }}>关闭帖子</Text>
                      </TouchableOpacity>
                    )}
                    {canDeletePost && (
                      <TouchableOpacity
                        style={{ backgroundColor: "#fee2e2", padding: 8, borderRadius: 6 }}
                        onPress={() => handleDeletePost(selectedPost.id)}
                      >
                        <Text style={{ fontSize: 12, color: "#ef4444" }}>删除帖子</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
          </View>

          {/* 回复列表 */}
          <Text style={{ fontSize: 14, fontWeight: "bold", color: "#374151", marginBottom: 12 }}>
            回复（{replies.length}）
          </Text>

          {loadingReplies ? (
            <ActivityIndicator size="small" color="#2563eb" />
          ) : replies.length === 0 ? (
            <Text style={{ color: "#6b7280", marginBottom: 16 }}>还没有回复</Text>
          ) : (
            replies.map((reply) => (
              <View
                key={reply.id}
                style={{
                  backgroundColor: "white",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 10,
                  borderLeftWidth: 4,
                  borderLeftColor: "#e5e7eb",
                }}
              >
                <Text style={{ fontSize: 14, color: "#374151", lineHeight: 24 }}>
                  {reply.content}
                </Text>
                <Text style={{ fontSize: 12, color: "#9ca3af", marginTop: 8 }}>
                  {reply.replied_by} · {formatDate(reply.created_at)}
                </Text>
              </View>
            ))
          )}

          {/* 回复输入框 */}
          {!selectedPost.is_closed && (
            <View style={{ backgroundColor: "white", borderRadius: 12, padding: 16, marginTop: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: "bold", color: "#374151", marginBottom: 12 }}>
                发表回复
              </Text>

              <textarea
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="写下你的回复..."
                style={{
                  width: "100%",
                  border: "1px solid #ccc",
                  borderRadius: 8,
                  padding: 12,
                  fontSize: 14,
                  marginBottom: 12,
                  backgroundColor: "white",
                  boxSizing: "border-box",
                  height: 100,
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />

              {/* 匿名选项 */}
              <TouchableOpacity
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 12,
                }}
                onPress={() => setReplyAnonymous(!replyAnonymous)}
              >
                <View style={{
                  width: 20, height: 20, borderRadius: 4,
                  borderWidth: 2,
                  borderColor: replyAnonymous ? "#2563eb" : "#d1d5db",
                  backgroundColor: replyAnonymous ? "#2563eb" : "white",
                  alignItems: "center", justifyContent: "center",
                }}>
                  {replyAnonymous && <Text style={{ color: "white", fontSize: 12 }}>✓</Text>}
                </View>
                <Text style={{ fontSize: 14, color: "#374151" }}>匿名回复</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={{
                  backgroundColor: savingReply ? "#93c5fd" : "#2563eb",
                  padding: 12, borderRadius: 8, alignItems: "center",
                }}
                onPress={handleReply}
                disabled={savingReply}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  {savingReply ? "发送中..." : "发表回复"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ backgroundColor: "#2563eb", padding: 24, paddingTop: 48 }}>
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
          <Text style={{ color: "#bfdbfe", fontSize: 14 }}>← 返回</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "white" }}>
          问答交流
        </Text>
        <Text style={{ fontSize: 14, color: "#bfdbfe", marginTop: 4 }}>
          提问 · 分享 · 交流
        </Text>
      </View>

      {/* 标签切换 */}
      <View style={{ flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
        {[
          { key: "list", label: "所有帖子" },
          { key: "new", label: "发新帖子" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={{
              flex: 1, padding: 14, alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.key ? "#2563eb" : "transparent",
            }}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text style={{
              fontSize: 14,
              fontWeight: activeTab === tab.key ? "bold" : "normal",
              color: activeTab === tab.key ? "#2563eb" : "#6b7280",
            }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ padding: 16 }}>
        {/* 帖子列表 */}
        {activeTab === "list" && (
          <View>
            {posts.length === 0 ? (
              <Text style={{ color: "#6b7280", textAlign: "center", marginTop: 40 }}>
                还没有帖子
              </Text>
            ) : (
              posts.map((post) => (
                <TouchableOpacity
                  key={post.id}
                  style={{
                    backgroundColor: "white",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 10,
                    borderLeftWidth: 4,
                    borderLeftColor: post.is_closed ? "#d1d5db" : "#2563eb",
                  }}
                  onPress={() => {
                    setSelectedPost(post);
                    fetchReplies(post.id);
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 16, fontWeight: "bold", color: "#111827", flex: 1 }}>
                      {post.title}
                    </Text>
                    {post.is_closed && (
                      <View style={{ backgroundColor: "#fee2e2", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 }}>
                        <Text style={{ fontSize: 11, color: "#ef4444" }}>已关闭</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }} numberOfLines={2}>
                    {post.content}
                  </Text>
                  <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 8 }}>
                    {post.asked_by} · {formatDate(post.created_at)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* 发新帖子 */}
        {activeTab === "new" && (
          <View>
            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>标题</Text>
            <TextInput
              style={{
                borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
                padding: 12, fontSize: 16, marginBottom: 16, backgroundColor: "white",
              }}
              placeholder="帖子标题"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>内容</Text>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="写下你的问题或分享..."
              style={{
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: 12,
                fontSize: 14,
                marginBottom: 16,
                backgroundColor: "white",
                boxSizing: "border-box",
                height: 160,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />

            {/* 匿名选项 */}
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                marginBottom: 24,
                padding: 12,
                backgroundColor: "white",
                borderRadius: 8,
                borderWidth: 1,
                borderColor: newAnonymous ? "#2563eb" : "#e5e7eb",
              }}
              onPress={() => setNewAnonymous(!newAnonymous)}
            >
              <View style={{
                width: 20, height: 20, borderRadius: 4,
                borderWidth: 2,
                borderColor: newAnonymous ? "#2563eb" : "#d1d5db",
                backgroundColor: newAnonymous ? "#2563eb" : "white",
                alignItems: "center", justifyContent: "center",
              }}>
                {newAnonymous && <Text style={{ color: "white", fontSize: 12 }}>✓</Text>}
              </View>
              <Text style={{ fontSize: 14, color: "#374151" }}>匿名发帖</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: saving ? "#93c5fd" : "#2563eb",
                padding: 14, borderRadius: 8, alignItems: "center",
              }}
              onPress={handleCreatePost}
              disabled={saving}
            >
              <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
                {saving ? "发布中..." : "发布帖子"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}