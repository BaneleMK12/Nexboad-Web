import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import * as OT from "@/engines/othello";
import { useStats } from "@/hooks/useStats";

// Android Othello board: bg=#1a3a2a (dark green), disc White=#F0F0F0, Black=#181818
const BOARD_BG = "#1a3a2a";
const LINE_COLOR = "rgba(255,255,255,0.12)";

type Mode = "menu"|"playing";

function getFlipped(board:(0|1|2)[], s:number, turn:OT.OColor): number[] {
  const opp:OT.OColor = turn===1?2:1;
  const DIRS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
  const result:number[]=[];
  for(const[dr,df]of DIRS){
    const toFlip:number[]=[];
    let r=Math.floor(s/8)+dr, f=(s%8)+df;
    while(r>=0&&r<8&&f>=0&&f<8&&board[r*8+f]===opp){toFlip.push(r*8+f);r+=dr;f+=df;}
    if(toFlip.length&&r>=0&&r<8&&f>=0&&f<8&&board[r*8+f]===turn) result.push(...toFlip);
  }
  return result;
}

export default function Othello() {
  const [,go] = useLocation();
  const { recordWin, recordLoss, recordDraw } = useStats("othello");
  const [mode, setMode] = useState<Mode>("menu");
  const [vsAI, setVsAI] = useState(true);
  const [playerColor] = useState<OT.OColor>(1); // 1=black always first
  const [gs, setGs] = useState(OT.initial());
  const [thinking, setThinking] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultRecorded, setResultRecorded] = useState(false);
  const [recentPlaced, setRecentPlaced] = useState<Set<number>>(new Set());
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aiRef = useRef(false);

  const CS = useCallback(()=>{
    const el=canvasRef.current; if(!el) return 46;
    return Math.floor(Math.min(el.width,el.height)/8);
  },[]);

  const draw = useCallback((state:OT.OState, recent:Set<number>)=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext("2d")!;
    const cs=CS();
    ctx.fillStyle=BOARD_BG; ctx.fillRect(0,0,canvas.width,canvas.height);
    // grid lines
    ctx.strokeStyle=LINE_COLOR; ctx.lineWidth=1;
    for(let i=1;i<8;i++){
      ctx.beginPath(); ctx.moveTo(i*cs,0); ctx.lineTo(i*cs,8*cs); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0,i*cs); ctx.lineTo(8*cs,i*cs); ctx.stroke();
    }
    // valid move hints
    const validMvs = state.status==="playing" ? OT.validMoves(state.board,state.turn) : [];
    for(const s of validMvs){
      const r=Math.floor(s/8), f=s%8;
      const cx=f*cs+cs/2, cy=r*cs+cs/2;
      ctx.beginPath(); ctx.arc(cx,cy,cs*0.14,0,Math.PI*2);
      ctx.fillStyle="rgba(255,255,255,0.2)"; ctx.fill();
    }
    // pieces — Android Othello style with glint
    for(let s=0;s<64;s++){
      const c=state.board[s]; if(!c) continue;
      const r=Math.floor(s/8), f=s%8;
      const cx=f*cs+cs/2, cy=r*cs+cs/2;
      const radius=cs*0.40;
      const isWhite=c===2;
      const isRecent=recent.has(s);
      // shadow
      ctx.beginPath(); ctx.arc(cx+1.5, cy+2.5, radius, 0, Math.PI*2);
      ctx.fillStyle="rgba(0,0,0,0.31)"; ctx.fill();
      // disc body
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI*2);
      ctx.fillStyle=isWhite?"#F0F0F0":"#181818"; ctx.fill();
      // rim
      ctx.beginPath(); ctx.arc(cx,cy,radius,0,Math.PI*2);
      ctx.strokeStyle=isWhite?"#B0B0B0":"#505050";
      ctx.lineWidth=radius*0.08; ctx.stroke();
      // glint highlight (Android: circle at -0.18r offset, r=0.45r)
      ctx.beginPath(); ctx.arc(cx-radius*0.18, cy-radius*0.18, radius*0.45, 0, Math.PI*2);
      ctx.strokeStyle=isWhite?"rgba(255,255,255,0.6)":"rgba(56,56,56,0.8)";
      ctx.lineWidth=radius*0.05; ctx.stroke();
      // recently placed pop ring
      if(isRecent){
        ctx.beginPath(); ctx.arc(cx,cy,radius*1.15,0,Math.PI*2);
        ctx.strokeStyle="rgba(127,200,248,0.4)"; ctx.lineWidth=2; ctx.stroke();
      }
    }
    // corner dots
    ctx.fillStyle="rgba(0,0,0,0.4)";
    for(const[r,f] of [[2,2],[2,5],[5,2],[5,5]]){
      ctx.beginPath(); ctx.arc(f*cs,r*cs,3,0,Math.PI*2); ctx.fill();
    }
  },[CS]);

  useEffect(()=>{ if(mode==="playing") draw(gs,recentPlaced); },[gs,recentPlaced,mode,draw]);

  const startGame=useCallback(()=>{
    const s=OT.initial(); setGs(s); setThinking(false);
    setResultRecorded(false); setShowResult(false); setRecentPlaced(new Set());
    aiRef.current=false; setMode("playing");
  },[]);

  const recordResult=useCallback((s:OT.OState)=>{
    if(resultRecorded||!vsAI) return; setResultRecorded(true);
    if(s.status==="draw") recordDraw();
    else if(s.status==="win_black"&&playerColor===1) recordWin();
    else if(s.status==="win_white"&&playerColor===2) recordWin();
    else recordLoss();
  },[resultRecorded,vsAI,playerColor,recordWin,recordLoss,recordDraw]);

  const triggerAI=useCallback((s:OT.OState)=>{
    if(aiRef.current) return;
    aiRef.current=true; setThinking(true);
    setTimeout(()=>{
      const m=OT.aiMove(s.board, s.turn, 7);
      aiRef.current=false; setThinking(false);
      if(m!==null){
        const flipped=getFlipped(s.board,m,s.turn);
        const placed=new Set([m,...flipped]);
        const next=OT.applyMove(s,m); setRecentPlaced(placed); setGs(next);
        setTimeout(()=>setRecentPlaced(new Set()),500);
        if(next.status!=="playing"){ recordResult(next); setTimeout(()=>setShowResult(true),600); }
      }
    },50);
  },[recordResult]);

  useEffect(()=>{
    if(mode!=="playing") return;
    if(gs.status!=="playing"){ if(!resultRecorded){ recordResult(gs); setTimeout(()=>setShowResult(true),600); } return; }
    if(vsAI&&gs.turn!==playerColor&&!aiRef.current) triggerAI(gs);
  },[gs,mode]);

  const handleClick=useCallback((x:number,y:number)=>{
    if(mode!=="playing"||thinking||(vsAI&&gs.turn!==playerColor)) return;
    if(gs.status!=="playing"){ setShowResult(true); return; }
    const cs=CS();
    const f=Math.floor(x/cs), r=Math.floor(y/cs);
    if(f<0||f>7||r<0||r>7) return;
    const s=r*8+f;
    const valid=OT.validMoves(gs.board,gs.turn);
    if(!valid.includes(s)) return;
    const flipped=getFlipped(gs.board,s,gs.turn);
    const placed=new Set([s,...flipped]);
    const next=OT.applyMove(gs,s);
    setRecentPlaced(placed); setGs(next);
    setTimeout(()=>setRecentPlaced(new Set()),500);
    if(next.status!=="playing"){ recordResult(next); setTimeout(()=>setShowResult(true),600); }
    else if(vsAI&&next.turn!==playerColor) setTimeout(()=>triggerAI(next),50);
  },[mode,gs,vsAI,playerColor,thinking,CS,recordResult,triggerAI]);

  const canvasClick=(e:React.MouseEvent<HTMLCanvasElement>)=>{
    const r=canvasRef.current!.getBoundingClientRect();
    handleClick((e.clientX-r.left)*canvasRef.current!.width/r.width,(e.clientY-r.top)*canvasRef.current!.height/r.height);
  };
  const canvasTouch=(e:React.TouchEvent<HTMLCanvasElement>)=>{
    e.preventDefault(); const t=e.changedTouches[0];
    const r=canvasRef.current!.getBoundingClientRect();
    handleClick((t.clientX-r.left)*canvasRef.current!.width/r.width,(t.clientY-r.top)*canvasRef.current!.height/r.height);
  };

  const counts=gs.board.reduce((a,c)=>{if(c===1)a[0]++;else if(c===2)a[1]++;return a;},[0,0]);

  const statusText=()=>{
    if(thinking) return "AI thinking…";
    if(gs.status==="win_black") return vsAI?(playerColor===1?"You win!":"AI wins!"):"Black wins!";
    if(gs.status==="win_white") return vsAI?(playerColor===2?"You win!":"AI wins!"):"White wins!";
    if(gs.status==="draw") return "Draw!";
    const mine=vsAI&&gs.turn===playerColor;
    return mine?"Your turn":`${gs.turn===1?"Black":"White"} to move`;
  };
  const winner=()=>{
    if(gs.status==="win_black") return vsAI?(playerColor===1?"You win!":"You lose!"):"Black wins!";
    if(gs.status==="win_white") return vsAI?(playerColor===2?"You win!":"You lose!"):"White wins!";
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
        <span>⬤ Black: {counts[0]}</span>
        <span>Othello</span>
        <span>White: {counts[1]} ⬤</span>
      </div>
      {mode==="menu"&&(
        <div className="modal-overlay"><div className="modal">
          <h2>⬤ Othello</h2>
          <button className="modal-btn" onClick={()=>{setVsAI(true);startGame();}}>vs AI</button>
          <button className="modal-btn" onClick={()=>{setVsAI(false);startGame();}}>2 Players</button>
          <button className="modal-close" onClick={()=>go("/")}>Main Menu</button>
        </div></div>
      )}
      {showResult&&(
        <div className="modal-overlay"><div className="modal">
          <h2>Game Over</h2>
          <p style={{textAlign:"center",marginBottom:8}}>{winner()}</p>
          <p style={{color:"var(--muted)",textAlign:"center",marginBottom:16}}>
            Black: {counts[0]} — White: {counts[1]}
          </p>
          <button className="modal-btn" onClick={()=>{setShowResult(false);startGame();}}>Play Again</button>
          <button className="modal-btn" onClick={()=>{setShowResult(false);setMode("menu");}}>Change Mode</button>
          <button className="modal-close" onClick={()=>go("/")}>Main Menu</button>
        </div></div>
      )}
    </div>
  );
}
