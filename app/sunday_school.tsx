import { Picker } from "@react-native-picker/picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { can } from "../lib/permissions";
import { supabase } from "../lib/supabase";

type Student = {
  id: number;
  child_name: string;
  class: string;
  date: string;
  checked_in_at: string;
  checked_out_at: string | null;
  checked_in_by: string;
  checked_out_by: string | null;
};

export default function SundaySchool({ onBack, userRole }: { onBack: () => void; userRole: string }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [childName, setChildName] = useState("");
  const [selectedClass, setSelectedClass] = useState("小小班");
  const [activeTab, setActiveTab] = useState<"checkin" | "checkout" | "view" | "search">("checkin");
  const [filterClass, setFilterClass] = useState("小小班");

  // 查询功能
  const [searchName, setSearchName] = useState("");
  const [searchResults, setSearchResults] = useState<Student[]>([]);
  const [searching, setSearching] = useState(false);

  const today = new Date().toISOString().split("T")[0];

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

    // 只取今天的签到记录
    const { data } = await supabase
      .from("sunday_school")
      .select("*")
      .eq("date", today)
      .order("checked_in_at", { ascending: false });

    if (data) setStudents(data);
    setLoading(false);
  }

  function getStudentRecord(name: string, cls: string) {
    return students.find(
      (s) => s.child_name === name && s.class === cls && s.date === today
    );
  }

  async function handleCheckIn() {
    if (!childName) {
      alert("请输入孩子姓名");
      return;
    }

    const existing = getStudentRecord(childName, selectedClass);
    if (existing) {
      alert(`${childName} 今天已经签到了！`);
      return;
    }

    if (!confirm(`确定为 ${childName}（${selectedClass}）签到吗？`)) return;

    const { data, error } = await supabase
      .from("sunday_school")
      .insert({
        child_name: childName,
        class: selectedClass,
        date: today,
        checked_in_at: new Date().toISOString(),
        checked_in_by: username,
      })
      .select()
      .single();

    if (!error && data) {
      setStudents([data, ...students]);
      setChildName("");
      alert(`${childName} 签到成功！`);
    } else {
      alert("签到失败：" + error?.message);
    }
  }

  async function handleCheckOut() {
    if (!childName) {
      alert("请输入孩子姓名");
      return;
    }

    const existing = students.find(
      (s) => s.child_name === childName && s.class === selectedClass && s.date === today && !s.checked_out_at
    );

    if (!existing) {
      alert(`找不到 ${childName}（${selectedClass}）的签到记录`);
      return;
    }

    if (!confirm(`确定让 ${childName}（${selectedClass}）签出吗？`)) return;

    const { error } = await supabase
      .from("sunday_school")
      .update({
        checked_out_at: new Date().toISOString(),
        checked_out_by: username,
      })
      .eq("child_name", childName)
      .eq("class", selectedClass)
      .eq("date", today);

    if (!error) {
      setStudents(
        students.map((s) =>
          s.child_name === childName && s.class === selectedClass && s.date === today
            ? { ...s, checked_out_at: new Date().toISOString(), checked_out_by: username }
            : s
        )
      );
      setChildName("");
      alert(`${childName} 签出成功！`);
    } else {
      alert("签出失败：" + error.message);
    }
  }

  async function handleSearch() {
    if (!searchName) {
      alert("请输入孩子姓名");
      return;
    }

    setSearching(true);

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    const { data, error } = await supabase
      .from("sunday_school")
      .select("*")
      .eq("child_name", searchName)
      .gte("date", threeMonthsAgo.toISOString().split("T")[0])
      .order("date", { ascending: false });

    if (!error && data) {
      setSearchResults(data);
    } else {
      alert("查询失败：" + error?.message);
    }

    setSearching(false);
  }

  function formatTime(isoStr: string) {
    const date = new Date(isoStr);
    return date.toLocaleTimeString("zh-TW", {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }

  const filteredStudents = students.filter((s) => s.class === filterClass);

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#9333ea" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* 顶部标题 */}
      <View style={{ backgroundColor: "#9333ea", padding: 24, paddingTop: 48 }}>
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
          <Text style={{ color: "#e9d5ff", fontSize: 14 }}>← 返回</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "white" }}>
          主日学班级签到
        </Text>
        <Text style={{ fontSize: 14, color: "#e9d5ff", marginTop: 4 }}>
          小小班 · 小班 · 中班 · {today}
        </Text>
      </View>

      {/* 标签切换 */}
      <View style={{ flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
        {[
          { key: "checkin", label: "签到" },
          { key: "checkout", label: "签出" },
          ...(can(userRole, "view_sunday_school_records") ? [{ key: "view", label: "今日记录" }] : []),
          ...(can(userRole, "search_sunday_school") ? [{ key: "search", label: "查询出勤" }] : []),
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={{
              flex: 1,
              padding: 12,
              alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.key ? "#9333ea" : "transparent",
            }}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text style={{
              fontSize: 12,
              fontWeight: activeTab === tab.key ? "bold" : "normal",
              color: activeTab === tab.key ? "#9333ea" : "#6b7280",
            }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ padding: 16 }}>
        {/* 签到页面 */}
        {activeTab === "checkin" && (
          <View>
            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>孩子姓名</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, backgroundColor: "white" }}
              placeholder="输入孩子姓名"
              value={childName}
              onChangeText={setChildName}
            />

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>班级</Text>
            <View style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, marginBottom: 24, backgroundColor: "white" }}>
              <Picker selectedValue={selectedClass} onValueChange={(value) => setSelectedClass(value)}>
                <Picker.Item label="小小班" value="小小班" />
                <Picker.Item label="小班" value="小班" />
                <Picker.Item label="中班" value="中班" />
              </Picker>
            </View>

            <TouchableOpacity
              style={{ backgroundColor: "#9333ea", padding: 14, borderRadius: 8, alignItems: "center" }}
              onPress={handleCheckIn}
            >
              <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>确认签到</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 签出页面 */}
        {activeTab === "checkout" && (
          <View>
            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>孩子姓名</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16, backgroundColor: "white" }}
              placeholder="输入孩子姓名"
              value={childName}
              onChangeText={setChildName}
            />

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>班级</Text>
            <View style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, marginBottom: 24, backgroundColor: "white" }}>
              <Picker selectedValue={selectedClass} onValueChange={(value) => setSelectedClass(value)}>
                <Picker.Item label="小小班" value="小小班" />
                <Picker.Item label="小班" value="小班" />
                <Picker.Item label="中班" value="中班" />
              </Picker>
            </View>

            <TouchableOpacity
              style={{ backgroundColor: "#ea580c", padding: 14, borderRadius: 8, alignItems: "center" }}
              onPress={handleCheckOut}
            >
              <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>确认签出</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 今日记录 */}
        {activeTab === "view" && (
          <View>
            {/* 班级筛选 */}
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              {["小小班", "小班", "中班"].map((cls) => (
                <TouchableOpacity
                  key={cls}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: filterClass === cls ? "#9333ea" : "white",
                    borderWidth: 1,
                    borderColor: filterClass === cls ? "#9333ea" : "#d1d5db",
                  }}
                  onPress={() => setFilterClass(cls)}
                >
                  <Text style={{
                    fontSize: 13,
                    color: filterClass === cls ? "white" : "#6b7280",
                    fontWeight: filterClass === cls ? "bold" : "normal",
                  }}>
                    {cls}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 人数统计 */}
            <View style={{ backgroundColor: "#f3e8ff", borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <Text style={{ fontSize: 13, color: "#9333ea", fontWeight: "bold" }}>
                {filterClass} 今日签到：{filteredStudents.length} 人
                （已签出：{filteredStudents.filter((s) => s.checked_out_at).length} 人）
              </Text>
            </View>

            {filteredStudents.length === 0 ? (
              <Text style={{ color: "#6b7280", textAlign: "center", marginTop: 40 }}>
                今天还没有签到记录
              </Text>
            ) : (
              filteredStudents.map((student) => (
                <View
                  key={student.id}
                  style={{
                    backgroundColor: "white",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 10,
                    borderLeftWidth: 4,
                    borderLeftColor: student.checked_out_at ? "#6b7280" : "#9333ea",
                  }}
                >
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 16, fontWeight: "bold", color: "#111827" }}>
                      {student.child_name}
                    </Text>
                    <View style={{
                      backgroundColor: student.class === "小小班" ? "#fef3c7" : student.class === "小班" ? "#dbeafe" : "#ede9fe",
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 12,
                    }}>
                      <Text style={{ fontSize: 12, color: "#374151" }}>{student.class}</Text>
                    </View>
                  </View>

                  <Text style={{ fontSize: 12, color: "#16a34a", marginTop: 6 }}>
                    ✅ 签到：{formatTime(student.checked_in_at)} （{student.checked_in_by}）
                  </Text>

                  {student.checked_out_at ? (
                    <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      🚪 签出：{formatTime(student.checked_out_at)} （{student.checked_out_by}）
                    </Text>
                  ) : (
                    <Text style={{ fontSize: 12, color: "#ea580c", marginTop: 2 }}>
                      🟡 尚未签出
                    </Text>
                  )}
                </View>
              ))
            )}
          </View>
        )}

        {/* 查询出勤 */}
        {activeTab === "search" && (
          <View>
            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>输入孩子姓名</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
              <TextInput
                style={{ flex: 1, borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16, backgroundColor: "white" }}
                placeholder="孩子姓名"
                value={searchName}
                onChangeText={setSearchName}
              />
              <TouchableOpacity
                style={{ backgroundColor: "#9333ea", padding: 12, borderRadius: 8, alignItems: "center", justifyContent: "center" }}
                onPress={handleSearch}
                disabled={searching}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  {searching ? "查询中" : "查询"}
                </Text>
              </TouchableOpacity>
            </View>

            {searchResults.length > 0 && (
              <View>
                <Text style={{ fontSize: 14, fontWeight: "bold", color: "#374151", marginBottom: 12 }}>
                  {searchName} 最近三个月出勤记录（{searchResults.length} 次）
                </Text>
                {searchResults.map((record) => (
                  <View
                    key={record.id}
                    style={{
                      backgroundColor: "white",
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 10,
                      borderLeftWidth: 4,
                      borderLeftColor: record.checked_out_at ? "#6b7280" : "#9333ea",
                    }}
                  >
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={{ fontSize: 14, fontWeight: "bold", color: "#111827" }}>
                        {formatDate(record.date)}
                      </Text>
                      <View style={{
                        backgroundColor: record.class === "小小班" ? "#fef3c7" : record.class === "小班" ? "#dbeafe" : "#ede9fe",
                        paddingHorizontal: 8,
                        paddingVertical: 2,
                        borderRadius: 12,
                      }}>
                        <Text style={{ fontSize: 12, color: "#374151" }}>{record.class}</Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 12, color: "#16a34a", marginTop: 6 }}>
                      ✅ 签到：{formatTime(record.checked_in_at)}
                    </Text>
                    {record.checked_out_at ? (
                      <Text style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                        🚪 签出：{formatTime(record.checked_out_at)}
                      </Text>
                    ) : (
                      <Text style={{ fontSize: 12, color: "#ea580c", marginTop: 2 }}>
                        🟡 未签出
                      </Text>
                    )}
                  </View>
                ))}
              </View>
            )}

            {searchResults.length === 0 && searchName && !searching && (
              <Text style={{ color: "#6b7280", textAlign: "center", marginTop: 40 }}>
                没有找到 {searchName} 的出勤记录
              </Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}