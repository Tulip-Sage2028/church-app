import { useState } from "react";
import { Text, TextInput, TouchableOpacity, View } from "react-native";
import { supabase } from "../lib/supabase";
import Home from "./home";
import Register from "./register";

export default function Index() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [userRole, setUserRole] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  if (loggedIn) {
    return (
      <Home
        onLogout={() => {
          setLoggedIn(false);
          setUserRole("");
          setUserId(null);
        }}
        userRole={userRole}
        userId={userId}
      />
    );
  }

  if (showRegister) {
    return (
      <Register
        onBack={() => setShowRegister(false)}
        onSuccess={() => setShowRegister(false)}
      />
    );
  }

  async function handleLogin() {
    if (!username) {
      alert("请填写用户名");
      return;
    }
    if (!password) {
      alert("请填写密码");
      return;
    }

    setLoading(true);

    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id, role")
      .eq("username", username)
      .single();

    if (!profile) {
      alert("用户名不存在");
      setLoading(false);
      return;
    }

    const internalEmail = `${username}@grace-life.com`;
    const { error } = await supabase.auth.signInWithPassword({
      email: internalEmail,
      password: password,
    });

    setLoading(false);

    if (error) {
      alert("密码错误");
    } else {
      setUserRole(profile.role || "guest");
      setUserId(profile.user_id);
      setLoggedIn(true);
    }
  }

  function handleGuestBrowse() {
    setUserRole("guest");
    setUserId(null);
    setLoggedIn(true);
  }

  return (
    <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 24 }}>
      <Text style={{ fontSize: 28, fontWeight: "bold", marginBottom: 8 }}>
        恩典生命团契
      </Text>
      <Text style={{ fontSize: 16, color: "gray", marginBottom: 40 }}>
        请登录你的账号
      </Text>

      <TextInput
        style={{
          width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
          padding: 12, fontSize: 16, marginBottom: 16,
        }}
        placeholder="用户名"
        value={username}
        onChangeText={setUsername}
        autoCapitalize="none"
      />

      <TextInput
        style={{
          width: "100%", borderWidth: 1, borderColor: "#ccc", borderRadius: 8,
          padding: 12, fontSize: 16, marginBottom: 24,
        }}
        placeholder="密码"
        value={password}
        onChangeText={setPassword}
        secureTextEntry={true}
      />

      <TouchableOpacity
        style={{
          width: "100%",
          backgroundColor: loading ? "#93c5fd" : "#2563eb",
          padding: 14, borderRadius: 8, alignItems: "center", marginBottom: 12,
        }}
        onPress={handleLogin}
        disabled={loading}
      >
        <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
          {loading ? "登录中..." : "登录"}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={{
          width: "100%", backgroundColor: "white", padding: 14, borderRadius: 8,
          alignItems: "center", borderWidth: 1, borderColor: "#2563eb", marginBottom: 12,
        }}
        onPress={() => setShowRegister(true)}
      >
        <Text style={{ color: "#2563eb", fontSize: 16, fontWeight: "bold" }}>
          注册新账号
        </Text>
      </TouchableOpacity>

      {/* 访客浏览按钮 */}
      <TouchableOpacity
        style={{
          width: "100%", backgroundColor: "#f0fdf4", padding: 14, borderRadius: 8,
          alignItems: "center", borderWidth: 2, borderColor: "#16a34a",
        }}
        onPress={handleGuestBrowse}
      >
        <Text style={{ color: "#16a34a", fontSize: 16, fontWeight: "bold" }}>
           👀 访客浏览（无需登录）
        </Text>
      </TouchableOpacity>
    </View>
  );
}