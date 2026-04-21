import { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../lib/supabase";

export default function Register({ onBack, onSuccess }: { onBack: () => void; onSuccess: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
          <Text style={{ color: "#2563eb", fontSize: 14 }}>← 返回登录</Text>
        </TouchableOpacity>

        <Text style={{ fontSize: 28, fontWeight: "bold", color: "#111827", marginBottom: 8 }}>
          注册账号
        </Text>
        <Text style={{ fontSize: 16, color: "#6b7280", marginBottom: 40 }}>
          恩典生命团契
        </Text>

        <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>用户名</Text>
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

        <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>密码</Text>
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

        <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>确认密码</Text>
        <TextInput
          style={{
            width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
            padding: 12, fontSize: 16, marginBottom: 32, backgroundColor: "white",
          }}
          placeholder="再输入一次密码"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry={true}
        />

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