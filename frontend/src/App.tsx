import { Navigate, Route, Routes } from "react-router-dom";
import { getToken } from "./lib/api";
import { Login } from "./routes/Login";
import { FindGroup } from "./routes/FindGroup";
import { Room } from "./routes/Room";
import { Board } from "./routes/Board";

function Guard({ children }: { children: JSX.Element }) {
  return getToken() ? children : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/find"
        element={
          <Guard>
            <FindGroup />
          </Guard>
        }
      />
      <Route
        path="/room/:sid"
        element={
          <Guard>
            <Room />
          </Guard>
        }
      />
      <Route
        path="/board"
        element={
          <Guard>
            <Board />
          </Guard>
        }
      />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
