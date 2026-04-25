import { useState } from "react";
import { ScrollView, Text, TextInput, TouchableOpacity, View } from "react-native";

export default function Bulletin({ onBack }: { onBack: () => void }) {
  const [date, setDate] = useState("");
  const [sermonTitle, setSermonTitle] = useState("");
  const [scriptureText, setScriptureText] = useState("");
  const [hymnsText, setHymnsText] = useState("");
  const [bibleReading, setBibleReading] = useState("");
  const [announcements, setAnnouncements] = useState("");
  const [generating, setGenerating] = useState(false);

  function parseHymns(text: string) {
    const blocks = text.trim().split(/^#/m).filter((b) => b.trim());
    return blocks.map((block) => {
      const lines = block.trim().split("\n");
      const title = lines[0].trim();
      const lyrics = lines.slice(1).join("\n").trim();
      return { title, lyrics };
    });
  }

  function formatDate(dateStr: string) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("zh-TW", {
      year: "numeric", month: "long", day: "numeric"
    });
  }

  function handleGenerate() {
    if (!date || !sermonTitle) {
      alert("请填写日期和证道题目");
      return;
    }
    setGenerating(true);
    const hymns = parseHymns(hymnsText);
    const worshipHymns = hymns.slice(0, hymns.length - 1);
    const responseHymn = hymns[hymns.length - 1];
    const html = generateHTML(hymns, worshipHymns, responseHymn);

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("请允许弹出窗口");
      setGenerating(false);
      return;
    }
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      setGenerating(false);
    }, 800);
  }

  function generateHTML(hymns: any[], worshipHymns: any[], responseHymn: any) {
    const formattedDate = formatDate(date);

    // 经文书名自动加粗
    const formattedScripture = scriptureText.replace(
      /(尼希米记|帖前|帖撒罗尼迦前书|路加福音|哥林多前书|诗篇|耶利米书|以赛亚书|约翰福音|创世记|出埃及记|利未记|民数记|申命记|约书亚记|士师记|路得记|撒母耳记上|撒母耳记下|列王纪上|列王纪下|历代志上|历代志下|以斯拉记|以斯帖记|约伯记|箴言|传道书|雅歌|但以理书|何西阿书|约珥书|阿摩司书|俄巴底亚书|约拿书|弥迦书|那鸿书|哈巴谷书|西番雅书|哈该书|撒迦利亚书|玛拉基书|马太福音|马可福音|使徒行传|罗马书|加拉太书|以弗所书|腓立比书|歌罗西书|提摩太前书|提摩太后书|帖撒罗尼迦后书|希伯来书|雅各书|彼得前书|彼得后书|约翰一书|约翰二书|约翰三书|犹大书|启示录)/g,
      "<b style='font-weight:900;'>$1</b>"
    );

    const announcementLines = announcements
      .trim().split("\n")
      .filter((l) => l.trim())
      .reduce((acc: string[], line: string) => {
        if (/^\d+[\.\。]/.test(line.trim())) {
          acc.push(line.trim());
        } else {
          if (acc.length === 0) {
            acc.push(line.trim());
          } else {
            acc[acc.length - 1] += " " + line.trim();
          }
        }
        return acc;
      }, [])
      .map((l) => `<p class="ann-item">${l}</p>`)
      .join("");

    const hymnsHTML = hymns.map((h) => `
      <div class="hymn-block">
        <div class="hymn-title">${h.title}</div>
        <div class="hymn-lyrics">${h.lyrics.replace(/\n/g, "<br>")}</div>
      </div>
    `).join("");

    const worshipHymnsHTML = worshipHymns.map((h) =>
      `<div class="wt-hymn">${h.title}</div>`
    ).join("");

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>恩典生命团契周报 ${formattedDate}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: "SimSun", "宋体", "Microsoft YaHei", "微软雅黑", serif;
    font-size: 9pt;
    color: #000;
    background: white;
  }

  @page { size: A4 landscape; margin: 6mm; }

  @media print {
    body { margin: 0; }
    .page { page-break-after: always; }
    .page:last-child { page-break-after: avoid; }
  }

  .page {
    width: 285mm;
    height: 196mm;
    display: flex;
    flex-direction: row;
    overflow: hidden;
  }

  /* ══ 第一页左半 ══ */
  .p1-left {
    width: 50%;
    height: 100%;
    padding: 4mm 5mm;
    border: 1pt solid #000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .church-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1pt solid #000;
    padding-bottom: 2mm;
    margin-bottom: 3mm;
  }

  .logo-area { display: flex; align-items: center; gap: 2mm; }

  .logo-circle {
    width: 11mm;
    height: 11mm;
    border: 1.5pt solid #000;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14pt;
    font-weight: bold;
  }

  .church-name { font-size: 14pt; font-weight: bold; line-height: 1.2; }
  .church-name-en { font-size: 7pt; color: #444; }
  .church-url { font-size: 10pt; font-weight: bold; }

  .sermon-box {
    border: 0.8pt solid #000;
    padding: 2mm 3mm;
    margin-bottom: 3mm;
    flex-shrink: 0;
  }

  .sermon-label {
    text-align: center;
    font-size: 10pt;
    font-weight: bold;
    margin-bottom: 1mm;
  }

  .sermon-title {
    text-align: center;
    font-size: 11pt;
    font-weight: bold;
    margin-bottom: 2mm;
  }

  .scripture-text {
    font-size: 8pt;
    line-height: 1.65;
    text-align: justify;
    overflow: hidden;
  }

  .ann-box { flex: 1; overflow: hidden; }

  .ann-title {
    text-align: center;
    font-size: 11pt;
    font-weight: bold;
    text-decoration: underline;
    margin-bottom: 2mm;
  }

  .ann-item {
    font-size: 8pt;
    line-height: 1.6;
    margin-bottom: 1mm;
  }

  .p1-footer {
    font-size: 7pt;
    color: #555;
    text-align: center;
    border-top: 0.5pt solid #ccc;
    padding-top: 1mm;
    margin-top: 2mm;
  }

  /* ══ 第一页右半 ══ */
  .p1-right {
    width: 50%;
    height: 100%;
    border: 1pt solid #000;
    border-left: none;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .p1-right-placeholder {
    color: #ccc;
    font-size: 10pt;
    text-align: center;
  }

  /* ══ 第二页左半 ══ */
  .p2-left {
    width: 50%;
    height: 100%;
    padding: 4mm 5mm;
    border: 1pt solid #000;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .worship-box {
    border: 0.8pt solid #000;
    padding: 3mm;
    flex: 1;
    overflow: hidden;
  }

  .worship-title {
    text-align: center;
    font-size: 14pt;
    font-weight: bold;
    border-bottom: 0.8pt solid #000;
    padding-bottom: 2mm;
    margin-bottom: 2mm;
  }

  .worship-date {
    text-align: center;
    font-size: 9pt;
    font-weight: bold;
    margin-bottom: 2mm;
  }

  .worship-table {
    width: 100%;
    border-collapse: collapse;
    border-top: 0.5pt solid #ccc;
  }

  .worship-table td {
    vertical-align: top;
    padding: 1.5mm 2mm;
    font-size: 8.5pt;
    line-height: 1.4;
    border-bottom: 0.5pt solid #ccc;
  }

  .wt-left {
    width: 42%;
    border-right: 0.5pt solid #ccc;
    padding-right: 2mm;
  }

  .wt-right { width: 58%; padding-left: 2mm; }
  .wt-cn { font-weight: bold; font-size: 9pt; }
  .wt-en { font-size: 7pt; color: #555; }
  .wt-detail { font-size: 8pt; }
  .wt-hymn { font-size: 8pt; display: block; }

  .qr-row {
    display: flex;
    gap: 3mm;
    margin-top: 2mm;
    justify-content: space-around;
  }

  .qr-box {
    border: 0.8pt solid #ccc;
    padding: 2mm;
    text-align: center;
    font-size: 7pt;
    flex: 1;
  }

  .qr-placeholder {
    width: 18mm;
    height: 18mm;
    border: 0.5pt solid #ccc;
    margin: 1mm auto;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 6pt;
    color: #aaa;
  }

  .offering-row {
    border: 0.8pt solid #ccc;
    padding: 2mm;
    margin-top: 2mm;
    font-size: 7.5pt;
    text-align: center;
    line-height: 1.6;
  }

  /* ══ 第二页右半 ══ */
  .p2-right {
    width: 50%;
    height: 100%;
    padding: 4mm 5mm;
    border: 1pt solid #000;
    border-left: none;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .hymns-header {
    text-align: center;
    font-size: 12pt;
    font-weight: bold;
    border: 0.8pt solid #000;
    padding: 1.5mm;
    margin-bottom: 3mm;
    flex-shrink: 0;
  }

  .hymns-area {
    flex: 1;
    overflow: hidden;
    font-size: 7.5pt;
    line-height: 1.55;
  }

  .hymn-block { margin-bottom: 3mm; }

  .hymn-title {
    text-align: center;
    font-size: 9.5pt;
    font-weight: bold;
    margin-bottom: 1.5mm;
    white-space: nowrap;
    overflow: hidden;
  }

  .hymn-lyrics {
    font-size: 7.5pt;
    line-height: 1.55;
    text-align: center;
    word-break: keep-all;
  }

  .p2-right-footer {
    font-size: 7pt;
    color: #555;
    text-align: center;
    border-top: 0.5pt solid #ccc;
    padding-top: 1mm;
    margin-top: 2mm;
    line-height: 1.6;
    flex-shrink: 0;
  }
</style>
<script>
window.onload = function() {
  const container = document.querySelector('.p2-right');
  const hymnsArea = document.querySelector('.hymns-area');
  const footer = document.querySelector('.p2-right-footer');
  const header = document.querySelector('.hymns-header');
  if (!container || !hymnsArea) return;

  // 第一步：同段内短行合并，段落之间保留
  const lyricDivs = hymnsArea.querySelectorAll('.hymn-lyrics');
  lyricDivs.forEach(div => {
    div.innerHTML = div.innerHTML
      .replace(/<br>\s*<br>/gi, '§§')
      .replace(/<br>/gi, ' ')
      .replace(/§§/g, '<br><br>');
  });

  // 第二步：诗歌标题太长自动缩小
  const hymnTitles = hymnsArea.querySelectorAll('.hymn-title');
  hymnTitles.forEach(title => {
    let titleSize = 9.5;
    while (title.scrollWidth > title.offsetWidth && titleSize > 6) {
      titleSize -= 0.2;
      title.style.fontSize = titleSize + 'pt';
    }
  });

  // 第三步：自动缩小字体直到内容全部放得下
  const availableHeight = container.offsetHeight
    - (header ? header.offsetHeight : 0)
    - (footer ? footer.offsetHeight : 0)
    - 16;

  let fontSize = 7.5;
  let lineHeight = 1.55;

  while (hymnsArea.scrollHeight > availableHeight && fontSize > 4.5) {
    fontSize -= 0.15;
    lineHeight = Math.max(1.15, lineHeight - 0.02);
    hymnsArea.style.fontSize = fontSize + 'pt';
    hymnsArea.style.lineHeight = lineHeight.toString();
  }
  while (hymnsArea.scrollHeight > availableHeight && fontSize > 4.5) {
    fontSize -= 0.15;
    lineHeight = Math.max(1.15, lineHeight - 0.02);
    hymnsArea.style.fontSize = fontSize + 'pt';
    hymnsArea.style.lineHeight = lineHeight.toString();
  }

  // 报告事项自动缩小字体
  const annBox = document.querySelector('.ann-box');
  if (annBox) {
    const annAvailableHeight = annBox.offsetHeight;
    let annFontSize = 8.0;
    let annLineHeight = 1.6;

    while (annBox.scrollHeight > annAvailableHeight && annFontSize > 5) {
      annFontSize -= 0.15;
      annLineHeight = Math.max(1.2, annLineHeight - 0.02);
      const items = annBox.querySelectorAll('.ann-item');
      items.forEach(item => {
        item.style.fontSize = annFontSize + 'pt';
        item.style.lineHeight = annLineHeight.toString();
      });
    }
  }
};
</script>
</head>
<body>

<!-- ══════════ 第一页 ══════════ -->
<div class="page">
  <div class="p1-left">
    <div class="church-header">
      <div class="logo-area">
        <div class="logo-circle">†</div>
        <div>
          <div class="church-name">恩典生命团契</div>
          <div class="church-name-en">Grace Chinese Fellowship</div>
        </div>
      </div>
      <div class="church-url">www.gracechinese.org</div>
    </div>

    <div class="sermon-box">
      <div class="sermon-label">证道大纲</div>
      <div class="sermon-title">${sermonTitle}</div>
      <div class="scripture-text">${formattedScripture.replace(/\n/g, "<br>")}</div>
    </div>

    <div class="ann-box">
      <div class="ann-title">报告事项</div>
      ${announcementLines}
    </div>

    <div class="p1-footer">
      www.gracechinese.org &nbsp;|&nbsp;
      支票或 Zelle 奉献：Grace Chinese Fellowship &nbsp;|&nbsp;
      Email: GCFofLF@gmail.com
    </div>
  </div>

  <div class="p1-right">
    <div class="p1-right-placeholder">（图片位置）</div>
  </div>
</div>

<!-- ══════════ 第二页 ══════════ -->
<div class="page">
  <div class="p2-left">
    <div class="worship-box">
      <div class="worship-title">主日崇拜程序</div>
      <div class="worship-date">主后 ${formattedDate}</div>
      <table class="worship-table">
        <tr>
          <td class="wt-left"><div class="wt-cn">序乐</div><div class="wt-en">Prelude</div></td>
          <td class="wt-right"></td>
        </tr>
        <tr>
          <td class="wt-left"><div class="wt-cn">感恩祷告</div><div class="wt-en">Opening Prayer of Thanksgiving</div></td>
          <td class="wt-right"></td>
        </tr>
        <tr>
          <td class="wt-left"><div class="wt-cn">诗歌赞美</div><div class="wt-en">Hymns</div></td>
          <td class="wt-right">${worshipHymnsHTML}</td>
        </tr>
        <tr>
          <td class="wt-left"><div class="wt-cn">主餐</div></td>
          <td class="wt-right"></td>
        </tr>
        <tr>
          <td class="wt-left"><div class="wt-cn">读经</div><div class="wt-en">Reading of Scripture</div></td>
          <td class="wt-right"><div class="wt-detail">${bibleReading}</div></td>
        </tr>
        <tr>
          <td class="wt-left"><div class="wt-cn">证道</div><div class="wt-en">Sermon</div></td>
          <td class="wt-right"><div class="wt-detail">${sermonTitle}</div></td>
        </tr>
        <tr>
          <td class="wt-left"><div class="wt-cn">回应诗歌</div><div class="wt-en">Song of Praise</div></td>
          <td class="wt-right"><div class="wt-detail">${responseHymn?.title || ""}</div></td>
        </tr>
        <tr>
          <td class="wt-left"><div class="wt-cn">奉献祷告</div><div class="wt-en">Offertory Prayer</div></td>
          <td class="wt-right"></td>
        </tr>
        <tr>
          <td class="wt-left"><div class="wt-cn">欢迎</div><div class="wt-en">Welcome</div></td>
          <td class="wt-right"></td>
        </tr>
        <tr>
          <td class="wt-left"><div class="wt-cn">报告</div><div class="wt-en">Announcements</div></td>
          <td class="wt-right"></td>
        </tr>
        <tr>
          <td class="wt-left"><div class="wt-cn">祝福</div><div class="wt-en">Benediction</div></td>
          <td class="wt-right"></td>
        </tr>
      </table>
    </div>

    <div class="qr-row">
      <div class="qr-box">
        <div class="qr-placeholder">QR</div>
        儿童主日学签到<br>Sunday School Check In
      </div>
      <div class="qr-box">
        <div class="qr-placeholder">QR</div>
        活动通知
      </div>
    </div>

    <div class="offering-row">
      支票或 Zelle 奉献收款单位 &nbsp; <strong>Grace Chinese Fellowship</strong><br>
      Email: GCFofLF@gmail.com &nbsp;
      请首次奉献的人注明电子邮件地址以便年终发收据
    </div>
  </div>

  <div class="p2-right">
    <div class="hymns-header">【诗歌】</div>
    <div class="hymns-area">
      ${hymnsHTML}
    </div>
    <div class="p2-right-footer">
      支票或 Zelle 奉献收款单位 &nbsp; Grace Chinese Fellowship<br>
      Email: GCFofLF@gmail.com<br>
      请首次奉献的人注明电子邮件地址以便年终发收据
    </div>
  </div>
</div>

</body>
</html>`;
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#f8fafc" }}>
      <View style={{ backgroundColor: "#7c3aed", padding: 24, paddingTop: 48 }}>
        <TouchableOpacity onPress={onBack} style={{ marginBottom: 12 }}>
          <Text style={{ color: "#e9d5ff", fontSize: 18, fontWeight: "bold" }}>← 返回</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: "bold", color: "white" }}>生成本周周报</Text>
        <Text style={{ fontSize: 14, color: "#e9d5ff", marginTop: 4 }}>
          填写内容后自动排版生成 PDF（两页格式）
        </Text>
      </View>

      <View style={{ padding: 16 }}>

        <Text style={{ fontSize: 15, fontWeight: "bold", color: "#374151", marginBottom: 6 }}>日期 *</Text>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ width: "100%", border: "1px solid #ccc", borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20, backgroundColor: "white", boxSizing: "border-box" }}
        />

        <Text style={{ fontSize: 15, fontWeight: "bold", color: "#374151", marginBottom: 6 }}>证道题目 *</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20, backgroundColor: "white" }}
          placeholder="例如：神是我们的安慰者"
          value={sermonTitle}
          onChangeText={setSermonTitle}
        />

        <Text style={{ fontSize: 15, fontWeight: "bold", color: "#374151", marginBottom: 4 }}>证道大纲经文</Text>
        <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>将所有经文一起复制贴入，书名会自动加粗</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 20, backgroundColor: "white", minHeight: 120, textAlignVertical: "top" }}
          placeholder="尼希米记 1：6 愿你睁眼看，侧耳听..."
          value={scriptureText}
          onChangeText={setScriptureText}
          multiline
        />

        <Text style={{ fontSize: 15, fontWeight: "bold", color: "#374151", marginBottom: 6 }}>读经篇章</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 20, backgroundColor: "white" }}
          placeholder="例如：诗篇 48 篇"
          value={bibleReading}
          onChangeText={setBibleReading}
        />

        <Text style={{ fontSize: 15, fontWeight: "bold", color: "#374151", marginBottom: 4 }}>诗歌（4 首）</Text>
        <View style={{ backgroundColor: "#f5f3ff", borderRadius: 8, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "#ddd6fe" }}>
          <Text style={{ fontSize: 12, color: "#7c3aed", lineHeight: 20 }}>
            每首诗歌名称前加 # 号，其余是歌词，最后一首自动作为回应诗歌。{"\n"}
            例如：#何等榮耀{"\n"}祂的聖潔 如此美麗...{"\n"}#藉我賜恩福{"\n"}在廛世生命崎岖...
          </Text>
        </View>
        <TextInput
          style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 20, backgroundColor: "white", minHeight: 240, textAlignVertical: "top" }}
          placeholder={"#第一首\n歌词...\n#第二首\n歌词...\n#第三首\n歌词...\n#回应诗歌\n歌词..."}
          value={hymnsText}
          onChangeText={setHymnsText}
          multiline
        />

        <Text style={{ fontSize: 15, fontWeight: "bold", color: "#374151", marginBottom: 4 }}>报告事项</Text>
        <Text style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>每行一条，直接复制贴入</Text>
        <TextInput
          style={{ borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, fontSize: 14, marginBottom: 32, backgroundColor: "white", minHeight: 150, textAlignVertical: "top" }}
          placeholder={"欢迎每位同心来敬拜复活的主耶稣基督！\n欢迎 Preschool-2 年级小朋友参加小羊学堂...\n如果您愿意信主..."}
          value={announcements}
          onChangeText={setAnnouncements}
          multiline
        />

        <TouchableOpacity
          style={{
            backgroundColor: generating ? "#a78bfa" : "#7c3aed",
            padding: 16, borderRadius: 12, alignItems: "center", marginBottom: 40,
          }}
          onPress={handleGenerate}
          disabled={generating}
        >
          <Text style={{ color: "white", fontSize: 18, fontWeight: "bold" }}>
            {generating ? "生成中..." : "📋 生成并预览周报"}
          </Text>
        </TouchableOpacity>

      </View>
    </ScrollView>
  );
}