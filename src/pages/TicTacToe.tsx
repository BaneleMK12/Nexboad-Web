import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import * as TT from "@/engines/tictactoe";
import { useStats } from "@/hooks/useStats";

// Android TicTacToe colors: bg=#121212, grid=#383838, X=#EF5350, O=#7FC8F8, win=#FFC107
const GRID_COLOR = "#383838";
const X_COLOR    = "#EF5350";
const O_COLOR    = "#7FC8F8";
const WIN_COLOR  = "#FFC107";

type Mode = "menu"|"size"|"color"|"playing";

export default function TicTacToe() {
  const [,go] = useLocation();
  const { recordWin, recordLoss, recordDraw } = useStats("tictactoe");
  const [mode, setMode] = useState<Mode>("menu");
  const [vsAI, setVsAI] = useState(true);
  const [boardSize, setBoardSize] = useState(3);
  const [playerColor, setPlayerColor] = useState<TT.TColor>(1);
  const [difficulty, setDifficulty] = useState(1);
  const [gs, setGs] = useState(TT.initial(3));
  const [thinking, setThinking] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultRecorded, setResultRecorded] = useState(false);
  const [winProgress, setWinProgress] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aiRef = useRef(false);

  const CS = useCallback(()=>{
    const el=canvasRef.current; if(!el) return 100;
    return Math.floor(Math.min(el.width,el.height)/gs.size);
  },[gs.size]);

  const draw = useCallback((state:TT.TState, wp:number)=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext("2d")!;
    const n=state.size, cs=CS();
    const totalSize=n*cs;
    const ox=(canvas.width-totalSize)/2, oy=(canvas.height-totalSize)/2;
    // background
    ctx.fillStyle="#121212"; ctx.fillRect(0,0,canvas.width,canvas.height);
    // grid lines — Android style: strokeCap round
    ctx.strokeStyle=GRID_COLOR; ctx.lineCap="round";
    ctx.lineWidth=Math.max(cs*0.022,2);
    for(let i=1;i<n;i++){
      ctx.beginPath(); ctx.moveTo(ox+i*cs,oy); ctx.lineTo(ox+i*cs,oy+totalSize); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(ox,oy+i*cs); ctx.lineTo(ox+totalSize,oy+i*cs); ctx.stroke();
    }
    // pieces
    ctx.lineWidth=cs*0.085; ctx.lineCap="round";
    for(let r=0;r<n;r++) for(let f=0;f<n;f++){
      const c=state.board[r*n+f]; if(!c) continue;
      const cx=ox+f*cs+cs/2, cy=oy+r*cs+cs/2;
      const rad=cs*0.29;
      if(c===1){
        ctx.strokeStyle=X_COLOR;
        ctx.beginPath(); ctx.moveTo(cx-rad,cy-rad); ctx.lineTo(cx+rad,cy+rad); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx+rad,cy-rad); ctx.lineTo(cx-rad,cy+rad); ctx.stroke();
      } else {
        ctx.strokeStyle=O_COLOR;
        ctx.beginPath(); ctx.arc(cx,cy,rad,0,Math.PI*2); ctx.stroke();
      }
    }
    // win line
    const wl=state.winLine;
    if(wl&&wl.length>=2&&wp>0){
      const first=wl[0], last=wl[wl.length-1];
      const r0=Math.floor(first/n), f0=first%n;
      const r1=Math.floor(last/n),  f1=last%n;
      const sx=ox+f0*cs+cs/2, sy=oy+r0*cs+cs/2;
      const ex=ox+f1*cs+cs/2, ey=oy+r1*cs+cs/2;
      const dx=ex-sx, dy=ey-sy;
      ctx.strokeStyle=`rgba(255,193,7,${wp*0.86})`;
      ctx.lineWidth=cs*0.055; ctx.lineCap="round";
      ctx.beginPath(); ctx.moveTo(sx,sy); ctx.lineTo(sx+dx*wp,sy+dy*wp); ctx.stroke();
    }
  },[CS]);

  useEffect(()=>{ if(mode==="playing") draw(gs,winProgress); },[gs,winProgress,mode,draw]);

  const startGame=useCallback((size:number,pColor:TT.TColor)=>{
    const s=TT.initial(size); setGs(s); setWinProgress(0);
    setThinking(false); setResultRecorded(false); setShowResult(false);
    aiRef.current=false; setMode("playing");
    if(vsAI&&s.turn!==pColor) {
      setTimeout(()=>triggerAI(s,pColor,difficulty),100);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[vsAI,difficulty]);

  const recordResult=useCallback((s:TT.TState)=>{
    if(resultRecorded||!vsAI) return; setResultRecorded(true);
    if(s.status==="draw") recordDraw();
    else if((s.status==="win_x"&&playerColor===1)||(s.status==="win_o"&&playerColor===2)) recordWin();
    else recordLoss();
  },[resultRecorded,vsAI,playerColor,recordWin,recordLoss,recordDraw]);

  const triggerAI=useCallback((s:TT.TState,pCol:TT.TColor,diff:number)=>{
    if(aiRef.current) return;
    aiRef.current=true; setThinking(true);
    const depths=[[3,5,9],[3,5,7],[3,5,6],[3,5,6]];
    const di=Math.min(s.size-3,3);
    const depth=depths[di][diff];
    setTimeout(()=>{
      const m=TT.aiMove(s,depth);
      aiRef.current=false; setThinking(false);
      if(m!==null){
        const next=TT.applyMove(s,m); setGs(next);
        if(next.status!=="playing"){
          recordResult(next);
          if(next.winLine) {
            let p=0; const iv=setInterval(()=>{ p+=0.05; setWinProgress(Math.min(p,1)); if(p>=1)clearInterval(iv); },16);
          }
          setTimeout(()=>setShowResult(true),1000);
        }
      }
    },50);
  },[recordResult]);

  useEffect(()=>{
    if(mode!=="playing") return;
    if(gs.status!=="playing"){
      if(!resultRecorded){ recordResult(gs); }
      return;
    }
    if(vsAI&&gs.turn!==playerColor&&!aiRef.current) triggerAI(gs,playerColor,difficulty);
  },[gs,mode]);

  const handleClick=useCallback((x:number,y:number)=>{
    if(mode!=="playing"||thinking||(vsAI&&gs.turn!==playerColor)) return;
    if(gs.status!=="playing"){ setShowResult(true); return; }
    const cs=CS(); const n=gs.size;
    const totalSize=n*cs;
    const canvas=canvasRef.current!;
    const ox=(canvas.width-totalSize)/2, oy=(canvas.height-totalSize)/2;
    const f=Math.floor((x-ox)/cs), r=Math.floor((y-oy)/cs);
    if(f<0||f>=n||r<0||r>=n) return;
    const sq=r*n+f;
    if(gs.board[sq]) return;
    const next=TT.applyMove(gs,sq); setGs(next);
    if(next.status!=="playing"){
      recordResult(next);
      if(next.winLine){
        let p=0; const iv=setInterval(()=>{ p+=0.05; setWinProgress(Math.min(p,1)); if(p>=1)clearInterval(iv); },16);
      }
      setTimeout(()=>setShowResult(true),1000);
    } else if(vsAI&&next.turn!==playerColor) triggerAI(next,playerColor,difficulty);
  },[mode,gs,vsAI,playerColor,thinking,CS,recordResult,triggerAI,difficulty]);

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
    if(thinking) return "AI thinking…";
    if(gs.status==="win_x") return vsAI?(playerColor===1?"You win!":"AI wins!"):"X wins!";
    if(gs.status==="win_o") return vsAI?(playerColor===2?"You win!":"AI wins!"):"O wins!";
    if(gs.status==="draw") return "Draw!";
    const mine=vsAI&&gs.turn===playerColor;
    return mine?"Your turn":`${gs.turn===1?"X":"O"}'s turn`;
  };
  const winner=()=>{
    if(gs.status==="win_x") return vsAI?(playerColor===1?"You win! 🎉":"You lose!"):"X wins!";
    if(gs.status==="win_o") return vsAI?(playerColor===2?"You win! 🎉":"You lose!"):"O wins!";
    return "Draw!";
  };

  const SIZE_OPTS:[number,string][]=[
    [3,"3×3 — Classic (3 in a row)"],
    [4,"4×4 — Medium (4 in a row)"],
    [5,"5×5 — Large (4 in a row)"],
    [6,"6×6 — X-Large (5 in a row)"],
  ];

  return (
    <div className="game-wrap">
      <div className="game-hud">
        <button className="hud-btn" onClick={()=>go("/")}>← Back</button>
        <div style={{textAlign:"center"}}>
          <div className="turn-label" style={{color:gs.turn===1?X_COLOR:O_COLOR}}>{statusText()}</div>
          {thinking&&<div className="thinking">● thinking</div>}
        </div>
        <button className="hud-btn" onClick={()=>setMode("menu")}>Menu</button>
      </div>
      <div className="board-area">
        <canvas ref={canvasRef} width={400} height={400}
          style={{maxWidth:"100%",maxHeight:"100%",cursor:"pointer"}}
          onClick={canvasClick} onTouchEnd={canvasTouch}/>
      </div>
      <div className="status-bar">
        <span style={{color:X_COLOR}}>✕ X</span>
        <span>Tic-Tac-Toe {gs.size}×{gs.size}</span>
        <span style={{color:O_COLOR}}>○ O</span>
      </div>
      {mode==="menu"&&(
        <div className="modal-overlay"><div className="modal">
          <h2>✕○ Tic-Tac-Toe</h2>
          <button className="modal-btn" onClick={()=>{setVsAI(true);setMode("size");}}>vs AI</button>
          <button className="modal-btn" onClick={()=>{setVsAI(false);setMode("size");}}>2 Players</button>
          <div style={{marginTop:12,marginBottom:8}}>
            <div style={{fontSize:".75rem",color:"var(--muted)",marginBottom:6}}>AI Difficulty</div>
            <div style={{display:"flex",gap:8}}>
              {["Easy","Medium","Hard"].map((l,i)=>(
                <button key={l} className={`modal-btn${difficulty===i?" active":""}`} style={{flex:1,padding:"8px"}} onClick={()=>setDifficulty(i)}>{l}</button>
              ))}
            </div>
          </div>
          <button className="modal-close" onClick={()=>go("/")}>Main Menu</button>
        </div></div>
      )}
      {mode==="size"&&(
        <div className="modal-overlay"><div className="modal">
          <h2>Board Size</h2>
          {SIZE_OPTS.map(([sz,label])=>(
            <button key={sz} className={`modal-btn${boardSize===sz?" active":""}`}
              onClick={()=>{ setBoardSize(sz); if(vsAI) setMode("color"); else { setPlayerColor(1); startGame(sz,1); } }}>
              {label}
            </button>
          ))}
          <button className="modal-close" onClick={()=>setMode("menu")}>← Back</button>
        </div></div>
      )}
      {mode==="color"&&(
        <div className="modal-overlay"><div className="modal">
          <h2>Play as</h2>
          <button className="modal-btn" style={{color:X_COLOR}} onClick={()=>{ setPlayerColor(1); startGame(boardSize,1); }}>✕ X (goes first)</button>
          <button className="modal-btn" style={{color:O_COLOR}} onClick={()=>{ setPlayerColor(2); startGame(boardSize,2); }}>○ O (goes second)</button>
          <button className="modal-close" onClick={()=>setMode("size")}>← Back</button>
        </div></div>
      )}
      {showResult&&(
        <div className="modal-overlay"><div className="modal">
          <h2>Game Over</h2>
          <p style={{color:"var(--muted)",marginBottom:16,textAlign:"center"}}>{winner()}</p>
          <button className="modal-btn" onClick={()=>{setShowResult(false);setWinProgress(0);startGame(boardSize,playerColor);}}>Play Again</button>
          <button className="modal-btn" onClick={()=>{setShowResult(false);setWinProgress(0);setMode("menu");}}>Change Mode</button>
          <button className="modal-close" onClick={()=>go("/")}>Main Menu</button>
        </div></div>
      )}
    </div>
  );
}
