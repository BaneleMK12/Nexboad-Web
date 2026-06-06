// Full Chess engine — legal moves, alpha-beta AI with PSTs
export type Color = "w" | "b";
export type PType = "P"|"N"|"B"|"R"|"Q"|"K";
export interface Piece { t: PType; c: Color }
export interface CMove {
  from: number; to: number;
  promo?: PType;
  castle?: "K"|"Q";
  ep?: boolean;
  capSq?: number;
}
export interface CState {
  board: (Piece|null)[];
  turn: Color;
  castle: { wK:boolean; wQ:boolean; bK:boolean; bQ:boolean };
  ep: number|null;
  half: number;
  full: number;
  status: "playing"|"check"|"checkmate"|"stalemate"|"draw";
  lastFrom: number; lastTo: number;
}

// Rank 0 = rank 1 (bottom, white side), file 0 = a
const rank = (sq:number) => sq >> 3;
const file = (sq:number) => sq & 7;
const sq = (r:number,f:number) => r*8+f;
const opp = (c:Color):Color => c==="w"?"b":"w";

export function initial(): CState {
  const b: (Piece|null)[] = Array(64).fill(null);
  const back: PType[] = ["R","N","B","Q","K","B","N","R"];
  for (let f=0;f<8;f++) {
    b[sq(0,f)] = { t:back[f], c:"w" };
    b[sq(1,f)] = { t:"P", c:"w" };
    b[sq(6,f)] = { t:"P", c:"b" };
    b[sq(7,f)] = { t:back[f], c:"b" };
  }
  return { board:b, turn:"w",
    castle:{wK:true,wQ:true,bK:true,bQ:true},
    ep:null, half:0, full:1,
    status:"playing", lastFrom:-1, lastTo:-1 };
}

function isAttacked(board:(Piece|null)[], s:number, by:Color):boolean {
  // pawns
  const pDir = by==="w"?1:-1;
  const pr = rank(s)-pDir; const pf = file(s);
  if (pr>=0&&pr<8) {
    for (const df of [-1,1]) { const ff=pf+df; if(ff>=0&&ff<8){ const p=board[sq(pr,ff)]; if(p&&p.t==="P"&&p.c===by) return true; } }
  }
  // knights
  for (const [dr,df] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
    const r2=rank(s)+dr, f2=file(s)+df;
    if(r2>=0&&r2<8&&f2>=0&&f2<8){const p=board[sq(r2,f2)];if(p&&p.t==="N"&&p.c===by)return true;}
  }
  // king
  for(let dr=-1;dr<=1;dr++) for(let df=-1;df<=1;df++) { if(!dr&&!df)continue; const r2=rank(s)+dr,f2=file(s)+df; if(r2>=0&&r2<8&&f2>=0&&f2<8){const p=board[sq(r2,f2)];if(p&&p.t==="K"&&p.c===by)return true;} }
  // sliding
  for(const[dr,df]of[[0,1],[0,-1],[1,0],[-1,0]]) {
    let r2=rank(s)+dr,f2=file(s)+df;
    while(r2>=0&&r2<8&&f2>=0&&f2<8){
      const p=board[sq(r2,f2)];
      if(p){if(p.c===by&&(p.t==="R"||p.t==="Q"))return true;break;}
      r2+=dr;f2+=df;
    }
  }
  for(const[dr,df]of[[1,1],[1,-1],[-1,1],[-1,-1]]) {
    let r2=rank(s)+dr,f2=file(s)+df;
    while(r2>=0&&r2<8&&f2>=0&&f2<8){
      const p=board[sq(r2,f2)];
      if(p){if(p.c===by&&(p.t==="B"||p.t==="Q"))return true;break;}
      r2+=dr;f2+=df;
    }
  }
  return false;
}

function kingSquare(board:(Piece|null)[], c:Color):number {
  for(let i=0;i<64;i++){const p=board[i];if(p&&p.t==="K"&&p.c===c)return i;}
  return -1;
}

function pseudoMoves(state:CState, c:Color):CMove[] {
  const moves:CMove[]=[]; const b=state.board;
  for(let from=0;from<64;from++){
    const p=b[from]; if(!p||p.c!==c) continue;
    const r=rank(from),f=file(from);
    if(p.t==="P"){
      const dir=c==="w"?1:-1; const startR=c==="w"?1:6; const promR=c==="w"?7:0;
      // advance
      const r1=r+dir;
      if(r1>=0&&r1<8&&!b[sq(r1,f)]){
        const to=sq(r1,f);
        if(r1===promR){for(const pt of["Q","R","B","N"] as PType[])moves.push({from,to,promo:pt});}
        else{moves.push({from,to});
          // double push
          if(r===startR){const r2=r+2*dir;if(!b[sq(r2,f)])moves.push({from,to:sq(r2,f)});}
        }
      }
      // captures
      for(const df of[-1,1]){
        const f2=f+df; if(f2<0||f2>7)continue;
        const to=sq(r1,f2);
        if(b[to]&&b[to]!.c!==c){
          if(r1===promR){for(const pt of["Q","R","B","N"] as PType[])moves.push({from,to,promo:pt,capSq:to});}
          else moves.push({from,to,capSq:to});
        }
        // en passant
        if(state.ep===to) moves.push({from,to,ep:true,capSq:sq(r,f2)});
      }
    }
    else if(p.t==="N"){
      for(const[dr,df]of[[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]){
        const r2=r+dr,f2=f+df; if(r2<0||r2>7||f2<0||f2>7)continue;
        const to=sq(r2,f2); const tgt=b[to];
        if(!tgt||tgt.c!==c) moves.push({from,to,capSq:tgt?to:undefined});
      }
    }
    else if(p.t==="K"){
      for(let dr=-1;dr<=1;dr++)for(let df=-1;df<=1;df++){
        if(!dr&&!df)continue; const r2=r+dr,f2=f+df;
        if(r2<0||r2>7||f2<0||f2>7)continue;
        const to=sq(r2,f2); const tgt=b[to];
        if(!tgt||tgt.c!==c) moves.push({from,to,capSq:tgt?to:undefined});
      }
      // castling
      const homeR=c==="w"?0:7;
      if(r===homeR&&f===4&&!isAttacked(b,from,opp(c))){
        if((c==="w"?state.castle.wK:state.castle.bK)&&!b[sq(homeR,5)]&&!b[sq(homeR,6)]&&!isAttacked(b,sq(homeR,5),opp(c))&&!isAttacked(b,sq(homeR,6),opp(c)))
          moves.push({from,to:sq(homeR,6),castle:"K"});
        if((c==="w"?state.castle.wQ:state.castle.bQ)&&!b[sq(homeR,3)]&&!b[sq(homeR,2)]&&!b[sq(homeR,1)]&&!isAttacked(b,sq(homeR,3),opp(c))&&!isAttacked(b,sq(homeR,2),opp(c)))
          moves.push({from,to:sq(homeR,2),castle:"Q"});
      }
    }
    else {
      const dirs:number[][]=[];
      if(p.t==="R"||p.t==="Q") dirs.push([0,1],[0,-1],[1,0],[-1,0]);
      if(p.t==="B"||p.t==="Q") dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
      for(const[dr,df]of dirs){
        let r2=r+dr,f2=f+df;
        while(r2>=0&&r2<8&&f2>=0&&f2<8){
          const to=sq(r2,f2); const tgt=b[to];
          if(tgt){if(tgt.c!==c)moves.push({from,to,capSq:to});break;}
          moves.push({from,to}); r2+=dr;f2+=df;
        }
      }
    }
  }
  return moves;
}

function applyMove(state:CState, m:CMove):CState {
  const b=[...state.board];
  const p=b[m.from]!;
  const castle={...state.castle};
  let ep:number|null=null;
  let half=state.half+1;

  if(m.castle){
    const homeR=p.c==="w"?0:7;
    if(m.castle==="K"){b[sq(homeR,6)]=p;b[sq(homeR,4)]=null;b[sq(homeR,5)]=b[sq(homeR,7)];b[sq(homeR,7)]=null;}
    else{b[sq(homeR,2)]=p;b[sq(homeR,4)]=null;b[sq(homeR,3)]=b[sq(homeR,0)];b[sq(homeR,0)]=null;}
  } else {
    if(m.ep&&m.capSq!=null) b[m.capSq]=null;
    b[m.to]=m.promo?{t:m.promo,c:p.c}:p;
    b[m.from]=null;
    if(p.t==="P"){half=0; if(Math.abs(rank(m.to)-rank(m.from))===2) ep=sq((rank(m.from)+rank(m.to))>>1, file(m.from));}
    if(m.capSq!=null) half=0;
  }

  if(p.t==="K"){ if(p.c==="w"){castle.wK=false;castle.wQ=false;}else{castle.bK=false;castle.bQ=false;} }
  if(p.t==="R"){ const homeR=p.c==="w"?0:7; if(m.from===sq(homeR,0)){if(p.c==="w")castle.wQ=false;else castle.bQ=false;} if(m.from===sq(homeR,7)){if(p.c==="w")castle.wK=false;else castle.bK=false;} }

  const next:CState={board:b,turn:opp(p.c),castle,ep,half,full:state.full+(p.c==="b"?1:0),status:"playing",lastFrom:m.from,lastTo:m.to};
  return updateStatus(next);
}

function updateStatus(state:CState):CState {
  const legal=legalMoves(state);
  const inCheck=isAttacked(state.board,kingSquare(state.board,state.turn),opp(state.turn));
  if(legal.length===0) return {...state,status:inCheck?"checkmate":"stalemate"};
  if(inCheck) return {...state,status:"check"};
  if(state.half>=100) return {...state,status:"draw"};
  return state;
}

export function legalMoves(state:CState):CMove[] {
  if(state.status==="checkmate"||state.status==="stalemate"||state.status==="draw") return [];
  const pseudo=pseudoMoves(state,state.turn);
  return pseudo.filter(m=>{
    const next=applyMove({...state,status:"playing"},m);
    return !isAttacked(next.board,kingSquare(next.board,state.turn),opp(state.turn));
  });
}

export function movesFrom(state:CState,from:number):CMove[] {
  return legalMoves(state).filter(m=>m.from===from);
}

export function applyLegal(state:CState,m:CMove):CState {
  return applyMove(state,m);
}

// PSTs (from white's perspective, flipped for black)
const PAWN_PST=[
  0,0,0,0,0,0,0,0,
  50,50,50,50,50,50,50,50,
  10,10,20,30,30,20,10,10,
  5,5,10,25,25,10,5,5,
  0,0,0,20,20,0,0,0,
  5,-5,-10,0,0,-10,-5,5,
  5,10,10,-20,-20,10,10,5,
  0,0,0,0,0,0,0,0
];
const KNIGHT_PST=[
  -50,-40,-30,-30,-30,-30,-40,-50,
  -40,-20,0,0,0,0,-20,-40,
  -30,0,10,15,15,10,0,-30,
  -30,5,15,20,20,15,5,-30,
  -30,0,15,20,20,15,0,-30,
  -30,5,10,15,15,10,5,-30,
  -40,-20,0,5,5,0,-20,-40,
  -50,-40,-30,-30,-30,-30,-40,-50
];
const BISHOP_PST=[
  -20,-10,-10,-10,-10,-10,-10,-20,
  -10,0,0,0,0,0,0,-10,
  -10,0,5,10,10,5,0,-10,
  -10,5,5,10,10,5,5,-10,
  -10,0,10,10,10,10,0,-10,
  -10,10,10,10,10,10,10,-10,
  -10,5,0,0,0,0,5,-10,
  -20,-10,-10,-10,-10,-10,-10,-20
];
const ROOK_PST=[
  0,0,0,0,0,0,0,0,
  5,10,10,10,10,10,10,5,
  -5,0,0,0,0,0,0,-5,
  -5,0,0,0,0,0,0,-5,
  -5,0,0,0,0,0,0,-5,
  -5,0,0,0,0,0,0,-5,
  -5,0,0,0,0,0,0,-5,
  0,0,0,5,5,0,0,0
];
const QUEEN_PST=[
  -20,-10,-10,-5,-5,-10,-10,-20,
  -10,0,0,0,0,0,0,-10,
  -10,0,5,5,5,5,0,-10,
  -5,0,5,5,5,5,0,-5,
  0,0,5,5,5,5,0,-5,
  -10,5,5,5,5,5,0,-10,
  -10,0,5,0,0,0,0,-10,
  -20,-10,-10,-5,-5,-10,-10,-20
];
const KING_MID=[
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -30,-40,-40,-50,-50,-40,-40,-30,
  -20,-30,-30,-40,-40,-30,-30,-20,
  -10,-20,-20,-20,-20,-20,-20,-10,
  20,20,0,0,0,0,20,20,
  20,30,10,0,0,10,30,20
];

const PIECE_VAL:Record<PType,number>={P:100,N:320,B:330,R:500,Q:900,K:20000};

function pst(t:PType,r:number,f:number,c:Color):number {
  const idx=c==="w"?(7-r)*8+f:r*8+f;
  const tables:Partial<Record<PType,number[]>>={P:PAWN_PST,N:KNIGHT_PST,B:BISHOP_PST,R:ROOK_PST,Q:QUEEN_PST,K:KING_MID};
  return tables[t]?.[idx]??0;
}

export function evaluate(state:CState):number {
  if(state.status==="checkmate") return state.turn==="w"?-30000:30000;
  if(state.status==="stalemate"||state.status==="draw") return 0;
  let score=0;
  for(let i=0;i<64;i++){
    const p=state.board[i];if(!p)continue;
    const v=(PIECE_VAL[p.t]+pst(p.t,rank(i),file(i),p.c))*(p.c==="w"?1:-1);
    score+=v;
  }
  return score;
}

let aiStart=0;
let aiTimeLimit=0;

function orderMoves(moves:CMove[],b:(Piece|null)[]):CMove[] {
  return moves.sort((a,b_m)=>{
    const capA=a.capSq!=null?PIECE_VAL[(b[a.capSq]?.t??"P")]:0;
    const capB=b_m.capSq!=null?PIECE_VAL[(b[b_m.capSq]?.t??"P")]:0;
    return capB-capA;
  });
}

function alphabeta(state:CState,depth:number,alpha:number,beta:number,maxing:boolean):number {
  if(Date.now()-aiStart>aiTimeLimit) throw "timeout";
  if(depth===0||state.status!=="playing"&&state.status!=="check") return evaluate(state);
  const moves=orderMoves(legalMoves(state),state.board);
  if(moves.length===0) return evaluate(state);
  if(maxing){
    let best=-Infinity;
    for(const m of moves){
      const v=alphabeta(applyLegal(state,m),depth-1,alpha,beta,false);
      best=Math.max(best,v); alpha=Math.max(alpha,v);
      if(beta<=alpha) break;
    }
    return best;
  } else {
    let best=Infinity;
    for(const m of moves){
      const v=alphabeta(applyLegal(state,m),depth-1,alpha,beta,true);
      best=Math.min(best,v); beta=Math.min(beta,v);
      if(beta<=alpha) break;
    }
    return best;
  }
}

export function aiMove(state:CState, depth:number, timeLimitMs=2000): CMove|null {
  const moves=legalMoves(state); if(!moves.length) return null;
  aiStart=Date.now(); aiTimeLimit=timeLimitMs;
  const maxing=state.turn==="w";
  let bestMove=moves[0], bestVal=maxing?-Infinity:Infinity;
  // iterative deepening
  for(let d=1;d<=depth;d++){
    let iterBest=moves[0]; let iterVal=maxing?-Infinity:Infinity;
    try {
      for(const m of moves){
        const v=alphabeta(applyLegal(state,m),d-1,-Infinity,Infinity,!maxing);
        if(maxing?v>iterVal:v<iterVal){iterVal=v;iterBest=m;}
      }
      bestMove=iterBest; bestVal=iterVal;
    } catch { break; }
    if(Date.now()-aiStart>timeLimitMs*0.85) break;
  }
  void bestVal;
  return bestMove;
}
