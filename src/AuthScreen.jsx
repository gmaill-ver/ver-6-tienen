import { useState } from "react";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const ERROR_MSGS = {
  "auth/wrong-password":     "パスワードが違います",
  "auth/invalid-email":      "メールアドレスの形式が正しくありません",
  "auth/weak-password":      "パスワードは6文字以上にしてください",
  "auth/too-many-requests":  "試行回数が多すぎます。しばらくしてから再試行してください",
  "auth/invalid-credential": "メールアドレスまたはパスワードが違います",
};

export default function AuthScreen() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const trimmedEmail = email.trim().toLowerCase();

      // ホワイトリスト確認
      const snap = await getDoc(doc(db, "allowedEmails", trimmedEmail));
      if (!snap.exists()) {
        setError("このメールアドレスは承認されていません。管理者に連絡してください。");
        setLoading(false);
        return;
      }

      // サインイン試行（初回は新規登録）
      try {
        await signInWithEmailAndPassword(auth, trimmedEmail, password);
      } catch (err) {
        if (
          err.code === "auth/user-not-found" ||
          err.code === "auth/invalid-credential"
        ) {
          // 初回ログイン → アカウント作成
          await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        } else {
          throw err;
        }
      }
    } catch (err) {
      setError(ERROR_MSGS[err.code] || err.message);
    } finally {
      setLoading(false);
    }
  };

  const iStyle = {
    width: "100%", padding: "10px 14px",
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8, color: "#e2e8f0", fontSize: 14,
    outline: "none", boxSizing: "border-box",
  };

  return (
    <div style={{
      minHeight: "100vh", background: "#0d0f18",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", padding: 24,
      fontFamily: "'Hiragino Kaku Gothic ProN','Noto Sans JP',sans-serif",
      color: "#e2e8f0",
    }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 20, fontWeight: 900 }}>出勤状況管理</div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 6 }}>
            承認済みアカウントでログイン
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>
              メールアドレス
            </label>
            <input
              type="email" value={email} required
              onChange={e => setEmail(e.target.value)}
              style={iStyle} placeholder="example@email.com"
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", display: "block", marginBottom: 4 }}>
              パスワード
            </label>
            <input
              type="password" value={password} required
              onChange={e => setPassword(e.target.value)}
              style={iStyle} placeholder="6文字以上"
            />
          </div>

          {error && (
            <div style={{
              background: "rgba(239,68,68,0.12)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#f87171", borderRadius: 8,
              padding: "8px 12px", fontSize: 12,
            }}>{error}</div>
          )}

          <button
            type="submit" disabled={loading}
            style={{
              background: loading ? "rgba(99,102,241,0.3)" : "rgba(99,102,241,0.8)",
              border: "1px solid rgba(99,102,241,0.5)",
              color: "#fff", borderRadius: 10, padding: "12px",
              fontSize: 14, fontWeight: 800,
              cursor: loading ? "default" : "pointer", marginTop: 4,
            }}
          >
            {loading ? "確認中..." : "ログイン"}
          </button>
        </form>

        <div style={{ fontSize: 10, color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: 20 }}>
          初回ログイン時はそのままパスワードが設定されます
        </div>
      </div>
    </div>
  );
}
