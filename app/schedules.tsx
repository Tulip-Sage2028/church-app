import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { can } from "../lib/permissions";
import { supabase } from "../lib/supabase";

type Schedule = {
  id: number;
  title: string;
  description: string;
  date: string;
  time: string;
};

export default function Schedules({ onBack, userRole }: { onBack: () => void; userRole: string }) {  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState("");

  // 新增/修改表单
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newTime, setNewTime] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSchedules();
  }, []);

  async function fetchSchedules() {
    const now = new Date();
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    const { data } = await supabase
      .from("Daily Schedule")
      .select("*")
      .gte("date", now.toISOString().split("T")[0])
      .lte("date", threeMonthsLater.toISOString().split("T")[0])
      .order("date", { ascending: true });

    if (data) setSchedules(data);
    setLoading(false);
  }

  function getSchedulesForDate(dateStr: string) {
    return schedules.filter((s) => s.date === dateStr);
  }

  function hasSchedule(dateStr: string) {
    return schedules.some((s) => s.date === dateStr);
  }

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

  function formatTime(timeStr: string) {
    return timeStr.substring(0, 5);
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

  function clearForm() {
    setEditingId(null);
    setNewTitle("");
    setNewDescription("");
    setNewTime("");
  }

  function startEdit(item: Schedule) {
    setEditingId(item.id);
    setNewTitle(item.title);
    setNewDescription(item.description || "");
    setNewTime(item.time.substring(0, 5));
  }

  async function handleSave() {
    if (!newTitle || !newTime) {
      alert("请填写标题和时间");
      return;
    }

    setSaving(true);

    if (editingId) {
      // 修改
      const { error } = await supabase
        .from("Daily Schedule")
        .update({
          title: newTitle,
          description: newDescription,
          time: newTime + ":00",
        })
        .eq("id", editingId);

      if (!error) {
        setSchedules(schedules.map((s) =>
          s.id === editingId
            ? { ...s, title: newTitle, description: newDescription, time: newTime + ":00" }
            : s
        ));
        alert("修改成功！");
        clearForm();
      } else {
        alert("修改失败：" + error.message);
      }
    } else {
      // 新增
      const { data, error } = await supabase
        .from("Daily Schedule")
        .insert({
          title: newTitle,
          description: newDescription,
          date: selectedDate,
          time: newTime + ":00",
        })
        .select()
        .single();

      if (!error && data) {
        setSchedules([...schedules, data]);
        alert("新增成功！");
        clearForm();
      } else {
        alert("新增失败：" + error?.message);
      }
    }

    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm("确定删除这个安排吗？")) return;

    const { error } = await supabase
      .from("Daily Schedule")
      .delete()
      .eq("id", id);

    if (!error) {
      setSchedules(schedules.filter((s) => s.id !== id));
      clearForm();
    } else {
      alert("删除失败：" + error.message);
    }
  }

  const { firstDay, daysInMonth, year, month } = getDaysInMonth(currentMonth);
  const today = new Date().toISOString().split("T")[0];
  const selectedSchedules = selectedDate ? getSchedulesForDate(selectedDate) : [];

  const maxMonth = new Date();
  maxMonth.setMonth(maxMonth.getMonth() + 2);
  const minMonth = new Date();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ backgroundColor: "#2563eb", padding: 24, paddingTop: 48 }}>
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
          <Text style={{ color: "#bfdbfe", fontSize: 18, fontWeight: "bold" }}>← 返回</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "white" }}>
          聚会日程安排
        </Text>
        <Text style={{ fontSize: 14, color: "#bfdbfe", marginTop: 4 }}>
          点击日期查看或新增安排
        </Text>
      </View>

      <View style={{ padding: 16 }}>
        {/* 月份切换 */}
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <TouchableOpacity
            style={{ padding: 8 }}
            onPress={() => {
              const prev = new Date(currentMonth);
              prev.setMonth(prev.getMonth() - 1);
              if (prev.getFullYear() > minMonth.getFullYear() ||
                (prev.getFullYear() === minMonth.getFullYear() && prev.getMonth() >= minMonth.getMonth())) {
                setCurrentMonth(prev);
              }
            }}
          >
            <Text style={{ fontSize: 20, color: "#2563eb" }}>‹</Text>
          </TouchableOpacity>

          <Text style={{ fontSize: 16, fontWeight: "bold", color: "#111827" }}>
            {currentMonth.toLocaleDateString("zh-TW", { year: "numeric", month: "long" })}
          </Text>

          <TouchableOpacity
            style={{ padding: 8 }}
            onPress={() => {
              const next = new Date(currentMonth);
              next.setMonth(next.getMonth() + 1);
              if (next.getFullYear() < maxMonth.getFullYear() ||
                (next.getFullYear() === maxMonth.getFullYear() && next.getMonth() <= maxMonth.getMonth())) {
                setCurrentMonth(next);
              }
            }}
          >
            <Text style={{ fontSize: 20, color: "#2563eb" }}>›</Text>
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
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
          {Array.from({ length: firstDay }).map((_, i) => (
            <View key={`empty-${i}`} style={{ width: `${100 / 7}%`, height: 36 }} />
          ))}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = formatDateStr(year, month, day);
            const hasEvent = hasSchedule(dateStr);
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === today;

            return (
              <TouchableOpacity
                key={day}
                style={{
                  width: `${100 / 7}%`,
                  height: 36,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isSelected ? "#2563eb" : "transparent",
                  borderRadius: 18,
                }}
                onPress={() => {
                  setSelectedDate(dateStr);
                  clearForm();
                }}
              >
                <Text style={{
                  fontSize: 14,
                  fontWeight: isToday ? "bold" : "normal",
                  color: isSelected ? "white" : isToday ? "#2563eb" : "#111827",
                }}>
                  {day}
                </Text>
                {hasEvent && (
                  <View style={{
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: isSelected ? "white" : "#16a34a",
                    marginTop: 1,
                  }} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 图例 */}
        <View style={{ flexDirection: "row", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#16a34a" }} />
            <Text style={{ fontSize: 12, color: "#6b7280" }}>有聚会安排</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
            <Text style={{ fontSize: 12, color: "#2563eb", fontWeight: "bold" }}>{new Date().getDate()}
            </Text>
            <Text style={{ fontSize: 12, color: "#6b7280" }}>当前日期</Text>
          </View>
        </View>

        {/* 选中日期 */}
        {selectedDate && (
          <View>
            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#374151", marginBottom: 12 }}>
              {formatDisplayDate(selectedDate)}
            </Text>

            {/* 现有安排 */}
            {selectedSchedules.map((item) => (
              <View
                key={item.id}
                style={{
                  backgroundColor: "white",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 10,
                  borderLeftWidth: 4,
                  borderLeftColor: editingId === item.id ? "#f59e0b" : "#2563eb",
                }}
              >
                <Text style={{ fontSize: 16, fontWeight: "bold", color: "#111827" }}>
                  {item.title}
                </Text>
                {item.description ? (
                  <Text style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
                    {item.description}
                  </Text>
                ) : null}
                <Text style={{ fontSize: 13, color: "#2563eb", marginTop: 6 }}>
                  🕐 {formatTime(item.time)}
                </Text>

                {/* 修改/删除按钮 */}
                {can(userRole, "manage_schedules") && (
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: "#f3f4f6", padding: 8, borderRadius: 6, alignItems: "center" }}
                        onPress={() => startEdit(item)}
                      >
                        <Text style={{ fontSize: 13, color: "#374151" }}>✏️ 修改</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ flex: 1, backgroundColor: "#fee2e2", padding: 8, borderRadius: 6, alignItems: "center" }}
                        onPress={() => handleDelete(item.id)}
                      >
                        <Text style={{ fontSize: 13, color: "#ef4444" }}>🗑 删除</Text>
                      </TouchableOpacity>
                    </View>
                  )}
              </View>
            ))}

            {/* 新增/修改表单 */}
            {can(userRole, "manage_schedules") && (
              <View style={{
                backgroundColor: "white",
                borderRadius: 12,
                padding: 16,
                marginBottom: 20,
                borderWidth: 1,
                borderColor: editingId ? "#f59e0b" : "#e5e7eb",
                borderStyle: "dashed",
              }}>
                <Text style={{ fontSize: 14, fontWeight: "bold", color: "#374151", marginBottom: 12 }}>
                  {editingId ? "✏️ 修改安排" : "＋ 新增安排"}
                </Text>

                <Text style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>标题</Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 14,
                    marginBottom: 10,
                    backgroundColor: "#f9fafb",
                  }}
                  placeholder="聚会名称"
                  value={newTitle}
                  onChangeText={setNewTitle}
                />

                <Text style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>说明（选填）</Text>
                <TextInput
                  style={{
                    borderWidth: 1,
                    borderColor: "#e5e7eb",
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 14,
                    marginBottom: 10,
                    backgroundColor: "#f9fafb",
                  }}
                  placeholder="聚会说明"
                  value={newDescription}
                  onChangeText={setNewDescription}
                />

                <Text style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>时间</Text>
                <input
                  type="time"
                  value={newTime}
                  onChange={(e) => setNewTime(e.target.value)}
                  style={{
                    width: "100%",
                    border: "1px solid #e5e7eb",
                    borderRadius: 8,
                    padding: 10,
                    fontSize: 14,
                    marginBottom: 16,
                    backgroundColor: "#f9fafb",
                    boxSizing: "border-box",
                  }}
                />

                <View style={{ flexDirection: "row", gap: 8 }}>
                  {editingId && (
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        backgroundColor: "#f3f4f6",
                        padding: 10,
                        borderRadius: 8,
                        alignItems: "center",
                      }}
                      onPress={clearForm}
                    >
                      <Text style={{ color: "#6b7280", fontWeight: "bold" }}>取消</Text>
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={{
                      flex: 2,
                      backgroundColor: editingId ? "#f59e0b" : "#2563eb",
                      padding: 10,
                      borderRadius: 8,
                      alignItems: "center",
                    }}
                    onPress={handleSave}
                    disabled={saving}
                  >
                    <Text style={{ color: "white", fontWeight: "bold" }}>
                      {saving ? "保存中..." : editingId ? "保存修改" : "新增"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}