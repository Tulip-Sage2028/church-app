import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
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

  // 手机号格式验证:支持 + 开头的国际号码,或 10 位本地号
  function isValidPhone(input: string): boolean {
    const cleaned = input.replace(/[\s\-\(\)\.]/g, "");
    if (cleaned.startsWith("+")) {
      return /^\+\d{7,15}$/.test(cleaned);
    }
    return /^\d{10}$/.test(cleaned);
  }

  useEffect(() => {
    fetchProfile();
  }, []);

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
      setSmsOptIn(data.sms_opt_in !== false); // 数据库为 null 或 true 都视为同意
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

      {/* 标签切换 */}
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
        {/* 联络资料 */}
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
            <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 20 }}>
              请填写本地 10 位手机号,或以「+」开头的国际号码
            </Text>

            {/* 同意接收短信通知 */}
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
                marginBottom: 32,
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
                  我同意接收教会短信通知
                </Text>
                <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 4, lineHeight: 18 }}>
                  勾选后,教会将在有重要通知(如聚会变动、紧急事项等)时通过短信告知你。
                </Text>
              </View>
            </TouchableOpacity>

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