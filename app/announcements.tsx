import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { can } from "../lib/permissions";
import { supabase } from "../lib/supabase";

type Announcement = {
  id: number;
  title: string;
  content: string;
  created_by: string;
  updated_by: string | null;
  updated_at: string | null;
  created_at: string;
  is_pinned: boolean;
};

export default function Announcements({ onBack, userRole }: { onBack: () => void; userRole: string }) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [activeTab, setActiveTab] = useState<"view" | "create" | "edit">("view");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [isPinned, setIsPinned] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    // 取得当前用户名
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .single();
      if (profile) setUsername(profile.username);
    }

    // 三个月前的日期
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // 读取最近三个月的公告
    const { data } = await supabase
      .from("announcements")
      .select("*")
      .or(`created_at.gte.${threeMonthsAgo.toISOString()},updated_at.gte.${threeMonthsAgo.toISOString()}`)
      .order("is_pinned", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (data) setAnnouncements(data);
    setLoading(false);
  }

  async function handleCreate() {
    if (!title) {
      alert("请填写标题");
      return;
    }
    if (!content) {
      alert("请填写内容");
      return;
    }

    const { data, error } = await supabase
      .from("announcements")
      .insert({
        title,
        content,
        is_pinned: isPinned,
        created_by: username,
      })
      .select()
      .single();

    if (!error && data) {
      setAnnouncements([data, ...announcements]);
      setTitle("");
      setContent("");
      setIsPinned(false);
      setActiveTab("view");
      alert("公告发布成功！");
    } else {
      alert("发布失败：" + error?.message);
    }
  }

  async function handleEdit() {
    if (!title || !content) {
      alert("请填写标题和内容");
      return;
    }

    const { error } = await supabase
      .from("announcements")
      .update({
        title,
        content,
        is_pinned: isPinned,
        updated_by: username,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editingId);

    if (!error) {
      setAnnouncements(
        announcements.map((a) =>
          a.id === editingId
            ? { ...a, title, content, is_pinned: isPinned, updated_by: username, updated_at: new Date().toISOString() }
            : a
        )
      );
      setTitle("");
      setContent("");
      setIsPinned(false);
      setEditingId(null);
      setActiveTab("view");
      alert("公告修改成功！");
    } else {
      alert("修改失败：" + error.message);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("确定删除这条公告吗？")) return;

    const { error } = await supabase
      .from("announcements")
      .delete()
      .eq("id", id);

    if (!error) {
      setAnnouncements(announcements.filter((a) => a.id !== id));
    } else {
      alert("删除失败：" + error.message);
    }
  }

  function startEdit(item: Announcement) {
    setEditingId(item.id);
    setTitle(item.title);
    setContent(item.content);
    setIsPinned(item.is_pinned);
    setActiveTab("edit");
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* 顶部标题 */}
      <View style={{ backgroundColor: "#ea580c", padding: 24, paddingTop: 48 }}>
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
          <Text style={{ color: "#fed7aa", fontSize: 18, fontWeight: "bold" }}>← 返回</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "white" }}>
          公告栏
        </Text>
        <Text style={{ fontSize: 14, color: "#fed7aa", marginTop: 4 }}>
          最新消息及通知
        </Text>
      </View>

      {/* 标签切换 */}
      <View style={{ flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
        {[
          { key: "view", label: "查看公告" },
          ...(can(userRole, "manage_announcements") ? [{ key: "create", label: "发布公告" }] : []),
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={{
              flex: 1,
              padding: 14,
              alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.key ? "#ea580c" : "transparent",
            }}
            onPress={() => {
              setActiveTab(tab.key as any);
              setTitle("");
              setContent("");
              setIsPinned(false);
              setEditingId(null);
            }}
          >
            <Text style={{
              fontSize: 14,
              fontWeight: activeTab === tab.key ? "bold" : "normal",
              color: activeTab === tab.key ? "#ea580c" : "#6b7280",
            }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ padding: 16 }}>
        {/* 查看公告 */}
        {activeTab === "view" && (
          <View>
            {announcements.length === 0 ? (
              <Text style={{ color: "#6b7280", textAlign: "center", marginTop: 40 }}>
                目前没有公告
              </Text>
            ) : (
              announcements.map((item) => (
                <View
                  key={item.id}
                  style={{
                    backgroundColor: "white",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderLeftWidth: 4,
                    borderLeftColor: item.is_pinned ? "#ea580c" : "#d1d5db",
                  }}
                >
                  {/* 置顶标签 */}
                  {item.is_pinned && (
                    <View style={{
                      backgroundColor: "#fff7ed",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 12,
                      alignSelf: "flex-start",
                      marginBottom: 8,
                    }}>
                      <Text style={{ fontSize: 11, color: "#ea580c", fontWeight: "bold" }}>
                        📌 置顶
                      </Text>
                    </View>
                  )}

                  {/* 标题 */}
                  <Text style={{ fontSize: 16, fontWeight: "bold", color: "#111827", marginBottom: 8 }}>
                    {item.title}
                  </Text>

                  {/* 内容 */}
                  <Text style={{ fontSize: 14, color: "#374151", lineHeight: 22 }}>
                    {item.content}
                  </Text>

                  {/* 发布信息 */}
                  <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 10 }}>
                    {formatDate(item.created_at)} · {item.created_by}
                    {item.updated_at ? ` · 修改：${item.updated_by}` : ""}
                  </Text>

                  {/* 编辑/删除按钮 */}
                  {can(userRole, "manage_announcements") && (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          backgroundColor: "#f3f4f6",
                          padding: 8,
                          borderRadius: 6,
                          alignItems: "center",
                        }}
                        onPress={() => startEdit(item)}
                      >
                        <Text style={{ fontSize: 13, color: "#374151" }}>编辑</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={{
                          flex: 1,
                          backgroundColor: "#fee2e2",
                          padding: 8,
                          borderRadius: 6,
                          alignItems: "center",
                        }}
                        onPress={() => handleDelete(item.id)}
                      >
                        <Text style={{ fontSize: 13, color: "#ef4444" }}>删除</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* 发布/编辑公告 */}
        {(activeTab === "create" || activeTab === "edit") && (
          <View>
            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>标题</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                marginBottom: 16,
                backgroundColor: "white",
              }}
              placeholder="公告标题"
              value={title}
              onChangeText={setTitle}
            />

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>内容</Text>
            <TextInput
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                marginBottom: 16,
                backgroundColor: "white",
                height: 160,
                textAlignVertical: "top",
              }}
              placeholder="公告内容"
              value={content}
              onChangeText={setContent}
              multiline={true}
            />

            {/* 置顶选项 */}
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginBottom: 24,
                padding: 12,
                backgroundColor: "white",
                borderRadius: 8,
                borderWidth: 1,
                borderColor: isPinned ? "#ea580c" : "#e5e7eb",
              }}
              onPress={() => setIsPinned(!isPinned)}
            >
              <View style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: isPinned ? "#ea580c" : "#d1d5db",
                backgroundColor: isPinned ? "#ea580c" : "white",
                alignItems: "center",
                justifyContent: "center",
              }}>
                {isPinned && <Text style={{ color: "white", fontSize: 12 }}>✓</Text>}
              </View>
              <Text style={{ fontSize: 14, color: "#374151" }}>置顶这条公告</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: "#ea580c",
                padding: 14,
                borderRadius: 8,
                alignItems: "center",
              }}
              onPress={activeTab === "create" ? handleCreate : handleEdit}
            >
              <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
                {activeTab === "create" ? "发布公告" : "保存修改"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}