import { useState, useMemo, useEffect } from "react";

// ── Utils ─────────────────────────────────────────────────────────
const LS = {
  get: (key, def) => {
    try { const v = localStorage.getItem(key); return v != null ? JSON.parse(v) : def; }
    catch { return def; }
  },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const DOW = ["日", "月", "火", "水", "木", "金", "土"];
const NOW = new Date();
const todayKey = `${NOW.getFullYear()}-${String(NOW.getMonth() + 1).padStart(2, "0")}-${String(NOW.getDate()).padStart(2, "0")}`;
const dateKey = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

function buildCalendar(year, month) {
  const first = new Date(year, month - 1, 1).getDay();
  const days = new Date(year, month, 0).getDate();
  const cells = [];
  for (let i = 0; i < first; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// ── Default data ──────────────────────────────────────────────────
const DEFAULT_TEAMS = [
  { id: "t1", name: "地上班",  color: "#3b82f6", accent: "#93c5fd" },
  { id: "t2", name: "多重班",  color: "#10b981", accent: "#6ee7b7" },
  { id: "t3", name: "回統班",  color: "#f59e0b", accent: "#fcd34d" },
  { id: "t4", name: "事務所",  color: "#8b5cf6", accent: "#c4b5fd" },
];

const DEFAULT_STATUSES = [
  { id: "出勤",    label: "出",    color: "#22c55e" },
  { id: "代休",    label: "代",    color: "#60a5fa" },
  { id: "入校",    label: "入",    color: "#c084fc" },
  { id: "休（前）", label: "（前）", color: "#fb923c" },
  { id: "休（後）", label: "（後）", color: "#fdba74" },
  { id: "特別",    label: "特",    color: "#facc15" },
  { id: "当直",    label: "当",    color: "#818cf8" },
  { id: "増警",    label: "増",    color: "#f87171" },
  { id: "訓練",    label: "訓",    color: "#2dd4bf" },
  { id: "明け",    label: "明",    color: "#f472b6" },
];

const DEFAULT_MEMBERS = [
  { id: 1,  name: "田中 一郎",   teamId: "t1", role: "班長" },
  { id: 2,  name: "佐藤 花子",   teamId: "t1", role: "" },
  { id: 3,  name: "鈴木 次郎",   teamId: "t1", role: "" },
  { id: 4,  name: "高橋 美咲",   teamId: "t1", role: "" },
  { id: 5,  name: "伊藤 健太",   teamId: "t1", role: "" },
  { id: 6,  name: "渡辺 麻衣",   teamId: "t1", role: "" },
  { id: 7,  name: "山本 大輔",   teamId: "t1", role: "" },
  { id: 8,  name: "中川 裕子",   teamId: "t1", role: "" },
  { id: 9,  name: "中村 直樹",   teamId: "t2", role: "班長" },
  { id: 10, name: "小林 由美",   teamId: "t2", role: "" },
  { id: 11, name: "加藤 浩二",   teamId: "t2", role: "" },
  { id: 12, name: "吉田 恵子",   teamId: "t2", role: "" },
  { id: 13, name: "山田 翔太",   teamId: "t2", role: "" },
  { id: 14, name: "松本 千夏",   teamId: "t2", role: "" },
  { id: 15, name: "井上 雄介",   teamId: "t2", role: "" },
  { id: 16, name: "木村 奈々",   teamId: "t2", role: "" },
  { id: 17, name: "林 勇気",     teamId: "t2", role: "" },
  { id: 18, name: "清水 彩花",   teamId: "t2", role: "" },
  { id: 19, name: "山口 誠",     teamId: "t3", role: "班長" },
  { id: 20, name: "斎藤 みゆき", teamId: "t3", role: "" },
  { id: 21, name: "松田 康平",   teamId: "t3", role: "" },
  { id: 22, name: "岡田 里奈",   teamId: "t3", role: "" },
  { id: 23, name: "藤田 悠斗",   teamId: "t3", role: "" },
  { id: 24, name: "橋本 茜",     teamId: "t3", role: "" },
  { id: 25, name: "石川 博",     teamId: "t3", role: "" },
  { id: 26, name: "前田 沙織",   teamId: "t3", role: "" },
  { id: 27, name: "後藤 竜也",   teamId: "t4", role: "所長" },
  { id: 28, name: "坂本 瑠衣",   teamId: "t4", role: "" },
];

const COLOR_PALETTE = [
  "#22c55e", "#60a5fa", "#c084fc", "#fb923c", "#fdba74",
  "#facc15", "#818cf8", "#f87171", "#2dd4bf", "#f472b6",
  "#38bdf8", "#a3e635", "#fb7185", "#34d399", "#fbbf24",
  "#e879f9", "#67e8f9", "#86efac", "#fca5a5", "#c4b5fd",
];

// ── Shared styles ─────────────────────────────────────────────────
const backBtnStyle = {
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.1)",
  color: "rgba(255,255,255,0.6)",
  borderRadius: 8, padding: "6px 12px",
  fontSize: 12, cursor: "pointer",
};

const inputStyle = {
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8, padding: "8px 12px",
  color: "#e2e8f0", fontSize: 13,
  width: "100%", outline: "none",
};

// ── App ───────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [selectedMember, setSelectedMember] = useState(null);
  const [teams]    = useState(() => LS.get("teams", DEFAULT_TEAMS));
  const [statuses, setStatuses] = useState(() => LS.get("statuses", DEFAULT_STATUSES));
  const [members,  setMembers]  = useState(() => LS.get("members",  DEFAULT_MEMBERS));
  const [attendanceData, setAttendanceData] = useState(() => LS.get("attendanceData", {}));

  useEffect(() => { LS.set("statuses",      statuses);      }, [statuses]);
  useEffect(() => { LS.set("members",       members);       }, [members]);
  useEffect(() => { LS.set("attendanceData", attendanceData); }, [attendanceData]);

  const year  = NOW.getFullYear();
  const month = NOW.getMonth() + 1;

  const getTeam = (id) => teams.find(t => t.id === id);
  const getSt   = (id) => {
    const s = statuses.find(s => s.id === id);
    if (!s) return null;
    return { ...s, bg: hexToRgba(s.color, 0.2), border: hexToRgba(s.color, 0.45) };
  };

  const ctx = { teams, statuses, members, attendanceData, setAttendanceData, getTeam, getSt, year, month };

  return (
    <div style={{
      minHeight: "100vh", background: "#0d0f18",
      fontFamily: "'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif",
      color: "#e2e8f0",
    }}>
      {screen === "home" && (
        <HomeScreen
          onInput={() => setScreen("input")}
          onBoard={() => setScreen("board")}
          onSettings={() => setScreen("settings")}
          year={year} month={month}
        />
      )}
      {screen === "input" && (
        <InputScreen
          {...ctx}
          selectedMember={selectedMember}
          setSelectedMember={setSelectedMember}
          onBack={() => setScreen("home")}
        />
      )}
      {screen === "board" && (
        <BoardScreen {...ctx} onBack={() => setScreen("home")} />
      )}
      {screen === "settings" && (
        <SettingsScreen
          teams={teams}
          statuses={statuses} setStatuses={setStatuses}
          members={members}   setMembers={setMembers}
          getTeam={getTeam}   getSt={getSt}
          onBack={() => setScreen("home")}
        />
      )}
    </div>
  );
}

// ── Home ──────────────────────────────────────────────────────────
function HomeScreen({ onInput, onBoard, onSettings, year, month }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh", gap: 32, padding: 24,
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.06em", marginBottom: 6 }}>
          出勤状況管理
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>{year}年 {month}月</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 320 }}>
        <BigButton label="自分の勤務を入力する" sub="カレンダーに月間の勤務を登録" color="#6366f1" onClick={onInput} />
        <BigButton label="全体ボードを見る"     sub="今日の班ごと出勤状況を確認"   color="#059669" onClick={onBoard} />
        <BigButton label="設定"                sub="メンバー・ステータスの管理"   color="#64748b" onClick={onSettings} />
      </div>
    </div>
  );
}

function BigButton({ label, sub, color, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: hover ? color : color + "33",
        border: `1.5px solid ${color}88`,
        borderRadius: 14, padding: "18px 24px",
        cursor: "pointer", textAlign: "left", transition: "all 0.18s",
      }}
    >
      <div style={{ fontSize: 15, fontWeight: 800, color: "#fff", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>{sub}</div>
    </button>
  );
}

// ── Input Screen ──────────────────────────────────────────────────
function InputScreen({
  year, month, selectedMember, setSelectedMember,
  attendanceData, setAttendanceData,
  members, teams, statuses, getTeam, getSt, onBack,
}) {
  const [popup, setPopup] = useState(null);
  const cells  = useMemo(() => buildCalendar(year, month), [year, month]);
  const member = members.find(m => m.id === selectedMember);
  const myData = selectedMember ? (attendanceData[selectedMember] || {}) : {};
  const team   = member ? getTeam(member.teamId) : null;

  const setStatus = (dk, statusId) => {
    setAttendanceData(prev => ({
      ...prev,
      [selectedMember]: { ...(prev[selectedMember] || {}), [dk]: statusId },
    }));
    setPopup(null);
  };

  const clearStatus = (dk) => {
    setAttendanceData(prev => {
      const copy = { ...(prev[selectedMember] || {}) };
      delete copy[dk];
      return { ...prev, [selectedMember]: copy };
    });
    setPopup(null);
  };

  return (
    <div
      style={{ maxWidth: 700, margin: "0 auto", padding: "16px 12px" }}
      onClick={() => setPopup(null)}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button onClick={onBack} style={backBtnStyle}>← 戻る</button>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800 }}>勤務入力</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>{year}年{month}月</div>
        </div>
      </div>

      {!selectedMember ? (
        /* Member select */
        <>
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginBottom: 14 }}>
            あなたの名前を選んでください
          </div>
          {teams.map(t => {
            const tm = members.filter(m => m.teamId === t.id);
            if (!tm.length) return null;
            return (
              <div key={t.id} style={{ marginBottom: 16 }}>
                <div style={{
                  fontSize: 11, fontWeight: 800, color: t.accent,
                  letterSpacing: "0.1em", marginBottom: 8,
                  borderLeft: `3px solid ${t.color}`, paddingLeft: 8,
                }}>{t.name}</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {tm.map(m => (
                    <button key={m.id} onClick={() => setSelectedMember(m.id)} style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      borderRadius: 8, padding: "7px 14px",
                      color: "#e2e8f0", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}>
                      {m.name}
                      {m.role && (
                        <span style={{ marginLeft: 5, fontSize: 9, color: t.accent }}>{m.role}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      ) : (
        /* Calendar view */
        <>
          {/* Selected member bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: `linear-gradient(90deg,${team.color}22,transparent)`,
            borderLeft: `3px solid ${team.color}`,
            borderRadius: 10, padding: "10px 14px", marginBottom: 16,
          }}>
            <div>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{member.name}</span>
              <span style={{
                marginLeft: 8, fontSize: 10, color: team.accent,
                background: `${team.color}22`, padding: "2px 8px", borderRadius: 5,
              }}>{team.name}</span>
            </div>
            <button onClick={() => setSelectedMember(null)} style={{
              background: "rgba(255,255,255,0.07)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.5)", borderRadius: 7,
              padding: "5px 12px", fontSize: 11, cursor: "pointer",
            }}>変更</button>
          </div>

          {/* Calendar grid */}
          <div style={{
            background: "rgba(255,255,255,0.03)", borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden",
          }}>
            {/* Day header */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
              {DOW.map((d, i) => (
                <div key={d} style={{
                  textAlign: "center", padding: "10px 0", fontSize: 11, fontWeight: 700,
                  color: i === 0 ? "#f87171" : i === 6 ? "#93c5fd" : "rgba(255,255,255,0.35)",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}>{d}</div>
              ))}
            </div>
            {/* Cells */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)" }}>
              {cells.map((day, idx) => {
                if (!day) return <div key={idx} style={{ minHeight: 72 }} />;
                const dk       = dateKey(year, month, day);
                const status   = myData[dk];
                const st       = status ? getSt(status) : null;
                const isToday  = dk === todayKey;
                const isFuture = dk > todayKey;
                const dow      = idx % 7;
                const isWknd   = dow === 0 || dow === 6;
                const isOpen   = popup === dk;

                return (
                  <div key={dk} style={{
                    position: "relative",
                    borderRight: "1px solid rgba(255,255,255,0.04)",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    <div
                      onClick={e => { e.stopPropagation(); if (!isFuture) setPopup(isOpen ? null : dk); }}
                      style={{
                        minHeight: 72, padding: "6px 6px 4px",
                        background: isToday ? "rgba(99,102,241,0.12)"
                          : isWknd ? "rgba(255,255,255,0.015)" : "transparent",
                        cursor: isFuture ? "default" : "pointer",
                        display: "flex", flexDirection: "column", gap: 4,
                        transition: "background 0.12s",
                      }}
                    >
                      <div style={{
                        fontSize: 12, fontWeight: isToday ? 900 : 600,
                        color: isToday ? "#818cf8"
                          : isFuture ? "rgba(255,255,255,0.2)"
                          : dow === 0 ? "#f87171" : dow === 6 ? "#93c5fd"
                          : "rgba(255,255,255,0.7)",
                        display: "flex", alignItems: "center", gap: 3,
                      }}>
                        {day}
                        {isToday && (
                          <span style={{
                            fontSize: 8, color: "#818cf8",
                            background: "rgba(99,102,241,0.25)",
                            borderRadius: 3, padding: "0 4px", fontWeight: 800,
                          }}>今日</span>
                        )}
                      </div>
                      {st && (
                        <div style={{
                          background: st.bg, border: `1px solid ${st.border}`,
                          color: st.color, borderRadius: 5, padding: "2px 5px",
                          fontSize: 10, fontWeight: 800, textAlign: "center", lineHeight: 1.3,
                        }}>{st.label}</div>
                      )}
                      {!st && !isFuture && !isWknd && (
                        <div style={{
                          fontSize: 9, color: "rgba(255,255,255,0.15)",
                          textAlign: "center", marginTop: 2,
                        }}>タップ</div>
                      )}
                    </div>

                    {/* Status popup */}
                    {isOpen && (
                      <div
                        onClick={e => e.stopPropagation()}
                        style={{
                          position: "absolute",
                          left:  idx % 7 >= 5 ? "auto" : 0,
                          right: idx % 7 >= 5 ? 0 : "auto",
                          top: "100%",
                          background: "#1a1d2e",
                          border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: 11, padding: 6, zIndex: 500,
                          display: "grid", gridTemplateColumns: "1fr 1fr",
                          gap: 3, minWidth: 190,
                          boxShadow: "0 10px 40px rgba(0,0,0,0.7)",
                        }}
                      >
                        {statuses.map(s => {
                          const sst = getSt(s.id);
                          return (
                            <button key={s.id} onClick={() => setStatus(dk, s.id)} style={{
                              background: status === s.id ? sst.bg : "transparent",
                              border: status === s.id
                                ? `1px solid ${sst.border}` : "1px solid transparent",
                              color: status === s.id ? sst.color : "rgba(255,255,255,0.6)",
                              borderRadius: 7, padding: "6px 8px", fontSize: 11,
                              cursor: "pointer",
                              fontWeight: status === s.id ? 800 : 400,
                              textAlign: "left", transition: "all 0.1s",
                            }}>{s.id}</button>
                          );
                        })}
                        {status && (
                          <button onClick={() => clearStatus(dk)} style={{
                            gridColumn: "1/-1",
                            background: "rgba(239,68,68,0.12)",
                            border: "1px solid rgba(239,68,68,0.25)",
                            color: "#f87171", borderRadius: 7, padding: "5px 8px",
                            fontSize: 10, cursor: "pointer", marginTop: 2,
                          }}>クリア</button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legend */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 14 }}>
            {statuses.map(s => {
              const sst = getSt(s.id);
              return (
                <div key={s.id} style={{
                  fontSize: 10, padding: "2px 8px", borderRadius: 5,
                  background: sst.bg, color: sst.color,
                  border: `1px solid ${sst.border}`, fontWeight: 700,
                }}>{sst.label}</div>
              );
            })}
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 8 }}>
            ※ 過去〜今日のマスをタップしてステータスを設定できます
          </div>
        </>
      )}
    </div>
  );
}

// ── Board Screen ──────────────────────────────────────────────────
function BoardScreen({ year, month, attendanceData, members, teams, statuses, getTeam, getSt, onBack }) {
  const [filterTeam, setFilterTeam] = useState("ALL");

  const todayStatuses = useMemo(() => {
    const map = {};
    members.forEach(m => { map[m.id] = attendanceData[m.id]?.[todayKey] || null; });
    return map;
  }, [attendanceData, members]);

  const displayed  = filterTeam === "ALL" ? teams : teams.filter(t => t.id === filterTeam);
  const presentAll = members.filter(m => todayStatuses[m.id] === "出勤").length;
  const notInput   = members.filter(m => !todayStatuses[m.id]).length;
  const dateLabel  = `${NOW.getMonth() + 1}/${NOW.getDate()}（${DOW[NOW.getDay()]}）`;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: "16px 12px" }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 18,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={backBtnStyle}>← 戻る</button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>全体ボード</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
              {year}年{month}月 · 本日 {dateLabel}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          <Chip label="出勤" val={presentAll} color="#22c55e" />
          <Chip label="未入力" val={notInput}   color="#94a3b8" />
        </div>
      </div>

      {/* Status summary bar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {statuses.map(s => {
          const cnt = members.filter(m => todayStatuses[m.id] === s.id).length;
          if (!cnt) return null;
          const st = getSt(s.id);
          return (
            <div key={s.id} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 7,
              background: st.bg, border: `1px solid ${st.border}`,
            }}>
              <span style={{ fontSize: 11, color: st.color, fontWeight: 700 }}>{st.label}</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: st.color }}>{cnt}</span>
            </div>
          );
        })}
      </div>

      {/* Team filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[{ id: "ALL", name: "全班", color: "#6366f1" }, ...teams].map(item => {
          const t      = teams.find(t => t.id === item.id);
          const active = filterTeam === item.id;
          const col    = t ? t.color : "#6366f1";
          return (
            <button key={item.id} onClick={() => setFilterTeam(item.id)} style={{
              padding: "5px 14px", borderRadius: 8, border: "none",
              cursor: "pointer", fontSize: 12,
              background: active ? col + "44" : "rgba(255,255,255,0.05)",
              color: active ? "#fff" : "rgba(255,255,255,0.4)",
              fontWeight: active ? 800 : 400,
              outline: active ? `1.5px solid ${col}` : "1.5px solid transparent",
            }}>{item.name}</button>
          );
        })}
      </div>

      {/* Team cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {displayed.map(team => {
          const tm      = members.filter(m => m.teamId === team.id);
          const present = tm.filter(m => todayStatuses[m.id] === "出勤").length;
          return (
            <div key={team.id} style={{
              background: "rgba(255,255,255,0.03)", borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.07)",
            }}>
              <div style={{
                padding: "10px 14px",
                background: `linear-gradient(90deg,${team.color}22,transparent)`,
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                borderLeft: `3px solid ${team.color}`,
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}>
                <span style={{ fontWeight: 800, fontSize: 14, color: team.accent }}>{team.name}</span>
                <span style={{
                  fontSize: 11, padding: "2px 10px", borderRadius: 20,
                  background: "rgba(34,197,94,0.18)", color: "#22c55e", fontWeight: 800,
                }}>出勤 {present}/{tm.length}</span>
              </div>
              <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
                {tm.map(mem => {
                  const sid = todayStatuses[mem.id];
                  const st  = sid ? getSt(sid) : null;
                  return (
                    <div key={mem.id} style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "7px 10px", borderRadius: 9,
                      background: "rgba(255,255,255,0.025)",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ fontSize: 13, fontWeight: 600 }}>{mem.name}</span>
                        {mem.role && (
                          <span style={{
                            fontSize: 9, padding: "1px 5px", borderRadius: 4,
                            background: "rgba(139,92,246,0.2)", color: "#a78bfa", fontWeight: 700,
                          }}>{mem.role}</span>
                        )}
                      </div>
                      {st ? (
                        <div style={{
                          background: st.bg, border: `1px solid ${st.border}`,
                          color: st.color, borderRadius: 7, padding: "4px 10px",
                          fontSize: 11, fontWeight: 800,
                        }}>{st.label}</div>
                      ) : (
                        <div style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.08)",
                          color: "rgba(255,255,255,0.25)", borderRadius: 7,
                          padding: "4px 10px", fontSize: 11,
                        }}>未入力</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Settings Screen ───────────────────────────────────────────────
function SettingsScreen({ teams, statuses, setStatuses, members, setMembers, getTeam, getSt, onBack }) {
  const [section, setSection] = useState(null);

  if (section === "members") {
    return (
      <MembersSettings
        teams={teams} members={members} setMembers={setMembers}
        getTeam={getTeam} onBack={() => setSection(null)}
      />
    );
  }
  if (section === "statuses") {
    return (
      <StatusesSettings
        statuses={statuses} setStatuses={setStatuses}
        getSt={getSt} onBack={() => setSection(null)}
      />
    );
  }

  return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: "16px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <button onClick={onBack} style={backBtnStyle}>← 戻る</button>
        <div style={{ fontSize: 15, fontWeight: 800 }}>設定</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SettingRow icon="👥" title="メンバー管理"   sub="メンバーの追加・編集・削除"       onClick={() => setSection("members")} />
        <SettingRow icon="🏷️" title="ステータス管理" sub="勤務カテゴリの追加・編集・削除" onClick={() => setSection("statuses")} />
      </div>
    </div>
  );
}

function SettingRow({ icon, title, sub, onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 14,
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 12, padding: "14px 16px",
      cursor: "pointer", textAlign: "left", width: "100%",
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#e2e8f0" }}>{title}</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", marginTop: 2 }}>{sub}</div>
      </div>
      <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.3)", fontSize: 16 }}>›</span>
    </button>
  );
}

// ── Members Settings ──────────────────────────────────────────────
function MembersSettings({ teams, members, setMembers, onBack }) {
  const [form, setForm] = useState(null);

  const openAdd  = () => setForm({ name: "", teamId: teams[0]?.id || "", role: "" });
  const openEdit = (m) => setForm({ ...m });
  const close    = () => setForm(null);

  const save = () => {
    if (!form.name.trim()) return;
    if (form.id) {
      setMembers(prev => prev.map(m => m.id === form.id ? { ...form, name: form.name.trim() } : m));
    } else {
      const newId = Math.max(0, ...members.map(m => m.id)) + 1;
      setMembers(prev => [...prev, { id: newId, name: form.name.trim(), teamId: form.teamId, role: form.role }]);
    }
    close();
  };

  const remove = (id) => {
    if (window.confirm("このメンバーを削除しますか？")) {
      setMembers(prev => prev.filter(m => m.id !== id));
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={backBtnStyle}>← 戻る</button>
          <div style={{ fontSize: 15, fontWeight: 800 }}>メンバー管理</div>
        </div>
        <button onClick={openAdd} style={{
          background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.5)",
          color: "#818cf8", borderRadius: 8, padding: "7px 14px",
          fontSize: 12, cursor: "pointer", fontWeight: 700,
        }}>+ 追加</button>
      </div>

      {/* Form */}
      {form && (
        <div style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12, padding: 16, marginBottom: 20,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>
            {form.id ? "メンバーを編集" : "新規メンバーを追加"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>
                名前 *
              </label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="例: 田中 一郎"
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>
                班
              </label>
              <select
                style={{ ...inputStyle, appearance: "none" }}
                value={form.teamId}
                onChange={e => setForm(f => ({ ...f, teamId: e.target.value }))}
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>
                役職（任意）
              </label>
              <input
                style={inputStyle}
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                placeholder="例: 班長、所長"
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={save} style={{
                background: "rgba(99,102,241,0.3)", border: "1px solid rgba(99,102,241,0.5)",
                color: "#818cf8", borderRadius: 8, padding: "8px 20px",
                fontSize: 13, cursor: "pointer", fontWeight: 700,
              }}>保存</button>
              <button onClick={close} style={{
                background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.4)", borderRadius: 8,
                padding: "8px 20px", fontSize: 13, cursor: "pointer",
              }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* Member list */}
      {teams.map(t => {
        const tm = members.filter(m => m.teamId === t.id);
        if (!tm.length) return null;
        return (
          <div key={t.id} style={{ marginBottom: 16 }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: t.accent,
              letterSpacing: "0.1em", marginBottom: 8,
              borderLeft: `3px solid ${t.color}`, paddingLeft: 8,
            }}>{t.name}（{tm.length}人）</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {tm.map(m => (
                <div key={m.id} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "rgba(255,255,255,0.03)",
                  border: "1px solid rgba(255,255,255,0.06)",
                  borderRadius: 8, padding: "8px 12px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 13 }}>{m.name}</span>
                    {m.role && (
                      <span style={{
                        fontSize: 9, padding: "1px 5px", borderRadius: 4,
                        background: "rgba(139,92,246,0.2)", color: "#a78bfa",
                      }}>{m.role}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={() => openEdit(m)} style={{
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.5)", borderRadius: 6,
                      padding: "4px 10px", fontSize: 11, cursor: "pointer",
                    }}>編集</button>
                    <button onClick={() => remove(m.id)} style={{
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.2)",
                      color: "#f87171", borderRadius: 6,
                      padding: "4px 10px", fontSize: 11, cursor: "pointer",
                    }}>削除</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Statuses Settings ─────────────────────────────────────────────
function StatusesSettings({ statuses, setStatuses, getSt, onBack }) {
  const [form, setForm] = useState(null);

  const openAdd  = () => setForm({ id: "", label: "", color: COLOR_PALETTE[0], _editing: false });
  const openEdit = (s) => setForm({ ...s, _editing: true, _origId: s.id });
  const close    = () => setForm(null);

  const save = () => {
    const name = form.id.trim();
    const lbl  = form.label.trim();
    if (!name || !lbl) return;

    if (form._editing) {
      setStatuses(prev => prev.map(s =>
        s.id === form._origId ? { id: name, label: lbl, color: form.color } : s
      ));
    } else {
      if (statuses.find(s => s.id === name)) {
        alert("同じ名前のステータスが既に存在します");
        return;
      }
      setStatuses(prev => [...prev, { id: name, label: lbl, color: form.color }]);
    }
    close();
  };

  const remove = (id) => {
    if (window.confirm(`「${id}」を削除しますか？`)) {
      setStatuses(prev => prev.filter(s => s.id !== id));
    }
  };

  return (
    <div style={{ maxWidth: 600, margin: "0 auto", padding: "16px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={backBtnStyle}>← 戻る</button>
          <div style={{ fontSize: 15, fontWeight: 800 }}>ステータス管理</div>
        </div>
        <button onClick={openAdd} style={{
          background: "rgba(99,102,241,0.25)", border: "1px solid rgba(99,102,241,0.5)",
          color: "#818cf8", borderRadius: 8, padding: "7px 14px",
          fontSize: 12, cursor: "pointer", fontWeight: 700,
        }}>+ 追加</button>
      </div>

      {/* Form */}
      {form && (
        <div style={{
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 12, padding: 16, marginBottom: 20,
        }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12 }}>
            {form._editing ? "ステータスを編集" : "新規ステータスを追加"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>
                名前 *（例: 出勤、当直）
              </label>
              <input
                style={inputStyle}
                value={form.id}
                onChange={e => setForm(f => ({ ...f, id: e.target.value }))}
                placeholder="例: 夜勤"
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>
                略称ラベル *（カレンダーに表示される短い文字）
              </label>
              <input
                style={inputStyle}
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="例: 夜"
                maxLength={6}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 6 }}>
                カラー
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {COLOR_PALETTE.map(c => (
                  <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{
                    width: 28, height: 28, borderRadius: 6,
                    background: c,
                    border: form.color === c ? "2.5px solid #fff" : "2px solid transparent",
                    cursor: "pointer", padding: 0,
                    boxShadow: form.color === c ? `0 0 8px ${c}` : "none",
                  }} />
                ))}
              </div>
              <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>プレビュー:</span>
                <div style={{
                  background: hexToRgba(form.color, 0.2),
                  border: `1px solid ${hexToRgba(form.color, 0.45)}`,
                  color: form.color, borderRadius: 5, padding: "2px 10px",
                  fontSize: 12, fontWeight: 800,
                }}>{form.label || "？"}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={save} style={{
                background: "rgba(99,102,241,0.3)", border: "1px solid rgba(99,102,241,0.5)",
                color: "#818cf8", borderRadius: 8, padding: "8px 20px",
                fontSize: 13, cursor: "pointer", fontWeight: 700,
              }}>保存</button>
              <button onClick={close} style={{
                background: "transparent", border: "1px solid rgba(255,255,255,0.1)",
                color: "rgba(255,255,255,0.4)", borderRadius: 8,
                padding: "8px 20px", fontSize: 13, cursor: "pointer",
              }}>キャンセル</button>
            </div>
          </div>
        </div>
      )}

      {/* Status list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {statuses.map(s => {
          const st = getSt(s.id);
          return (
            <div key={s.id} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 9, padding: "8px 12px",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  background: st.bg, border: `1px solid ${st.border}`,
                  color: st.color, borderRadius: 5, padding: "3px 10px",
                  fontSize: 12, fontWeight: 800, minWidth: 36, textAlign: "center",
                }}>{st.label}</div>
                <span style={{ fontSize: 13 }}>{s.id}</span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => openEdit(s)} style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  color: "rgba(255,255,255,0.5)", borderRadius: 6,
                  padding: "4px 10px", fontSize: 11, cursor: "pointer",
                }}>編集</button>
                <button onClick={() => remove(s.id)} style={{
                  background: "rgba(239,68,68,0.1)",
                  border: "1px solid rgba(239,68,68,0.2)",
                  color: "#f87171", borderRadius: 6,
                  padding: "4px 10px", fontSize: 11, cursor: "pointer",
                }}>削除</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Shared ────────────────────────────────────────────────────────
function Chip({ label, val, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{label}</span>
      <span style={{ fontSize: 18, fontWeight: 800, color, lineHeight: 1 }}>{val}</span>
    </div>
  );
}
