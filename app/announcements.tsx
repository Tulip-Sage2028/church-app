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
  const [sendPush, setSendPush] = useState(false); // ⭐ 是否同时推送
  const [editingId, setEditingId] = useState<number | null>(null);
  const [pushing, setPushing] = useState(false);

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

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data } = await supabase
      .from("announcements")
      .select("*")
      .or(`created_at.gte.${threeMonthsAgo.toISOString()},updated_at.gte.${threeMonthsAgo.toISOString()}`)
      .order("is_pinned", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false });

    if (data) setAnnouncements(data);
    setLoading(false);
  }

  // ════════════════════════════════════════════════════════
  //  调用 send-push Edge Function 推送公告
  // ════════════════════════════════════════════════════════
  async function pushAnnouncement(announcementTitle: string, announcementContent: string) {
    setPushing(true);
    try {
      // 取标题前 80 字 + 内容前 80 字作为推送预览
      const pushTitle = announcementTitle.substring(0, 80);
      const pushBody = announcementContent.substring(0, 80) +
        (announcementContent.length > 80 ? "..." : "");

      const { data, error } = await supabase.functions.invoke("send-push", {
        body: {
          title: pushTitle,
          body: pushBody,
          url: "/",
        },
      });

      if (error) {
        console.error("send-push error:", error);
        return { success: false, message: error.message };
      }

      if (data?.success === false) {
        return { success: false, message: data.error || "推送失败" };
      }

      return { success: true, message: data?.message || "推送已发送" };
    } catch (err: any) {
      return { success: false, message: err?.message || "推送失败" };
    } finally {
      setPushing(false);
    }
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

      // 如果勾选了同时推送,调用 Edge Function
      let pushMessage = "";
      if (sendPush) {
        const result = await pushAnnouncement(title, content);
        pushMessage = result.success ? `\n📣 ${result.message}` : `\n⚠️ 推送失败:${result.message}`;
      }

      setTitle("");
      setContent("");
      setIsPinned(false);
      setSendPush(false);
      setActiveTab("view");
      alert(`公告发布成功！${pushMessage}`);
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

      // 编辑时也支持推送(可选)
      let pushMessage = "";
      if (sendPush) {
        const result = await pushAnnouncement(title, content);
        pushMessage = result.success ? `\n📣 ${result.message}` : `\n⚠️ 推送失败:${result.message}`;
      }

      setTitle("");
      setContent("");
      setIsPinned(false);
      setSendPush(false);
      setEditingId(null);
      setActiveTab("view");
      alert(`公告修改成功！${pushMessage}`);
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
    setSendPush(false); // 编辑时默认不勾推送(避免误推)
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
              setSendPush(false);
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

                  <Text style={{ fontSize: 16, fontWeight: "bold", color: "#111827", marginBottom: 8 }}>
                    {item.title}
                  </Text>

                  <Text style={{ fontSize: 14, color: "#374151", lineHeight: 22 }}>
                    {item.content}
                  </Text>

                  <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 10 }}>
                    {formatDate(item.created_at)} · {item.created_by}
                    {item.updated_at ? ` · 修改：${item.updated_by}` : ""}
                  </Text>

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
                marginBottom: 12,
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

            {/* ⭐ 同时推送选项 */}
            <TouchableOpacity
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                marginBottom: 24,
                padding: 12,
                backgroundColor: sendPush ? "#fff7ed" : "white",
                borderRadius: 8,
                borderWidth: 1,
                borderColor: sendPush ? "#ea580c" : "#e5e7eb",
              }}
              onPress={() => setSendPush(!sendPush)}
            >
              <View style={{
                width: 20,
                height: 20,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: sendPush ? "#ea580c" : "#d1d5db",
                backgroundColor: sendPush ? "#ea580c" : "white",
                alignItems: "center",
                justifyContent: "center",
                marginTop: 2,
              }}>
                {sendPush && <Text style={{ color: "white", fontSize: 12 }}>✓</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, color: "#374151", fontWeight: "bold" }}>
                  📣 同时推送通知
                </Text>
                <Text style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 16 }}>
                  勾选后,所有已开启推送的会众会立刻收到通知(即使没打开 App)。重要公告才推送,避免打扰会友。
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={{
                backgroundColor: pushing ? "#fdba74" : "#ea580c",
                padding: 14,
                borderRadius: 8,
                alignItems: "center",
              }}
              onPress={activeTab === "create" ? handleCreate : handleEdit}
              disabled={pushing}
            >
              <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
                {pushing
                  ? "推送中..."
                  : activeTab === "create" ? "发布公告" : "保存修改"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}