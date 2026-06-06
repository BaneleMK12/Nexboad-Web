import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import * as MB from "@/engines/morabaraba";
import { useStats } from "@/hooks/useStats";
import { useResponsiveCanvas } from "@/hooks/useCanvas";

type Mode = "menu"|"variant"|"color"|"playing";
const DEPTHS = [2,4,6];

export default function Morabaraba() {
  const [,go] = useLocation();
  const { recordWin, recordLoss, recordDraw } = useStats("morabaraba");
  const [mode, setMode] = useState<Mode>("menu");
  const [vsAI, setVsAI] = useState(true);
  const [playerColor, setPlayerColor] = useState<MB.MColor>("w");
  const [difficulty, setDifficulty] = useState(1);
  const [pieceCnt, setPieceCnt] = useState(12);
  const [gs, setGs] = useState(MB.initial(12));
  const [selected, setSelected] = useState<number|null>(null);
  const [thinking, setThinking] = useState(false);
  const [resultRecorded, setResultRecorded] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const aiPending = useRef(false);

  const modeRef = useRef(mode); const gsRef = useRef(gs); const selRef = useRef(selected);
  modeRef.current=mode; gsRef.current=gs; selRef.current=selected;

  const drawFn = useCallback((canvas: HTMLCanvasElement) => {
    if (modeRef.current !== "playing") return;
    const state = gsRef.current; const sel = selRef.current;
    const ctx = canvas.getContext("2d")!;
    const W = Math.min(canvas.width, canvas.height);
    const cs = W/7;
    ctx.fillStyle="#0e0e0e"; ctx.fillRect(0,0,canvas.width,canvas.height);
    for(const mill of MB.MILLS){
      const allSame=mill.every(n=>state.board[n]&&state.board[n]===state.board[mill[0]]);
      if(allSame&&state.board[mill[0]]){
        ctx.strokeStyle=state.board[mill[0]]==="w"?"rgba(245,245,245,0.2)":"rgba(230,81,0,0.3)";
        ctx.lineWidth=cs*0.08;
        ctx.beginPath();
        for(let i=0;i<mill.length;i++){
          const[r,f]=MB.NODE_POS[mill[i]]; const x=f*cs,y=r*cs;
          if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
        }
        ctx.stroke();
      }
    }
    ctx.strokeStyle="#2e2e2e"; ctx.lineWidth=2;
    const drawn=new Set<string>();
    for(let i=0;i<24;i++){
      for(const j of MB.ADJACENCY[i]){
        const key=[Math.min(i,j),Math.max(i,j)].join(",");
        if(drawn.has(key)) continue; drawn.add(key);
        const[r1,f1]=MB.NODE_POS[i]; const[r2,f2]=MB.NODE_POS[j];
        ctx.beginPath(); ctx.moveTo(f1*cs,r1*cs); ctx.lineTo(f2*cs,r2*cs); ctx.stroke();
      }
    }
    const validTargets=new Set<number>();
    if(state.phase==="place"&&!state.pendingRemove){
      state.board.forEach((v,i)=>{ if(!v) validTargets.add(i); });
    } else if(sel!==null&&!state.pendingRemove){
      const canFly=state.board.filter(x=>x===state.turn).length<=3;
      if(canFly) state.board.forEach((v,i)=>{ if(!v) validTargets.add(i); });
      else MB.ADJACENCY[sel].forEach(j=>{ if(!state.board[j]) validTargets.add(j); });
    }
    const removeCandidates=new Set<number>();
    if(state.pendingRemove){
      const opp:MB.MColor=state.turn==="w"?"b":"w";
      const oppP=state.board.map((v,i)=>v===opp?i:-1).filter(i=>i>=0);
      const allInMill=oppP.every(n=>MB.MILLS.some(m=>m.includes(n)&&m.every(x=>state.board[x]===opp)));
      oppP.forEach(n=>{
        const inM=MB.MILLS.some(m=>m.includes(n)&&m.every(x=>state.board[x]===opp));
        if(!inM||allInMill) removeCandidates.add(n);
      });
    }
    for(let i=0;i<24;i++){
      const[r,f]=MB.NODE_POS[i]; const x=f*cs; const y=r*cs; const rad=cs*0.18;
      ctx.shadowColor="rgba(0,0,0,0.7)"; ctx.shadowBlur=5;
      const p=state.board[i];
      if(p){
        ctx.beginPath(); ctx.arc(x,y,rad*2,0,Math.PI*2);
        ctx.fillStyle=p==="w"?"#f5f5f5":"#bf360c"; ctx.fill();
        ctx.strokeStyle=p==="w"?"#9e9e9e":"#7f2600"; ctx.lineWidth=2; ctx.stroke();
        if(sel===i&&!state.pendingRemove){ ctx.strokeStyle="#7fc8f8"; ctx.lineWidth=3; ctx.stroke(); }
        if(removeCandidates.has(i)){ ctx.strokeStyle="#ff1744"; ctx.lineWidth=3; ctx.stroke(); }
      } else {
        ctx.beginPath(); ctx.arc(x,y,rad,0,Math.PI*2);
        ctx.fillStyle=validTargets.has(i)?"rgba(127,200,248,0.4)":"#2a2a2a"; ctx.fill();
        ctx.strokeStyle="#444"; ctx.lineWidth=1.5; ctx.stroke();
      }
      ctx.shadowBlur=0;
    }
  }, []);

  const canvasRef = useResponsiveCanvas(drawFn);
  const redraw = useCallback(() => { const c=canvasRef.current; if(c) drawFn(c); }, [drawFn,canvasRef]);
  useEffect(() => { redraw(); }, [gs, selected, mode, redraw]);

  const startGame = useCallback(() => {
    const s=MB.initial(pieceCnt); setGs(s); setSelected(null); setThinking(false);
    setResultRecorded(false); setShowResult(false); aiPending.current=false; setMode("playing");
  }, [pieceCnt]);

  const recordResult = useCallback((s:MB.MState) => {
    if(resultRecorded||!vsAI) return; setResultRecorded(true);
    if(s.status==="win_w"){if(playerColor==="w") recordWin(); else recordLoss();}
    else if(s.status==="win_b"){if(playerColor==="b") recordWin(); else recordLoss();}
    else recordDraw();
  }, [resultRecorded,vsAI,playerColor,recordWin,recordLoss,recordDraw]);

  const triggerAI = useCallback((s:MB.MState) => {
    if(aiPending.current) return; aiPending.current=true; setThinking(true);
    setTimeout(()=>{
      const result=MB.aiMove(s,DEPTHS[difficulty]); aiPending.current=false; setThinking(false);
      if(!result) return;
      if(result.remove!=null){
        const next=MB.applyRemove(s,result.remove); setGs(next);
        if(next.status!=="playing"){recordResult(next);setShowResult(true);}
        else if(vsAI&&next.turn!==playerColor) triggerAI(next);
      } else {
        const next=s.phase==="place"?MB.applyPlace(s,result.to):MB.applyMoveNode(s,result.from,result.to);
        setGs(next);
        if(next.status!=="playing"){recordResult(next);setShowResult(true);}
        else if(next.pendingRemove){ triggerAI(next); }
        else if(vsAI&&next.turn!==playerColor) triggerAI(next);
      }
    },50);
  }, [difficulty,vsAI,playerColor,recordResult]);

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
    const cs=Math.min(canvas.width,canvas.height)/7;
    let best=-1; let bestDist=Infinity;
    for(let i=0;i<24;i++){
      const[r,f]=MB.NODE_POS[i]; const nx=f*cs; const ny=r*cs;
      const d=Math.hypot(x-nx,y-ny);
      if(d<bestDist){bestDist=d;best=i;}
    }
    if(bestDist>cs*0.45) return;
    if(gs.pendingRemove){
      const next=MB.applyRemove(gs,best); if(next===gs) return;
      setGs(next);
      if(next.status!=="playing"){recordResult(next);setShowResult(true);}
      else if(vsAI&&next.turn!==playerColor) triggerAI(next);
      return;
    }
    if(gs.phase==="place"){
      if(gs.board[best]) return;
      const next=MB.applyPlace(gs,best); setGs(next);
      if(next.status!=="playing"){recordResult(next);setShowResult(true);}
      else if(vsAI&&next.turn!==playerColor&&!next.pendingRemove) triggerAI(next);
      return;
    }
    if(selected===null){
      if(gs.board[best]===gs.turn) setSelected(best);
    } else {
      if(best===selected){setSelected(null);return;}
      const next=MB.applyMoveNode(gs,selected,best);
      if(next===gs){ if(gs.board[best]===gs.turn) setSelected(best); else setSelected(null); return; }
      setSelected(null); setGs(next);
      if(next.status!=="playing"){recordResult(next);setShowResult(true);}
      else if(vsAI&&next.turn!==playerColor&&!next.pendingRemove) triggerAI(next);
    }
  };

  const getXY = (canvas:HTMLCanvasElement,cx:number,cy:number) => {
    const r=canvas.getBoundingClientRect();
    return [(cx-r.left)*canvas.width/r.width,(cy-r.top)*canvas.height/r.height] as const;
  };
  const clickC=(e:React.MouseEvent<HTMLCanvasElement>)=>{const[x,y]=getXY(canvasRef.current!,e.clientX,e.clientY);handleClick(x,y);};
  const touchC=(e:React.TouchEvent<HTMLCanvasElement>)=>{e.preventDefault();const t=e.changedTouches[0];const[x,y]=getXY(canvasRef.current!,t.clientX,t.clientY);handleClick(x,y);};

  const wCnt=gs.board.filter(x=>x==="w").length;
  const bCnt=gs.board.filter(x=>x==="b").length;
  const [wp,bp]=gs.placed; const pc=gs.pieceCnt;

  const statusText=()=>{
    if(thinking) return "AI thinking…";
    if(gs.pendingRemove&&gs.turn===playerColor) return "Tap opponent's piece to remove";
    if(gs.phase==="place") return `Placing — ${gs.turn==="w"?"White":"Black"}`;
    return vsAI&&gs.turn===playerColor?"Your turn":`${gs.turn==="w"?"White":"Black"} to move`;
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
        <canvas ref={canvasRef} style={{width:"100%",height:"100%",cursor:"pointer"}} onClick={clickC} onTouchEnd={touchC}/>
      </div>
      <div className="status-bar">
        <span style={{color:"var(--text)"}}>⬜ {wCnt}{wp<pc?` (${pc-wp} left)`:""}</span>
        <span style={{color:"var(--muted)"}}>vs</span>
        <span style={{color:"#bf360c"}}>⬤ {bCnt}{bp<pc?` (${pc-bp} left)`:""}</span>
      </div>
      {(mode==="menu"||mode==="variant"||mode==="color")&&(
        <div className="modal-overlay">
          <div className="modal">
            {mode==="menu"&&<>
              <h2>⬡ Morabaraba</h2>
              <button className="modal-btn" onClick={()=>{setVsAI(true);setMode("variant");}}>vs AI</button>
              <button className="modal-btn" onClick={()=>{setVsAI(false);setMode("variant");}}>2 Players</button>
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
            {mode==="variant"&&<>
              <h2>Choose Variant</h2>
              {[["6 Cows","Simple",6],["9 Cows","Classic",9],["12 Cows","Morabaraba",12]].map(([name,sub,cnt])=>(
                <button key={String(cnt)} className={`modal-btn${pieceCnt===cnt?" active":""}`} onClick={()=>setPieceCnt(cnt as number)}>
                  <span style={{fontWeight:700}}>{name}</span> — <span style={{color:"var(--muted)"}}>{sub}</span>
                </button>
              ))}
              {vsAI
                ?<button className="modal-btn" style={{marginTop:8,background:"var(--accent)",color:"#000"}} onClick={()=>setMode("color")}>Continue →</button>
                :<button className="modal-btn" style={{marginTop:8,background:"var(--accent)",color:"#000"}} onClick={()=>{setPlayerColor("w");startGame();}}>Start Game →</button>
              }
              <button className="modal-close" onClick={()=>setMode("menu")}>← Back</button>
            </>}
            {mode==="color"&&<>
              <h2>Play as</h2>
              <button className="modal-btn" onClick={()=>{setPlayerColor("w");startGame();}}>⬜ White (moves first)</button>
              <button className="modal-btn" onClick={()=>{setPlayerColor("b");startGame();}}>⬤ Brown (moves second)</button>
              <button className="modal-close" onClick={()=>setMode("variant")}>← Back</button>
            </>}
          </div>
        </div>
      )}
      {showResult&&(
        <div className="modal-overlay">
          <div className="modal">
            <h2>Game Over</h2>
            <p style={{color:"var(--muted)",marginBottom:16,textAlign:"center"}}>
              {gs.status==="win_w"?"White wins!":gs.status==="win_b"?"Brown wins!":"Draw!"}
            </p>
            <button className="modal-btn" onClick={()=>{setShowResult(false);startGame();}}>Play Again</button>
            <button className="modal-close" onClick={()=>go("/")}>Main Menu</button>
          </div>
        </div>
      )}
    </div>
  );
}
