import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from "react-native";
import { can } from "../lib/permissions";
import { supabase } from "../lib/supabase";

type Devotional = {
  id: number;
  date: string;
  content: string;
  pastor_notes: string;
  created_by: string;
};

type Checkin = {
  id: number;
  date: string;
  user_id: string;
  username: string;
  checked_at: string;
};

export default function Devotionals({ onBack, userRole }: { onBack: () => void; userRole: string }) {
  const [devotionals, setDevotionals] = useState<Devotional[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [userId, setUserId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTab, setActiveTab] = useState<"view" | "manage">("view");

  // 管理员表单
  const [newDate, setNewDate] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newPastorNotes, setNewPastorNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("user_id", user.id)
        .single();
      if (profile) setUsername(profile.username);
    }

    // 最近半年
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: devData } = await supabase
      .from("devotionals")
      .select("*")
      .gte("date", sixMonthsAgo.toISOString().split("T")[0])
      .order("date", { ascending: false });

    if (devData) setDevotionals(devData);

    // 取得用户打卡记录
    if (user) {
      const { data: checkinData } = await supabase
        .from("devotional_checkins")
        .select("*")
        .eq("user_id", user.id)
        .gte("date", sixMonthsAgo.toISOString().split("T")[0]);

      if (checkinData) setCheckins(checkinData);
    }

    setLoading(false);
  }

  // 取得某天的读经内容
  function getDevotional(dateStr: string) {
    return devotionals.find((d) => d.date === dateStr);
  }

  // 取得某天的打卡记录
  function getCheckin(dateStr: string) {
    return checkins.find((c) => c.date === dateStr);
  }

  async function handleCheckin(dateStr: string) {
    if (!userId) return;

    const existing = getCheckin(dateStr);
    if (existing) {
      alert("你今天已经打卡了！");
      return;
    }

    const { data, error } = await supabase
      .from("devotional_checkins")
      .insert({
        date: dateStr,
        user_id: userId,
        username: username,
        checked_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (!error && data) {
      setCheckins([...checkins, data]);
      alert("打卡成功！🎉");
    } else {
      alert("打卡失败：" + error?.message);
    }
  }

  async function handleSaveDevotional() {
    if (!newDate || !newContent) {
      alert("请填写日期和读经内容");
      return;
    }

    setSaving(true);

    const existing = getDevotional(newDate);

    if (existing) {
      // 更新
      const { error } = await supabase
        .from("devotionals")
        .update({
          content: newContent,
          pastor_notes: newPastorNotes,
          created_by: username,
        })
        .eq("date", newDate);

      if (!error) {
        setDevotionals(devotionals.map((d) =>
          d.date === newDate
            ? { ...d, content: newContent, pastor_notes: newPastorNotes }
            : d
        ));
        alert("读经内容更新成功！");
      }
    } else {
      // 新建
      const { data, error } = await supabase
        .from("devotionals")
        .insert({
          date: newDate,
          content: newContent,
          pastor_notes: newPastorNotes,
          created_by: username,
        })
        .select()
        .single();

      if (!error && data) {
        setDevotionals([data, ...devotionals]);
        alert("读经内容发布成功！");
      } else {
        alert("发布失败：" + error?.message);
      }
    }

    setSaving(false);
    setNewDate("");
    setNewContent("");
    setNewPastorNotes("");
  }

  // 产生当月所有日期
  function getDaysInMonth(date: Date) {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return { firstDay, daysInMonth, year, month };
  }

  function formatDateStr(year: number, month: number, day: number) {
    return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  }

  function formatDisplayDate(dateStr: string) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    });
  }

  const { firstDay, daysInMonth, year, month } = getDaysInMonth(currentMonth);
  const selectedDevotional = selectedDate ? getDevotional(selectedDate) : null;
  const selectedCheckin = selectedDate ? getCheckin(selectedDate) : null;

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* 顶部标题 */}
      <View style={{ backgroundColor: "#16a34a", padding: 24, paddingTop: 48 }}>
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
          <Text style={{ color: "#bbf7d0", fontSize: 14 }}>← 返回</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "white" }}>
          每日读经
        </Text>
        <Text style={{ fontSize: 14, color: "#bbf7d0", marginTop: 4 }}>
          点击日期查看读经内容
        </Text>
      </View>

      {/* 标签切换 */}
      <View style={{ flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
        {[
          { key: "view", label: "读经日历" },
          ...(can(userRole, "manage_devotionals") ? [{ key: "manage", label: "管理" }] : []),
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={{
              flex: 1,
              padding: 14,
              alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.key ? "#16a34a" : "transparent",
            }}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text style={{
              fontSize: 14,
              fontWeight: activeTab === tab.key ? "bold" : "normal",
              color: activeTab === tab.key ? "#16a34a" : "#6b7280",
            }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ padding: 16 }}>
        {activeTab === "view" && (
          <View>
            {/* 月份切换 */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <TouchableOpacity
                style={{ padding: 8 }}
                onPress={() => {
                  const prev = new Date(currentMonth);
                  prev.setMonth(prev.getMonth() - 1);
                  const sixMonthsAgo = new Date();
                  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
                  if (prev >= sixMonthsAgo) {
                    setCurrentMonth(prev);
                  }
                }}
              >
                <Text style={{ fontSize: 20, color: "#16a34a" }}>‹</Text>
              </TouchableOpacity>

              <Text style={{ fontSize: 16, fontWeight: "bold", color: "#111827" }}>
                {currentMonth.toLocaleDateString("zh-TW", { year: "numeric", month: "long" })}
              </Text>

              <TouchableOpacity
                style={{ padding: 8 }}
                onPress={() => {
                  const next = new Date(currentMonth);
                  next.setMonth(next.getMonth() + 1);
                  const now = new Date();
                  if (next.getFullYear() < now.getFullYear() || 
                     (next.getFullYear() === now.getFullYear() && next.getMonth() <= now.getMonth())) {
                    setCurrentMonth(next);
                  }
                }}
              >
                <Text style={{ fontSize: 20, color: "#16a34a" }}>›</Text>
              </TouchableOpacity>
            </View>

            {/* 星期标题 */}
            <View style={{ flexDirection: "row", marginBottom: 8 }}>
              {["日", "一", "二", "三", "四", "五", "六"].map((day) => (
                <View key={day} style={{ flex: 1, alignItems: "center" }}>
                  <Text style={{ fontSize: 12, color: "#6b7280", fontWeight: "bold" }}>{day}</Text>
                </View>
              ))}
            </View>

            {/* 日历格子 */}
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {/* 空白格子 */}
              {Array.from({ length: firstDay }).map((_, i) => (
                <View key={`empty-${i}`} style={{ width: `${100 / 7}%`, height: 36 }} />
              ))}

              {/* 日期格子 */}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dateStr = formatDateStr(year, month, day);
                const hasDevotional = !!getDevotional(dateStr);
                const hasCheckin = !!getCheckin(dateStr);
                const isSelected = selectedDate === dateStr;
                const isToday = dateStr === new Date().toISOString().split("T")[0];

                return (
                  <TouchableOpacity
                    key={day}
                    style={{
                      width: `${100 / 7}%`,
                      height: 36,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isSelected ? "#16a34a" : "transparent",
                      borderRadius: 18,
                    }}
                    onPress={() => setSelectedDate(dateStr)}
                  >
                    <Text style={{
                      fontSize: 14,
                      fontWeight: isToday ? "bold" : "normal",
                      color: isSelected ? "white" : isToday ? "#16a34a" : "#111827",
                    }}>
                      {day}
                    </Text>
                    {/* 圆点指示器 */}
                    {hasDevotional && (
                      <View style={{
                        width: 6,
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: hasCheckin ? "#16a34a" : "#d1d5db",
                        marginTop: 2,
                      }} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 图例 */}
            <View style={{ flexDirection: "row", gap: 16, marginTop: 12, marginBottom: 20 }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a" }} />
                <Text style={{ fontSize: 12, color: "#6b7280" }}>已打卡</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#d1d5db" }} />
                <Text style={{ fontSize: 12, color: "#6b7280" }}>未打卡</Text>
              </View>
            </View>

            {/* 选中日期的读经内容 */}
            {selectedDate && (
              <View>
                <Text style={{ fontSize: 16, fontWeight: "bold", color: "#374151", marginBottom: 12 }}>
                  {formatDisplayDate(selectedDate)}
                </Text>

                {selectedDevotional ? (
                  <View>
                    {can(userRole, "manage_devotionals") && (
                      <TouchableOpacity
                        style={{
                          backgroundColor: "#f0fdf4",
                          padding: 10,
                          borderRadius: 8,
                          alignItems: "center",
                          marginBottom: 12,
                        }}
                        onPress={() => {
                          setNewDate(selectedDate);
                          setNewContent(selectedDevotional.content);
                          setNewPastorNotes(selectedDevotional.pastor_notes || "");
                          setActiveTab("manage");
                        }}
                      >
                        <Text style={{ color: "#16a34a", fontWeight: "bold" }}>✏️ 编辑这天的读经内容</Text>
                      </TouchableOpacity>
                    )}
                    {/* 读经内容 */}
                    <View style={{
                      backgroundColor: "white",
                      borderRadius: 12,
                      padding: 16,
                      marginBottom: 12,
                      borderLeftWidth: 4,
                      borderLeftColor: "#16a34a",
                    }}>
                      <Text style={{ fontSize: 14, fontWeight: "bold", color: "#374151", marginBottom: 8 }}>
                        读经内容
                      </Text>
                      <Text style={{ fontSize: 14, color: "#374151", lineHeight: 24 }}>
                        {selectedDevotional.content}
                      </Text>
                    </View>

                    {/* 牧师解析 */}
                    {selectedDevotional.pastor_notes ? (
                      <View style={{
                        backgroundColor: "#f0fdf4",
                        borderRadius: 12,
                        padding: 16,
                        marginBottom: 12,
                        borderLeftWidth: 4,
                        borderLeftColor: "#86efac",
                      }}>
                        <Text style={{ fontSize: 14, fontWeight: "bold", color: "#374151", marginBottom: 8 }}>
                          牧师解析
                        </Text>
                        <Text style={{ fontSize: 14, color: "#374151", lineHeight: 24 }}>
                          {selectedDevotional.pastor_notes}
                        </Text>
                      </View>
                    ) : null}

                    {/* 打卡按钮 */}
                    {selectedCheckin ? (
                      <View style={{
                        backgroundColor: "#f0fdf4",
                        padding: 14,
                        borderRadius: 8,
                        alignItems: "center",
                      }}>
                        <Text style={{ color: "#16a34a", fontSize: 16, fontWeight: "bold" }}>
                          ✅ 已打卡
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={{
                          backgroundColor: "#16a34a",
                          padding: 14,
                          borderRadius: 8,
                          alignItems: "center",
                        }}
                        onPress={() => handleCheckin(selectedDate)}
                      >
                        <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
                          打卡 🙏
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ) : (
                  <View style={{
                    backgroundColor: "#f3f4f6",
                    borderRadius: 12,
                    padding: 20,
                    alignItems: "center",
                  }}>
                    <Text style={{ color: "#6b7280" }}>这天没有读经内容</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* 管理页面 */}
        {activeTab === "manage" && (
          <View>
            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#374151", marginBottom: 16 }}>
              发布读经内容
            </Text>

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>日期</Text>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              style={{
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                marginBottom: 16,
                backgroundColor: "white",
                boxSizing: "border-box",
              }}
            />

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>读经内容</Text>
            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="今天的读经内容..."
              style={{
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                marginBottom: 16,
                backgroundColor: "white",
                boxSizing: "border-box",
                height: 120,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>牧师解析</Text>
            <textarea
              value={newPastorNotes}
              onChange={(e) => setNewPastorNotes(e.target.value)}
              placeholder="牧师的解析和反思..."
              style={{
                width: "100%",
                border: "1px solid #ccc",
                borderRadius: 8,
                padding: 12,
                fontSize: 16,
                marginBottom: 24,
                backgroundColor: "white",
                boxSizing: "border-box",
                height: 160,
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />

            <TouchableOpacity
              style={{
                backgroundColor: "#16a34a",
                padding: 14,
                borderRadius: 8,
                alignItems: "center",
              }}
              onPress={handleSaveDevotional}
              disabled={saving}
            >
              <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
                {saving ? "保存中..." : "发布读经内容"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}