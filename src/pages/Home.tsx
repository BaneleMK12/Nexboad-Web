import { useLocation } from "wouter";
import { loadAllStats, GameKey } from "@/hooks/useStats";
import { useState } from "react";

const GAMES: { key: GameKey; path: string; icon: string; name: string; desc: string }[] = [
  { key:"chess",       path:"/chess",       icon:"♟", name:"Chess",       desc:"Full rules · castling · en passant · promotion" },
  { key:"checkers",    path:"/checkers",    icon:"⬤", name:"Checkers",    desc:"Mandatory captures · multi-jump · kinging" },
  { key:"othello",     path:"/othello",     icon:"◉", name:"Othello",     desc:"Reversi · flip discs · strategic mobility" },
  { key:"morabaraba",  path:"/morabaraba",  icon:"⬡", name:"Morabaraba",  desc:"Traditional SA game · mills · 3 phases" },
  { key:"tictactoe",   path:"/tictactoe",   icon:"✕", name:"Tic-Tac-Toe", desc:"3×3 to 7×7 boards · perfect AI" },
];

export default function Home() {
  const [,go] = useLocation();
  const stats = loadAllStats();
  const [showStats, setShowStats] = useState(false);

  const total = Object.values(stats).reduce((a,s)=>({wins:a.wins+s.wins,losses:a.losses+s.losses,draws:a.draws+s.draws}),{wins:0,losses:0,draws:0});

  return (
    <div style={{ minHeight:"100dvh", background:"var(--bg)", display:"flex", flexDirection:"column", alignItems:"center", padding:"0 0 32px" }}>
      {/* Header */}
      <div style={{ width:"100%", maxWidth:480, padding:"24px 20px 8px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div>
          <h1 style={{ fontSize:"1.8rem", fontWeight:800, letterSpacing:"-0.03em", color:"var(--text)" }}>
            Nex<span style={{ color:"var(--accent)" }}>Board</span>
          </h1>
          <p style={{ fontSize:".75rem", color:"var(--muted)", marginTop:2 }}>5 classic games · AI opponents</p>
        </div>
        <button
          onClick={() => setShowStats(true)}
          style={{ background:"var(--bg3)", border:"1px solid var(--border)", borderRadius:10, padding:"8px 14px", color:"var(--accent)", fontSize:".8rem", fontWeight:600 }}
        >
          Stats
        </button>
      </div>

      {/* Game cards */}
      <div style={{ width:"100%", maxWidth:480, padding:"0 16px", marginTop:8 }}>
        {GAMES.map(g => {
          const s = stats[g.key];
          const total2 = s.wins+s.losses+s.draws;
          const pct = total2 ? Math.round(s.wins/total2*100) : null;
          return (
            <button
              key={g.key}
              onClick={() => go(g.path)}
              style={{
                display:"flex", alignItems:"center", gap:14,
                width:"100%", marginBottom:10, padding:"16px 18px",
                background:"var(--bg2)", border:"1px solid var(--border)",
                borderRadius:14, textAlign:"left", cursor:"pointer",
                transition:"border-color .15s, background .15s",
              }}
              onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--accent)";(e.currentTarget as HTMLElement).style.background="#1a2a2a";}}
              onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor="var(--border)";(e.currentTarget as HTMLElement).style.background="var(--bg2)";}}
            >
              <span style={{ fontSize:"2rem", width:44, textAlign:"center", flexShrink:0 }}>{g.icon}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:700, fontSize:"1rem", color:"var(--text)" }}>{g.name}</div>
                <div style={{ fontSize:".75rem", color:"var(--muted)", marginTop:2, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{g.desc}</div>
              </div>
              {total2 > 0 && (
                <div style={{ textAlign:"right", flexShrink:0 }}>
                  <div style={{ fontSize:".85rem", fontWeight:700, color: pct!==null&&pct>=50?"var(--win)":"var(--loss)" }}>{pct}%</div>
                  <div style={{ fontSize:".7rem", color:"var(--muted)" }}>{total2} played</div>
                </div>
              )}
              <span style={{ color:"var(--muted)", fontSize:"1rem", flexShrink:0 }}>›</span>
            </button>
          );
        })}
      </div>

      {/* Stats modal */}
      {showStats && (
        <div className="modal-overlay" onClick={() => setShowStats(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Overall Stats</h2>
            <div style={{ display:"flex", gap:16, marginBottom:20, justifyContent:"center" }}>
              {[["Wins","var(--win)",total.wins],["Losses","var(--loss)",total.losses],["Draws","var(--accent)",total.draws]].map(([label,color,val]) => (
                <div key={label as string} style={{ textAlign:"center" }}>
                  <div style={{ fontSize:"1.6rem", fontWeight:800, color:color as string }}>{val as number}</div>
                  <div style={{ fontSize:".7rem", color:"var(--muted)" }}>{label}</div>
                </div>
              ))}
            </div>
            {GAMES.map(g => {
              const s = stats[g.key];
              const t = s.wins+s.losses+s.draws;
              if(!t) return null;
              return (
                <div key={g.key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, padding:"8px 12px", background:"var(--bg3)", borderRadius:8 }}>
                  <span style={{ fontSize:".85rem", color:"var(--text)" }}>{g.icon} {g.name}</span>
                  <span style={{ fontSize:".8rem", color:"var(--muted)" }}>{s.wins}W / {s.losses}L / {s.draws}D</span>
                </div>
              );
            })}
            {!total.wins&&!total.losses&&!total.draws && (
              <p style={{ color:"var(--muted)", fontSize:".85rem", textAlign:"center", marginBottom:12 }}>No games played yet.</p>
            )}
            <button className="modal-close" onClick={() => setShowStats(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
