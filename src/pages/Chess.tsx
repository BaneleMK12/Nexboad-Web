import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import * as CE from "@/engines/chess";
import { useStats } from "@/hooks/useStats";

// Android "Classic" theme: light=#F0D9B5 dark=#B58863 accent=#7FC8F8
const LIGHT = "#F0D9B5";
const DARK  = "#B58863";

const SYMBOLS: Record<string,string> = {
  wK:"♔",wQ:"♕",wR:"♖",wB:"♗",wN:"♘",wP:"♙",
  bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟",
};
const DEPTHS = [2,4,6];

type Mode = "menu"|"color"|"playing";

export default function Chess() {
  const [,go] = useLocation();
  const { recordWin, recordLoss, recordDraw } = useStats("chess");
  const [mode, setMode] = useState<Mode>("menu");
  const [vsAI, setVsAI] = useState(true);
  const [playerColor, setPlayerColor] = useState<CE.Color>("w");
  const [difficulty, setDifficulty] = useState(1);
  const [gameState, setGameState] = useState(CE.initial());
  const [selected, setSelected] = useState<number|null>(null);
  const [legalFrom, setLegalFrom] = useState<CE.CMove[]>([]);
  const [thinking, setThinking] = useState(false);
  const [promoInfo, setPromoInfo] = useState<{from:number,to:number}|null>(null);
  const [resultRecorded, setResultRecorded] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const aiPending = useRef(false);

  const cellSize = useCallback(() => {
    const el = canvasRef.current; if (!el) return 50;
    return Math.floor(Math.min(el.width, el.height) / 8);
  }, []);

  // Engine: rank 0 = white back rank (a1-h1 = bottom when white is at bottom)
  // Display: canvas row 0 = top of screen
  // Normal view (white at bottom): screenRow = 7 - engineRow
  // Flipped view (black at bottom): screenRow = engineRow
  const toScreen = useCallback((engineRow:number, engineCol:number, flipped:boolean) => {
    const r = flipped ? engineRow : 7 - engineRow;
    const f = flipped ? 7 - engineCol : engineCol;
    return [r, f];
  }, []);

  const squareForXY = useCallback((x:number,y:number,flipped:boolean) => {
    const cs = cellSize();
    const screenCol = Math.floor(x/cs); const screenRow = Math.floor(y/cs);
    if (screenCol<0||screenCol>7||screenRow<0||screenRow>7) return -1;
    // Invert toScreen: engineRow = flipped?screenRow:7-screenRow, engineCol = flipped?7-screenCol:screenCol
    const engineRow = flipped ? screenRow : 7 - screenRow;
    const engineCol = flipped ? 7 - screenCol : screenCol;
    return engineRow*8+engineCol;
  }, [cellSize]);

  const draw = useCallback((state:CE.CState, sel:number|null, lm:CE.CMove[]) => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const cs = cellSize(); const flipped = vsAI && playerColor==="b";
    // background
    ctx.fillStyle = "#121212"; ctx.fillRect(0,0,canvas.width,canvas.height);
    // board squares — screen r=0 is top, so for white-at-bottom: screen r=0 = rank 8 (black side)
    for (let r=0;r<8;r++) for (let f=0;f<8;f++) {
      const [er, ef] = [flipped?r:7-r, flipped?7-f:f]; // engine row/col for this screen cell
      const light = (er+ef)%2===0;
      ctx.fillStyle = light ? LIGHT : DARK;
      ctx.fillRect(f*cs, r*cs, cs, cs);
    }
    // last move highlight (gold)
    if (state.lastFrom>=0) {
      const [sr,sf] = toScreen(Math.floor(state.lastFrom/8), state.lastFrom%8, flipped);
      ctx.fillStyle = "rgba(255,215,0,0.35)"; ctx.fillRect(sf*cs,sr*cs,cs,cs);
    }
    if (state.lastTo>=0) {
      const [sr,sf] = toScreen(Math.floor(state.lastTo/8), state.lastTo%8, flipped);
      ctx.fillStyle = "rgba(255,215,0,0.35)"; ctx.fillRect(sf*cs,sr*cs,cs,cs);
    }
    // selected highlight (blue)
    if (sel!==null) {
      const [sr,sf] = toScreen(Math.floor(sel/8), sel%8, flipped);
      ctx.fillStyle = "rgba(127,200,248,0.6)"; ctx.fillRect(sf*cs,sr*cs,cs,cs);
    }
    // legal move dots/rings
    for (const m of lm) {
      const to = m.to;
      const [sr,sf] = toScreen(Math.floor(to/8), to%8, flipped);
      const cx = sf*cs+cs/2; const cy = sr*cs+cs/2;
      const hasPiece = state.board[to];
      if (hasPiece) {
        ctx.beginPath(); ctx.arc(cx,cy,cs*0.44,0,Math.PI*2);
        ctx.strokeStyle=`rgba(127,200,248,0.5)`; ctx.lineWidth=cs*0.08; ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(cx,cy,cs*0.17,0,Math.PI*2);
        ctx.fillStyle="rgba(127,200,248,0.5)"; ctx.fill();
      }
    }
    // check/checkmate king highlight
    if (state.status==="check"||state.status==="checkmate") {
      for (let s=0;s<64;s++) {
        const p=state.board[s];
        if (p&&p.t==="K"&&p.c===state.turn) {
          const [sr,sf] = toScreen(Math.floor(s/8), s%8, flipped);
          ctx.fillStyle="rgba(255,50,50,0.45)"; ctx.fillRect(sf*cs,sr*cs,cs,cs);
        }
      }
    }
    // pieces — Android style: stroke outline then fill
    ctx.textAlign="center"; ctx.textBaseline="middle";
    for (let sq=0;sq<64;sq++) {
      const p=state.board[sq]; if (!p) continue;
      const [sr,sf] = toScreen(Math.floor(sq/8), sq%8, flipped);
      const r=sr, f=sf;
      const cx=f*cs+cs/2; const cy=r*cs+cs/2;
      const sz = Math.floor(cs*0.62);
      ctx.font = `${sz}px serif`;
      // shadow/stroke first
      ctx.strokeStyle = p.c==="w" ? "#757575" : "#EEEEEE";
      ctx.lineWidth = cs*0.04;
      ctx.strokeText(SYMBOLS[p.c+p.t], cx, cy+sz*0.04);
      // fill
      ctx.fillStyle = p.c==="w" ? "#FFFDE7" : "#212121";
      ctx.fillText(SYMBOLS[p.c+p.t], cx, cy+sz*0.04);
    }
    // board labels
    ctx.font = `${Math.floor(cs*0.18)}px Inter,sans-serif`;
    ctx.fillStyle = "rgba(120,80,40,0.5)";
    const ranks = flipped?["1","2","3","4","5","6","7","8"]:["8","7","6","5","4","3","2","1"];
    const files = flipped?["h","g","f","e","d","c","b","a"]:["a","b","c","d","e","f","g","h"];
    for (let i=0;i<8;i++) {
      ctx.textAlign="left"; ctx.textBaseline="top";
      ctx.fillText(ranks[i], 2, i*cs+2);
      ctx.textAlign="right"; ctx.textBaseline="bottom";
      ctx.fillText(files[i], (i+1)*cs-2, 8*cs-2);
    }
  }, [vsAI, playerColor, cellSize, toScreen]);

  useEffect(() => { if (mode==="playing") draw(gameState, selected, legalFrom); }, [gameState, selected, legalFrom, mode, draw]);

  const startGame = useCallback(() => {
    const s = CE.initial();
    setGameState(s); setSelected(null); setLegalFrom([]);
    setThinking(false); setResultRecorded(false); setShowResult(false);
    aiPending.current = false; setMode("playing");
  }, []);

  const recordResult = useCallback((s:CE.CState) => {
    if (resultRecorded||!vsAI) return;
    setResultRecorded(true);
    if (s.status==="checkmate") {
      if (s.turn===playerColor) recordLoss(); else recordWin();
    } else recordDraw();
  }, [resultRecorded,vsAI,playerColor,recordWin,recordLoss,recordDraw]);

  const triggerAI = useCallback((s:CE.CState) => {
    if (aiPending.current) return;
    aiPending.current=true; setThinking(true);
    const depth=DEPTHS[difficulty]; const tl=[800,1500,2500][difficulty];
    setTimeout(() => {
      const m = CE.aiMove(s,depth,tl);
      aiPending.current=false; setThinking(false);
      if (m) {
        const next = CE.applyLegal(s,m); setGameState(next);
        if (next.status!=="playing"&&next.status!=="check") { recordResult(next); setShowResult(true); }
      }
    }, 50);
  }, [difficulty, recordResult]);

  useEffect(() => {
    if (mode!=="playing") return;
    if (gameState.status==="checkmate"||gameState.status==="stalemate"||gameState.status==="draw") {
      if (!resultRecorded) { recordResult(gameState); setShowResult(true); } return;
    }
    if (vsAI&&gameState.turn!==playerColor&&!thinking&&!aiPending.current) triggerAI(gameState);
  }, [gameState, mode]);

  const handleCanvas = useCallback((cx:number,cy:number) => {
    if (mode!=="playing") return;
    if (gameState.status!=="playing"&&gameState.status!=="check") { setShowResult(true); return; }
    if (thinking||(vsAI&&gameState.turn!==playerColor)) return;
    const flipped=vsAI&&playerColor==="b";
    const sq=squareForXY(cx,cy,flipped); if (sq<0) return;
    if (selected===null) {
      const p=gameState.board[sq];
      if (p&&p.c===gameState.turn) { setSelected(sq); setLegalFrom(CE.movesFrom(gameState,sq)); }
    } else {
      const moves=legalFrom.filter(m=>m.to===sq);
      if (moves.length) {
        const promos=moves.filter(m=>m.promo);
        if (promos.length) { setPromoInfo({from:selected,to:sq}); return; }
        const next=CE.applyLegal(gameState,moves[0]);
        setGameState(next); setSelected(null); setLegalFrom([]);
        if (next.status==="checkmate"||next.status==="stalemate"||next.status==="draw") { recordResult(next); setShowResult(true); }
        else if (vsAI&&next.turn!==playerColor) triggerAI(next);
      } else {
        const p=gameState.board[sq];
        if (p&&p.c===gameState.turn) { setSelected(sq); setLegalFrom(CE.movesFrom(gameState,sq)); }
        else { setSelected(null); setLegalFrom([]); }
      }
    }
  }, [mode,gameState,selected,legalFrom,vsAI,playerColor,thinking,squareForXY,recordResult,triggerAI]);

  const canvasClick=(e:React.MouseEvent<HTMLCanvasElement>)=>{
    const r=canvasRef.current!.getBoundingClientRect();
    handleCanvas((e.clientX-r.left)*canvasRef.current!.width/r.width,(e.clientY-r.top)*canvasRef.current!.height/r.height);
  };
  const canvasTouch=(e:React.TouchEvent<HTMLCanvasElement>)=>{
    e.preventDefault(); const t=e.changedTouches[0];
    const r=canvasRef.current!.getBoundingClientRect();
    handleCanvas((t.clientX-r.left)*canvasRef.current!.width/r.width,(t.clientY-r.top)*canvasRef.current!.height/r.height);
  };

  const statusText=()=>{
    if (thinking) return "AI thinking…";
    if (gameState.status==="check") return `${gameState.turn==="w"?"White":"Black"} in check`;
    if (gameState.status==="checkmate") return "Checkmate!";
    if (gameState.status==="stalemate") return "Stalemate";
    if (gameState.status==="draw") return "Draw";
    const mine=vsAI&&gameState.turn===playerColor;
    return mine?"Your turn":`${gameState.turn==="w"?"White":"Black"} to move`;
  };
  void stats;

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
        <span>♟ Chess</span>
        {vsAI&&<span>AI: {["Easy","Medium","Hard"][difficulty]}</span>}
        <span>{gameState.turn==="w"?"White":"Black"} to move</span>
      </div>
      {(mode==="menu"||mode==="color")&&(
        <div className="modal-overlay">
          <div className="modal">
            {mode==="menu"&&<>
              <h2>♟ Chess</h2>
              <button className="modal-btn" onClick={()=>{setVsAI(true);setMode("color");}}>vs AI</button>
              <button className="modal-btn" onClick={()=>{setVsAI(false);setPlayerColor("w");startGame();}}>2 Players</button>
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
              <button className="modal-btn" onClick={()=>{setPlayerColor("w");startGame();}}>⬜ White (moves first)</button>
              <button className="modal-btn" onClick={()=>{setPlayerColor("b");startGame();}}>⬛ Black (moves second)</button>
              <button className="modal-close" onClick={()=>setMode("menu")}>← Back</button>
            </>}
          </div>
        </div>
      )}
      {promoInfo&&(
        <div className="modal-overlay">
          <div className="modal">
            <h2>Promote pawn</h2>
            {(["Q","R","B","N"] as CE.PType[]).map(pt=>(
              <button key={pt} className="modal-btn" style={{fontSize:"1.4rem",textAlign:"center"}} onClick={()=>{
                const m=CE.movesFrom(gameState,promoInfo.from).find(x=>x.to===promoInfo.to&&x.promo===pt)!;
                const next=CE.applyLegal(gameState,m);
                setGameState(next); setSelected(null); setLegalFrom([]); setPromoInfo(null);
                if (next.status==="checkmate"||next.status==="stalemate"||next.status==="draw") { recordResult(next); setShowResult(true); }
                else if (vsAI&&next.turn!==playerColor) triggerAI(next);
              }}>{SYMBOLS[gameState.turn+pt]} {pt==="Q"?"Queen":pt==="R"?"Rook":pt==="B"?"Bishop":"Knight"}</button>
            ))}
          </div>
        </div>
      )}
      {showResult&&(
        <div className="modal-overlay">
          <div className="modal">
            <h2>Game Over</h2>
            <p style={{color:"var(--muted)",marginBottom:16,textAlign:"center"}}>
              {gameState.status==="checkmate"
                ?(gameState.turn===(vsAI?playerColor:"w")?"You lose! Checkmate.":"You win! Checkmate.")
                :gameState.status==="stalemate"?"Stalemate — it's a draw!":"Draw!"}
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
