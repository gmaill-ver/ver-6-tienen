import { useState, useMemo, useEffect } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import AuthScreen from "./AuthScreen";

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
  // Auth state (undefined=loading, null=未ログイン, object=ログイン済み)
  const [user, setUser] = useState(undefined);

  useEffect(() => onAuthStateChanged(auth, u => setUser(u)), []);

  if (user === undefined) return (
    <div style={{
      minHeight: "100vh", background: "#0d0f18",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Hiragino Kaku Gothic ProN',sans-serif", color: "#e2e8f0",
    }}>読み込み中...</div>
  );
  if (!user) return <AuthScreen />;

  return <MainApp user={user} />;
}

function MainApp({ user }) {
  const [screen, setScreen] = useState("home");
  const [selectedMember, setSelectedMember] = useState(null);
  const [teams]    = useState(() => LS.get("teams", DEFAULT_TEAMS));
  const [statuses, setStatuses] = useState(() => LS.get("statuses", DEFAULT_STATUSES));
  const [members,  setMembers]  = useState(() => LS.get("members",  DEFAULT_MEMBERS));
  const [attendanceData, setAttendanceData] = useState(() => LS.get("attendanceData", {}));

  // 月ナビゲーション
  const [viewYear,  setViewYear]  = useState(NOW.getFullYear());
  const [viewMonth, setViewMonth] = useState(NOW.getMonth() + 1);

  const goPrev = () => {
    if (viewMonth === 1) { setViewYear(y => y - 1); setViewMonth(12); }
    else setViewMonth(m => m - 1);
  };
  const goNext = () => {
    if (viewMonth === 12) { setViewYear(y => y + 1); setViewMonth(1); }
    else setViewMonth(m => m + 1);
  };
  const goToday = () => { setViewYear(NOW.getFullYear()); setViewMonth(NOW.getMonth() + 1); };

  useEffect(() => { LS.set("statuses",       statuses);       }, [statuses]);
  useEffect(() => { LS.set("members",        members);        }, [members]);
  useEffect(() => { LS.set("attendanceData", attendanceData); }, [attendanceData]);

  const getTeam = (id) => teams.find(t => t.id === id);
  const getSt   = (id) => {
    const s = statuses.find(s => s.id === id);
    if (!s) return null;
    return { ...s, bg: hexToRgba(s.color, 0.2), border: hexToRgba(s.color, 0.45) };
  };

  const isAdmin = user.email === import.meta.env.VITE_ADMIN_EMAIL;
  const nav     = { viewYear, viewMonth, goPrev, goNext, goToday };
  const ctx     = { teams, statuses, members, attendanceData, setAttendanceData, getTeam, getSt, ...nav };

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
          user={user}
          viewYear={viewYear} viewMonth={viewMonth}
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
          isAdmin={isAdmin}
          onBack={() => setScreen("home")}
        />
      )}
    </div>
  );
}

// ── Home ──────────────────────────────────────────────────────────
function HomeScreen({ onInput, onBoard, onSettings, user, viewYear, viewMonth }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", minHeight: "100vh", gap: 32, padding: 24,
    }}>
      {/* ユーザー情報 + ログアウト */}
      <div style={{
        position: "fixed", top: 16, right: 16,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>{user.email}</span>
        <button
          onClick={() => signOut(auth)}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            color: "rgba(255,255,255,0.4)", borderRadius: 6,
            padding: "4px 10px", fontSize: 11, cursor: "pointer",
          }}
        >ログアウト</button>
      </div>

      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
        <div style={{ fontSize: 22, fontWeight: 900, letterSpacing: "0.06em", marginBottom: 6 }}>
          出勤状況管理
        </div>
        <div style={{ fontSize: 13, color: "rgba(255,255,255,0.35)" }}>{viewYear}年 {viewMonth}月</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, width: "100%", maxWidth: 320 }}>
        <BigButton label="自分の勤務を入力する" sub="カレンダーに月間の勤務を登録" color="#6366f1" onClick={onInput} />
        <BigButton label="全体ボードを見る"     sub="月間の班ごと出勤状況を確認"   color="#059669" onClick={onBoard} />
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
function MonthNav({ viewYear, viewMonth, goPrev, goNext, goToday }) {
  const isThisMonth = viewYear === NOW.getFullYear() && viewMonth === NOW.getMonth() + 1;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <button onClick={goPrev} style={{
        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.7)", borderRadius: 7, padding: "5px 10px",
        fontSize: 13, cursor: "pointer",
      }}>‹</button>
      <div style={{
        fontSize: 14, fontWeight: 800, minWidth: 90, textAlign: "center",
        color: isThisMonth ? "#818cf8" : "#e2e8f0",
      }}>{viewYear}年{viewMonth}月</div>
      <button onClick={goNext} style={{
        background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
        color: "rgba(255,255,255,0.7)", borderRadius: 7, padding: "5px 10px",
        fontSize: 13, cursor: "pointer",
      }}>›</button>
      {!isThisMonth && (
        <button onClick={goToday} style={{
          background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.4)",
          color: "#818cf8", borderRadius: 7, padding: "4px 8px",
          fontSize: 10, cursor: "pointer", fontWeight: 700,
        }}>今月</button>
      )}
    </div>
  );
}

function InputScreen({
  viewYear, viewMonth, goPrev, goNext, goToday,
  selectedMember, setSelectedMember,
  attendanceData, setAttendanceData,
  members, teams, statuses, getTeam, getSt, onBack,
}) {
  const year = viewYear; const month = viewMonth;
  const [activeStatus, setActiveStatus] = useState(null); // 選択中カテゴリ（null=消去モード以外）
  const [eraseMode, setEraseMode] = useState(false);
  const cells  = useMemo(() => buildCalendar(year, month), [year, month]);
  const member = members.find(m => m.id === selectedMember);
  const myData = selectedMember ? (attendanceData[selectedMember] || {}) : {};
  const team   = member ? getTeam(member.teamId) : null;

  const handleCellTap = (dk) => {
    if (!selectedMember) return;
    if (eraseMode) {
      setAttendanceData(prev => {
        const copy = { ...(prev[selectedMember] || {}) };
        delete copy[dk];
        return { ...prev, [selectedMember]: copy };
      });
    } else if (activeStatus) {
      // 同じステータスをタップしたらクリア（トグル）
      if (myData[dk] === activeStatus) {
        setAttendanceData(prev => {
          const copy = { ...(prev[selectedMember] || {}) };
          delete copy[dk];
          return { ...prev, [selectedMember]: copy };
        });
      } else {
        setAttendanceData(prev => ({
          ...prev,
          [selectedMember]: { ...(prev[selectedMember] || {}), [dk]: activeStatus },
        }));
      }
    }
  };

  const selectStatus = (sid) => {
    setEraseMode(false);
    setActiveStatus(prev => prev === sid ? null : sid);
  };

  const toggleErase = () => {
    setEraseMode(prev => !prev);
    setActiveStatus(null);
  };

  return (
    <div style={{ maxWidth: 700, margin: "0 auto", padding: "16px 12px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={backBtnStyle}>← 戻る</button>
          <div style={{ fontSize: 15, fontWeight: 800 }}>勤務入力</div>
        </div>
        <MonthNav viewYear={viewYear} viewMonth={viewMonth} goPrev={goPrev} goNext={goNext} goToday={goToday} />
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

          {/* ── カテゴリ選択パレット ── */}
          <div style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 12, padding: "10px 12px", marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)", marginBottom: 8 }}>
              カテゴリを選んでから日付をタップ
              {(activeStatus || eraseMode) && (
                <span style={{ marginLeft: 8, color: eraseMode ? "#f87171" : getSt(activeStatus)?.color }}>
                  ▶ {eraseMode ? "消去モード" : `「${activeStatus}」を適用中`}
                </span>
              )}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {statuses.map(s => {
                const sst     = getSt(s.id);
                const isActive = activeStatus === s.id && !eraseMode;
                return (
                  <button key={s.id} onClick={() => selectStatus(s.id)} style={{
                    background: isActive ? sst.bg : "rgba(255,255,255,0.04)",
                    border: isActive ? `2px solid ${sst.color}` : "1px solid rgba(255,255,255,0.1)",
                    color: isActive ? sst.color : "rgba(255,255,255,0.55)",
                    borderRadius: 8, padding: "6px 12px",
                    fontSize: 12, fontWeight: isActive ? 800 : 400,
                    cursor: "pointer", transition: "all 0.1s",
                    transform: isActive ? "scale(1.05)" : "scale(1)",
                  }}>{s.id}</button>
                );
              })}
              <button onClick={toggleErase} style={{
                background: eraseMode ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.04)",
                border: eraseMode ? "2px solid #f87171" : "1px solid rgba(255,255,255,0.1)",
                color: eraseMode ? "#f87171" : "rgba(255,255,255,0.4)",
                borderRadius: 8, padding: "6px 12px",
                fontSize: 12, fontWeight: eraseMode ? 800 : 400,
                cursor: "pointer", transition: "all 0.1s",
              }}>消去</button>
            </div>
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
                if (!day) return <div key={idx} style={{ minHeight: 64 }} />;
                const dk      = dateKey(year, month, day);
                const status  = myData[dk];
                const st      = status ? getSt(status) : null;
                const isToday = dk === todayKey;
                const dow     = idx % 7;
                const isWknd  = dow === 0 || dow === 6;
                const canTap  = activeStatus || eraseMode;

                return (
                  <div
                    key={dk}
                    onClick={() => canTap && handleCellTap(dk)}
                    style={{
                      minHeight: 64, padding: "6px 6px 4px",
                      borderRight: "1px solid rgba(255,255,255,0.04)",
                      borderBottom: "1px solid rgba(255,255,255,0.04)",
                      background: isToday ? "rgba(99,102,241,0.12)"
                        : isWknd ? "rgba(255,255,255,0.015)" : "transparent",
                      cursor: canTap ? "pointer" : "default",
                      display: "flex", flexDirection: "column", gap: 4,
                      transition: "background 0.1s",
                      userSelect: "none",
                    }}
                  >
                    <div style={{
                      fontSize: 12, fontWeight: isToday ? 900 : 600,
                      color: isToday ? "#818cf8"
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
                    {!st && canTap && !isWknd && (
                      <div style={{
                        fontSize: 9, color: "rgba(255,255,255,0.15)",
                        textAlign: "center", marginTop: 2,
                      }}>+</div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", marginTop: 8 }}>
            ※ カテゴリを選択してから日付をタップ。同じカテゴリをタップするとクリア
          </div>
        </>
      )}
    </div>
  );
}

// ── Board Screen ──────────────────────────────────────────────────
function BoardScreen({ viewYear, viewMonth, goPrev, goNext, goToday, attendanceData, members, teams, statuses, getTeam, getSt, onBack }) {
  const year = viewYear; const month = viewMonth;
  const [filterTeam, setFilterTeam] = useState("ALL");

  const days = new Date(year, month, 0).getDate();
  const allDays = Array.from({ length: days }, (_, i) => i + 1);

  const displayedMembers = useMemo(() =>
    filterTeam === "ALL"
      ? members
      : members.filter(m => m.teamId === filterTeam),
    [members, filterTeam]
  );

  // 今日の出勤人数
  const presentToday = members.filter(m =>
    attendanceData[m.id]?.[todayKey] === "出勤"
  ).length;

  const CELL_W    = 36;
  const NAME_COL_W = 90;

  return (
    <div style={{ padding: "16px 12px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button onClick={onBack} style={backBtnStyle}>← 戻る</button>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800 }}>全体ボード</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.35)" }}>
              今日の出勤 {presentToday}/{members.length}人
            </div>
          </div>
        </div>
        <MonthNav viewYear={viewYear} viewMonth={viewMonth} goPrev={goPrev} goNext={goNext} goToday={goToday} />
      </div>

      {/* Team filter */}
      <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap" }}>
        {[{ id: "ALL", name: "全班" }, ...teams].map(item => {
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

      {/* Monthly table: 縦=メンバー 横=日付 */}
      <div style={{ overflowX: "auto", borderRadius: 12, border: "1px solid rgba(255,255,255,0.07)" }}>
        <table style={{
          borderCollapse: "collapse", fontSize: 11,
          minWidth: NAME_COL_W + days * CELL_W,
        }}>
          {/* Column headers: dates */}
          <thead>
            <tr>
              <th style={{
                position: "sticky", left: 0, zIndex: 10,
                background: "#131520", minWidth: NAME_COL_W,
                padding: "8px 6px",
                borderBottom: "1px solid rgba(255,255,255,0.1)",
                borderRight: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.3)", fontSize: 10,
              }}>メンバー</th>
              {allDays.map(day => {
                const dk   = dateKey(year, month, day);
                const dow  = new Date(year, month - 1, day).getDay();
                const isToday = dk === todayKey;
                return (
                  <th key={day} style={{
                    minWidth: CELL_W, width: CELL_W,
                    padding: "4px 2px",
                    background: isToday ? "#1e2040" : "#131520",
                    borderBottom: "1px solid rgba(255,255,255,0.1)",
                    borderRight: "1px solid rgba(255,255,255,0.04)",
                    textAlign: "center",
                  }}>
                    <div style={{
                      fontSize: 10, fontWeight: isToday ? 900 : 600,
                      color: isToday ? "#818cf8"
                        : dow === 0 ? "#f87171"
                        : dow === 6 ? "#93c5fd"
                        : "rgba(255,255,255,0.5)",
                    }}>{day}</div>
                    <div style={{
                      fontSize: 9,
                      color: isToday ? "#818cf8"
                        : dow === 0 ? "#f87171"
                        : dow === 6 ? "#93c5fd"
                        : "rgba(255,255,255,0.25)",
                    }}>{DOW[dow]}</div>
                    {isToday && (
                      <div style={{
                        fontSize: 7, color: "#818cf8",
                        background: "rgba(99,102,241,0.25)",
                        borderRadius: 2, lineHeight: "14px",
                      }}>今日</div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {displayedMembers.map(mem => {
              const t = getTeam(mem.teamId);
              return (
                <tr key={mem.id}>
                  {/* Member name cell */}
                  <td style={{
                    position: "sticky", left: 0, zIndex: 5,
                    background: "#0d0f18",
                    padding: "5px 10px",
                    borderBottom: "1px solid rgba(255,255,255,0.04)",
                    borderRight: "1px solid rgba(255,255,255,0.08)",
                    whiteSpace: "nowrap",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      {t && (
                        <span style={{
                          width: 3, height: 14, borderRadius: 2,
                          background: t.color, display: "inline-block", flexShrink: 0,
                        }} />
                      )}
                      <span style={{
                        fontSize: 12, fontWeight: 600,
                        color: "rgba(255,255,255,0.8)",
                      }}>{mem.name}</span>
                      {mem.role && (
                        <span style={{
                          fontSize: 8, padding: "1px 4px", borderRadius: 3,
                          background: "rgba(139,92,246,0.2)", color: "#a78bfa",
                        }}>{mem.role}</span>
                      )}
                    </div>
                  </td>
                  {/* Status cells */}
                  {allDays.map(day => {
                    const dk  = dateKey(year, month, day);
                    const dow = new Date(year, month - 1, day).getDay();
                    const sid = attendanceData[mem.id]?.[dk] || null;
                    const st  = sid ? getSt(sid) : null;
                    const isToday = dk === todayKey;
                    const isWknd  = dow === 0 || dow === 6;
                    return (
                      <td key={day} style={{
                        textAlign: "center", padding: "3px 2px",
                        borderBottom: "1px solid rgba(255,255,255,0.04)",
                        borderRight: "1px solid rgba(255,255,255,0.04)",
                        background: isToday ? "rgba(99,102,241,0.08)"
                          : isWknd ? "rgba(255,255,255,0.015)" : "transparent",
                      }}>
                        {st ? (
                          <div style={{
                            display: "inline-block",
                            background: st.bg, border: `1px solid ${st.border}`,
                            color: st.color, borderRadius: 4, padding: "1px 3px",
                            fontSize: 9, fontWeight: 800, lineHeight: 1.4,
                          }}>{st.label}</div>
                        ) : (
                          <span style={{ color: "rgba(255,255,255,0.08)", fontSize: 10 }}>-</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
        {statuses.map(s => {
          const st = getSt(s.id);
          return (
            <div key={s.id} style={{
              fontSize: 10, padding: "2px 8px", borderRadius: 5,
              background: st.bg, color: st.color,
              border: `1px solid ${st.border}`, fontWeight: 700,
            }}>{st.label} {s.id}</div>
          );
        })}
      </div>
    </div>
  );
}

// ── Settings Screen ───────────────────────────────────────────────
function SettingsScreen({ teams, statuses, setStatuses, members, setMembers, getTeam, getSt, isAdmin, onBack }) {
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
  if (section === "whitelist" && isAdmin) {
    return <WhitelistSettings onBack={() => setSection(null)} />;
  }

  return (
    <div style={{ maxWidth: 500, margin: "0 auto", padding: "16px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
        <button onClick={onBack} style={backBtnStyle}>← 戻る</button>
        <div style={{ fontSize: 15, fontWeight: 800 }}>設定</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SettingRow icon="👥" title="メンバー管理"   sub="メンバーの追加・編集・削除"       onClick={() => setSection("members")} />
        <SettingRow icon="🏷️" title="ステータス管理" sub="勤務カテゴリの追加・編集・削除"   onClick={() => setSection("statuses")} />
        {isAdmin && (
          <SettingRow icon="🔐" title="承認メール管理" sub="ログインを許可するメールアドレスの管理" onClick={() => setSection("whitelist")} />
        )}
      </div>
    </div>
  );
}

// ── Whitelist Settings (管理者のみ) ───────────────────────────────
function WhitelistSettings({ onBack }) {
  const [emails,   setEmails]   = useState([]);
  const [newEmail, setNewEmail] = useState("");
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);

  useEffect(() => {
    getDocs(collection(db, "allowedEmails")).then(snap => {
      setEmails(snap.docs.map(d => d.data().email).sort());
      setLoading(false);
    });
  }, []);

  const addEmail = async () => {
    const e = newEmail.trim().toLowerCase();
    if (!e || emails.includes(e)) return;
    setSaving(true);
    await setDoc(doc(db, "allowedEmails", e), { email: e, addedAt: new Date() });
    setEmails(prev => [...prev, e].sort());
    setNewEmail("");
    setSaving(false);
  };

  const removeEmail = async (email) => {
    if (!window.confirm(`${email} を削除しますか？`)) return;
    await deleteDoc(doc(db, "allowedEmails", email));
    setEmails(prev => prev.filter(e => e !== email));
  };

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: "16px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
        <button onClick={onBack} style={backBtnStyle}>← 戻る</button>
        <div style={{ fontSize: 15, fontWeight: 800 }}>承認メール管理</div>
      </div>

      {/* 追加フォーム */}
      <div style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12, padding: 14, marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, color: "rgba(255,255,255,0.4)", marginBottom: 8 }}>
          承認するメールアドレスを追加
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            type="email" value={newEmail}
            onChange={e => setNewEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addEmail()}
            placeholder="example@email.com"
            style={{ ...inputStyle, flex: 1 }}
          />
          <button onClick={addEmail} disabled={saving} style={{
            background: "rgba(99,102,241,0.3)", border: "1px solid rgba(99,102,241,0.5)",
            color: "#818cf8", borderRadius: 8, padding: "8px 16px",
            fontSize: 13, cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap",
          }}>{saving ? "..." : "追加"}</button>
        </div>
      </div>

      {/* メール一覧 */}
      {loading ? (
        <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 13, textAlign: "center", padding: 20 }}>
          読み込み中...
        </div>
      ) : emails.length === 0 ? (
        <div style={{ color: "rgba(255,255,255,0.2)", fontSize: 13, textAlign: "center", padding: 20 }}>
          承認済みメールアドレスがありません
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {emails.map(email => (
            <div key={email} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 8, padding: "9px 12px",
            }}>
              <span style={{ fontSize: 13, color: "rgba(255,255,255,0.8)" }}>{email}</span>
              <button onClick={() => removeEmail(email)} style={{
                background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)",
                color: "#f87171", borderRadius: 6, padding: "4px 10px",
                fontSize: 11, cursor: "pointer",
              }}>削除</button>
            </div>
          ))}
        </div>
      )}
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
