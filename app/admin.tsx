import { useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { can } from "../lib/permissions";
import { supabase } from "../lib/supabase";

type UserProfile = {
  user_id: string;
  username: string;
  email: string;
  phone: string;
  role: string;
  created_at: string;
};

const ROLES = ["guest", "member", "teacher", "media", "leader", "pastor", "admin"];

const ROLE_LABELS: { [key: string]: string } = {
  guest: "访客",
  member: "会员",
  teacher: "老师",
  media: "媒体组",
  leader: "组长",
  pastor: "牧师",
  admin: "管理员",
};

const ROLE_COLORS: { [key: string]: string } = {
  guest: "#6b7280",
  member: "#2563eb",
  teacher: "#9333ea",
  media: "#0891b2",
  leader: "#16a34a",
  pastor: "#ea580c",
  admin: "#ef4444",
};

export default function Admin({ onBack, userRole }: { onBack: () => void; userRole: string }) {
  const [activeTab, setActiveTab] = useState<"users" | "cleanup">("users");
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [cleanupCounts, setCleanupCounts] = useState<{ [key: string]: number } | null>(null);
  const [counting, setCounting] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);

  // 是否有权限重置密码 — 仅 admin 和 pastor
  const canResetPassword = userRole === "admin" || userRole === "pastor";

  async function fetchUsers() {
    console.log("userRole in admin:", userRole);
    console.log("can manage_user_roles:", can(userRole, "manage_user_roles"));
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .neq("role", "admin")
      .order("created_at", { ascending: false });

    if (data) setUsers(data);
    setLoading(false);
  }

  async function handleRoleChange(userId: string, newRole: string) {
    const { error } = await supabase
      .from("profiles")
      .update({ role: newRole })
      .eq("user_id", userId);

    if (!error) {
      setUsers(users.map((u) =>
        u.user_id === userId ? { ...u, role: newRole } : u
      ));
      setEditingUserId(null);
      alert("角色修改成功！");
    } else {
      alert("修改失败：" + error.message);
    }
  }

  async function handleDeleteUser(userId: string, username: string) {
    if (!confirm(`确定删除用户 ${username} 吗？此操作无法恢复！`)) return;

    const { error } = await supabase
      .from("profiles")
      .delete()
      .eq("user_id", userId);

    if (!error) {
      setUsers(users.filter((u) => u.user_id !== userId));
      alert(`用户 ${username} 已删除！`);
    } else {
      alert("删除失败：" + error.message);
    }
  }

  // ════════════════════════════════════════════════════════
  //  重置密码 — 调用 Supabase Edge Function: reset-password
  // ════════════════════════════════════════════════════════
  async function handleResetPassword(userId: string, username: string) {
    if (!confirm(
      `确定将「${username}」的密码重置为 111111 吗？\n\n` +
      `重置后请通知该用户用 111111 登录,并立刻在「个人资料 → 修改密码」中修改。`
    )) return;

    setResettingUserId(userId);

    try {
      const { data, error } = await supabase.functions.invoke("reset-password", {
        body: { user_id: userId },
      });

      if (error) {
        // Supabase 客户端的 functions.invoke 错误
        alert(`重置失败: ${error.message}`);
        return;
      }

      if (data?.success === false) {
        // Edge Function 返回的业务错误
        alert(`重置失败: ${data.error || "未知错误"}`);
        return;
      }

      // 成功
      alert(
        `✅ 重置成功!\n\n` +
        `用户 ${username} 的临时密码已设为:111111\n\n` +
        `请通知该用户登录后立刻修改密码。`
      );

    } catch (err: any) {
      alert(`重置失败: ${err.message || "网络错误"}`);
    } finally {
      setResettingUserId(null);
    }
  }

  async function handleCountCleanup() {
    setCounting(true);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString();
    const oneYearAgoDate = oneYearAgo.toISOString().split("T")[0];

    const counts: { [key: string]: number } = {};

    const tables = [
      { name: "announcements", column: "created_at", isDate: false },
      { name: "attendance", column: "checked_in_at", isDate: false },
      { name: "devotional_checkins", column: "checked_at", isDate: false },
      { name: "devotionals", column: "created_at", isDate: false },
      { name: "events", column: "date", isDate: true },
      { name: "sermons", column: "date", isDate: true },
      { name: "sunday_school", column: "checked_in_at", isDate: false },
      { name: "Daily Schedule", column: "date", isDate: true },
      { name: "qa_posts", column: "created_at", isDate: false },
      { name: "qa_replies", column: "created_at", isDate: false },
    ];

    for (const table of tables) {
      const { count } = await supabase
        .from(table.name)
        .select("*", { count: "exact", head: true })
        .lt(table.column, table.isDate ? oneYearAgoDate : oneYearAgoStr);

      counts[table.name] = count || 0;
    }

    setCleanupCounts(counts);
    setCounting(false);
  }

  async function handleCleanup() {
    if (!confirm("确定删除所有一年前的数据吗？此操作无法恢复！")) return;

    setCleaning(true);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const oneYearAgoStr = oneYearAgo.toISOString();
    const oneYearAgoDate = oneYearAgo.toISOString().split("T")[0];

    const tables = [
      { name: "announcements", column: "created_at", isDate: false },
      { name: "attendance", column: "checked_in_at", isDate: false },
      { name: "devotional_checkins", column: "checked_at", isDate: false },
      { name: "devotionals", column: "created_at", isDate: false },
      { name: "events", column: "date", isDate: true },
      { name: "sermons", column: "date", isDate: true },
      { name: "sunday_school", column: "checked_in_at", isDate: false },
      { name: "Daily Schedule", column: "date", isDate: true },
      { name: "qa_posts", column: "created_at", isDate: false },
      { name: "qa_replies", column: "created_at", isDate: false },
    ];

    let hasError = false;
    for (const table of tables) {
      const { error } = await supabase
        .from(table.name)
        .delete()
        .lt(table.column, table.isDate ? oneYearAgoDate : oneYearAgoStr);

      if (error) {
        alert(`清理 ${table.name} 失败：${error.message}`);
        hasError = true;
        break;
      }
    }

    setCleaning(false);
    if (!hasError) {
      alert("数据清理完成！");
      setCleanupCounts(null);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    return date.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* 顶部标题 */}
      <View style={{ backgroundColor: "#ef4444", padding: 24, paddingTop: 48 }}>
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
          <Text style={{ color: "#fecaca", fontSize: 18, fontWeight: "bold" }}>← 返回</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "white" }}>
          系统管理
        </Text>
        <Text style={{ fontSize: 14, color: "#fecaca", marginTop: 4 }}>
          用户管理 · 数据清理
        </Text>
      </View>

      {/* 标签切换 */}
      <View style={{ flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
        {[
          { key: "users", label: "用户管理" },
          { key: "cleanup", label: "数据清理" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={{
              flex: 1, padding: 14, alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.key ? "#ef4444" : "transparent",
            }}
            onPress={() => {
              setActiveTab(tab.key as any);
              if (tab.key === "users" && users.length === 0) fetchUsers();
            }}
          >
            <Text style={{
              fontSize: 14,
              fontWeight: activeTab === tab.key ? "bold" : "normal",
              color: activeTab === tab.key ? "#ef4444" : "#6b7280",
            }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ padding: 16 }}>
        {/* 用户管理 */}
        {activeTab === "users" && (
          <View>
            {loading ? (
              <ActivityIndicator size="large" color="#ef4444" style={{ marginTop: 40 }} />
            ) : users.length === 0 ? (
              <TouchableOpacity
                style={{ backgroundColor: "#ef4444", padding: 14, borderRadius: 8, alignItems: "center" }}
                onPress={fetchUsers}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>载入用户列表</Text>
              </TouchableOpacity>
            ) : (
              users.map((user) => (
                <View
                  key={user.user_id}
                  style={{
                    backgroundColor: "white",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 10,
                    borderLeftWidth: 4,
                    borderLeftColor: ROLE_COLORS[user.role] || "#6b7280",
                  }}
                >
                  {/* 用户信息 */}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <Text style={{ fontSize: 16, fontWeight: "bold", color: "#111827" }}>
                      {user.username}
                    </Text>
                    <View style={{
                      backgroundColor: (ROLE_COLORS[user.role] || "#6b7280") + "20",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 12,
                    }}>
                      <Text style={{ fontSize: 12, color: ROLE_COLORS[user.role] || "#6b7280", fontWeight: "bold" }}>
                        {ROLE_LABELS[user.role] || user.role}
                      </Text>
                    </View>
                  </View>

                  {user.email ? (
                    <Text style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                      📧 {user.email}
                    </Text>
                  ) : null}
                  {user.phone ? (
                    <Text style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                      📱 {user.phone}
                    </Text>
                  ) : null}
                  <Text style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                    注册：{formatDate(user.created_at)}
                  </Text>

                  {/* 修改角色 */}
                  {editingUserId === user.user_id ? (
                    <View style={{ marginTop: 10 }}>
                      <Text style={{ fontSize: 13, color: "#374151", marginBottom: 6 }}>选择新角色：</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                        {ROLES.map((role) => (
                          <TouchableOpacity
                            key={role}
                            style={{
                              paddingHorizontal: 10,
                              paddingVertical: 6,
                              borderRadius: 20,
                              backgroundColor: user.role === role ? ROLE_COLORS[role] : "#f3f4f6",
                              borderWidth: 1,
                              borderColor: ROLE_COLORS[role] || "#e5e7eb",
                            }}
                            onPress={() => handleRoleChange(user.user_id, role)}
                          >
                            <Text style={{
                              fontSize: 12,
                              color: user.role === role ? "white" : ROLE_COLORS[role] || "#374151",
                              fontWeight: "bold",
                            }}>
                              {ROLE_LABELS[role]}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                      <TouchableOpacity
                        style={{ marginTop: 8 }}
                        onPress={() => setEditingUserId(null)}
                      >
                        <Text style={{ fontSize: 13, color: "#6b7280" }}>取消</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10, justifyContent: "flex-end" }}>
                      {can(userRole, "manage_user_roles") && (
                        <TouchableOpacity
                          style={{ backgroundColor: "#f3f4f6", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
                          onPress={() => setEditingUserId(user.user_id)}
                        >
                          <Text style={{ fontSize: 12, color: "#374151" }}>✏️ 修改角色</Text>
                        </TouchableOpacity>
                      )}
                      {canResetPassword && (
                        <TouchableOpacity
                          style={{
                            backgroundColor: resettingUserId === user.user_id ? "#fde68a" : "#fef3c7",
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 20,
                            opacity: resettingUserId === user.user_id ? 0.6 : 1,
                          }}
                          onPress={() => handleResetPassword(user.user_id, user.username)}
                          disabled={resettingUserId === user.user_id}
                        >
                          <Text style={{ fontSize: 12, color: "#92400e" }}>
                            {resettingUserId === user.user_id ? "⏳ 重置中..." : "🔑 重置密码"}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {can(userRole, "delete_user") && (
                        <TouchableOpacity
                          style={{ backgroundColor: "#fee2e2", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 }}
                          onPress={() => handleDeleteUser(user.user_id, user.username)}
                        >
                          <Text style={{ fontSize: 12, color: "#ef4444" }}>🗑 删除</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* 数据清理 */}
        {activeTab === "cleanup" && (
          <View>
            <View style={{
              backgroundColor: "#fef3c7",
              borderRadius: 12,
              padding: 16,
              marginBottom: 16,
              borderWidth: 1,
              borderColor: "#fde68a",
            }}>
              <Text style={{ fontSize: 14, color: "#92400e", fontWeight: "bold", marginBottom: 4 }}>
                ⚠️ 注意
              </Text>
              <Text style={{ fontSize: 13, color: "#92400e" }}>
                此操作将永久删除一年前的所有数据，无法恢复。用户资料不会被删除。
              </Text>
            </View>

            {/* 先统计 */}
            <TouchableOpacity
              style={{
                backgroundColor: "#f59e0b",
                padding: 14, borderRadius: 8, alignItems: "center", marginBottom: 16,
              }}
              onPress={handleCountCleanup}
              disabled={counting}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>
                {counting ? "统计中..." : "统计将要删除的数据"}
              </Text>
            </TouchableOpacity>

            {/* 显示统计结果 */}
            {cleanupCounts && (
              <View>
                <View style={{ backgroundColor: "white", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: "bold", color: "#374151", marginBottom: 12 }}>
                    将要删除的数据：
                  </Text>
                  {Object.entries(cleanupCounts).map(([table, count]) => (
                    <View
                      key={table}
                      style={{
                        flexDirection: "row",
                        justifyContent: "space-between",
                        paddingVertical: 6,
                        borderBottomWidth: 0.5,
                        borderBottomColor: "#e5e7eb",
                      }}
                    >
                      <Text style={{ fontSize: 13, color: "#374151" }}>{table}</Text>
                      <Text style={{ fontSize: 13, color: count > 0 ? "#ef4444" : "#6b7280", fontWeight: "bold" }}>
                        {count} 条
                      </Text>
                    </View>
                  ))}
                  <Text style={{ fontSize: 13, fontWeight: "bold", color: "#ef4444", marginTop: 8 }}>
                    总计：{Object.values(cleanupCounts).reduce((a, b) => a + b, 0)} 条
                  </Text>
                </View>

                <TouchableOpacity
                  style={{
                    backgroundColor: cleaning ? "#fca5a5" : "#ef4444",
                    padding: 14, borderRadius: 8, alignItems: "center",
                  }}
                  onPress={handleCleanup}
                  disabled={cleaning}
                >
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    {cleaning ? "清理中..." : "确认删除"}
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}