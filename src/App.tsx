import { Switch, Route, Router as WouterRouter } from "wouter";
import Home from "@/pages/Home";
import Chess from "@/pages/Chess";
import Checkers from "@/pages/Checkers";
import Othello from "@/pages/Othello";
import Morabaraba from "@/pages/Morabaraba";
import TicTacToe from "@/pages/TicTacToe";

function Router() {
  return (
    <Switch>
      <Route path="/"           component={Home} />
      <Route path="/chess"      component={Chess} />
      <Route path="/checkers"   component={Checkers} />
      <Route path="/othello"    component={Othello} />
      <Route path="/morabaraba" component={Morabaraba} />
      <Route path="/tictactoe"  component={TicTacToe} />
    </Switch>
  );
}

export default function App() {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  return (
    <WouterRouter base={base}>
      <Router />
    </WouterRouter>
  );
}
