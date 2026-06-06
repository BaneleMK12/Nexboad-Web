import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import * as CK from "@/engines/checkers";
import { useStats } from "@/hooks/useStats";
import { useResponsiveCanvas } from "@/hooks/useCanvas";

type Mode = "menu"|"color"|"playing";
const DEPTHS = [3,5,7];

export default function Checkers() {
  const [,go] = useLocation();
  const { recordWin, recordLoss, recordDraw } = useStats("checkers");
  const [mode, setMode] = useState<Mode>("menu");
  const [vsAI, setVsAI] = useState(true);
  const [playerColor, setPlayerColor] = useState<CK.CkColor>("b");
  const [difficulty, setDifficulty] = useState(1);
  const [gs, setGs] = useState(CK.initial());
  const [selected, setSelected] = useState<number|null>(null);
  const [legalFrom, setLegalFrom] = useState<CK.CkMove[]>([]);
  const [thinking, setThinking] = useState(false);
  const [resultRecorded, setResultRecorded] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const aiPending = useRef(false);

  const modeRef = useRef(mode); const gsRef = useRef(gs);
  const selRef = useRef(selected); const lfRef = useRef(legalFrom);
  const vsAIRef = useRef(vsAI); const pcRef = useRef(playerColor);
  modeRef.current=mode; gsRef.current=gs; selRef.current=selected;
  lfRef.current=legalFrom; vsAIRef.current=vsAI; pcRef.current=playerColor;

  const drawFn = useCallback((canvas: HTMLCanvasElement) => {
    if (modeRef.current !== "playing") return;
    const state = gsRef.current; const sel = selRef.current; const lm = lfRef.current;
    const ctx = canvas.getContext("2d")!;
    const cs = Math.floor(Math.min(canvas.width, canvas.height) / 8);
    const flipped = vsAIRef.current && pcRef.current === "b";
    const validTos = new Set(lm.map(m=>m.path[m.path.length-1]));
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for (let r=0;r<8;r++) for (let f=0;f<8;f++) {
      const sq = flipped?(7-r)*8+(7-f):r*8+f;
      const dark = (r+f)%2===1;
      let bg = dark?"#2d2d2d":"#4a4a4a";
      if (sq===state.lastFrom||sq===state.lastTo) bg = dark?"#4a4a20":"#6a6a30";
      ctx.fillStyle=bg; ctx.fillRect(f*cs,r*cs,cs,cs);
      if (sel===sq){ctx.fillStyle="rgba(127,200,248,0.3)";ctx.fillRect(f*cs,r*cs,cs,cs);}
      if (validTos.has(sq)&&dark) {
        ctx.beginPath();ctx.arc(f*cs+cs/2,r*cs+cs/2,cs*0.12,0,Math.PI*2);
        ctx.fillStyle="rgba(127,200,248,0.7)";ctx.fill();
      }
    }
    for (let sq=0;sq<64;sq++) {
      const p=state.board[sq]; if(!p) continue;
      const r=flipped?7-Math.floor(sq/8):Math.floor(sq/8);
      const f=flipped?7-(sq%8):sq%8;
      const cx=f*cs+cs/2; const cy=r*cs+cs/2; const rad=cs*0.36;
      ctx.shadowColor="rgba(0,0,0,0.6)";ctx.shadowBlur=5;
      ctx.beginPath();ctx.arc(cx,cy,rad,0,Math.PI*2);
      ctx.fillStyle=p.c==="r"?"#e53935":"#f5f5f5";ctx.fill();
      ctx.strokeStyle=p.c==="r"?"#b71c1c":"#9e9e9e";ctx.lineWidth=2;ctx.stroke();
      ctx.shadowBlur=0;
      if(p.king){
        ctx.fillStyle=p.c==="r"?"#fff":"#333";
        ctx.font=`bold ${Math.floor(cs*0.32)}px serif`;
        ctx.textAlign="center";ctx.textBaseline="middle";
        ctx.fillText("♚",cx,cy+1);
      }
    }
  }, []);

  const canvasRef = useResponsiveCanvas(drawFn);
  const redraw = useCallback(() => { const c=canvasRef.current; if(c) drawFn(c); }, [drawFn,canvasRef]);
  useEffect(() => { redraw(); }, [gs, selected, legalFrom, mode, redraw]);

  const startGame = useCallback(() => {
    const s=CK.initial(); setGs(s); setSelected(null); setLegalFrom([]);
    setThinking(false); setResultRecorded(false); setShowResult(false);
    aiPending.current=false; setMode("playing");
  }, []);

  const recordResult = useCallback((s:CK.CkState) => {
    if(resultRecorded||!vsAI) return; setResultRecorded(true);
    if(s.status==="win_b"){if(playerColor==="b") recordWin(); else recordLoss();}
    else if(s.status==="win_r"){if(playerColor==="r") recordWin(); else recordLoss();}
    else recordDraw();
  }, [resultRecorded,vsAI,playerColor,recordWin,recordLoss,recordDraw]);

  const triggerAI = useCallback((s:CK.CkState) => {
    if(aiPending.current) return; aiPending.current=true; setThinking(true);
    setTimeout(()=>{
      const m=CK.aiMove(s,DEPTHS[difficulty]); aiPending.current=false; setThinking(false);
      if(m){const next=CK.applyMove(s,m); setGs(next); if(next.status!=="playing"){recordResult(next);setShowResult(true);}}
    },50);
  }, [difficulty,recordResult]);

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
    const flipped=vsAI&&playerColor==="b";
    const col=Math.floor(x/cs); const row=Math.floor(y/cs);
    if(col<0||col>7||row<0||row>7) return;
    const sq=flipped?(7-row)*8+(7-col):row*8+col;
    if(selected!==null){
      const moves=legalFrom.filter(m=>m.path[m.path.length-1]===sq);
      if(moves.length){
        const next=CK.applyMove(gs,moves[0]); setGs(next); setSelected(null); setLegalFrom([]);
        if(next.status!=="playing"){recordResult(next);setShowResult(true);}
        else if(vsAI&&next.turn!==playerColor) triggerAI(next);
        return;
      }
    }
    const lm=CK.movesFrom(gs,sq);
    if(lm.length){setSelected(sq);setLegalFrom(lm);}
    else{setSelected(null);setLegalFrom([]);}
  };

  const getXY = (canvas:HTMLCanvasElement,cx:number,cy:number) => {
    const r=canvas.getBoundingClientRect();
    return [(cx-r.left)*canvas.width/r.width,(cy-r.top)*canvas.height/r.height] as const;
  };
  const clickC = (e:React.MouseEvent<HTMLCanvasElement>) => { const[x,y]=getXY(canvasRef.current!,e.clientX,e.clientY); handleClick(x,y); };
  const touchC = (e:React.TouchEvent<HTMLCanvasElement>) => { e.preventDefault(); const t=e.changedTouches[0]; const[x,y]=getXY(canvasRef.current!,t.clientX,t.clientY); handleClick(x,y); };

  const statusText = () => {
    if(thinking) return "AI thinking…";
    if(gs.status==="win_r") return "Red wins!";
    if(gs.status==="win_b") return "White wins!";
    return vsAI&&gs.turn===playerColor?"Your turn":`${gs.turn==="r"?"Red":"White"} to move`;
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
        <canvas ref={canvasRef} style={{width:"100%",height:"100%",cursor:"pointer",borderRadius:4}} onClick={clickC} onTouchEnd={touchC}/>
      </div>
      <div className="status-bar"><span>⬤ Checkers</span>{vsAI&&<span>AI: {["Easy","Medium","Hard"][difficulty]}</span>}</div>
      {(mode==="menu"||mode==="color")&&(
        <div className="modal-overlay">
          <div className="modal">
            {mode==="menu"&&<>
              <h2>⬤ Checkers</h2>
              <button className="modal-btn" onClick={()=>{setVsAI(true);setMode("color");}}>vs AI</button>
              <button className="modal-btn" onClick={()=>{setVsAI(false);setPlayerColor("b");startGame();}}>2 Players</button>
              <div style={{marginTop:12,marginBottom:8}}>
                <div style={{fontSize:".75rem",color:"var(--muted)",marginBottom:6}}>AI Difficulty</div>
                <div style={{display:"flex",gap:8}}>
                  {["Easy","Medium","Hard"].map((l,i)=>(
                    <button key={l} className={`modal-btn${difficulty===i?" active":""}`} style={{flex:1,textAlign:"center",padding:"8px"}} onClick={()=>setDifficulty(i)}>{l}</button>
                  ))}
                </div>
              </div>
              <button className="modal-close" onClick={()=>go("/")}>Main Menu</button>
            </>}
            {mode==="color"&&<>
              <h2>Play as</h2>
              <button className="modal-btn" onClick={()=>{setPlayerColor("r");startGame();}}>🔴 Red (moves first)</button>
              <button className="modal-btn" onClick={()=>{setPlayerColor("b");startGame();}}>⬜ White (moves second)</button>
              <button className="modal-close" onClick={()=>setMode("menu")}>← Back</button>
            </>}
          </div>
        </div>
      )}
      {showResult&&(
        <div className="modal-overlay">
          <div className="modal">
            <h2>Game Over</h2>
            <p style={{color:"var(--muted)",marginBottom:16,textAlign:"center"}}>
              {gs.status==="win_r"?"Red wins!":gs.status==="win_b"?"White wins!":"Draw!"}
            </p>
            <button className="modal-btn" onClick={()=>{setShowResult(false);startGame();}}>Play Again</button>
            <button className="modal-btn" onClick={()=>{setShowResult(false);setMode("menu");}}>Change Mode</button>
            <button className="modal-close" onClick={()=>go("/")}>Main Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
