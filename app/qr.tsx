import { Text, TouchableOpacity, View } from "react-native";
import QRCode from "react-native-qrcode-svg";

const APP_URL = "https://church-app-sable.vercel.app/";

export default function QR({ onBack }: { onBack: () => void }) {
  return (
    <View style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      {/* 顶部 */}
      <View style={{ backgroundColor: "#2563eb", padding: 24, paddingTop: 48, flexDirection: "row", alignItems: "center", gap: 12 }}>
        <TouchableOpacity onPress={onBack}>
          <Text style={{ color: "white", fontSize: 16 }}>← 返回</Text>
        </TouchableOpacity>
        <Text style={{ color: "white", fontSize: 18, fontWeight: "bold" }}>扫码进入 App</Text>
      </View>

      {/* 主体 */}
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 32 }}>
        <View style={{
          padding: 24, backgroundColor: "white", borderRadius: 20,
          shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1, shadowRadius: 12, elevation: 6,
          alignItems: "center",
        }}>
          <Text style={{ fontSize: 20, fontWeight: "bold", color: "#1e3a5f", marginBottom: 8 }}>
            恩典生命团契
          </Text>
          <Text style={{ fontSize: 13, color: "#9ca3af", marginBottom: 24 }}>
            用手机扫描下方二维码
          </Text>

          <QRCode
            value={APP_URL}
            size={220}
            color="#1e3a5f"
            backgroundColor="#ffffff"
          />

          <Text style={{ marginTop: 24, fontSize: 11, color: "#d1d5db" }}>
            {APP_URL}
          </Text>
        </View>

        <Text style={{ marginTop: 24, fontSize: 13, color: "#6b7280", textAlign: "center" }}>
          扫码后可直接浏览，{"\n"}无需输入网址
        </Text>
      </View>
    </View>
  );
}