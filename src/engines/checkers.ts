// Checkers engine — 8x8, mandatory captures, multi-jump, kinging
export type CkColor = "r"|"b";
export interface CkPiece { c:CkColor; king:boolean }
export interface CkMove {
  path: number[];        // sequence of squares visited (includes start)
  captured: number[];    // captured squares
}
export interface CkState {
  board: (CkPiece|null)[];  // 64 squares, only dark used
  turn: CkColor;
  status: "playing"|"win_r"|"win_b"|"draw";
  lastFrom: number; lastTo: number;
}

// Dark squares only: sq valid if (rank+file) is odd
const rank=(s:number)=>s>>3;
const file=(s:number)=>s&7;
const sq=(r:number,f:number)=>r*8+f;
const isDark=(s:number)=>(rank(s)+file(s))%2===1;

export function initial():CkState {
  const board:(CkPiece|null)[]=Array(64).fill(null);
  for(let r=0;r<3;r++) for(let f=0;f<8;f++) { if((r+f)%2===1) board[sq(r,f)]={c:"r",king:false}; }
  for(let r=5;r<8;r++) for(let f=0;f<8;f++) { if((r+f)%2===1) board[sq(r,f)]={c:"b",king:false}; }
  return {board,turn:"b",status:"playing",lastFrom:-1,lastTo:-1};
}

function jumpMoves(board:(CkPiece|null)[],s:number,piece:CkPiece,captured:Set<number>,path:number[]):CkMove[] {
  const r=rank(s),f=file(s);
  const dirs:number[][]=(piece.king||piece.c==="b")?[[1,-1],[1,1]]:[];
  if(piece.king||piece.c==="r") dirs.push([-1,-1],[-1,1]);
  // king can also go fwd
  if(piece.king){ dirs.push([1,-1],[1,1],[-1,-1],[-1,1]); }
  const results:CkMove[]=[];
  const seenDirs=new Set<string>();
  for(const[dr,df] of dirs){
    const dk=dr+","+df; if(seenDirs.has(dk))continue; seenDirs.add(dk);
    const r2=r+dr,f2=f+df;
    if(r2<0||r2>7||f2<0||f2>7)continue;
    const mid=sq(r2,f2);
    if(!board[mid]||board[mid]!.c===piece.c||captured.has(mid))continue;
    const r3=r2+dr,f3=f2+df;
    if(r3<0||r3>7||f3<0||f3>7)continue;
    const land=sq(r3,f3);
    if(board[land]&&!captured.has(land))continue;
    // valid jump
    const newCap=new Set([...captured,mid]);
    const newPath=[...path,land];
    const sub=jumpMoves(board,land,piece,newCap,newPath);
    if(sub.length) results.push(...sub);
    else results.push({path:newPath,captured:[...newCap]});
  }
  return results;
}

export function legalMoves(state:CkState):CkMove[] {
  if(state.status!=="playing") return [];
  const b=state.board; const c=state.turn;
  // must capture if possible
  const jumps:CkMove[]=[];
  const slides:CkMove[]=[];
  for(let s=0;s<64;s++){
    if(!isDark(s))continue;
    const p=b[s]; if(!p||p.c!==c)continue;
    const r=rank(s),f=file(s);
    // jumps
    const js=jumpMoves(b,s,p,new Set(),[s]);
    if(js.length) jumps.push(...js);
    // slides
    const dirs:number[][]=(p.king||p.c==="b")?[[1,-1],[1,1]]:[];
    if(p.king||p.c==="r") dirs.push([-1,-1],[-1,1]);
    for(const[dr,df] of dirs){
      const r2=r+dr,f2=f+df;
      if(r2<0||r2>7||f2<0||f2>7)continue;
      const to=sq(r2,f2);
      if(!b[to]) slides.push({path:[s,to],captured:[]});
    }
  }
  return jumps.length?jumps:slides;
}

export function movesFrom(state:CkState,from:number):CkMove[] {
  return legalMoves(state).filter(m=>m.path[0]===from);
}

export function applyMove(state:CkState,m:CkMove):CkState {
  const b=[...state.board];
  const from=m.path[0]; const to=m.path[m.path.length-1];
  const p={...b[from]!};
  // remove captured
  for(const cs of m.captured) b[cs]=null;
  b[from]=null;
  // king promotion
  if(!p.king&&(p.c==="r"&&rank(to)===0||p.c==="b"&&rank(to)===7)) p.king=true;
  b[to]=p;
  const turn:CkColor=state.turn==="r"?"b":"r";
  const next:CkState={board:b,turn,status:"playing",lastFrom:from,lastTo:to};
  return updateStatus(next);
}

function updateStatus(state:CkState):CkState {
  const rCount=state.board.filter(p=>p&&p.c==="r").length;
  const bCount=state.board.filter(p=>p&&p.c==="b").length;
  if(!rCount) return {...state,status:"win_b"};
  if(!bCount) return {...state,status:"win_r"};
  if(!legalMoves(state).length) return {...state,status:state.turn==="r"?"win_b":"win_r"};
  return state;
}

function evaluate(state:CkState):number {
  let score=0;
  for(let s=0;s<64;s++){
    const p=state.board[s]; if(!p) continue;
    const v=(p.king?3:1)*(p.c==="b"?1:-1);
    score+=v;
  }
  return score;
}

function alphabeta(state:CkState,depth:number,alpha:number,beta:number,maxing:boolean):number {
  if(depth===0||state.status!=="playing"){
    if(state.status==="win_b") return 10000;
    if(state.status==="win_r") return -10000;
    return evaluate(state);
  }
  const moves=legalMoves(state);
  if(!moves.length) return evaluate(state);
  if(maxing){
    let best=-Infinity;
    for(const m of moves){
      const v=alphabeta(applyMove(state,m),depth-1,alpha,beta,false);
      best=Math.max(best,v); alpha=Math.max(alpha,best);
      if(beta<=alpha) break;
    }
    return best;
  } else {
    let best=Infinity;
    for(const m of moves){
      const v=alphabeta(applyMove(state,m),depth-1,alpha,beta,true);
      best=Math.min(best,v); beta=Math.min(beta,best);
      if(beta<=alpha) break;
    }
    return best;
  }
}

export function aiMove(state:CkState,depth:number):CkMove|null {
  const moves=legalMoves(state); if(!moves.length) return null;
  const maxing=state.turn==="b";
  let best=moves[0], bestVal=maxing?-Infinity:Infinity;
  for(const m of moves){
    const v=alphabeta(applyMove(state,m),depth-1,-Infinity,Infinity,!maxing);
    if(maxing?v>bestVal:v<bestVal){bestVal=v;best=m;}
  }
  return best;
}
