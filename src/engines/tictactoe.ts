// Tic-Tac-Toe engine — variable size, variable win length
export type TColor = 1|2; // 1=X, 2=O
export interface TState {
  board: (0|1|2)[];
  size: number;
  winLen: number;
  turn: TColor;
  status: "playing"|"win_x"|"win_o"|"draw";
  winLine?: number[];
}

export function winLenFor(size:number):number {
  if(size<=3) return 3;
  if(size===4) return 4;
  if(size===5) return 4;
  return 5; // 6,7
}

export function initial(size:number):TState {
  return { board:Array(size*size).fill(0), size, winLen:winLenFor(size), turn:1, status:"playing" };
}

function checkWin(board:(0|1|2)[],size:number,winLen:number,color:TColor):{won:boolean,line:number[]} {
  const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  for(let r=0;r<size;r++) for(let f=0;f<size;f++) {
    const s=r*size+f;
    if(board[s]!==color) continue;
    for(const[dr,df] of dirs){
      const line=[s];
      for(let k=1;k<winLen;k++){
        const r2=r+dr*k,f2=f+df*k;
        if(r2<0||r2>=size||f2<0||f2>=size) break;
        const s2=r2*size+f2;
        if(board[s2]!==color) break;
        line.push(s2);
      }
      if(line.length===winLen) return {won:true,line};
    }
  }
  return {won:false,line:[]};
}

export function applyMove(state:TState, sq:number):TState {
  if(state.board[sq]||state.status!=="playing") return state;
  const b=[...state.board] as (0|1|2)[];
  b[sq]=state.turn;
  const{won,line}=checkWin(b,state.size,state.winLen,state.turn);
  if(won) return {...state,board:b,status:state.turn===1?"win_x":"win_o",winLine:line,turn:state.turn===1?2:1};
  if(b.every(x=>x!==0)) return {...state,board:b,status:"draw",turn:state.turn===1?2:1};
  // Early draw detection: check if any win line is still achievable for either player
  if(!canWin(b,state.size,state.winLen)) return {...state,board:b,status:"draw",turn:state.turn===1?2:1};
  return {...state,board:b,turn:state.turn===1?2:1};
}

function canWin(board:(0|1|2)[],size:number,winLen:number):boolean {
  const dirs=[[0,1],[1,0],[1,1],[1,-1]];
  for(let c of[1,2] as TColor[]){
    for(let r=0;r<size;r++) for(let f=0;f<size;f++){
      for(const[dr,df] of dirs){
        let can=true;
        for(let k=0;k<winLen;k++){
          const r2=r+dr*k,f2=f+df*k;
          if(r2<0||r2>=size||f2<0||f2>=size){can=false;break;}
          const v=board[r2*size+f2];
          if(v!==0&&v!==c){can=false;break;}
        }
        if(can) return true;
      }
    }
  }
  return false;
}

function minimax(board:(0|1|2)[],size:number,winLen:number,turn:TColor,alpha:number,beta:number,depth:number):number {
  const{won:w1}=checkWin(board,size,winLen,1);
  if(w1) return 10-depth;
  const{won:w2}=checkWin(board,size,winLen,2);
  if(w2) return depth-10;
  if(board.every(x=>x)) return 0;
  if(!canWin(board,size,winLen)) return 0;
  if(depth<=0) return 0;
  const empties=board.map((_,i)=>i).filter(i=>board[i]===0);
  if(turn===1){
    let best=-Infinity;
    for(const s of empties){
      board[s]=1;
      const v=minimax(board,size,winLen,2,alpha,beta,depth-1);
      board[s]=0;
      best=Math.max(best,v); alpha=Math.max(alpha,v);
      if(beta<=alpha) break;
    }
    return best;
  } else {
    let best=Infinity;
    for(const s of empties){
      board[s]=2;
      const v=minimax(board,size,winLen,1,alpha,beta,depth-1);
      board[s]=0;
      best=Math.min(best,v); beta=Math.min(beta,v);
      if(beta<=alpha) break;
    }
    return best;
  }
}

function maxDepthFor(size:number):number {
  if(size<=3) return 9;
  if(size===4) return 5;
  if(size===5) return 4;
  return 3;
}

export function aiMove(state:TState):number|null {
  const empties=state.board.map((_,i)=>i).filter(i=>state.board[i]===0);
  if(!empties.length) return null;
  const b=[...state.board] as (0|1|2)[];
  let best=empties[0]; let bestVal=state.turn===1?-Infinity:Infinity;
  const depth=maxDepthFor(state.size);
  const maxing=state.turn===1;
  for(const s of empties){
    b[s]=state.turn;
    const v=minimax(b,state.size,state.winLen,state.turn===1?2:1,-Infinity,Infinity,depth-1);
    b[s]=0;
    if(maxing?v>bestVal:v<bestVal){bestVal=v;best=s;}
  }
  return best;
}
