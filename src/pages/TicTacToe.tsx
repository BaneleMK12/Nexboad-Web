import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import * as TT from "@/engines/tictactoe";
import { useStats } from "@/hooks/useStats";
import { useResponsiveCanvas } from "@/hooks/useCanvas";

type Mode = "menu"|"size"|"color"|"playing";

export default function TicTacToe() {
  const [,go] = useLocation();
  const { recordWin, recordLoss, recordDraw } = useStats("tictactoe");
  const [mode, setMode] = useState<Mode>("menu");
  const [vsAI, setVsAI] = useState(true);
  const [playerColor, setPlayerColor] = useState<TT.TColor>(1);
  const [boardSize, setBoardSize] = useState(3);
  const [gs, setGs] = useState(TT.initial(3));
  const [thinking, setThinking] = useState(false);
  const [resultRecorded, setResultRecorded] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [scoreX, setScoreX] = useState(0);
  const [scoreO, setScoreO] = useState(0);
  const [scoreD, setScoreD] = useState(0);
  const aiPending = useRef(false);

  const modeRef = useRef(mode); const gsRef = useRef(gs);
  modeRef.current = mode; gsRef.current = gs;

  const drawFn = useCallback((canvas: HTMLCanvasElement) => {
    if (modeRef.current !== "playing") return;
    const state = gsRef.current;
    const ctx = canvas.getContext("2d")!;
    const bs = state.size;
    const cs = Math.floor(Math.min(canvas.width, canvas.height) / bs);
    const w = cs*bs;
    ctx.fillStyle="#121212"; ctx.fillRect(0,0,canvas.width,canvas.height);
    const ox=(canvas.width-w)/2; const oy=(canvas.height-w)/2;
    ctx.strokeStyle="#2a2a2a"; ctx.lineWidth=2;
    for(let i=1;i<bs;i++){
      ctx.beginPath();ctx.moveTo(ox+i*cs,oy);ctx.lineTo(ox+i*cs,oy+w);ctx.stroke();
      ctx.beginPath();ctx.moveTo(ox,oy+i*cs);ctx.lineTo(ox+w,oy+i*cs);ctx.stroke();
    }
    if(state.winLine&&state.winLine.length>=2){
      const first=state.winLine[0]; const last=state.winLine[state.winLine.length-1];
      const r1=Math.floor(first/bs),f1=first%bs; const r2=Math.floor(last/bs),f2=last%bs;
      ctx.strokeStyle="#fbbf24"; ctx.lineWidth=Math.max(4,cs*0.05); ctx.lineCap="round";
      ctx.beginPath();
      ctx.moveTo(ox+f1*cs+cs/2,oy+r1*cs+cs/2);
      ctx.lineTo(ox+f2*cs+cs/2,oy+r2*cs+cs/2);
      ctx.stroke(); ctx.lineCap="butt";
    }
    for(let s=0;s<bs*bs;s++){
      const v=state.board[s]; if(!v) continue;
      const r=Math.floor(s/bs),f=s%bs;
      const cx=ox+f*cs+cs/2; const cy=oy+r*cs+cs/2; const r2=cs*0.3;
      ctx.lineWidth=Math.max(3,cs*0.07); ctx.lineCap="round";
      if(v===1){
        ctx.strokeStyle=state.winLine?.includes(s)?"#fbbf24":"#ef5350";
        ctx.beginPath();ctx.moveTo(cx-r2,cy-r2);ctx.lineTo(cx+r2,cy+r2);ctx.stroke();
        ctx.beginPath();ctx.moveTo(cx+r2,cy-r2);ctx.lineTo(cx-r2,cy+r2);ctx.stroke();
      } else {
        ctx.strokeStyle=state.winLine?.includes(s)?"#fbbf24":"#7fc8f8";
        ctx.beginPath();ctx.arc(cx,cy,r2,0,Math.PI*2);ctx.stroke();
      }
      ctx.lineCap="butt";
    }
  }, []);

  const canvasRef = useResponsiveCanvas(drawFn);
  const redraw = useCallback(() => { const c=canvasRef.current; if(c) drawFn(c); }, [drawFn,canvasRef]);
  useEffect(() => { redraw(); }, [gs, mode, redraw]);

  const startGame = useCallback(() => {
    const s=TT.initial(boardSize); setGs(s); setThinking(false);
    setResultRecorded(false); setShowResult(false); aiPending.current=false; setMode("playing");
  }, [boardSize]);

  const recordResult = useCallback((s:TT.TState) => {
    if(resultRecorded||!vsAI) return; setResultRecorded(true);
    if(s.status==="win_x"){
      setScoreX(p=>p+1);
      if(playerColor===1) recordWin(); else recordLoss();
    } else if(s.status==="win_o"){
      setScoreO(p=>p+1);
      if(playerColor===2) recordWin(); else recordLoss();
    } else {
      setScoreD(p=>p+1); recordDraw();
    }
  }, [resultRecorded,vsAI,playerColor,recordWin,recordLoss,recordDraw]);

  const triggerAI = useCallback((s:TT.TState) => {
    if(aiPending.current) return; aiPending.current=true; setThinking(true);
    setTimeout(()=>{
      const m=TT.aiMove(s); aiPending.current=false; setThinking(false);
      if(m!=null){ const next=TT.applyMove(s,m); setGs(next); if(next.status!=="playing"){recordResult(next);setTimeout(()=>setShowResult(true),600);} }
    },30);
  }, [recordResult]);

  useEffect(() => {
    if(mode!=="playing") return;
    if(gs.status!=="playing"){if(!resultRecorded){recordResult(gs);setTimeout(()=>setShowResult(true),600);}return;}
    if(vsAI&&gs.turn!==playerColor&&!thinking&&!aiPending.current) triggerAI(gs);
  }, [gs, mode]);

  const handleClick = (x:number,y:number) => {
    if(mode!=="playing") return;
    if(gs.status!=="playing"){setShowResult(true);return;}
    if(thinking||(vsAI&&gs.turn!==playerColor)) return;
    const canvas=canvasRef.current; if(!canvas) return;
    const bs=gs.size; const cs=Math.floor(Math.min(canvas.width,canvas.height)/bs);
    const w=cs*bs; const ox=(canvas.width-w)/2; const oy=(canvas.height-w)/2;
    const col=Math.floor((x-ox)/cs); const row=Math.floor((y-oy)/cs);
    if(col<0||col>=bs||row<0||row>=bs) return;
    const sq=row*bs+col;
    if(gs.board[sq]) return;
    const next=TT.applyMove(gs,sq); setGs(next);
    if(next.status!=="playing"){recordResult(next);setTimeout(()=>setShowResult(true),700);}
    else if(vsAI&&next.turn!==playerColor) triggerAI(next);
  };

  const getXY = (canvas:HTMLCanvasElement,cx:number,cy:number) => {
    const r=canvas.getBoundingClientRect();
    return [(cx-r.left)*canvas.width/r.width,(cy-r.top)*canvas.height/r.height] as const;
  };
  const clickC=(e:React.MouseEvent<HTMLCanvasElement>)=>{const[x,y]=getXY(canvasRef.current!,e.clientX,e.clientY);handleClick(x,y);};
  const touchC=(e:React.TouchEvent<HTMLCanvasElement>)=>{e.preventDefault();const t=e.changedTouches[0];const[x,y]=getXY(canvasRef.current!,t.clientX,t.clientY);handleClick(x,y);};

  const statusText=()=>{
    if(thinking) return "AI thinking…";
    if(gs.status==="win_x") return "X wins!";
    if(gs.status==="win_o") return "O wins!";
    if(gs.status==="draw") return "It's a draw!";
    return vsAI&&gs.turn===playerColor?"Your turn":`${gs.turn===1?"X":"O"}'s turn`;
  };

  const SIZE_OPTS=[3,4,5,6,7];

  return (
    <div className="game-wrap">
      <div className="game-hud">
        <button className="hud-btn" onClick={()=>go("/")}>← Back</button>
        <div style={{textAlign:"center"}}>
          <div className="turn-label" style={{color:gs.turn===1?"#ef5350":"#7fc8f8"}}>{statusText()}</div>
          {thinking&&<div className="thinking">● thinking</div>}
        </div>
        <button className="hud-btn" onClick={()=>setMode("menu")}>Menu</button>
      </div>
      <div className="board-area">
        <canvas ref={canvasRef} style={{width:"100%",height:"100%",cursor:"pointer"}} onClick={clickC} onTouchEnd={touchC}/>
      </div>
      <div className="status-bar">
        <span style={{color:"#ef5350"}}>X {scoreX}</span>
        <span style={{color:"var(--muted)"}}>Draw {scoreD}</span>
        <span style={{color:"#7fc8f8"}}>O {scoreO}</span>
      </div>
      {(mode==="menu"||mode==="size"||mode==="color")&&(
        <div className="modal-overlay">
          <div className="modal">
            {mode==="menu"&&<>
              <h2>✕ Tic-Tac-Toe</h2>
              <button className="modal-btn" onClick={()=>{setVsAI(true);setMode("size");}}>vs AI (Always Hard)</button>
              <button className="modal-btn" onClick={()=>{setVsAI(false);setMode("size");}}>2 Players</button>
              <button className="modal-close" onClick={()=>go("/")}>Main Menu</button>
            </>}
            {mode==="size"&&<>
              <h2>Board Size</h2>
              {SIZE_OPTS.map(sz=>(
                <button key={sz} className={`modal-btn${boardSize===sz?" active":""}`} onClick={()=>setBoardSize(sz)}>
                  {sz}×{sz} — {TT.winLenFor(sz)} in a row
                </button>
              ))}
              {vsAI
                ?<button className="modal-btn" style={{marginTop:8,background:"var(--accent)",color:"#000"}} onClick={()=>setMode("color")}>Continue →</button>
                :<button className="modal-btn" style={{marginTop:8,background:"var(--accent)",color:"#000"}} onClick={()=>{setPlayerColor(1);startGame();}}>Start Game →</button>
              }
              <button className="modal-close" onClick={()=>setMode("menu")}>← Back</button>
            </>}
            {mode==="color"&&<>
              <h2>Play as</h2>
              <button className="modal-btn" onClick={()=>{setPlayerColor(1);startGame();}}>✕ X (goes first)</button>
              <button className="modal-btn" onClick={()=>{setPlayerColor(2);startGame();}}>◯ O (goes second)</button>
              <button className="modal-close" onClick={()=>setMode("size")}>← Back</button>
            </>}
          </div>
        </div>
      )}
      {showResult&&(
        <div className="modal-overlay">
          <div className="modal">
            <h2>Game Over</h2>
            <p style={{color:"var(--muted)",marginBottom:16,textAlign:"center"}}>{statusText()}</p>
            <button className="modal-btn" onClick={()=>{setShowResult(false);startGame();}}>Play Again</button>
            <button className="modal-btn" onClick={()=>{setShowResult(false);setMode("menu");}}>Change Settings</button>
            <button className="modal-close" onClick={()=>go("/")}>Main Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
