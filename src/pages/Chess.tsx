import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import * as CE from "@/engines/chess";
import { useStats } from "@/hooks/useStats";

type Mode = "menu"|"color"|"playing";

const SYMBOLS: Record<string,string> = {
  wK:"♔",wQ:"♕",wR:"♖",wB:"♗",wN:"♘",wP:"♙",
  bK:"♚",bQ:"♛",bR:"♜",bB:"♝",bN:"♞",bP:"♟",
};

const DEPTHS = [2,4,6];

export default function Chess() {
  const [,go] = useLocation();
  const { stats, recordWin, recordLoss, recordDraw } = useStats("chess");
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

  const cellSize = () => {
    const el = canvasRef.current;
    if (!el) return 50;
    return Math.floor(Math.min(el.width, el.height) / 8);
  };

  const squareForXY = useCallback((x:number,y:number,flipped:boolean) => {
    const cs = cellSize();
    const col = Math.floor(x/cs); const row = Math.floor(y/cs);
    if(col<0||col>7||row<0||row>7) return -1;
    return flipped ? (7-row)*8+(7-col) : row*8+col;
  }, []);

  const draw = useCallback((state:CE.CState, sel:number|null, lm:CE.CMove[]) => {
    const canvas = canvasRef.current; if(!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const cs = cellSize(); const flipped = vsAI && playerColor==="b";
    ctx.clearRect(0,0,canvas.width,canvas.height);
    for(let r=0;r<8;r++) for(let f=0;f<8;f++){
      const sq = flipped?(7-r)*8+(7-f):r*8+f;
      const dark=(r+f)%2===1;
      let bg=dark?"#2d4a3e":"#4a6b5a";
      if(sq===state.lastFrom||sq===state.lastTo) bg=dark?"#4a5a2a":"#6a7a3a";
      if(sel===sq) bg="#1a4a6a";
      ctx.fillStyle=bg;
      ctx.fillRect(f*cs,r*cs,cs,cs);
    }
    // legal move dots
    for(const m of lm){
      const to=m.to; const r=flipped?7-Math.floor(to/8):Math.floor(to/8); const f=flipped?7-(to%8):to%8;
      const cx=f*cs+cs/2; const cy=r*cs+cs/2;
      const hasPiece=state.board[to];
      ctx.beginPath();
      if(hasPiece){ ctx.arc(cx,cy,cs*0.45,0,Math.PI*2); ctx.strokeStyle="rgba(127,200,248,0.5)"; ctx.lineWidth=3; ctx.stroke(); }
      else { ctx.arc(cx,cy,cs*0.15,0,Math.PI*2); ctx.fillStyle="rgba(127,200,248,0.5)"; ctx.fill(); }
    }
    // pieces
    ctx.textAlign="center"; ctx.textBaseline="middle";
    for(let sq=0;sq<64;sq++){
      const p=state.board[sq]; if(!p) continue;
      const r=flipped?7-Math.floor(sq/8):Math.floor(sq/8); const f=flipped?7-(sq%8):sq%8;
      const cx=f*cs+cs/2; const cy=r*cs+cs/2;
      ctx.font=`${Math.floor(cs*0.68)}px serif`;
      ctx.fillStyle=p.c==="w"?"#f5f5f5":"#1a1a1a";
      ctx.shadowColor="rgba(0,0,0,0.8)"; ctx.shadowBlur=4;
      ctx.fillText(SYMBOLS[p.c+p.t], cx, cy+1);
      ctx.shadowBlur=0;
    }
    // check indicator
    if(state.status==="check"||state.status==="checkmate"){
      const ks = CE.legalMoves({...state}).length === 0 && state.status==="checkmate" ? -1 : -1;
      void ks;
      // find king square
      for(let s=0;s<64;s++){
        const p=state.board[s];
        if(p&&p.t==="K"&&p.c===state.turn){
          const r=flipped?7-Math.floor(s/8):Math.floor(s/8); const f=flipped?7-(s%8):s%8;
          ctx.fillStyle="rgba(255,50,50,0.35)";
          ctx.fillRect(f*cs,r*cs,cs,cs);
        }
      }
    }
    // coord labels
    ctx.font=`${Math.floor(cs*0.18)}px Inter,sans-serif`;
    ctx.fillStyle="rgba(255,255,255,0.4)";
    const ranks=flipped?["1","2","3","4","5","6","7","8"]:["8","7","6","5","4","3","2","1"];
    const files=flipped?["h","g","f","e","d","c","b","a"]:["a","b","c","d","e","f","g","h"];
    for(let i=0;i<8;i++){
      ctx.textAlign="left"; ctx.textBaseline="top";
      ctx.fillText(ranks[i],2,i*cs+2);
      ctx.textAlign="right"; ctx.textBaseline="bottom";
      ctx.fillText(files[i],(i+1)*cs-2,8*cs-2);
    }
  }, [vsAI, playerColor]);

  useEffect(() => { if(mode==="playing") draw(gameState, selected, legalFrom); }, [gameState, selected, legalFrom, mode, draw]);

  const startGame = useCallback(() => {
    const s = CE.initial();
    setGameState(s); setSelected(null); setLegalFrom([]); setThinking(false);
    setResultRecorded(false); setShowResult(false);
    aiPending.current = false;
    setMode("playing");
  }, []);

  const recordResult = useCallback((s:CE.CState) => {
    if(resultRecorded||!vsAI) return;
    setResultRecorded(true);
    if(s.status==="checkmate"){
      const loser=s.turn; // the one in checkmate
      if(loser===playerColor) recordLoss(); else recordWin();
    } else { recordDraw(); }
  }, [resultRecorded, vsAI, playerColor, recordWin, recordLoss, recordDraw]);

  const triggerAI = useCallback((s:CE.CState) => {
    if(aiPending.current) return;
    aiPending.current=true; setThinking(true);
    const depth=DEPTHS[difficulty]; const tl=[800,1500,2500][difficulty];
    setTimeout(()=>{
      const m=CE.aiMove(s,depth,tl);
      aiPending.current=false; setThinking(false);
      if(m){
        const next=CE.applyLegal(s,m);
        setGameState(next);
        if(next.status!=="playing"&&next.status!=="check"){
          recordResult(next); setShowResult(true);
        }
      }
    },50);
  }, [difficulty, recordResult]);

  useEffect(()=>{
    if(mode!=="playing") return;
    if(gameState.status==="checkmate"||gameState.status==="stalemate"||gameState.status==="draw"){
      if(!resultRecorded){ recordResult(gameState); setShowResult(true); }
      return;
    }
    if(vsAI&&gameState.turn!==playerColor&&!thinking&&!aiPending.current){
      triggerAI(gameState);
    }
  },[gameState, mode]);

  const handleCanvas = useCallback((cx:number,cy:number) => {
    if(mode!=="playing") return;
    if(gameState.status!=="playing"&&gameState.status!=="check"){ setShowResult(true); return; }
    if(thinking||(vsAI&&gameState.turn!==playerColor)) return;
    const flipped=vsAI&&playerColor==="b";
    const sq=squareForXY(cx,cy,flipped);
    if(sq<0) return;
    if(selected===null){
      const p=gameState.board[sq];
      if(p&&p.c===gameState.turn){
        const lm=CE.movesFrom(gameState,sq);
        setSelected(sq); setLegalFrom(lm);
      }
    } else {
      // try to move
      const moves=legalFrom.filter(m=>m.to===sq);
      if(moves.length){
        const promos=moves.filter(m=>m.promo);
        if(promos.length){ setPromoInfo({from:selected,to:sq}); return; }
        const next=CE.applyLegal(gameState,moves[0]);
        setGameState(next); setSelected(null); setLegalFrom([]);
        if(next.status==="checkmate"||next.status==="stalemate"||next.status==="draw"){
          recordResult(next); setShowResult(true);
        } else if(vsAI&&next.turn!==playerColor){ triggerAI(next); }
      } else {
        const p=gameState.board[sq];
        if(p&&p.c===gameState.turn){ const lm=CE.movesFrom(gameState,sq); setSelected(sq); setLegalFrom(lm); }
        else { setSelected(null); setLegalFrom([]); }
      }
    }
  }, [mode,gameState,selected,legalFrom,vsAI,playerColor,thinking,squareForXY,recordResult,triggerAI]);

  const canvasClick = (e:React.MouseEvent<HTMLCanvasElement>) => {
    const r=canvasRef.current!.getBoundingClientRect();
    const scaleX=canvasRef.current!.width/r.width;
    const scaleY=canvasRef.current!.height/r.height;
    handleCanvas((e.clientX-r.left)*scaleX,(e.clientY-r.top)*scaleY);
  };
  const canvasTouch = (e:React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const t=e.changedTouches[0];
    const r=canvasRef.current!.getBoundingClientRect();
    const scaleX=canvasRef.current!.width/r.width;
    const scaleY=canvasRef.current!.height/r.height;
    handleCanvas((t.clientX-r.left)*scaleX,(t.clientY-r.top)*scaleY);
  };

  const undo = () => {/* simplified – restart */};
  const statusText = () => {
    if(thinking) return "AI thinking…";
    if(gameState.status==="check") return `${gameState.turn==="w"?"White":"Black"} in check`;
    if(gameState.status==="checkmate") return "Checkmate!";
    if(gameState.status==="stalemate") return "Stalemate";
    if(gameState.status==="draw") return "Draw";
    const mine=vsAI&&gameState.turn===playerColor;
    return mine?"Your turn":`${gameState.turn==="w"?"White":"Black"} to move`;
  };

  const diffLabel = ["Easy","Medium","Hard"][difficulty];
  void stats; void undo;

  return (
    <div className="game-wrap">
      {/* HUD */}
      <div className="game-hud">
        <button className="hud-btn" onClick={()=>go("/")}>← Back</button>
        <div style={{textAlign:"center"}}>
          <div className="turn-label">{statusText()}</div>
          {thinking&&<div className="thinking">● thinking</div>}
        </div>
        <button className="hud-btn" onClick={()=>setMode("menu")}>Menu</button>
      </div>

      {/* Board */}
      <div className="board-area">
        <canvas
          ref={canvasRef}
          width={400} height={400}
          style={{maxWidth:"100%",maxHeight:"100%",cursor:"pointer",borderRadius:4}}
          onClick={canvasClick}
          onTouchEnd={canvasTouch}
        />
      </div>

      {/* Status bar */}
      <div className="status-bar">
        <span>♟ Chess</span>
        {vsAI&&<span>AI: {diffLabel}</span>}
        <span>{gameState.turn==="w"?"White":"Black"} to move</span>
      </div>

      {/* Mode dialog */}
      {(mode==="menu"||mode==="color") && (
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

      {/* Promotion dialog */}
      {promoInfo&&(
        <div className="modal-overlay">
          <div className="modal">
            <h2>Promote pawn</h2>
            {(["Q","R","B","N"] as CE.PType[]).map(pt=>(
              <button key={pt} className="modal-btn" style={{fontSize:"1.4rem",textAlign:"center"}} onClick={()=>{
                const m=CE.movesFrom(gameState,promoInfo.from).find(x=>x.to===promoInfo.to&&x.promo===pt)!;
                const next=CE.applyLegal(gameState,m);
                setGameState(next); setSelected(null); setLegalFrom([]); setPromoInfo(null);
                if(next.status==="checkmate"||next.status==="stalemate"||next.status==="draw"){
                  recordResult(next); setShowResult(true);
                } else if(vsAI&&next.turn!==playerColor) triggerAI(next);
              }}>
                {SYMBOLS[(gameState.turn)+pt]} {pt==="Q"?"Queen":pt==="R"?"Rook":pt==="B"?"Bishop":"Knight"}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Result dialog */}
      {showResult&&(
        <div className="modal-overlay">
          <div className="modal">
            <h2>Game Over</h2>
            <p style={{color:"var(--muted)",marginBottom:16,textAlign:"center"}}>
              {gameState.status==="checkmate"?(gameState.turn===(vsAI?playerColor:"w")?"You lose! Checkmate.":"You win! Checkmate.")
               :gameState.status==="stalemate"?"Stalemate — it's a draw!"
               :"Draw!"}
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
