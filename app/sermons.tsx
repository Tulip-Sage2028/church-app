import * as DocumentPicker from "expo-document-picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";
import { can } from "../lib/permissions";
import { supabase } from "../lib/supabase";

type CurrentSermon = {
  id: number;
  title: string;
  pdf_url: string;
  date: string;
};

type Sermon = {
  id: number;
  title: string;
  date: string;
  video_url: string;
  speaker: string;
  description: string;
};

export default function Sermons({ onBack, userRole }: { onBack: () => void; userRole: string }) {
  const [currentSermon, setCurrentSermon] = useState<CurrentSermon | null>(null);
  const [sermons, setSermons] = useState<Sermon[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"view" | "manage">("view");

  // 管理员表单
  const [newTitle, setNewTitle] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newVideoUrl, setNewVideoUrl] = useState("");
  const [newSpeaker, setNewSpeaker] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPdfUrl, setNewPdfUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pdfFileName, setPdfFileName] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    // 取得本周讲道
    const { data: current } = await supabase
      .from("current_sermon")
      .select("*")
      .single();

    if (current) setCurrentSermon(current);

    // 取得往期讲道
    const { data: history } = await supabase
      .from("sermons")
      .select("*")
      .order("date", { ascending: false });

    if (history) setSermons(history);
    setLoading(false);
  }

  async function handlePickPdf() {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
    });

    if (result.canceled) return;

    const file = result.assets[0];
    setUploading(true);

    // 把文件转成可上传的格式
    const response = await fetch(file.uri);
    const blob = await response.blob();

    const fileName = `sermon_${Date.now()}.pdf`;

    const { data, error } = await supabase.storage
      .from("sermons")
      .upload(fileName, blob, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (error) {
      alert("上传失败：" + error.message);
      setUploading(false);
      return;
    }

    // 取得公开链接
    const { data: urlData } = supabase.storage
      .from("sermons")
      .getPublicUrl(fileName);

    setNewPdfUrl(urlData.publicUrl);
    setPdfFileName(file.name);
    setUploading(false);
    alert("PDF 上传成功！");
  }
  async function handleUpdateCurrentSermon() {
    if (!newTitle || !newDate || !newPdfUrl) {
      alert("请填写标题、日期和PDF链接");
      return;
    }

    setSaving(true);

    if (currentSermon) {
      // 更新现有记录
      const { error } = await supabase
        .from("current_sermon")
        .update({
          title: newTitle,
          date: newDate,
          pdf_url: newPdfUrl,
        })
        .eq("id", currentSermon.id);

      if (!error) {
        setCurrentSermon({ ...currentSermon, title: newTitle, date: newDate, pdf_url: newPdfUrl });
        alert("本周讲道更新成功！");
      }
    } else {
      // 新建记录
      const { data, error } = await supabase
        .from("current_sermon")
        .insert({ title: newTitle, date: newDate, pdf_url: newPdfUrl })
        .select()
        .single();

      if (!error && data) {
        setCurrentSermon(data);
        alert("本周讲道发布成功！");
      }
    }

    setSaving(false);
    setNewTitle("");
    setNewDate("");
    setNewPdfUrl("");
  }

  async function handleAddSermon() {
    if (!newTitle || !newDate) {
      alert("请填写标题和日期");
      return;
    }

    setSaving(true);

    const { data, error } = await supabase
      .from("sermons")
      .insert({
        title: newTitle,
        date: newDate,
        video_url: newVideoUrl,
        speaker: newSpeaker,
        description: newDescription,
      })
      .select()
      .single();

    if (!error && data) {
      setSermons([data, ...sermons]);
      setNewTitle("");
      setNewDate("");
      setNewVideoUrl("");
      setNewSpeaker("");
      setNewDescription("");
      alert("讲道记录添加成功！");
    } else {
      alert("添加失败：" + error?.message);
    }

    setSaving(false);
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("zh-TW", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#ea580c" />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* 顶部标题 */}
      <View style={{ backgroundColor: "#ea580c", padding: 24, paddingTop: 48 }}>
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
          <Text style={{ color: "#fed7aa", fontSize: 14 }}>← 返回</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "white" }}>
          主日信息
        </Text>
        <Text style={{ fontSize: 14, color: "#fed7aa", marginTop: 4 }}>
          讲道信息及往期记录
        </Text>
      </View>

      {/* 标签切换 */}
      <View style={{ flexDirection: "row", backgroundColor: "white", borderBottomWidth: 1, borderBottomColor: "#e5e7eb" }}>
        {[
          { key: "view", label: "主日信息" },
          ...(can(userRole, "manage_sermons") ? [{ key: "manage", label: "管理" }] : []),
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={{
              flex: 1,
              padding: 14,
              alignItems: "center",
              borderBottomWidth: 2,
              borderBottomColor: activeTab === tab.key ? "#ea580c" : "transparent",
            }}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text style={{
              fontSize: 14,
              fontWeight: activeTab === tab.key ? "bold" : "normal",
              color: activeTab === tab.key ? "#ea580c" : "#6b7280",
            }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ padding: 16 }}>
        {/* 查看页面 */}
        {activeTab === "view" && (
          <View>
            {/* 本周讲道 */}
            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#374151", marginBottom: 12 }}>
              本周主日信息
            </Text>

            {currentSermon ? (
              <View style={{
                backgroundColor: "#fff7ed",
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                borderWidth: 1,
                borderColor: "#fed7aa",
              }}>
                <Text style={{ fontSize: 18, fontWeight: "bold", color: "#111827", marginBottom: 4 }}>
                  {currentSermon.title}
                </Text>
                <Text style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>
                  📅 {formatDate(currentSermon.date)}
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: "#ea580c",
                    padding: 12,
                    borderRadius: 8,
                    alignItems: "center",
                  }}
                  onPress={() => {
                    if (typeof window !== "undefined") {
                      window.open(currentSermon.pdf_url, "_blank");
                    }
                  }}
                >
                  <Text style={{ color: "white", fontWeight: "bold" }}>
                    📄 查看本周讲道 PDF
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{
                backgroundColor: "#f3f4f6",
                borderRadius: 12,
                padding: 20,
                marginBottom: 24,
                alignItems: "center",
              }}>
                <Text style={{ color: "#6b7280" }}>本周讲道尚未发布</Text>
              </View>
            )}

            {/* 往期讲道 */}
            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#374151", marginBottom: 12 }}>
              往期讲道
            </Text>

            {sermons.length === 0 ? (
              <Text style={{ color: "#6b7280", textAlign: "center", marginTop: 20 }}>
                还没有往期讲道记录
              </Text>
            ) : (
              sermons.map((sermon) => (
                <View
                  key={sermon.id}
                  style={{
                    backgroundColor: "white",
                    borderRadius: 12,
                    padding: 16,
                    marginBottom: 12,
                    borderLeftWidth: 4,
                    borderLeftColor: "#ea580c",
                  }}
                >
                  <Text style={{ fontSize: 16, fontWeight: "bold", color: "#111827" }}>
                    {sermon.title}
                  </Text>
                  <Text style={{ fontSize: 13, color: "#6b7280", marginTop: 4 }}>
                    📅 {formatDate(sermon.date)}
                    {sermon.speaker ? ` · 👤 ${sermon.speaker}` : ""}
                  </Text>
                  {sermon.description ? (
                    <Text style={{ fontSize: 14, color: "#374151", marginTop: 8 }}>
                      {sermon.description}
                    </Text>
                  ) : null}
                  {sermon.video_url ? (
                    <TouchableOpacity
                      style={{
                        marginTop: 12,
                        backgroundColor: "#fee2e2",
                        padding: 10,
                        borderRadius: 8,
                        alignItems: "center",
                      }}
                      onPress={() => {
                        if (typeof window !== "undefined") {
                          window.open(sermon.video_url, "_blank");
                        }
                      }}
                    >
                      <Text style={{ color: "#ea580c", fontWeight: "bold" }}>
                        ▶ 观看视频
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ))
            )}
          </View>
        )}

        {/* 管理页面 */}
        {activeTab === "manage" && (
          <View>
            {/* 更新本周讲道 */}
            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#374151", marginBottom: 12 }}>
              更新本周讲道
            </Text>

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>标题</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, backgroundColor: "white" }}
              placeholder="本周讲道标题"
              value={newTitle}
              onChangeText={setNewTitle}
            />

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
                marginBottom: 12,
                backgroundColor: "white",
                boxSizing: "border-box",
              }}
            />

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>PDF 文件</Text>
            <TouchableOpacity
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                padding: 12,
                marginBottom: 8,
                backgroundColor: "white",
                alignItems: "center",
              }}
              onPress={handlePickPdf}
              disabled={uploading}
            >
              <Text style={{ color: "#2563eb", fontSize: 14 }}>
                {uploading ? "上传中..." : "📄 选择 PDF 文件"}
              </Text>
            </TouchableOpacity>
            {pdfFileName ? (
              <Text style={{ fontSize: 13, color: "#16a34a", marginBottom: 20 }}>
                ✅ 已上传：{pdfFileName}
              </Text>
            ) : (
              <Text style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>
                还没有选择文件
              </Text>
            )}

            <TouchableOpacity
              style={{ backgroundColor: "#ea580c", padding: 14, borderRadius: 8, alignItems: "center", marginBottom: 32 }}
              onPress={handleUpdateCurrentSermon}
              disabled={saving}
            >
              <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
                {saving ? "保存中..." : "更新本周讲道"}
              </Text>
            </TouchableOpacity>

            {/* 添加往期讲道 */}
            <Text style={{ fontSize: 16, fontWeight: "bold", color: "#374151", marginBottom: 12 }}>
              添加往期讲道
            </Text>

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>标题</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, backgroundColor: "white" }}
              placeholder="讲道标题"
              value={newTitle}
              onChangeText={setNewTitle}
            />

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
                marginBottom: 12,
                backgroundColor: "white",
                boxSizing: "border-box",
              }}
            />

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>讲员</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, backgroundColor: "white" }}
              placeholder="讲员姓名"
              value={newSpeaker}
              onChangeText={setNewSpeaker}
            />

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>视频链接</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12, backgroundColor: "white" }}
              placeholder="https://youtube.com/..."
              value={newVideoUrl}
              onChangeText={setNewVideoUrl}
              autoCapitalize="none"
            />

            <Text style={{ fontSize: 14, color: "#374151", marginBottom: 6 }}>简介</Text>
            <TextInput
              style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20, backgroundColor: "white", height: 100, textAlignVertical: "top" }}
              placeholder="讲道简介"
              value={newDescription}
              onChangeText={setNewDescription}
              multiline={true}
            />

            <TouchableOpacity
              style={{ backgroundColor: "#2563eb", padding: 14, borderRadius: 8, alignItems: "center", marginBottom: 32 }}
              onPress={handleAddSermon}
              disabled={saving}
            >
              <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
                {saving ? "保存中..." : "添加往期讲道"}
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </ScrollView>
  );
}