import React, { useState } from "react";
import "./App.css";
import ReactMarkdown from "react-markdown";
import { Bar, Line, Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  ArcElement,
  Tooltip,
  Legend
);

function isChartMessage(content) {
  if (typeof content === "object" && content !== null && content.type === "chart")
    return true;
  if (typeof content === "string") {
    try {
      const obj = JSON.parse(content);
      if (obj && obj.type === "chart") return true;
    } catch {}
  }
  return false;
}

function renderChart(content) {
  if (content && content.type === "chart-error") {
    return <div style={{color: 'red'}}>Biểu đồ không hợp lệ hoặc JSON lỗi.</div>;
  }
  let chartData, chartType, chartOptions;
  if (typeof content === "string") {
    try {
      content = JSON.parse(content);
    } catch {}
  }
  if (content && content.type === "chart") {
    chartType = content.chartType || content.type || "bar";
    chartData = content.data;
    chartOptions = content.options || {};
    // Thêm log để debug
    console.log("[renderChart] chartType:", chartType, "data:", chartData, "options:", chartOptions);
    return (
      <div style={{width: '100%', minHeight: 400}}>
        {chartType === "bar" && <Bar data={chartData} options={chartOptions} />}
        {chartType === "line" && <Line data={chartData} options={chartOptions} />}
        {chartType === "pie" && <Pie data={chartData} options={chartOptions} />}
        {/* fallback */}
        {!(chartType === "bar" || chartType === "line" || chartType === "pie") && <pre>{JSON.stringify(content, null, 2)}</pre>}
      </div>
    );
  }
  return null;
}

function extractChartFromString(str) {
  if (typeof str !== "string") return null;
  // Lấy mọi ký tự giữa <chart> và </chart>
const chartRegex = /<chart>\s*([\s\S]*?)\s*<\/chart>/i;
  const match = str.match(chartRegex);
  if (match) {
    try {
      // Log giá trị thực tế để debug
     // console.log("[extractChartFromString] match[1] raw:", match[1]);
      // Loại bỏ mọi ký tự trắng đầu chuỗi (trước {)
    const jsonStr = match[1].trim(); // bỏ khoảng trắng đầu & cuối
    //  console.log("[extractChartFromString] jsonStr:", jsonStr);
      const chartJson = JSON.parse(jsonStr);
      return chartJson;
    } catch (e) {
      console.error("Lỗi parse JSON biểu đồ:", e, match[1]);
      return { type: "chart-error", error: "Biểu đồ không hợp lệ hoặc JSON lỗi." };
    }
  }
  return null;
}

function renderMarkdownOrImage(text) {
  // Nếu là link ảnh quickchart.io hoặc link ảnh phổ biến, render <img>
  const imgRegex = /^(https?:\/\/.+\.(?:png|jpg|jpeg|gif)|https?:\/\/quickchart\.io\/chart\?c=.+)$/i;
  if (typeof text === 'string' && imgRegex.test(text.trim())) {
    return <img src={text.trim()} alt="AI chart" style={{maxWidth: '100%', margin: '16px 0', borderRadius: 8}} />;
  }
  // Nếu là markdown có ![alt](url) thì ReactMarkdown sẽ tự render ảnh
  return <ReactMarkdown>{text}</ReactMarkdown>;
}

function renderMessageContent(content) {
  // Nếu là mảng, render từng phần tử
  if (Array.isArray(content)) {
    return content.map((item, idx) => <div key={idx}>{renderMessageContent(item)}</div>);
  }
  // Nếu là object chart
  if (isChartMessage(content)) return renderChart(content);
  // Nếu là object {type: 'text', text: ...}
  if (
    typeof content === "object" &&
    content !== null &&
    content.type === "text" &&
    typeof content.text === "string"
  ) {
    // Kiểm tra trong text có <chart> không
    const chartObj = extractChartFromString(content.text);
    if (chartObj) {
      return (
        <>
          {renderChart(chartObj)}
          {renderMarkdownOrImage(content.text.replace(/<chart>[\s\S]*?<\/chart>/i, ""))}
        </>
      );
    }
    return renderMarkdownOrImage(content.text);
  }
  // Nếu là string
  if (typeof content === "string") {
    const chartObj = extractChartFromString(content);
    if (chartObj) {
      return (
        <>
          {renderChart(chartObj)}
          {renderMarkdownOrImage(content.replace(/<chart>[\s\S]*?<\/chart>/i, ""))}
        </>
      );
    }
    return renderMarkdownOrImage(content);
  }
  // fallback
  return <pre>{JSON.stringify(content, null, 2)}</pre>;
}

function App() {
  const [input, setInput] = useState("");
  const [threadId, _] = useState(1);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    if (!input.trim()) return;

    const newMessage = { role: "user", content: input };
    setMessages((prev) => [...prev, newMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL ?? "http://localhost:5000"}/generate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ prompt: input, thread_id: threadId }),
        }
      );
      const data = await res.json();
      let aiReply = data?.content || "**Không có phản hồi từ AI.**";
      if (
        typeof aiReply === "string" &&
        aiReply.startsWith('"') &&
        aiReply.endsWith('"')
      ) {
        try {
          aiReply = JSON.parse(aiReply); // chuyển "\n" thành xuống dòng thật
        } catch (e) {
          console.log(e);
          aiReply = aiReply.slice(1, -1); // fallback: loại bỏ dấu ngoặc kép
        }
      }
      setMessages((prev) => [...prev, { role: "ai", content: aiReply }]);
    } catch (err) {
      console.error("Lỗi khi gọi API:", err);
      setMessages((prev) => [
        ...prev,
        { role: "ai", content: "**Lỗi khi gọi API.**" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-box">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${msg.role === "user" ? "user" : "ai"}`}
          >
            {renderMessageContent(msg.content)}
          </div>
        ))}
        {loading && (
          <div className="message ai">
            <em></em>
          </div>
        )}
      </div>
      <div className="input-area">
        <input
          type="text"
          placeholder="Nhập tin nhắn..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button onClick={handleSend} disabled={loading}>
          Gửi
        </button>
      </div>
    </div>
  );
}

export default App;
