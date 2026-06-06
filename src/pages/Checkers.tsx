import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import * as CK from "@/engines/checkers";
import { useStats } from "@/hooks/useStats";

// Android "Dark Mode" checkers theme: light=#4A4A4A dark=#2D2D2D
const LIGHT = "#4A4A4A";
const DARK  = "#2D2D2D";

type Mode = "menu"|"color"|"playing";

export default function Checkers() {
  const [,go] = useLocation();
  const { recordWin, recordLoss, recordDraw } = useStats("checkers");
  const [mode, setMode] = useState<Mode>("menu");
  const [vsAI, setVsAI] = useState(true);
  const [playerColor, setPlayerColor] = useState<CK.CkColor>("b");
  const [difficulty, setDifficulty] = useState(1);
  const [gs, setGs] = useState(CK.initial());
  const [selected, setSelected] = useState<number|null>(null);
  const [legalMoves, setLegalMoves] = useState<CK.CkMove[]>([]);
  const [thinking, setThinking] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultRecorded, setResultRecorded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aiRef = useRef(false);

  const CS = useCallback(() => {
    const el = canvasRef.current; if (!el) return 50;
    return Math.floor(Math.min(el.width, el.height) / 8);
  }, []);

  const draw = useCallback((state: CK.CkState, sel: number|null, lm: CK.CkMove[]) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const cs = CS();
    const flipped = vsAI && playerColor === "r";
    ctx.fillStyle = "#121212"; ctx.fillRect(0,0,canvas.width,canvas.height);
    // squares
    for (let r=0;r<8;r++) for (let f=0;f<8;f++) {
      const light = (r+f)%2===0;
      ctx.fillStyle = light ? LIGHT : DARK;
      ctx.fillRect(f*cs, r*cs, cs, cs);
    }
    // last move highlight
    const lf = state.lastFrom, lt = state.lastTo;
    if (lf>=0) {
      const r=flipped?7-Math.floor(lf/8):Math.floor(lf/8), f=flipped?7-(lf%8):lf%8;
      ctx.fillStyle="rgba(255,215,0,0.3)"; ctx.fillRect(f*cs,r*cs,cs,cs);
    }
    if (lt>=0) {
      const r=flipped?7-Math.floor(lt/8):Math.floor(lt/8), f=flipped?7-(lt%8):lt%8;
      ctx.fillStyle="rgba(255,215,0,0.3)"; ctx.fillRect(f*cs,r*cs,cs,cs);
    }
    // selected highlight
    if (sel!==null) {
      const r=flipped?7-Math.floor(sel/8):Math.floor(sel/8), f=flipped?7-(sel%8):sel%8;
      ctx.fillStyle="rgba(127,200,248,0.45)"; ctx.fillRect(f*cs,r*cs,cs,cs);
    }
    // legal move targets
    const targets = new Set(lm.map(m=>m.path[m.path.length-1]));
    for (const to of targets) {
      const r=flipped?7-Math.floor(to/8):Math.floor(to/8), f=flipped?7-(to%8):to%8;
      const cx=f*cs+cs/2, cy=r*cs+cs/2;
      ctx.beginPath(); ctx.arc(cx,cy,cs*0.17,0,Math.PI*2);
      ctx.fillStyle="rgba(127,200,248,0.5)"; ctx.fill();
    }
    // pieces — Android style
    for (let sq=0;sq<64;sq++) {
      const p = state.board[sq]; if (!p) continue;
      const r=flipped?7-Math.floor(sq/8):Math.floor(sq/8), f=flipped?7-(sq%8):sq%8;
      const cx=f*cs+cs/2, cy=r*cs+cs/2;
      const radius = cs*0.38;
      const isWhite = p.c==="b"; // "b"=white side (bottom), "r"=red/black side
      // shadow
      ctx.beginPath(); ctx.arc(cx+1.5, cy+2.5, radius, 0, Math.PI*2);
      ctx.fillStyle="rgba(0,0,0,0.31)"; ctx.fill();
      // disc fill
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2);
      ctx.fillStyle = isWhite ? "#F5F5F5" : "#1E1E1E"; ctx.fill();
      // outer ring
      ctx.beginPath(); ctx.arc(cx, cy, radius*0.92, 0, Math.PI*2);
      ctx.strokeStyle = isWhite ? "#9E9E9E" : "#616161";
      ctx.lineWidth = radius*0.10; ctx.stroke();
      // inner ring
      ctx.beginPath(); ctx.arc(cx, cy, radius*0.72, 0, Math.PI*2);
      ctx.strokeStyle = isWhite ? "#BDBDBD" : "#424242";
      ctx.lineWidth = radius*0.06; ctx.stroke();
      // king crown
      if (p.king) {
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.font = `${Math.floor(radius*1.0)}px serif`;
        ctx.fillStyle="#FFC107";
        ctx.fillText("♛", cx, cy+radius*0.05);
      }
    }
  }, [CS, vsAI, playerColor]);

  useEffect(() => { if (mode==="playing") draw(gs, selected, legalMoves); }, [gs, selected, legalMoves, mode, draw]);

  const allMoves = useCallback((state: CK.CkState) => CK.legalMoves(state), []);

  const startGame = useCallback(() => {
    const s = CK.initial(); setGs(s); setSelected(null); setLegalMoves([]);
    setThinking(false); setResultRecorded(false); setShowResult(false);
    aiRef.current = false; setMode("playing");
  }, []);

  const recordResult = useCallback((s: CK.CkState) => {
    if (resultRecorded||!vsAI) return; setResultRecorded(true);
    if (s.status==="win_b"&&playerColor==="b") recordWin();
    else if (s.status==="win_r"&&playerColor==="r") recordWin();
    else if (s.status==="draw") recordDraw();
    else recordLoss();
  }, [resultRecorded,vsAI,playerColor,recordWin,recordLoss,recordDraw]);

  const triggerAI = useCallback((s: CK.CkState) => {
    if (aiRef.current) return;
    aiRef.current=true; setThinking(true);
    const depths=[3,6,9]; const depth=depths[difficulty];
    setTimeout(()=>{
      const m = CK.aiMove(s, depth);
      aiRef.current=false; setThinking(false);
      if (m) {
        const next=CK.applyMove(s,m); setGs(next);
        if (next.status!=="playing") { recordResult(next); setShowResult(true); }
      }
    },50);
  },[difficulty,recordResult]);

  useEffect(()=>{
    if (mode!=="playing") return;
    if (gs.status!=="playing") { if (!resultRecorded){ recordResult(gs); setShowResult(true); } return; }
    if (vsAI&&gs.turn!==playerColor&&!aiRef.current) triggerAI(gs);
  },[gs,mode]);

  const handleClick = useCallback((x:number,y:number)=>{
    if (mode!=="playing"||thinking||(vsAI&&gs.turn!==playerColor)) return;
    if (gs.status!=="playing") { setShowResult(true); return; }
    const cs=CS(); const flipped=vsAI&&playerColor==="r";
    const f=Math.floor(x/cs), r=Math.floor(y/cs);
    if (f<0||f>7||r<0||r>7) return;
    const sq=(flipped?7-r:r)*8+(flipped?7-f:f);
    if (selected===null) {
      const moves=allMoves(gs).filter(m=>m.path[0]===sq&&gs.board[sq]?.c===gs.turn);
      if (moves.length) { setSelected(sq); setLegalMoves(moves); }
    } else {
      const move=legalMoves.find(m=>m.path[m.path.length-1]===sq);
      if (move) {
        const next=CK.applyMove(gs,move); setGs(next); setSelected(null); setLegalMoves([]);
        if (next.status!=="playing") { recordResult(next); setShowResult(true); }
        else if (vsAI&&next.turn!==playerColor) triggerAI(next);
      } else {
        const moves=allMoves(gs).filter(m=>m.path[0]===sq&&gs.board[sq]?.c===gs.turn);
        if (moves.length) { setSelected(sq); setLegalMoves(moves); }
        else { setSelected(null); setLegalMoves([]); }
      }
    }
  },[mode,gs,selected,legalMoves,vsAI,playerColor,thinking,CS,allMoves,recordResult,triggerAI]);

  const canvasClick=(e:React.MouseEvent<HTMLCanvasElement>)=>{
    const r=canvasRef.current!.getBoundingClientRect();
    handleClick((e.clientX-r.left)*canvasRef.current!.width/r.width,(e.clientY-r.top)*canvasRef.current!.height/r.height);
  };
  const canvasTouch=(e:React.TouchEvent<HTMLCanvasElement>)=>{
    e.preventDefault(); const t=e.changedTouches[0];
    const r=canvasRef.current!.getBoundingClientRect();
    handleClick((t.clientX-r.left)*canvasRef.current!.width/r.width,(t.clientY-r.top)*canvasRef.current!.height/r.height);
  };

  const statusText=()=>{
    if (thinking) return "AI thinking…";
    if (gs.status==="win_b") return vsAI?(playerColor==="b"?"You win!":"AI wins!"):"White wins!";
    if (gs.status==="win_r") return vsAI?(playerColor==="r"?"You win!":"AI wins!"):"Black wins!";
    if (gs.status==="draw") return "Draw!";
    return vsAI&&gs.turn===playerColor?"Your turn":`${gs.turn==="b"?"White":"Black"} to move`;
  };

  const winner=()=>{
    if (gs.status==="win_b") return vsAI?(playerColor==="b"?"You win!":"You lose!"):"White wins!";
    if (gs.status==="win_r") return vsAI?(playerColor==="r"?"You win!":"You lose!"):"Black wins!";
    return "Draw!";
  };

  return (
    <div className="game-wrap">
      <div className="game-hud">
        <button className="hud-btn" onClick={()=>go("/")}>← Back</button>
        <div style={{textAlign:"center"}}>
          <div className="turn-label">{statusText()}</div>
          {thinking&&<div className="thinking">● thinking</div>}
        </div>
        <button className="hud-btn" onClick={()=>setMode("menu")}>Menu</button>
      </div>
      <div className="board-area">
        <canvas ref={canvasRef} width={400} height={400}
          style={{maxWidth:"100%",maxHeight:"100%",cursor:"pointer",borderRadius:4}}
          onClick={canvasClick} onTouchEnd={canvasTouch}/>
      </div>
      <div className="status-bar">
        <span>⬤ Checkers</span>
        {vsAI&&<span>AI: {["Easy","Medium","Hard"][difficulty]}</span>}
        <span>{gs.turn==="b"?"White":"Black"} to move</span>
      </div>
      {(mode==="menu"||mode==="color")&&(
        <div className="modal-overlay"><div className="modal">
          {mode==="menu"&&<>
            <h2>⬤ Checkers</h2>
            <button className="modal-btn" onClick={()=>{setVsAI(true);setMode("color");}}>vs AI</button>
            <button className="modal-btn" onClick={()=>{setVsAI(false);setPlayerColor("b");startGame();}}>2 Players</button>
            <div style={{marginTop:12,marginBottom:8}}>
              <div style={{fontSize:".75rem",color:"var(--muted)",marginBottom:6}}>AI Difficulty</div>
              <div style={{display:"flex",gap:8}}>
                {["Easy","Medium","Hard"].map((l,i)=>(
                  <button key={l} className={`modal-btn${difficulty===i?" active":""}`} style={{flex:1,padding:"8px"}} onClick={()=>setDifficulty(i)}>{l}</button>
                ))}
              </div>
            </div>
            <button className="modal-close" onClick={()=>go("/")}>Main Menu</button>
          </>}
          {mode==="color"&&<>
            <h2>Play as</h2>
            <button className="modal-btn" onClick={()=>{setPlayerColor("b");startGame();}}>⬜ White (bottom)</button>
            <button className="modal-btn" onClick={()=>{setPlayerColor("r");startGame();}}>⬛ Black (top)</button>
            <button className="modal-close" onClick={()=>setMode("menu")}>← Back</button>
          </>}
        </div></div>
      )}
      {showResult&&(
        <div className="modal-overlay"><div className="modal">
          <h2>Game Over</h2>
          <p style={{color:"var(--muted)",marginBottom:16,textAlign:"center"}}>{winner()}</p>
          <button className="modal-btn" onClick={()=>{setShowResult(false);startGame();}}>Play Again</button>
          <button className="modal-btn" onClick={()=>{setShowResult(false);setMode("menu");}}>Change Mode</button>
          <button className="modal-close" onClick={()=>go("/")}>Main Menu</button>
        </div></div>
      )}
    </div>
  );
}
