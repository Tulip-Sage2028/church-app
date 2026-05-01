import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import {
    getNotificationPermission,
    isIOS,
    isPushSupported,
    isStandalonePWA,
    isSubscribed,
    subscribeToPush,
    unsubscribeFromPush,
} from "../lib/push";
import { supabase } from "../lib/supabase";

export default function Profile({ onBack }: { onBack: () => void }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [username, setUsername] = useState("");
  const [phone, setPhone] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(true);
  const [role, setRole] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [activeTab, setActiveTab] = useState<"info" | "password">("info");

  // 推送相关状态
  const [pushSubbed, setPushSubbed] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushSupported, setPushSupported] = useState(false);
  const [pushIOSWarning, setPushIOSWarning] = useState(false);
  const [pushPermission, setPushPermission] = useState<NotificationPermission>("default");

  // 手机号格式验证
  function isValidPhone(input: string): boolean {
    const cleaned = input.replace(/[\s\-\(\)\.]/g, "");
    if (cleaned.startsWith("+")) {
      return /^\+\d{7,15}$/.test(cleaned);
    }
    return /^\d{10}$/.test(cleaned);
  }

  useEffect(() => {
    fetchProfile();
    checkPushStatus();
  }, []);

  async function checkPushStatus() {
    const supported = isPushSupported();
    setPushSupported(supported);
    if (!supported) return;

    if (isIOS() && !isStandalonePWA()) {
      setPushIOSWarning(true);
    }

    setPushPermission(getNotificationPermission());
    const subbed = await isSubscribed();
    setPushSubbed(subbed);
  }

  async function fetchProfile() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (data) {
      setUsername(data.username || "");
      setPhone(data.phone || "");
      setSmsOptIn(data.sms_opt_in !== false);
      setRole(data.role || "guest");
    }

    setLoading(false);
  }

  async function handleSave() {
    if (!phone.trim()) {
      alert("请填写手机号");
      return;
    }
    if (!isValidPhone(phone)) {
      alert("手机号格式不正确\n请输入 10 位本地号(如 9495551234)\n或国际号(如 +8613812345678)");
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase
      .from("profiles")
      .update({ phone: phone.trim(), sms_opt_in: smsOptIn })
      .eq("user_id", user.id);

    setSaving(false);

    if (error) {
      alert("保存失败：" + error.message);
    } else {
      alert("保存成功！");
      onBack();
    }
  }

  async function handleChangePassword() {
    if (!newPassword) {
      alert("请填写新密码");
      return;
    }
    if (newPassword.length < 6) {
      alert("密码至少6个字符");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      alert("两次密码不一致");
      return;
    }

    setSaving(true);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    setSaving(false);

    if (error) {
      alert("修改失败：" + error.message);
    } else {
      alert("密码修改成功！");
      setNewPassword("");
      setConfirmNewPassword("");
    }
  }

  // 开启/关闭推送订阅
  async function handleTogglePush() {
    if (pushBusy) return;
    setPushBusy(true);

    try {
      if (pushSubbed) {
        if (!confirm("确定关闭公告推送通知吗?")) {
          setPushBusy(false);
          return;
        }
        const result = await unsubscribeFromPush();
        if (result.success) {
          setPushSubbed(false);
          alert("✅ 已关闭推送通知");
        } else {
          alert(`关闭失败:${result.error}`);
        }
      } else {
        const result = await subscribeToPush();
        if (result.success) {
          setPushSubbed(true);
          setPushPermission("granted");
          alert("✅ 推送通知已开启!\n之后教会发布重要公告时,您会收到推送通知。");
        } else {
          alert(`开启失败:${result.error}`);
        }
      }
    } finally {
      setPushBusy(false);
    }
  }

  function getRoleLabel(r: string) {
    const map: { [key: string]: string } = {
      guest: "访客",
      member: "会员",
      teacher: "老师",
      media: "媒体组",
      leader: "组长",
      pastor: "牧师",
      admin: "管理员",
    };
    return map[r] || r;
  }

  function getRoleColor(r: string) {
    const map: { [key: string]: string } = {
      guest: "#6b7280",
      member: "#2563eb",
      teacher: "#9333ea",
      media: "#0891b2",
      leader: "#16a34a",
      pastor: "#ea580c",
      admin: "#ef4444",
    };
    return map[r] || "#6b7280";
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* 顶部标题 */}
      <View style={{ backgroundColor: "#2563eb", padding: 24, paddingTop: 48 }}>
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
          <Text style={{ color: "#bfdbfe", fontSize: 18, fontWeight: "bold" }}>← 返回</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "white" }}>
          个人资料
        </Text>
        <Text style={{ fontSize: 14, color: "#bfdbfe", marginTop: 4 }}>
          管理你的账号信息
        </Text>
      </View>

      {/* 用户信息卡片 */}
      <View style={{
        margin: 16,
        backgroundColor: "white",
        borderRadius: 16,
        padding: 20,
        flexDirection: "row",
        alignItems: "center",
        gap: 16,
      }}>
        <View style={{
          width: 60,
          height: 60,
          borderRadius: 30,
          backgroundColor: getRoleColor(role) + "20",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <Text style={{ fontSize: 24, fontWeight: "bold", color: getRoleColor(role) }}>
            {username ? username[0].toUpperCase() : "?"}
          </Text>
        </View>
        <View>
          <Text style={{ fontSize: 18, fontWeight: "bold", color: "#111827" }}>
            {username}
          </Text>
          <View style={{
            backgroundColor: getRoleColor(role) + "20",
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 12,
            marginTop: 4,
            alignSelf: "flex-start",
          }}>
            <Text style={{ fontSize: 12, color: getRoleColor(role), fontWeight: "bold" }}>
              {getRoleLabel(role)}
            </Text>
          </View>
        </View>
      </View>

      {/* 标签切换 — 改为只有 2 个 tab */}
      <View style={{ flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", marginBottom: 16 }}>
        {[
          { key: "info", label: "联络资料" },
          { key: "password", label: "修改密码" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={{
              flex: 1,
              padding: 14,
              alignItems: "center",
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
        {/* 联络资料 — 含手机号 + 通知偏好 */}
        {activeTab === "info" && (
          <View>
            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>用户名</Text>
            <View style={{
              borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8,
              padding: 12, marginBottom: 16, backgroundColor: "#f3f4f6",
            }}>
              <Text style={{ fontSize: 16, color: "#6b7280" }}>{username}</Text>
            </View>

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>
              手机号 <Text style={{ color: "#ef4444" }}>*</Text>
            </Text>
            <TextInput
              style={{
                borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
                padding: 12, fontSize: 16, marginBottom: 6, backgroundColor: "white",
              }}
              placeholder="例如:9495551234 或 +8613812345678"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />
            <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 24 }}>
              请填写本地 10 位手机号,或以「+」开头的国际号码
            </Text>

            {/* ════ 通知偏好区块 ════ */}
            <Text style={{ fontSize: 15, color: "#374151", marginBottom: 12, fontWeight: "bold" }}>
              📲 通知偏好
            </Text>

            {/* 短信通知开关 */}
            <TouchableOpacity
              onPress={() => setSmsOptIn(!smsOptIn)}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                backgroundColor: smsOptIn ? "#eff6ff" : "white",
                borderWidth: 1,
                borderColor: smsOptIn ? "#2563eb" : "#ccc",
                borderRadius: 8,
                padding: 14,
                marginBottom: 12,
              }}
              activeOpacity={0.7}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: smsOptIn ? "#2563eb" : "#9ca3af",
                  backgroundColor: smsOptIn ? "#2563eb" : "white",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                  marginTop: 2,
                }}
              >
                {smsOptIn && (
                  <Text style={{ color: "white", fontSize: 14, fontWeight: "bold" }}>✓</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "bold", color: "#374151" }}>
                  📩 接收短信通知
                </Text>
                <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 18 }}>
                  教会有重要事项(如聚会变动、紧急代祷)时,通过短信告知您。
                </Text>
              </View>
            </TouchableOpacity>

            {/* 推送通知开关 */}
            <TouchableOpacity
              onPress={handleTogglePush}
              disabled={pushBusy || !pushSupported || pushIOSWarning || pushPermission === "denied"}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                backgroundColor: pushSubbed ? "#eff6ff" : "white",
                borderWidth: 1,
                borderColor: pushSubbed ? "#2563eb" : "#ccc",
                borderRadius: 8,
                padding: 14,
                marginBottom: 12,
                opacity: (pushBusy || !pushSupported || pushIOSWarning || pushPermission === "denied") ? 0.6 : 1,
              }}
              activeOpacity={0.7}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: pushSubbed ? "#2563eb" : "#9ca3af",
                  backgroundColor: pushSubbed ? "#2563eb" : "white",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 12,
                  marginTop: 2,
                }}
              >
                {pushSubbed && (
                  <Text style={{ color: "white", fontSize: 14, fontWeight: "bold" }}>✓</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 14, fontWeight: "bold", color: "#374151" }}>
                  📣 接收公告推送通知 {pushBusy ? "(处理中...)" : ""}
                </Text>
                <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 18 }}>
                  {pushSubbed
                    ? "已开启 — 即使没打开 App 也能收到通知。点击关闭(仅本设备)。"
                    : "开启后,即使没打开 App,重要公告也会推送到您手机。点击此处开启。"}
                </Text>
              </View>
            </TouchableOpacity>

            {/* 推送相关提示 */}
            {!pushSupported && (
              <View style={{
                backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fde68a",
                borderRadius: 8, padding: 10, marginBottom: 12,
              }}>
                <Text style={{ fontSize: 11, color: "#92400e", lineHeight: 16 }}>
                  ⚠️ 您的浏览器不支持推送通知,请使用最新版 Chrome、Safari 或 Firefox。
                </Text>
              </View>
            )}

            {pushSupported && pushIOSWarning && (
              <View style={{
                backgroundColor: "#fef3c7", borderWidth: 1, borderColor: "#fde68a",
                borderRadius: 8, padding: 10, marginBottom: 12,
              }}>
                <Text style={{ fontSize: 12, color: "#92400e", fontWeight: "bold", marginBottom: 4 }}>
                  📱 iPhone 用户需先添加到主屏幕
                </Text>
                <Text style={{ fontSize: 11, color: "#92400e", lineHeight: 16 }}>
                  1. 用 Safari 打开 App  2. 点底部分享按钮  3. 选「加入主画面」  4. 从主屏幕图标打开,再回这里开启推送
                </Text>
              </View>
            )}

            {pushSupported && pushPermission === "denied" && (
              <View style={{
                backgroundColor: "#fee2e2", borderWidth: 1, borderColor: "#fecaca",
                borderRadius: 8, padding: 10, marginBottom: 12,
              }}>
                <Text style={{ fontSize: 11, color: "#991b1b", lineHeight: 16 }}>
                  ❌ 通知权限已被拒绝。请到浏览器设置中找到本网站,把「通知」改为「允许」后回来重试。
                </Text>
              </View>
            )}

            {/* 推送说明 */}
            <View style={{
              backgroundColor: "#f9fafb", borderRadius: 8, padding: 10, marginBottom: 24,
            }}>
              <Text style={{ fontSize: 11, color: "#6b7280", lineHeight: 16 }}>
                💡 推送是按设备开启的,如需在多个设备(如手机+电脑)都收到,需在每个设备上分别开启。
              </Text>
            </View>

            <TouchableOpacity
              style={{
                backgroundColor: saving ? "#93c5fd" : "#2563eb",
                padding: 14, borderRadius: 8, alignItems: "center",
              }}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
                {saving ? "保存中..." : "保存"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 修改密码 */}
        {activeTab === "password" && (
          <View>
            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>新密码</Text>
            <TextInput
              style={{
                borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
                padding: 12, fontSize: 16, marginBottom: 16, backgroundColor: "white",
              }}
              placeholder="输入新密码（至少6个字符）"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry={true}
            />

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>确认新密码</Text>
            <TextInput
              style={{
                borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
                padding: 12, fontSize: 16, marginBottom: 32, backgroundColor: "white",
              }}
              placeholder="再输入一次新密码"
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry={true}
            />

            <TouchableOpacity
              style={{
                backgroundColor: saving ? "#93c5fd" : "#9333ea",
                padding: 14, borderRadius: 8, alignItems: "center",
              }}
              onPress={handleChangePassword}
              disabled={saving}
            >
              <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
                {saving ? "修改中..." : "修改密码"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}