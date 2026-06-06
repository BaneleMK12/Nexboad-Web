import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import * as MB from "@/engines/morabaraba";
import { useStats } from "@/hooks/useStats";

// Android Morabaraba colors: bg=#0E0E0E, lines=#3A3A3A
// Pieces: White=#F5F5F5, Black=#212121, ring=#9E9E9E
// Selection accent=#7FC8F8, mill dots=#FFC107, lastMove=rgba(255,215,0,0.31)

type Mode = "menu"|"variant"|"color"|"playing";

export default function Morabaraba() {
  const [,go] = useLocation();
  const { recordWin, recordLoss } = useStats("morabaraba");
  const [mode, setMode] = useState<Mode>("menu");
  const [vsAI, setVsAI] = useState(true);
  const [playerColor, setPlayerColor] = useState<MB.MColor>("w");
  const [pieceCnt, setPieceCnt] = useState(12);
  const [difficulty, setDifficulty] = useState(1);
  const [gs, setGs] = useState(MB.initial(12));
  const [selected, setSelected] = useState<number|null>(null);
  const [legalTargets, setLegalTargets] = useState<number[]>([]);
  const [thinking, setThinking] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [resultRecorded, setResultRecorded] = useState(false);
  const [pendingRemove, setPendingRemove] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aiRef = useRef(false);

  const SIZE = useCallback(()=>{
    const el=canvasRef.current; if(!el) return 300;
    return Math.min(el.width,el.height);
  },[]);

  // cellSize = size/6 (matching Android: cellSize = size/6)
  const CS = useCallback(()=> SIZE()/6, [SIZE]);

  // Convert node index to pixel center
  const nodeCenter = useCallback((idx:number):[number,number]=>{
    const cs=CS();
    const [row,col]=MB.NODE_POS[idx];
    const canvas=canvasRef.current!;
    const boardSize=SIZE();
    const ox=(canvas.width-boardSize)/2, oy=(canvas.height-boardSize)/2;
    return [ox+col*cs, oy+row*cs];
  },[CS,SIZE]);

  const draw = useCallback((state:MB.MState, sel:number|null, targets:number[], isRemove:boolean)=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const ctx=canvas.getContext("2d")!;
    const cs=CS(); const boardSize=SIZE();
    const ox=(canvas.width-boardSize)/2, oy=(canvas.height-boardSize)/2;
    // background
    ctx.fillStyle="#0E0E0E"; ctx.fillRect(0,0,canvas.width,canvas.height);
    // board lines — connect adjacent nodes
    ctx.strokeStyle="#3A3A3A"; ctx.lineWidth=cs*0.04; ctx.lineCap="round";
    const drawn=new Set<string>();
    for(let i=0;i<24;i++){
      for(const j of MB.ADJACENCY[i]){
        const key=i<j?`${i}-${j}`:`${j}-${i}`;
        if(drawn.has(key)) continue; drawn.add(key);
        const [ax,ay]=nodeCenter(i); const [bx,by]=nodeCenter(j);
        ctx.beginPath(); ctx.moveTo(ax,ay); ctx.lineTo(bx,by); ctx.stroke();
      }
    }
    // last move highlight
    if(state.lastFrom>=0&&state.lastFrom<24){
      const[cx,cy]=nodeCenter(state.lastFrom);
      ctx.beginPath(); ctx.arc(cx,cy,cs*0.38,0,Math.PI*2);
      ctx.fillStyle="rgba(255,215,0,0.3)"; ctx.fill();
    }
    if(state.lastTo>=0&&state.lastTo<24){
      const[cx,cy]=nodeCenter(state.lastTo);
      ctx.beginPath(); ctx.arc(cx,cy,cs*0.38,0,Math.PI*2);
      ctx.fillStyle="rgba(255,215,0,0.3)"; ctx.fill();
    }
    // selected node ring
    if(sel!==null&&sel>=0){
      const[cx,cy]=nodeCenter(sel);
      ctx.beginPath(); ctx.arc(cx,cy,cs*0.38,0,Math.PI*2);
      ctx.strokeStyle="rgba(127,200,248,0.8)"; ctx.lineWidth=cs*0.10; ctx.stroke();
    }
    // valid target dots
    for(const idx of targets){
      const[cx,cy]=nodeCenter(idx);
      ctx.beginPath(); ctx.arc(cx,cy,cs*0.14,0,Math.PI*2);
      ctx.fillStyle=isRemove?"rgba(255,193,7,0.8)":"rgba(127,200,248,0.55)"; ctx.fill();
    }
    // empty nodes
    for(let i=0;i<24;i++){
      if(state.board[i]!==null) continue;
      const[cx,cy]=nodeCenter(i);
      ctx.beginPath(); ctx.arc(cx,cy,cs*0.13,0,Math.PI*2);
      ctx.fillStyle="#2A2A2A"; ctx.fill();
      ctx.strokeStyle="#444444"; ctx.lineWidth=cs*0.04; ctx.stroke();
    }
    // pieces — Android double-ring disc style
    for(let i=0;i<24;i++){
      const c=state.board[i]; if(c===null) continue;
      const[cx,cy]=nodeCenter(i);
      const r=cs*0.36;
      const isWhite=c==="w";
      // shadow
      ctx.beginPath(); ctx.arc(cx+1.5, cy+2.5, r, 0, Math.PI*2);
      ctx.fillStyle="rgba(0,0,0,0.31)"; ctx.fill();
      // fill
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.fillStyle=isWhite?"#F5F5F5":"#212121"; ctx.fill();
      // outer ring
      ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2);
      ctx.strokeStyle="#9E9E9E"; ctx.lineWidth=r*0.09; ctx.stroke();
      // inner ring
      ctx.beginPath(); ctx.arc(cx,cy,r*0.68,0,Math.PI*2);
      ctx.strokeStyle="#9E9E9E"; ctx.lineWidth=r*0.06; ctx.stroke();
    }
    // piece counts bar
    const wLeft=12-state.placed[0], bLeft=12-state.placed[1];
    ctx.fillStyle="rgba(255,255,255,0.25)";
    ctx.font=`${Math.floor(cs*0.28)}px Inter,sans-serif`;
    ctx.textAlign="left"; ctx.textBaseline="bottom";
    ctx.fillText(`W placed: ${state.placed[0]}/12  B placed: ${state.placed[1]}/12`, ox, oy-4);
  },[CS,SIZE,nodeCenter]);

  useEffect(()=>{ if(mode==="playing") draw(gs,selected,legalTargets,pendingRemove); },[gs,selected,legalTargets,pendingRemove,mode,draw]);

  const startGame=useCallback((pc:number,color:MB.MColor)=>{
    const s=MB.initial(pc); setGs(s); setSelected(null); setLegalTargets([]);
    setPendingRemove(false); setThinking(false); setResultRecorded(false); setShowResult(false);
    aiRef.current=false; setMode("playing");
    if(vsAI&&s.turn!==color) setTimeout(()=>triggerAI(s,color,difficulty),100);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[vsAI,difficulty]);

  const recordResult=useCallback((s:MB.MState)=>{
    if(resultRecorded||!vsAI) return; setResultRecorded(true);
    if((s.status==="win_w"&&playerColor==="w")||(s.status==="win_b"&&playerColor==="b")) recordWin();
    else recordLoss();
  },[resultRecorded,vsAI,playerColor,recordWin,recordLoss]);

  const triggerAI=useCallback((s:MB.MState,pCol:MB.MColor,diff:number)=>{
    if(aiRef.current) return;
    aiRef.current=true; setThinking(true);
    const depths=[3,5,7]; const depth=depths[diff];
    setTimeout(()=>{
      const m=MB.aiMove(s,depth);
      aiRef.current=false; setThinking(false);
      if(m){
        let next:MB.MState;
        if(m.from===-1) next=MB.applyPlace(s,m.to);
        else next=MB.applyMoveNode(s,m.from,m.to);
        if(m.remove!==undefined) next=MB.applyRemove(next,m.remove);
        setGs(next); setPendingRemove(false); setSelected(null); setLegalTargets([]);
        if(next.status!=="playing"){ recordResult(next); setShowResult(true); }
      }
    },50);
  },[recordResult]);

  useEffect(()=>{
    if(mode!=="playing") return;
    if(gs.status!=="playing"){ if(!resultRecorded){ recordResult(gs); setShowResult(true); } return; }
    if(vsAI&&gs.turn!==playerColor&&!aiRef.current) triggerAI(gs,playerColor,difficulty);
  },[gs,mode]);

  const nearestNode=useCallback((x:number,y:number):number=>{
    const cs=CS();
    let best=-1, bestDist=Infinity;
    for(let i=0;i<24;i++){
      const[cx,cy]=nodeCenter(i);
      const d=(x-cx)**2+(y-cy)**2;
      if(d<bestDist){ bestDist=d; best=i; }
    }
    const threshold=cs*0.65;
    return bestDist<threshold*threshold?best:-1;
  },[CS,nodeCenter]);

  const handleClick=useCallback((x:number,y:number)=>{
    if(mode!=="playing"||thinking||(vsAI&&gs.turn!==playerColor)) return;
    if(gs.status!=="playing"){ setShowResult(true); return; }
    const node=nearestNode(x,y); if(node<0) return;

    // Remove phase: must remove opponent piece
    if(gs.pendingRemove){
      const opp:MB.MColor=gs.turn==="w"?"b":"w";
      if(gs.board[node]!==opp) return;
      const next=MB.applyRemove(gs,node); setGs(next);
      setPendingRemove(false); setSelected(null); setLegalTargets([]);
      if(next.status!=="playing"){ recordResult(next); setShowResult(true); }
      else if(vsAI&&next.turn!==playerColor) triggerAI(next,playerColor,difficulty);
      return;
    }

    // Place phase
    if(gs.phase==="place"){
      if(gs.board[node]!==null) return;
      const next=MB.applyPlace(gs,node); setGs(next); setSelected(null); setLegalTargets([]);
      if(next.pendingRemove){
        // show which opponent pieces can be removed
        const opp:MB.MColor=next.turn==="w"?"b":"w";
        setPendingRemove(true);
        setLegalTargets(Array.from({length:24},(_,i)=>i).filter(i=>next.board[i]===opp));
        return;
      }
      if(next.status!=="playing"){ recordResult(next); setShowResult(true); }
      else if(vsAI&&next.turn!==playerColor) triggerAI(next,playerColor,difficulty);
      return;
    }

    // Move/fly phase
    if(selected===null){
      if(gs.board[node]!==gs.turn) return;
      const moves=MB.getMoves(gs).filter(m=>m.from===node);
      if(moves.length){ setSelected(node); setLegalTargets(moves.map(m=>m.to)); }
    } else {
      if(node===selected){ setSelected(null); setLegalTargets([]); return; }
      const moves=MB.getMoves(gs).filter(m=>m.from===selected&&m.to===node);
      if(moves.length){
        const next=MB.applyMoveNode(gs,selected,node); setGs(next);
        setSelected(null); setLegalTargets([]);
        if(next.pendingRemove){
          const opp:MB.MColor=next.turn==="w"?"b":"w";
          setPendingRemove(true);
          setLegalTargets(Array.from({length:24},(_,i)=>i).filter(i=>next.board[i]===opp));
          return;
        }
        if(next.status!=="playing"){ recordResult(next); setShowResult(true); }
        else if(vsAI&&next.turn!==playerColor) triggerAI(next,playerColor,difficulty);
      } else if(gs.board[node]===gs.turn){
        const movesFrom=MB.getMoves(gs).filter(m=>m.from===node);
        if(movesFrom.length){ setSelected(node); setLegalTargets(movesFrom.map(m=>m.to)); }
        else { setSelected(null); setLegalTargets([]); }
      } else { setSelected(null); setLegalTargets([]); }
    }
  },[mode,gs,selected,vsAI,playerColor,thinking,nearestNode,recordResult,triggerAI,difficulty]);

  const canvasClick=(e:React.MouseEvent<HTMLCanvasElement>)=>{
    const r=canvasRef.current!.getBoundingClientRect();
    handleClick((e.clientX-r.left)*canvasRef.current!.width/r.width,(e.clientY-r.top)*canvasRef.current!.height/r.height);
  };
  const canvasTouch=(e:React.TouchEvent<HTMLCanvasElement>)=>{
    e.preventDefault(); const t=e.changedTouches[0];
    const r=canvasRef.current!.getBoundingClientRect();
    handleClick((t.clientX-r.left)*canvasRef.current!.width/r.width,(t.clientY-r.top)*canvasRef.current!.height/r.height);
  };

  const wPieces=Array.from({length:24},(_,i)=>i).filter(i=>gs.board[i]==="w").length;
  const bPieces=Array.from({length:24},(_,i)=>i).filter(i=>gs.board[i]==="b").length;

  const statusText=()=>{
    if(thinking) return "AI thinking…";
    if(gs.status==="win_w") return vsAI?(playerColor==="w"?"You win!":"AI wins!"):"White wins!";
    if(gs.status==="win_b") return vsAI?(playerColor==="b"?"You win!":"AI wins!"):"Black wins!";
    if(gs.pendingRemove) return "MILL! Remove a piece";
    const mine=vsAI&&gs.turn===playerColor;
    const phase=gs.phase==="place"?"(place)":"(move)";
    return mine?`Your turn ${phase}`:`${gs.turn==="w"?"White":"Black"} ${phase}`;
  };
  const winner=()=>{
    if(gs.status==="win_w") return vsAI?(playerColor==="w"?"You win!":"You lose!"):"White wins!";
    if(gs.status==="win_b") return vsAI?(playerColor==="b"?"You win!":"You lose!"):"Black wins!";
    return "Game over";
  };

  const VARIANTS:[number,string][]=[
    [12,"Nine Cows (classic)"],
    [9,"Nine Men's Morris"],
    [6,"Six Cows"],
  ];

  return (
    <div className="game-wrap">
      <div className="game-hud">
        <button className="hud-btn" onClick={()=>go("/")}>← Back</button>
        <div style={{textAlign:"center"}}>
          <div className="turn-label" style={{color:gs.pendingRemove?"#FFC107":undefined}}>{statusText()}</div>
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
        <span style={{color:"#F5F5F5"}}>⬤ W: {wPieces}</span>
        <span>Morabaraba</span>
        <span style={{color:"#9E9E9E"}}>⬤ B: {bPieces}</span>
      </div>
      {(mode==="menu"||mode==="variant"||mode==="color")&&(
        <div className="modal-overlay"><div className="modal">
          {mode==="menu"&&<>
            <h2>⬤ Morabaraba</h2>
            <button className="modal-btn" onClick={()=>{setVsAI(true);setMode("variant");}}>vs AI</button>
            <button className="modal-btn" onClick={()=>{setVsAI(false);setMode("variant");}}>2 Players</button>
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
          {mode==="variant"&&<>
            <h2>Variant</h2>
            {VARIANTS.map(([pc,label])=>(
              <button key={pc} className={`modal-btn${pieceCnt===pc?" active":""}`}
                onClick={()=>{ setPieceCnt(pc); if(vsAI) setMode("color"); else { setPlayerColor("w"); startGame(pc,"w"); } }}>
                {label}
              </button>
            ))}
            <button className="modal-close" onClick={()=>setMode("menu")}>← Back</button>
          </>}
          {mode==="color"&&<>
            <h2>Play as</h2>
            <button className="modal-btn" onClick={()=>{ setPlayerColor("w"); startGame(pieceCnt,"w"); }}>⬜ White</button>
            <button className="modal-btn" onClick={()=>{ setPlayerColor("b"); startGame(pieceCnt,"b"); }}>⬛ Black</button>
            <button className="modal-close" onClick={()=>setMode("variant")}>← Back</button>
          </>}
        </div></div>
      )}
      {showResult&&(
        <div className="modal-overlay"><div className="modal">
          <h2>Game Over</h2>
          <p style={{color:"var(--muted)",marginBottom:16,textAlign:"center"}}>{winner()}</p>
          <button className="modal-btn" onClick={()=>{setShowResult(false);startGame(pieceCnt,playerColor);}}>Play Again</button>
          <button className="modal-btn" onClick={()=>{setShowResult(false);setMode("menu");}}>Change Mode</button>
          <button className="modal-close" onClick={()=>go("/")}>Main Menu</button>
        </div></div>
      )}
    </div>
  );
}
