import { useEffect, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { can } from "../lib/permissions";
import { supabase } from "../lib/supabase";
import Admin from "./admin";
import Announcements from "./announcements";
import Devotionals from "./devotionals";
import Events from "./events";
import Profile from "./profile";
import QA from "./qa";
import QR from "./qr";
import Schedules from "./schedules";
import Sermons from "./sermons";
import SundaySchool from "./sunday_school";

const MENU_ITEMS = [
  // 聚会日程安排功能暂时隐藏 — 取消注释即可恢复
  // { id: 1, title: "聚会日程安排", description: "查看本周及upcoming聚会", color: "#2563eb", icon: "📅" },
  { id: 2, title: "团契活动", description: "活动签到 · 事工报名", color: "#16a34a", icon: "✅" },
  { id: 3, title: "主日学班级签到", description: "大中小班签到签出", color: "#9333ea", icon: "👧" },
  { id: 4, title: "主日信息", description: "本周周报及往期讲道", color: "#ea580c", icon: "📖" },
  { id: 5, title: "公告栏", description: "最新消息及通知", color: "#f59e0b", icon: "📢" },
  { id: 6, title: "每日读经", description: "读经打卡及牧师解析", color: "#16a34a", icon: "📝" },
  // 问答交流功能暂时隐藏 — 取消注释即可恢复
  // { id: 7, title: "问答交流", description: "提问 · 分享 · 交流", color: "#2563eb", icon: "💬" },
  { id: 8, title: "系统管理", description: "用户管理 · 数据清理", color: "#ef4444", icon: "⚙️" },
  { id: 9, title: "扫码分享", description: "分享 App 给会友", color: "#0891b2", icon: "📲" },
];

// 访客可以看到的菜单
const GUEST_VISIBLE = [1, 2, 3, 4, 5, 9];

const PAGE_MAP: { [key: number]: string } = {
  1: "schedules",
  2: "events",
  3: "sunday_school",
  4: "sermons",
  5: "announcements",
  6: "devotionals",
  7: "qa",
  8: "admin",
  9: "qr",
};

export default function Home({
  onLogout,
  userRole,
  userId,
}: {
  onLogout: () => void;
  userRole: string;
  userId: string | null;
}) {
  const [currentPage, setCurrentPage] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [badges, setBadges] = useState<{ [key: number]: boolean }>({});

  const isGuest = userId === null;

  useEffect(() => {
    if (isGuest) return;
    async function fetchUsername() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("username")
          .eq("user_id", user.id)
          .single();
        if (profile) setUsername(profile.username);
      }
    }
    fetchUsername();
  }, []);

  useEffect(() => {
    if (isGuest) return;
    async function checkNewContent() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: readStatus } = await supabase
        .from("read_status")
        .select("feature, last_read_at")
        .eq("user_id", user.id);

      const lastRead: { [key: string]: string } = {};
      if (readStatus) {
        readStatus.forEach((r) => {
          lastRead[r.feature] = r.last_read_at;
        });
      }

      const { data: latestEvent } = await supabase
        .from("events")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);

      const { data: latestAnnouncement } = await supabase
        .from("announcements")
        .select("created_at")
        .order("created_at", { ascending: false })
        .limit(1);

      const newBadges: { [key: number]: boolean } = {};

      if (latestEvent && latestEvent.length > 0) {
        const lastReadEvents = lastRead["events"];
        if (!lastReadEvents || latestEvent[0].created_at > lastReadEvents) {
          newBadges[2] = true;
        }
      }

      if (latestAnnouncement && latestAnnouncement.length > 0) {
        const lastReadAnnouncements = lastRead["announcements"];
        if (!lastReadAnnouncements || latestAnnouncement[0].created_at > lastReadAnnouncements) {
          newBadges[5] = true;
        }
      }

      setBadges(newBadges);
    }
    checkNewContent();
  }, []);

  async function markAsRead(feature: string) {
    if (isGuest) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("read_status")
      .upsert({
        user_id: user.id,
        feature: feature,
        last_read_at: new Date().toISOString(),
      }, { onConflict: "user_id,feature" });
  }

  async function handleLogout() {
    if (isGuest) {
      onLogout();
      return;
    }
    if (confirm("确定登出吗？")) {
      await supabase.auth.signOut();
      onLogout();
    }
  }

  // 页面路由
  if (currentPage === "schedules") return <Schedules onBack={() => setCurrentPage(null)} userRole={userRole} />;
  if (currentPage === "events") return <Events onBack={() => setCurrentPage(null)} userRole={userRole} userId={userId} />;
  if (currentPage === "sunday_school") return <SundaySchool onBack={() => setCurrentPage(null)} userRole={userRole} userId={userId} />;
  if (currentPage === "sermons") return <Sermons onBack={() => setCurrentPage(null)} userRole={userRole} />;
  if (currentPage === "announcements") return <Announcements onBack={() => setCurrentPage(null)} userRole={userRole} />;
  if (currentPage === "devotionals") return <Devotionals onBack={() => setCurrentPage(null)} userRole={userRole} />;
  if (currentPage === "profile") return <Profile onBack={() => setCurrentPage(null)} />;
  if (currentPage === "qa") return <QA onBack={() => setCurrentPage(null)} userRole={userRole} />;
  if (currentPage === "admin") return <Admin onBack={() => setCurrentPage(null)} userRole={userRole} />;
  if (currentPage === "qr") return <QR onBack={() => setCurrentPage(null)} />;

  // 访客只显示部分菜单
  const visibleItems = isGuest
    ? MENU_ITEMS.filter((item) => GUEST_VISIBLE.includes(item.id))
    : MENU_ITEMS;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* 顶部标题栏 */}
      <View style={{ backgroundColor: "#2563eb", padding: 24, paddingTop: 48 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>

          {/* 左边：个人资料 或 访客标示 */}
          {isGuest ? (
            <View style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              paddingHorizontal: 12, paddingVertical: 6,
              borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6,
            }}>
              <Text style={{ color: "white", fontSize: 14 }}>👤</Text>
              <Text style={{ color: "white", fontSize: 14 }}>访客浏览</Text>
            </View>
          ) : (
            <TouchableOpacity
              onPress={() => setCurrentPage("profile")}
              style={{
                backgroundColor: "rgba(255,255,255,0.2)",
                paddingHorizontal: 12, paddingVertical: 6,
                borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6,
              }}
            >
              <Text style={{ color: "white", fontSize: 14 }}>👤</Text>
              <Text style={{ color: "white", fontSize: 14 }}>
                {username || "用户"} · 个人资料
              </Text>
            </TouchableOpacity>
          )}

          {/* 右边：登出 或 去登录 */}
          <TouchableOpacity
            onPress={handleLogout}
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              paddingHorizontal: 12, paddingVertical: 6,
              borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 4,
            }}
          >
            <Text style={{ color: "white", fontSize: 14 }}>
              {isGuest ? "去登录" : "登出"}
            </Text>
            <Text style={{ color: "white", fontSize: 14 }}>
              {isGuest ? "🔑" : "🚪"}
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={{ fontSize: 24, fontWeight: "bold", color: "white", marginTop: 16 }}>
          恩典生命团契
        </Text>
        <Text style={{ fontSize: 14, color: "#bfdbfe", marginTop: 4 }}>
          {isGuest ? "访客模式 · 登录后可使用完整功能 🙏" : "愿恩惠平安归与你们 🙏"}
        </Text>
      </View>

      {/* 功能菜单 */}
      <View style={{ padding: 16 }}>
        <Text style={{ fontSize: 16, fontWeight: "bold", color: "#374151", marginBottom: 12 }}>
          功能菜单
        </Text>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {visibleItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={{
                width: "47%",
                backgroundColor: "white",
                borderRadius: 16,
                padding: 16,
                alignItems: "center",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.06,
                shadowRadius: 8,
                elevation: 2,
              }}
              onPress={() => {
                if (!isGuest) {
                 if (item.id === 5 && !can(userRole, "view_announcements")) {
                    alert("你没有权限访问此功能，请联络管理员升级账号。");
                    return;
                  }
                  if (item.id === 7 && !can(userRole, "view_qa")) {
                    alert("你没有权限访问此功能，请联络管理员升级账号。");
                    return;
                  }
                  if (item.id === 8 && !can(userRole, "access_admin")) {
                    alert("你没有权限访问此功能");
                    return;
                  }
                }
                setBadges((prev) => ({ ...prev, [item.id]: false }));
                if (item.id === 2) markAsRead("events");
                if (item.id === 5) markAsRead("announcements");
                setCurrentPage(PAGE_MAP[item.id]);
              }}
            >
              {badges[item.id] && (
                <View style={{
                  position: "absolute", top: 8, right: 8,
                  width: 10, height: 10, borderRadius: 5, backgroundColor: "#ef4444",
                }} />
              )}

              <View style={{
                width: 56, height: 56, borderRadius: 16,
                backgroundColor: item.color + "15",
                alignItems: "center", justifyContent: "center", marginBottom: 10,
              }}>
                <Text style={{ fontSize: 26 }}>{item.icon}</Text>
              </View>
              <Text style={{ fontSize: 14, fontWeight: "bold", color: "#111827", textAlign: "center", marginBottom: 4 }}>
                {item.title}
              </Text>
              <Text style={{ fontSize: 11, color: "#9ca3af", textAlign: "center" }}>
                {item.description}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 访客提示 */}
        {isGuest && (
          <View style={{
            marginTop: 16, padding: 16, backgroundColor: "#eff6ff",
            borderRadius: 12, borderWidth: 1, borderColor: "#bfdbfe",
          }}>
            <Text style={{ color: "#1d4ed8", fontSize: 13, textAlign: "center" }}>
              🔒 登录后可使用完整功能
            </Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}