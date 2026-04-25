import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { can } from "../lib/permissions";
import { supabase } from "../lib/supabase";

type Event = {
  id: number;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  type: string;
  max_participants: number | null;
};

type Attendance = {
  id: number;
  event_id: number;
  user_id: string;
  username: string;
  checked_in_at: string;
  people_count: number;
  name: string;
  phone: string;
};

type AttendanceRecord = {
  username: string;
  people_count: number;
  checked_in_at: string;
  name: string;
  phone: string;
};

export default function Events({ onBack, userRole, userId }: { onBack: () => void; userRole: string; userId: string | null }) {
  const [events, setEvents] = useState<Event[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [totalCheckins, setTotalCheckins] = useState<{ [key: number]: number }>({});
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState("");
  const [activeTab, setActiveTab] = useState<"attendance" | "volunteer">("attendance");
  const [editingCount, setEditingCount] = useState<{ [key: number]: string }>({});
  const [checkInCount, setCheckInCount] = useState<{ [key: number]: string }>({});
  const [checkInName, setCheckInName] = useState<{ [key: number]: string }>({});
  const [checkInPhone, setCheckInPhone] = useState<{ [key: number]: string }>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewingEventId, setViewingEventId] = useState<number | null>(null);
  const [attendanceList, setAttendanceList] = useState<{ [key: number]: AttendanceRecord[] }>({});

  const isGuest = userId === null;

  // 新增/修改活动表单
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newTime, setNewTime] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newType, setNewType] = useState("attendance");
  const [newMaxParticipants, setNewMaxParticipants] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    if (!isGuest) {
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

    const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    const twoMonthsLater = new Date();
    twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2);
    twoMonthsLater.setDate(1);
    twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 1);
    twoMonthsLater.setDate(0);
    const twoMonthsLaterStr = twoMonthsLater.toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });

    const { data: eventsData } = await supabase
      .from("events")
      .select("*")
      .gte("date", todayStr)
      .lte("date", twoMonthsLaterStr)
      .order("date", { ascending: true });

    if (eventsData) {
      setEvents(eventsData);
      await fetchAllTotals(eventsData.map((e) => e.id));
    }

    if (!isGuest && userId) {
      const { data: attendanceData } = await supabase
        .from("attendance")
        .select("*")
        .eq("user_id", userId);
      if (attendanceData) setAttendance(attendanceData);
    }

    setLoading(false);
  }

  async function fetchAllTotals(eventIds: number[]) {
    if (eventIds.length === 0) return;
    const { data } = await supabase
      .from("attendance")
      .select("event_id, people_count")
      .in("event_id", eventIds);

    if (data) {
      const totals: { [key: number]: number } = {};
      data.forEach((row) => {
        totals[row.event_id] = (totals[row.event_id] || 0) + (row.people_count || 1);
      });
      setTotalCheckins(totals);
    }
  }

  async function refreshTotal(eventId: number) {
    const { data } = await supabase
      .from("attendance")
      .select("people_count")
      .eq("event_id", eventId);

    if (data) {
      const sum = data.reduce((acc, row) => acc + (row.people_count || 1), 0);
      setTotalCheckins((prev) => ({ ...prev, [eventId]: sum }));
    }
  }

  async function fetchAttendanceList(eventId: number) {
    const { data } = await supabase
      .from("attendance")
      .select("username, people_count, checked_in_at, name, phone")
      .eq("event_id", eventId)
      .order("checked_in_at", { ascending: true });

    if (data) {
      setAttendanceList((prev) => ({ ...prev, [eventId]: data }));
    }
  }

  function getAttendanceRecord(eventId: number) {
    return attendance.find((a) => a.event_id === eventId);
  }

  async function handleCheckIn(eventId: number, eventTitle: string, maxParticipants: number | null) {
    const name = checkInName[eventId]?.trim();
    const phone = checkInPhone[eventId]?.trim();
    const count = parseInt(checkInCount[eventId] || "1") || 1;

    if (!name) {
      alert("请填写姓名");
      return;
    }
    if (!phone) {
      alert("请填写电话");
      return;
    }

    // 检查人数上限
    if (maxParticipants !== null) {
      const current = totalCheckins[eventId] || 0;
      if (current + count > maxParticipants) {
        alert(`报名人数已满！上限 ${maxParticipants} 人，目前已有 ${current} 人。`);
        return;
      }
    }

    const { data, error } = await supabase
      .from("attendance")
      .insert({
        event_id: eventId,
        event_title: eventTitle,
        user_id: userId || "guest",
        username: username || name,
        name: name,
        phone: phone,
        checked_in_at: new Date().toISOString(),
        people_count: count,
      })
      .select()
      .single();

    if (!error && data) {
      if (!isGuest) {
        setAttendance([...attendance, data]);
      }
      setCheckInCount((prev) => ({ ...prev, [eventId]: "1" }));
      setCheckInName((prev) => ({ ...prev, [eventId]: "" }));
      setCheckInPhone((prev) => ({ ...prev, [eventId]: "" }));
      await refreshTotal(eventId);
      if (viewingEventId === eventId) await fetchAttendanceList(eventId);
      alert("报名成功！");
    } else {
      alert("报名失败：" + error?.message);
    }
  }

  async function handleUpdateCheckin(eventId: number) {
    if (!userId) return;

    const newCount = parseInt(editingCount[eventId] || "1") || 1;
    const event = events.find((e) => e.id === eventId);
    const record = getAttendanceRecord(eventId);

    if (event?.max_participants !== null && event?.max_participants !== undefined) {
      const current = (totalCheckins[eventId] || 0) - (record?.people_count || 1);
      if (current + newCount > event.max_participants) {
        alert(`修改后超过人数上限 ${event.max_participants} 人！`);
        return;
      }
    }

    const { error } = await supabase
      .from("attendance")
      .update({ people_count: newCount })
      .eq("event_id", eventId)
      .eq("user_id", userId);

    if (!error) {
      setAttendance(attendance.map((a) =>
        a.event_id === eventId ? { ...a, people_count: newCount } : a
      ));
      setEditingCount((prev) => ({ ...prev, [eventId]: "" }));
      await refreshTotal(eventId);
      if (viewingEventId === eventId) await fetchAttendanceList(eventId);
      alert("修改成功！");
    } else {
      alert("修改失败：" + error.message);
    }
  }

  async function handleCancelCheckIn(eventId: number) {
    if (!userId) return;
    if (!confirm("确定取消报名吗？")) return;

    const { error } = await supabase
      .from("attendance")
      .delete()
      .eq("event_id", eventId)
      .eq("user_id", userId);

    if (!error) {
      setAttendance(attendance.filter((a) => a.event_id !== eventId));
      await refreshTotal(eventId);
      if (viewingEventId === eventId) await fetchAttendanceList(eventId);
    } else {
      alert("取消失败：" + error.message);
    }
  }

  function clearForm() {
    setEditingEventId(null);
    setNewTitle("");
    setNewDescription("");
    setNewDate("");
    setNewTime("");
    setNewLocation("");
    setNewType(activeTab);
    setNewMaxParticipants("");
  }

  function startEditEvent(event: Event) {
    setEditingEventId(event.id);
    setNewTitle(event.title);
    setNewDescription(event.description || "");
    setNewDate(event.date);
    setNewTime(event.time.substring(0, 5));
    setNewLocation(event.location || "");
    setNewType(event.type || "attendance");
    setNewMaxParticipants(event.max_participants ? String(event.max_participants) : "");
    setShowAddForm(true);
  }

  async function handleSaveEvent() {
    if (!newTitle || !newDate || !newTime) {
      alert("请填写标题、日期和时间");
      return;
    }

    setSaving(true);

    const eventData = {
      title: newTitle,
      description: newDescription,
      date: newDate,
      time: newTime + ":00",
      location: newLocation,
      type: newType,
      max_participants: newMaxParticipants ? parseInt(newMaxParticipants) : null,
    };

    if (editingEventId) {
      const { error } = await supabase
        .from("events")
        .update(eventData)
        .eq("id", editingEventId);

      if (!error) {
        setEvents(events.map((e) => e.id === editingEventId ? { ...e, ...eventData } : e));
        alert("修改成功！");
        clearForm();
        setShowAddForm(false);
      } else {
        alert("修改失败：" + error.message);
      }
    } else {
      const { data, error } = await supabase
        .from("events")
        .insert(eventData)
        .select()
        .single();

      if (!error && data) {
        setEvents([...events, data].sort((a, b) => a.date.localeCompare(b.date)));
        alert("新增成功！");
        clearForm();
        setShowAddForm(false);
      } else {
        alert("新增失败：" + error?.message);
      }
    }

    setSaving(false);
  }

  async function handleDeleteEvent(id: number) {
    if (!confirm("确定删除这个活动吗？")) return;

    const { error } = await supabase.from("events").delete().eq("id", id);

    if (!error) {
      setEvents(events.filter((e) => e.id !== id));
      if (viewingEventId === id) setViewingEventId(null);
    } else {
      alert("删除失败：" + error.message);
    }
  }

  async function toggleAttendanceList(eventId: number) {
    if (viewingEventId === eventId) {
      setViewingEventId(null);
    } else {
      setViewingEventId(eventId);
      await fetchAttendanceList(eventId);
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" });
  }

  function formatTime(timeStr: string) {
    return timeStr.substring(0, 5);
  }

  function formatDateTime(isoStr: string) {
  const date = new Date(isoStr);
  return date.toLocaleDateString("zh-TW", {
        month: "long", day: "numeric",
        }) + " " + date.toLocaleTimeString("zh-TW", {
        hour: "2-digit",minute: "2-digit",
        });
  }

  // 访客只看教会活动，会员两个都看
  const tabs = isGuest
    ? [{ key: "attendance", label: "教会活动" }]
    : [
        { key: "attendance", label: "教会活动" },
        { key: "volunteer", label: "内部事工" },
      ];

  const filteredEvents = events.filter((e) => (e.type || "attendance") === activeTab);

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
          <Text style={{ color: "#bbf7d0", fontSize: 18, fontWeight: "bold" }}>← 返回</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "white" }}>团契活动</Text>
        <Text style={{ fontSize: 14, color: "#bbf7d0", marginTop: 4 }}>
          教会活动 · 内部事工
        </Text>
      </View>

      {/* 标签切换 */}
      <View style={{ flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={{
              flex: 1, padding: 14, alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.key ? "#16a34a" : "transparent",
            }}
            onPress={() => {
              setActiveTab(tab.key as any);
              setShowAddForm(false);
              clearForm();
            }}
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
        {/* 新增按钮（仅管理员） */}
        {can(userRole, "manage_events") && (
          <TouchableOpacity
            style={{ backgroundColor: "#16a34a", padding: 12, borderRadius: 8, alignItems: "center", marginBottom: 12 }}
            onPress={() => { clearForm(); setNewType(activeTab); setShowAddForm(!showAddForm); }}
          >
            <Text style={{ color: "white", fontWeight: "bold" }}>
              {showAddForm ? "取消" : activeTab === "attendance" ? "＋ 新增教会活动" : "＋ 新增内部事工"}
            </Text>
          </TouchableOpacity>
        )}

        {/* 新增/修改表单 */}
        {showAddForm && (
          <View style={{ backgroundColor: "white", borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: "#bbf7d0" }}>
            <Text style={{ fontSize: 15, fontWeight: "bold", color: "#374151", marginBottom: 12 }}>
              {editingEventId ? "修改活动" : activeTab === "attendance" ? "新增教会活动" : "新增内部事工"}
            </Text>

            <Text style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>标题</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 10, backgroundColor: "#f9fafb" }}
              placeholder="活动名称"
              value={newTitle}
              onChangeText={setNewTitle}
            />

            <Text style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>说明（选填）</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 10, backgroundColor: "#f9fafb" }}
              placeholder="活动说明"
              value={newDescription}
              onChangeText={setNewDescription}
            />

            <Text style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>日期</Text>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 10, backgroundColor: "#f9fafb", boxSizing: "border-box" }}
            />

            <Text style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>时间</Text>
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              style={{ width: "100%", border: "1px solid #e5e7eb", borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 10, backgroundColor: "#f9fafb", boxSizing: "border-box" }}
            />

            <Text style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>地点（选填）</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 10, backgroundColor: "#f9fafb" }}
              placeholder="活动地点"
              value={newLocation}
              onChangeText={setNewLocation}
            />

            <Text style={{ fontSize: 13, color: "#374151", marginBottom: 4 }}>人数上限（选填）</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 10, fontSize: 14, marginBottom: 16, backgroundColor: "#f9fafb" }}
              placeholder="例如：20"
              value={newMaxParticipants}
              onChangeText={setNewMaxParticipants}
              keyboardType="number-pad"
            />

            <View style={{ flexDirection: "row", gap: 8 }}>
              {editingEventId && (
                <TouchableOpacity
                  style={{ flex: 1, backgroundColor: "#f3f4f6", padding: 12, borderRadius: 8, alignItems: "center" }}
                  onPress={() => { clearForm(); setShowAddForm(false); }}
                >
                  <Text style={{ color: "#6b7280", fontWeight: "bold" }}>取消</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={{ flex: 2, backgroundColor: "#16a34a", padding: 12, borderRadius: 8, alignItems: "center" }}
                onPress={handleSaveEvent}
                disabled={saving}
              >
                <Text style={{ color: "white", fontWeight: "bold" }}>
                  {saving ? "保存中..." : editingEventId ? "保存修改" : "新增"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 活动列表 */}
        {filteredEvents.length === 0 ? (
          <View style={{ backgroundColor: "#f3f4f6", borderRadius: 12, padding: 24, alignItems: "center" }}>
            <Text style={{ color: "#6b7280" }}>
              {activeTab === "attendance" ? "目前没有教会活动" : "目前没有内部事工"}
            </Text>
          </View>
        ) : (
          filteredEvents.map((event) => {
            const record = getAttendanceRecord(event.id);
            const checkedIn = !!record && !isGuest;
            const total = totalCheckins[event.id] || 0;
            const list = attendanceList[event.id] || [];
            const isFull = event.max_participants !== null && total >= (event.max_participants || 0);

            return (
              <View
                key={event.id}
                style={{
                  backgroundColor: "white",
                  borderRadius: 12,
                  padding: 16,
                  marginBottom: 12,
                  borderLeftWidth: 4,
                  borderLeftColor: checkedIn ? "#16a34a" : isFull ? "#ef4444" : "#d1d5db",
                }}
              >
                {/* 日期和人数 */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <Text style={{ fontSize: 12, color: "#6b7280" }}>📅 {formatDate(event.date)}</Text>
                  <View style={{ backgroundColor: isFull ? "#fee2e2" : "#f0fdf4", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 }}>
                    <Text style={{ fontSize: 12, color: isFull ? "#ef4444" : "#16a34a", fontWeight: "bold" }}>
                      👥 {total}{event.max_participants ? `/${event.max_participants}` : ""} 人{isFull ? " · 已满" : ""}
                    </Text>
                  </View>
                </View>

                <Text style={{ fontSize: 18, fontWeight: "bold", color: "#111827" }}>{event.title}</Text>

                {event.description ? (
                  <Text style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>{event.description}</Text>
                ) : null}

                <View style={{ flexDirection: "row", marginTop: 6, gap: 16 }}>
                  <Text style={{ fontSize: 13, color: "#2563eb" }}>🕐 {formatTime(event.time)}</Text>
                  {event.location ? (
                    <Text style={{ fontSize: 13, color: "#16a34a" }}>📍 {event.location}</Text>
                  ) : null}
                </View>

                {/* 报名表单（未报名且未满） */}
                {!checkedIn && !isFull && (
                  <View style={{ marginTop: 12, backgroundColor: "#f9fafb", borderRadius: 8, padding: 12 }}>
                    <Text style={{ fontSize: 13, color: "#374151", marginBottom: 8, fontWeight: "bold" }}>
                      填写报名信息
                    </Text>

                    <Text style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}>姓名 *</Text>
                    <TextInput
                      style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 8, fontSize: 14, marginBottom: 8, backgroundColor: "white" }}
                      placeholder="请输入姓名"
                      value={checkInName[event.id] || ""}
                      onChangeText={(val) => setCheckInName((prev) => ({ ...prev, [event.id]: val }))}
                    />

                    <Text style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}>电话 *</Text>
                    <TextInput
                      style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 8, fontSize: 14, marginBottom: 8, backgroundColor: "white" }}
                      placeholder="请输入电话"
                      value={checkInPhone[event.id] || ""}
                      onChangeText={(val) => setCheckInPhone((prev) => ({ ...prev, [event.id]: val }))}
                      keyboardType="phone-pad"
                    />

                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Text style={{ fontSize: 13, color: "#374151" }}>人数：</Text>
                      <TextInput
                        style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 6, fontSize: 14, width: 60, textAlign: "center", backgroundColor: "white" }}
                        value={checkInCount[event.id] ?? "1"}
                        onChangeText={(val) => setCheckInCount((prev) => ({ ...prev, [event.id]: val }))}
                        keyboardType="number-pad"
                      />
                      <Text style={{ fontSize: 13, color: "#6b7280" }}>人</Text>
                    </View>

                    <TouchableOpacity
                      style={{ backgroundColor: "#16a34a", padding: 10, borderRadius: 8, alignItems: "center" }}
                      onPress={() => handleCheckIn(event.id, event.title, event.max_participants)}
                    >
                      <Text style={{ color: "white", fontWeight: "bold" }}>确认报名</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 已满 */}
                {!checkedIn && isFull && (
                  <View style={{ marginTop: 12, backgroundColor: "#fee2e2", padding: 10, borderRadius: 8, alignItems: "center" }}>
                    <Text style={{ color: "#ef4444", fontWeight: "bold" }}>名额已满</Text>
                  </View>
                )}

                {/* 已报名（仅登录用户） */}
                {checkedIn && (
                  <View style={{ marginTop: 10 }}>
                    <View style={{ padding: 8, backgroundColor: "#f0fdf4", borderRadius: 8, marginBottom: 8 }}>
                      <Text style={{ fontSize: 12, color: "#16a34a" }}>
                        ✅ 已报名 · {formatDateTime(record.checked_in_at)} · {record.people_count} 人
                      </Text>
                    </View>

                    {activeTab === "attendance" && (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
                        <Text style={{ fontSize: 13, color: "#374151" }}>修改人数：</Text>
                        <TextInput
                          style={{ borderWidth: 1, borderColor: "#e5e7eb", borderRadius: 8, padding: 6, fontSize: 14, width: 60, textAlign: "center", backgroundColor: "#f9fafb" }}
                          value={editingCount[event.id] !== undefined ? editingCount[event.id] : String(record.people_count)}
                          onChangeText={(val) => setEditingCount((prev) => ({ ...prev, [event.id]: val }))}
                          keyboardType="number-pad"
                        />
                        <Text style={{ fontSize: 13, color: "#6b7280" }}>人</Text>
                        <TouchableOpacity
                          style={{ backgroundColor: "#f59e0b", padding: 8, borderRadius: 8 }}
                          onPress={() => handleUpdateCheckin(event.id)}
                        >
                          <Text style={{ color: "white", fontWeight: "bold", fontSize: 13 }}>确认</Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <TouchableOpacity
                      style={{ backgroundColor: "#fee2e2", padding: 10, borderRadius: 8, alignItems: "center" }}
                      onPress={() => handleCancelCheckIn(event.id)}
                    >
                      <Text style={{ color: "#ef4444", fontWeight: "bold" }}>取消报名</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {/* 查看名单和操作 */}
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 12 }}>
                  {can(userRole, "view_attendance_list") && (
                    <TouchableOpacity onPress={() => toggleAttendanceList(event.id)}>
                      <Text style={{ fontSize: 12, color: "#2563eb" }}>
                        {viewingEventId === event.id ? "▲ 收起名单" : "▼ 查看名单"}
                      </Text>
                    </TouchableOpacity>
                  )}
                  {can(userRole, "manage_events") && (
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <TouchableOpacity onPress={() => startEditEvent(event)}>
                        <Text style={{ fontSize: 12, color: "#f59e0b" }}>✏️ 修改</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteEvent(event.id)}>
                        <Text style={{ fontSize: 12, color: "#ef4444" }}>🗑 删除</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* 名单 */}
                {viewingEventId === event.id && (
                  <View style={{ marginTop: 8, backgroundColor: "#f0fdf4", borderRadius: 8, padding: 10 }}>
                    <Text style={{ fontSize: 12, fontWeight: "bold", color: "#374151", marginBottom: 6 }}>报名名单</Text>
                    {list.length === 0 ? (
                      <Text style={{ fontSize: 12, color: "#6b7280" }}>还没有人报名</Text>
                    ) : (
                      list.map((item, index) => (
                        <View
                          key={index}
                          style={{
                            paddingVertical: 6,
                            borderBottomWidth: index < list.length - 1 ? 0.5 : 0,
                            borderBottomColor: "#d1fae5",
                          }}
                        >
                          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                            <Text style={{ fontSize: 12, color: "#374151", fontWeight: "bold" }}>
                              {item.name || item.username || "未知"}
                            </Text>
                            <Text style={{ fontSize: 12, color: "#16a34a" }}>
                              {item.people_count} 人 · {formatDateTime(item.checked_in_at)}
                            </Text>
                          </View>
                          {item.phone ? (
                            <Text style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>📞 {item.phone}</Text>
                          ) : null}
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })
        )}
      </View>
    </ScrollView>
  );
}