// Morabaraba engine — 24-node board, 3 phases, mills
export type MColor = "w"|"b";
export interface MState {
  board: (MColor|null)[];  // 24 nodes
  turn: MColor;
  placed: [number,number]; // [white placed, black placed]
  pieceCnt: number;        // pieces each starts with (6,9,12)
  status: "playing"|"win_w"|"win_b";
  phase: "place"|"move"|"fly";
  pendingRemove: boolean;   // must remove opponent piece after mill
  lastFrom: number; lastTo: number;
}

// 24-node topology: 3 rings of 8 nodes each
// Outer ring: 0-7, Middle: 8-15, Inner: 16-23
// Layout (row,col) for rendering (6x6 grid with specific positions)
export const NODE_POS:[number,number][] = [
  [0,0],[0,3],[0,6],[3,6],[6,6],[6,3],[6,0],[3,0],  // outer 0-7
  [1,1],[1,3],[1,5],[3,5],[5,5],[5,3],[5,1],[3,1],  // middle 8-15
  [2,2],[2,3],[2,4],[3,4],[4,4],[4,3],[4,2],[3,2],  // inner 16-23
];

// Adjacency
const ADJ:[number,number[]][] = [
  [0,[1,7,8]],[1,[0,2,9]],[2,[1,3,10]],[3,[2,4,11]],
  [4,[3,5,12]],[5,[4,6,13]],[6,[5,7,14]],[7,[6,0,15]],
  [8,[0,9,15,16]],[9,[1,8,10,17]],[10,[2,9,11,18]],[11,[3,10,12,19]],
  [12,[4,11,13,20]],[13,[5,12,14,21]],[14,[6,13,15,22]],[15,[7,14,8,23]],
  [16,[8,17,23]],[17,[9,16,18]],[18,[10,17,19]],[19,[11,18,20]],
  [20,[12,19,21]],[21,[13,20,22]],[22,[14,21,23]],[23,[15,22,16]],
];
export const ADJACENCY: number[][] = Array(24).fill(null).map((_,i)=>ADJ.find(a=>a[0]===i)![1]);

// Mills: all possible sets of 3 aligned nodes
export const MILLS: number[][] = [
  [0,1,2],[2,3,4],[4,5,6],[6,7,0],  // outer ring
  [8,9,10],[10,11,12],[12,13,14],[14,15,8],  // middle ring
  [16,17,18],[18,19,20],[20,21,22],[22,23,16],  // inner ring
  [1,9,17],[3,11,19],[5,13,21],[7,15,23],  // radials
  [0,8,16],[2,10,18],[4,12,20],[6,14,22],  // corner radials
];

export function initial(pieceCnt=12):MState {
  return {
    board: Array(24).fill(null),
    turn:"w", placed:[0,0], pieceCnt,
    status:"playing", phase:"place",
    pendingRemove:false, lastFrom:-1, lastTo:-1,
  };
}

function inMill(board:(MColor|null)[], node:number, color:MColor):boolean {
  return MILLS.some(m=>m.includes(node)&&m.every(n=>board[n]===color));
}

function newMill(prev:(MColor|null)[], next:(MColor|null)[], node:number, color:MColor):boolean {
  return !inMill(prev,node,color)&&inMill(next,node,color);
}

export function applyPlace(state:MState, node:number):MState {
  if(state.board[node]||state.phase!=="place") return state;
  const b=[...state.board]; b[node]=state.turn;
  const placed:[number,number]=[...state.placed] as [number,number];
  const idx=state.turn==="w"?0:1; placed[idx]++;
  const opp:MColor=state.turn==="w"?"b":"w";
  const mill=inMill(b,node,state.turn);
  const bothDone=placed[0]>=state.pieceCnt&&placed[1]>=state.pieceCnt;
  const phase:MState["phase"]=bothDone?"move":"place";
  return {
    ...state, board:b, placed,
    phase, pendingRemove:mill,
    turn:mill?state.turn:opp,
    lastFrom:-1, lastTo:node,
  };
}

export function applyMoveNode(state:MState, from:number, to:number):MState {
  if(state.board[from]!==state.turn||state.board[to]) return state;
  // fly: any empty node; move: adjacent only
  const canFly=state.board.filter(x=>x===state.turn).length<=3;
  if(!canFly&&!ADJACENCY[from].includes(to)) return state;
  const b=[...state.board]; b[to]=state.turn; b[from]=null;
  const opp:MColor=state.turn==="w"?"b":"w";
  const mill=inMill(b,to,state.turn);
  return {
    ...state, board:b, pendingRemove:mill,
    turn:mill?state.turn:opp,
    lastFrom:from, lastTo:to,
  };
}

export function applyRemove(state:MState, node:number):MState {
  const opp:MColor=state.turn==="w"?"b":"w";
  if(state.board[node]!==opp) return state;
  // can't remove from mill unless all opponent pieces in mills
  const oppPieces=state.board.map((v,i)=>v===opp?i:-1).filter(i=>i>=0);
  const allInMill=oppPieces.every(n=>inMill(state.board,n,opp));
  if(inMill(state.board,node,opp)&&!allInMill) return state;
  const b=[...state.board]; b[node]=null;
  const next={...state, board:b, pendingRemove:false, turn:opp, lastFrom:state.lastTo, lastTo:node};
  return checkWin(next);
}

function checkWin(state:MState):MState {
  if(state.phase==="place") return state;
  const wCnt=state.board.filter(x=>x==="w").length;
  const bCnt=state.board.filter(x=>x==="b").length;
  if(wCnt<3) return {...state,status:"win_b"};
  if(bCnt<3) return {...state,status:"win_w"};
  // check if current player has moves
  const moves=getMoves(state);
  if(!moves.length) return {...state,status:state.turn==="w"?"win_b":"win_w"};
  return state;
}

export function getMoves(state:MState):{from:number,to:number}[] {
  if(state.pendingRemove||state.status!=="playing") return [];
  if(state.phase==="place"){
    return state.board.map((v,i)=>v===null?{from:-1,to:i}:null).filter(Boolean) as {from:number,to:number}[];
  }
  const canFly=state.board.filter(x=>x===state.turn).length<=3;
  const moves:{from:number,to:number}[]=[];
  for(let i=0;i<24;i++){
    if(state.board[i]!==state.turn)continue;
    const targets=canFly?state.board.map((_,j)=>j).filter(j=>!state.board[j]):ADJACENCY[i].filter(j=>!state.board[j]);
    for(const t of targets) moves.push({from:i,to:t});
  }
  return moves;
}

function evalState(state:MState):number {
  if(state.status==="win_w") return 10000;
  if(state.status==="win_b") return -10000;
  const w=state.board.filter(x=>x==="w").length;
  const b=state.board.filter(x=>x==="b").length;
  let score=(w-b)*10;
  // mobility
  const wm=state.turn==="w"?getMoves(state).length:getMoves({...state,turn:"w"}).length;
  const bm=state.turn==="b"?getMoves(state).length:getMoves({...state,turn:"b"}).length;
  score+=(wm-bm)*2;
  return score;
}

function cloneForColor(state:MState, turn:MColor):MState { return {...state,turn,pendingRemove:false}; }

function alphaBeta(state:MState, depth:number, alpha:number, beta:number, maxing:boolean):number {
  if(depth===0||state.status!=="playing") return evalState(state);
  const moves=getMoves(state);
  if(!moves.length) return evalState(state);
  if(maxing){
    let best=-Infinity;
    for(const m of moves){
      const next=state.phase==="place"?applyPlace(state,m.to):applyMoveNode(state,m.from,m.to);
      const v=alphaBeta(next,depth-1,alpha,beta,false);
      best=Math.max(best,v); alpha=Math.max(alpha,v);
      if(beta<=alpha) break;
    }
    return best;
  } else {
    let best=Infinity;
    for(const m of moves){
      const next=state.phase==="place"?applyPlace(state,m.to):applyMoveNode(state,m.from,m.to);
      const v=alphaBeta(next,depth-1,alpha,beta,true);
      best=Math.min(best,v); beta=Math.min(beta,v);
      if(beta<=alpha) break;
    }
    return best;
  }
}

export function aiMove(state:MState,depth=4):{from:number,to:number,remove?:number}|null {
  if(state.pendingRemove){
    // choose best removal
    const opp:MColor=state.turn==="w"?"b":"w";
    const oppPieces=state.board.map((v,i)=>v===opp?i:-1).filter(i=>i>=0);
    const allInMill=oppPieces.every(n=>inMill(state.board,n,opp));
    const candidates=oppPieces.filter(n=>!inMill(state.board,n,opp)||allInMill);
    if(!candidates.length) return null;
    // pick piece that removes most threats
    let best=candidates[0];
    let bestScore=-Infinity;
    for(const c of candidates){
      const next=applyRemove(state,c);
      const v=evalState(next);
      if((state.turn==="w"?v:-v)>bestScore){bestScore=(state.turn==="w"?v:-v);best=c;}
    }
    return {from:-1,to:-1,remove:best};
  }
  const moves=getMoves(state);
  if(!moves.length) return null;
  const maxing=state.turn==="w";
  let bestMove=moves[0], bestVal=maxing?-Infinity:Infinity;
  for(const m of moves){
    const next=state.phase==="place"?applyPlace(state,m.to):applyMoveNode(state,m.from,m.to);
    const v=alphaBeta(next,depth-1,-Infinity,Infinity,!maxing);
    if(maxing?v>bestVal:v<bestVal){bestVal=v;bestMove=m;}
  }
  return bestMove;
}
