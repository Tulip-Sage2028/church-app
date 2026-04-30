import { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../lib/supabase";

export default function Register({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [smsOptIn, setSmsOptIn] = useState(true); // 默认勾选(同意接收短信)
  const [loading, setLoading] = useState(false);

  // 手机号格式验证:支持 + 开头的国际号码,或 10 位本地号
  function isValidPhone(input: string): boolean {
    // 去掉常见分隔符:空格、横杠、括号、小数点
    const cleaned = input.replace(/[\s\-\(\)\.]/g, "");

    // 国际号码:+ 开头,后面 7-15 位数字
    if (cleaned.startsWith("+")) {
      return /^\+\d{7,15}$/.test(cleaned);
    }

    // 本地号码:10 位数字(美国/加拿大格式)
    return /^\d{10}$/.test(cleaned);
  }

  async function handleRegister() {
    if (!username) {
      alert("请填写用户名");
      return;
    }
    if (username.length < 3) {
      alert("用户名至少3个字符");
      return;
    }
    if (!password) {
      alert("请填写密码");
      return;
    }
    if (password.length < 6) {
      alert("密码至少6个字符");
      return;
    }
    if (password !== confirmPassword) {
      alert("两次密码不一致");
      return;
    }
    if (!phone.trim()) {
      alert("请填写手机号");
      return;
    }
    if (!isValidPhone(phone)) {
      alert("手机号格式不正确\n请输入 10 位本地号(如 9495551234)\n或国际号(如 +8613812345678)");
      return;
    }

    setLoading(true);

    // 检查用户名是否已存在
    const { data: existing } = await supabase
      .from("profiles")
      .select("username")
      .eq("username", username)
      .single();

    if (existing) {
      alert("用户名已被使用，请换一个");
      setLoading(false);
      return;
    }

    // 注册 Supabase Auth
    const internalEmail = `${username}@grace-life.com`;
    const { data, error } = await supabase.auth.signUp({
      email: internalEmail,
      password: password,
    });

    if (error) {
      alert("注册失败：" + error.message);
      setLoading(false);
      return;
    }

    // 建立 profiles 记录
    if (data.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .insert({
          user_id: data.user.id,
          username: username,
          phone: phone.trim(),
          sms_opt_in: smsOptIn,
        });

      if (profileError) {
        alert("建立资料失败：" + profileError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    alert("注册成功！请登录");
    onSuccess();
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ padding: 24, paddingTop: 60 }}>
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 24 }}>
          <Text style={{ color: "#2563eb", fontSize: 18, fontWeight: "bold" }}>← 返回登录</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 28, fontWeight: "bold", color: "#111827", marginBottom: 8 }}>
          注册账号
        </Text>
        <Text style={{ fontSize: 16, color: "#6b7280", marginBottom: 40 }}>
          恩典生命团契
        </Text>

        <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>
          用户名 <Text style={{ color: "#ef4444" }}>*</Text>
        </Text>
        <TextInput
          style={{
            width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
            padding: 12, fontSize: 16, marginBottom: 16, backgroundColor: "white",
          }}
          placeholder="设定你的用户名（至少3个字符）"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />

        <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>
          密码 <Text style={{ color: "#ef4444" }}>*</Text>
        </Text>
        <TextInput
          style={{
            width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
            padding: 12, fontSize: 16, marginBottom: 16, backgroundColor: "white",
          }}
          placeholder="设定密码（至少6个字符）"
          value={password}
          onChangeText={setPassword}
          secureTextEntry={true}
        />

        <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>
          确认密码 <Text style={{ color: "#ef4444" }}>*</Text>
        </Text>
        <TextInput
          style={{
            width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
            padding: 12, fontSize: 16, marginBottom: 16, backgroundColor: "white",
          }}
          placeholder="再输入一次密码"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={true}
        />

        <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>
          手机号 <Text style={{ color: "#ef4444" }}>*</Text>
        </Text>
        <TextInput
          style={{
            width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
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
              你也可以稍后在「个人资料」中随时取消。
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            width: "100%",
            backgroundColor: loading ? "#93c5fd" : "#2563eb",
            padding: 14, borderRadius: 8, alignItems: "center",
          }}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
            {loading ? "注册中..." : "注册"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}