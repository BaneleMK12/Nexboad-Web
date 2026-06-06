import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import * as OT from "@/engines/othello";
import { useStats } from "@/hooks/useStats";
import { useResponsiveCanvas } from "@/hooks/useCanvas";

type Mode = "menu"|"playing";

export default function Othello() {
  const [,go] = useLocation();
  const { recordWin, recordLoss, recordDraw } = useStats("othello");
  const [mode, setMode] = useState<Mode>("menu");
  const [vsAI, setVsAI] = useState(true);
  const [playerColor] = useState<OT.OColor>(1);
  const [gs, setGs] = useState(OT.initial());
  const [thinking, setThinking] = useState(false);
  const [resultRecorded, setResultRecorded] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const aiPending = useRef(false);

  const modeRef = useRef(mode); const gsRef = useRef(gs);
  modeRef.current = mode; gsRef.current = gs;

  const drawFn = useCallback((canvas: HTMLCanvasElement) => {
    if (modeRef.current !== "playing") return;
    const state = gsRef.current;
    const ctx = canvas.getContext("2d")!;
    const cs = Math.floor(Math.min(canvas.width, canvas.height) / 8);
    const vm = OT.validMoves(state.board, state.turn);
    ctx.fillStyle="#1a3a2a"; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle="#0a2a1a"; ctx.lineWidth=1;
    for(let i=0;i<=8;i++){
      ctx.beginPath();ctx.moveTo(i*cs,0);ctx.lineTo(i*cs,8*cs);ctx.stroke();
      ctx.beginPath();ctx.moveTo(0,i*cs);ctx.lineTo(8*cs,i*cs);ctx.stroke();
    }
    const vmSet=new Set(vm);
    for(const s of vmSet){
      const r=s>>3; const f=s&7;
      ctx.fillStyle="rgba(127,200,248,0.15)"; ctx.fillRect(f*cs,r*cs,cs,cs);
      ctx.beginPath(); ctx.arc(f*cs+cs/2,r*cs+cs/2,cs*0.12,0,Math.PI*2);
      ctx.fillStyle="rgba(127,200,248,0.6)"; ctx.fill();
    }
    for(let s=0;s<64;s++){
      const v=state.board[s]; if(!v) continue;
      const r=s>>3; const f=s&7; const cx=f*cs+cs/2; const cy=r*cs+cs/2; const rad=cs*0.38;
      ctx.shadowColor="rgba(0,0,0,0.5)"; ctx.shadowBlur=4;
      ctx.beginPath(); ctx.arc(cx,cy,rad,0,Math.PI*2);
      ctx.fillStyle=v===1?"#1a1a1a":"#f5f5f5"; ctx.fill();
      ctx.strokeStyle=v===1?"#444":"#ccc"; ctx.lineWidth=1.5; ctx.stroke();
      ctx.shadowBlur=0;
    }
    const b1=state.board.filter(x=>x===1).length;
    const b2=state.board.filter(x=>x===2).length;
    ctx.font=`bold ${Math.floor(cs*0.22)}px Inter,sans-serif`;
    ctx.fillStyle="rgba(255,255,255,0.5)"; ctx.textAlign="left"; ctx.textBaseline="top";
    ctx.fillText(`⬤ ${b1}  ◯ ${b2}`,4,2);
  }, []);

  const canvasRef = useResponsiveCanvas(drawFn);
  const redraw = useCallback(() => { const c=canvasRef.current; if(c) drawFn(c); }, [drawFn,canvasRef]);
  useEffect(() => { redraw(); }, [gs, mode, redraw]);

  const startGame = useCallback(() => {
    const s=OT.initial(); setGs(s); setThinking(false);
    setResultRecorded(false); setShowResult(false); aiPending.current=false; setMode("playing");
  }, []);

  const recordResult = useCallback((s:OT.OState) => {
    if(resultRecorded||!vsAI) return; setResultRecorded(true);
    if(s.status==="win_black"){if(playerColor===1) recordWin(); else recordLoss();}
    else if(s.status==="win_white"){if(playerColor===2) recordWin(); else recordLoss();}
    else recordDraw();
  }, [resultRecorded,vsAI,playerColor,recordWin,recordLoss,recordDraw]);

  const triggerAI = useCallback((s:OT.OState) => {
    if(aiPending.current) return; aiPending.current=true; setThinking(true);
    setTimeout(()=>{
      const opp:OT.OColor=playerColor===1?2:1;
      const m=OT.aiMove(s.board,opp,5); aiPending.current=false; setThinking(false);
      if(m!=null){
        const next=OT.applyMove(s,m); setGs(next);
        if(next.status!=="playing"){recordResult(next);setShowResult(true);}
      } else {
        const next:OT.OState={...s,turn:s.turn===1?2:1,passed:true};
        setGs(next);
      }
    },50);
  }, [playerColor,recordResult]);

  useEffect(() => {
    if(mode!=="playing") return;
    if(gs.status!=="playing"){if(!resultRecorded){recordResult(gs);setShowResult(true);}return;}
    if(vsAI&&gs.turn!==playerColor&&!thinking&&!aiPending.current) triggerAI(gs);
  }, [gs, mode]);

  const handleClick = (x:number,y:number) => {
    if(mode!=="playing") return;
    if(gs.status!=="playing"){setShowResult(true);return;}
    if(thinking||(vsAI&&gs.turn!==playerColor)) return;
    const canvas=canvasRef.current; if(!canvas) return;
    const cs=Math.floor(Math.min(canvas.width,canvas.height)/8);
    const col=Math.floor(x/cs); const row=Math.floor(y/cs);
    if(col<0||col>7||row<0||row>7) return;
    const s=row*8+col;
    const vm=OT.validMoves(gs.board,gs.turn);
    if(!vm.includes(s)) return;
    const next=OT.applyMove(gs,s); setGs(next);
    if(next.status!=="playing"){recordResult(next);setShowResult(true);}
    else if(vsAI&&next.turn!==playerColor&&!next.passed) triggerAI(next);
  };

  const getXY = (canvas:HTMLCanvasElement,cx:number,cy:number) => {
    const r=canvas.getBoundingClientRect();
    return [(cx-r.left)*canvas.width/r.width,(cy-r.top)*canvas.height/r.height] as const;
  };
  const clickC=(e:React.MouseEvent<HTMLCanvasElement>)=>{const[x,y]=getXY(canvasRef.current!,e.clientX,e.clientY);handleClick(x,y);};
  const touchC=(e:React.TouchEvent<HTMLCanvasElement>)=>{e.preventDefault();const t=e.changedTouches[0];const[x,y]=getXY(canvasRef.current!,t.clientX,t.clientY);handleClick(x,y);};

  const b1=gs.board.filter(x=>x===1).length;
  const b2=gs.board.filter(x=>x===2).length;

  return (
    <div className="game-wrap">
      <div className="game-hud">
        <button className="hud-btn" onClick={()=>go("/")}>← Back</button>
        <div style={{textAlign:"center"}}>
          <div className="turn-label">{thinking?"AI thinking…":gs.passed?"Passed — your turn":`${gs.turn===1?"Black":"White"} to move`}</div>
          {thinking&&<div className="thinking">● thinking</div>}
        </div>
        <button className="hud-btn" onClick={()=>setMode("menu")}>Menu</button>
      </div>
      <div className="board-area">
        <canvas ref={canvasRef} style={{width:"100%",height:"100%",cursor:"pointer",borderRadius:4}} onClick={clickC} onTouchEnd={touchC}/>
      </div>
      <div className="status-bar"><span>⬤ {b1}</span><span style={{color:"var(--muted)"}}>vs</span><span>◯ {b2}</span></div>
      {mode==="menu"&&(
        <div className="modal-overlay">
          <div className="modal">
            <h2>◉ Othello</h2>
            <p style={{color:"var(--muted)",fontSize:".8rem",marginBottom:12}}>You play as Black. AI always plays at hard level.</p>
            <button className="modal-btn" onClick={()=>{setVsAI(true);startGame();}}>vs AI</button>
            <button className="modal-btn" onClick={()=>{setVsAI(false);startGame();}}>2 Players</button>
            <button className="modal-close" onClick={()=>go("/")}>Main Menu</button>
          </div>
        </div>
      )}
      {showResult&&(
        <div className="modal-overlay">
          <div className="modal">
            <h2>Game Over</h2>
            <p style={{color:"var(--muted)",marginBottom:16,textAlign:"center"}}>
              {gs.status==="win_black"?"Black wins!":gs.status==="win_white"?"White wins!":"Draw!"} ({b1}–{b2})
            </p>
            <button className="modal-btn" onClick={()=>{setShowResult(false);startGame();}}>Play Again</button>
            <button className="modal-close" onClick={()=>go("/")}>Main Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
