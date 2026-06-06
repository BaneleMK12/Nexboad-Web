// Othello (Reversi) engine
export type OColor = 1 | 2; // 1=black, 2=white
export interface OState {
  board: (0|1|2)[];   // 64 squares
  turn: OColor;
  passed: boolean;    // true if previous turn was forced pass
  status: "playing"|"win_black"|"win_white"|"draw";
}

const DIRS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
const rank=(s:number)=>s>>3;
const file=(s:number)=>s&7;
const sq=(r:number,f:number)=>r*8+f;

export function initial():OState {
  const board=(Array(64).fill(0)) as (0|1|2)[];
  board[sq(3,3)]=2; board[sq(3,4)]=1;
  board[sq(4,3)]=1; board[sq(4,4)]=2;
  return {board,turn:1,passed:false,status:"playing"};
}

export function validMoves(board:(0|1|2)[],turn:OColor):number[] {
  const opp:OColor=turn===1?2:1;
  const moves:number[]=[];
  for(let s=0;s<64;s++){
    if(board[s]!==0) continue;
    let valid=false;
    for(const[dr,df]of DIRS){
      let r=rank(s)+dr,f=file(s)+df;
      let count=0;
      while(r>=0&&r<8&&f>=0&&f<8&&board[sq(r,f)]===opp){r+=dr;f+=df;count++;}
      if(count>0&&r>=0&&r<8&&f>=0&&f<8&&board[sq(r,f)]===turn){valid=true;break;}
    }
    if(valid) moves.push(s);
  }
  return moves;
}

export function applyMove(state:OState, s:number):OState {
  const b=[...state.board] as (0|1|2)[];
  const turn=state.turn; const opp:OColor=turn===1?2:1;
  b[s]=turn;
  for(const[dr,df]of DIRS){
    const toFlip:number[]=[];
    let r=rank(s)+dr,f=file(s)+df;
    while(r>=0&&r<8&&f>=0&&f<8&&b[sq(r,f)]===opp){toFlip.push(sq(r,f));r+=dr;f+=df;}
    if(toFlip.length&&r>=0&&r<8&&f>=0&&f<8&&b[sq(r,f)]===turn){
      for(const fs of toFlip) b[fs]=turn;
    }
  }
  const nextTurn:OColor=turn===1?2:1;
  const nextMoves=validMoves(b,nextTurn);
  if(!nextMoves.length){
    const nextNextMoves=validMoves(b,turn);
    if(!nextNextMoves.length) return finalState({board:b,turn:nextTurn,passed:false,status:"playing"});
    return {board:b,turn,passed:true,status:"playing"};
  }
  return {board:b,turn:nextTurn,passed:false,status:"playing"};
}

function finalState(state:OState):OState {
  let b1=0,b2=0;
  for(const x of state.board){if(x===1)b1++;else if(x===2)b2++;}
  const status=b1>b2?"win_black":b2>b1?"win_white":"draw";
  return {...state,status};
}

// Stability corners heuristic
const WEIGHTS=[
  4,-3,2,2,2,2,-3,4,
  -3,-4,-1,-1,-1,-1,-4,-3,
  2,-1,1,0,0,1,-1,2,
  2,-1,0,1,1,0,-1,2,
  2,-1,0,1,1,0,-1,2,
  2,-1,1,0,0,1,-1,2,
  -3,-4,-1,-1,-1,-1,-4,-3,
  4,-3,2,2,2,2,-3,4
];

function evaluate(board:(0|1|2)[],turn:OColor):number {
  let score=0;
  for(let i=0;i<64;i++){
    if(board[i]===1) score+=WEIGHTS[i];
    else if(board[i]===2) score-=WEIGHTS[i];
  }
  // mobility bonus
  const m1=validMoves(board,1).length;
  const m2=validMoves(board,2).length;
  score+=(m1-m2)*5;
  return turn===1?score:-score;
}

function minimax(board:(0|1|2)[],turn:OColor,depth:number,alpha:number,beta:number):number {
  const moves=validMoves(board,turn);
  if(depth===0||!moves.length) return evaluate(board,turn);
  let best=-Infinity;
  const opp:OColor=turn===1?2:1;
  for(const s of moves){
    const nb=[...board] as (0|1|2)[];
    nb[s]=turn;
    for(const[dr,df]of DIRS){
      const toFlip:number[]=[];
      let r=rank(s)+dr,f=file(s)+df;
      while(r>=0&&r<8&&f>=0&&f<8&&nb[sq(r,f)]===opp){toFlip.push(sq(r,f));r+=dr;f+=df;}
      if(toFlip.length&&r>=0&&r<8&&f>=0&&f<8&&nb[sq(r,f)]===turn){for(const fs of toFlip)nb[fs]=turn;}
    }
    const v=-minimax(nb,opp,depth-1,-beta,-alpha);
    best=Math.max(best,v); alpha=Math.max(alpha,v);
    if(alpha>=beta) break;
  }
  return best;
}

export function aiMove(board:(0|1|2)[],turn:OColor,depth=5):number|null {
  const moves=validMoves(board,turn); if(!moves.length) return null;
  let best=moves[0], bestVal=-Infinity;
  const opp:OColor=turn===1?2:1;
  for(const s of moves){
    const nb=[...board] as (0|1|2)[];
    nb[s]=turn;
    for(const[dr,df]of DIRS){
      const toFlip:number[]=[];
      let r=rank(s)+dr,f=file(s)+df;
      while(r>=0&&r<8&&f>=0&&f<8&&nb[sq(r,f)]===opp){toFlip.push(sq(r,f));r+=dr;f+=df;}
      if(toFlip.length&&r>=0&&r<8&&f>=0&&f<8&&nb[sq(r,f)]===turn){for(const fs of toFlip)nb[fs]=turn;}
    }
    const v=-minimax(nb,opp,depth-1,-Infinity,Infinity);
    if(v>bestVal){bestVal=v;best=s;}
  }
  return best;
}
